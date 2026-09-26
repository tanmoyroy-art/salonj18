const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const crypto = require('crypto');

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// Get all active courses (public)
router.get('/public/list', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price, course_type, duration_hours, category FROM courses WHERE is_active = true ORDER BY course_type, name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get course details by ID (public)
router.get('/public/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM courses WHERE id = $1 AND is_active = true',
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit course enrollment form (public)
router.post('/public/enroll', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      full_name,
      date_of_birth,
      gender,
      contact_number,
      whatsapp_number,
      email,
      residential_address,
      city,
      state,
      pin_code,
      educational_qualification,
      prior_beauty_experience,
      experience_years,
      selected_course_ids,
      learning_mode,
      batch_preference,
      payment_plan,
      payment_mode,
      installment_months,
    } = req.body;

    // Validate required fields
    if (!full_name || !contact_number || !email || !selected_course_ids || selected_course_ids.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert empty string experience_years to NULL or 0
    const experienceYears = experience_years === '' || experience_years === null || experience_years === undefined ? 0 : parseInt(experience_years);

    // Calculate total amount from selected courses
    let totalAmount = 0;
    const courseDetails = [];
    for (const courseId of selected_course_ids) {
      const course = await client.query('SELECT id, name, price FROM courses WHERE id = $1 AND is_active = true', [courseId]);
      if (course.rows.length) {
        totalAmount += parseFloat(course.rows[0].price);
        courseDetails.push(course.rows[0]);
      }
    }

    if (courseDetails.length === 0) {
      return res.status(400).json({ error: 'No valid courses selected' });
    }

    // Generate enrollment_ref based on current year and enrollment count
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const yearPrefix = `JEBSA-${currentYear}-${nextYear}`;
    
    // Get the count of enrollments for this year
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM course_enrollments WHERE enrollment_ref LIKE $1`,
      [`${yearPrefix}-%`]
    );
    const nextNumber = (parseInt(countResult.rows[0].count) + 1);
    const enrollmentRef = `${yearPrefix}-${String(nextNumber).padStart(4, '0')}`;

    // Create enrollment
    const enrollment = await client.query(
      `INSERT INTO course_enrollments (
        enrollment_ref, full_name, date_of_birth, gender, contact_number, whatsapp_number, email,
        residential_address, city, state, pin_code, educational_qualification,
        prior_beauty_experience, experience_years, selected_course_ids,
        learning_mode, batch_preference, payment_plan, payment_mode,
        total_amount, enrollment_status, payment_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) RETURNING id, enrollment_ref, total_amount`,
      [
        enrollmentRef, full_name, date_of_birth, gender, contact_number, whatsapp_number, email,
        residential_address, city, state, pin_code, educational_qualification,
        prior_beauty_experience, experienceYears, selected_course_ids,
        learning_mode, batch_preference, payment_plan, payment_mode,
        totalAmount, 'pending', 'pending'
      ]
    );

    const enrollmentId = enrollment.rows[0].enrollment_ref;
    const enrollmentDbId = enrollment.rows[0].id;

    // Link enrollment to courses
    for (const course of courseDetails) {
      await client.query(
        'INSERT INTO enrollment_courses (enrollment_id, course_id, course_price) VALUES ($1, $2, $3)',
        [enrollmentDbId, course.id, course.price]
      );
    }

    // Calculate EMI and create payment schedule
    const { calculateEMI, generatePaymentScheduleDates } = require('../utils/emiCalculator');
    const months = payment_plan === 'installment' ? (installment_months || 4) : 1;
    const emiPlan = calculateEMI(totalAmount, payment_plan, months);
    const installmentsWithDates = generatePaymentScheduleDates(emiPlan.installments);

    // Create payment schedule entries for each installment
    for (const installment of installmentsWithDates) {
      await client.query(
        `INSERT INTO payment_schedules (
          enrollment_id, installment_number, total_installments, due_date, amount, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          enrollmentDbId,
          installment.installmentNumber,
          emiPlan.numberOfInstallments,
          installment.dueDate,
          installment.amount,
          'pending'
        ]
      );
    }

    await client.query('COMMIT');

    console.log(`✅ [COURSE ENROLLMENT] New enrollment created: ID ${enrollmentId}, Total: ₹${totalAmount}, Plan: ${emiPlan.planType}, Months: ${months}`);

    res.status(201).json({
      success: true,
      enrollment_id: enrollmentId,
      total_amount: totalAmount,
      payment_plan: emiPlan,
      courses: courseDetails,
      message: 'Enrollment created successfully. Proceed to payment.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [COURSE ENROLLMENT] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Create Razorpay order for course enrollment (public)
router.post('/public/create-payment-order', async (req, res) => {
  const client = await pool.connect();
  try {
    const { enrollment_id, amount } = req.body;

    if (!enrollment_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid enrollment_id or amount' });
    }

    // Verify enrollment exists
    const enrollment = await client.query(
      'SELECT * FROM course_enrollments WHERE enrollment_ref = $1',
      [enrollment_id]
    );

    if (!enrollment.rows.length) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enrollmentData = enrollment.rows[0];
    
    // Get first installment details
    const firstInstallment = await client.query(
      `SELECT * FROM payment_schedules 
       WHERE enrollment_id = $1 AND installment_number = 1
       ORDER BY installment_number ASC LIMIT 1`,
      [enrollmentData.id]
    );

    if (!firstInstallment.rows.length) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    const installment = firstInstallment.rows[0];
    const chargeAmount = parseFloat(installment.amount); // Charge only first installment

    // Lazy-load Razorpay
    let Razorpay;
    try {
      Razorpay = require('razorpay');
    } catch (e) {
      return res.status(500).json({ error: 'Razorpay not installed' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amountPaise = Math.round(chargeAmount * 100);

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `enrollment_${enrollment_id}_inst1_${Date.now()}`,
      notes: {
        enrollment_id: String(enrollment_id),
        enrollment_ref: enrollmentData.enrollment_ref,
        student_name: enrollmentData.full_name,
        installment_number: 1,
        payment_schedule_id: installment.id,
      },
    });

    console.log(`✅ [COURSE PAYMENT] Razorpay order created: ${order.id}, Amount: ₹${chargeAmount}, Installment: 1/${firstInstallment.rows[0].total_installments}`);

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      enrollment_id: enrollment_id,
      installment_number: 1,
      total_installments: installment.total_installments,
      installment_amount: chargeAmount,
      total_amount: enrollmentData.total_amount,
    });
  } catch (err) {
    console.error('❌ [COURSE PAYMENT] Error creating order:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Verify Razorpay payment for course enrollment (public)
router.post('/public/verify-payment', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, enrollment_id, amount } = req.body;

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Get enrollment by ref
    const enrollment = await client.query(
      'SELECT * FROM course_enrollments WHERE enrollment_ref = $1',
      [enrollment_id]
    );

    if (!enrollment.rows.length) {
      throw new Error('Enrollment not found');
    }

    const enrollmentData = enrollment.rows[0];
    const enrollmentDbId = enrollmentData.id;

    // Mark first installment as paid
    await client.query(
      `UPDATE payment_schedules 
       SET payment_status = 'paid', razorpay_order_id = $1, razorpay_payment_id = $2, 
           razorpay_signature = $3, paid_date = NOW(), updated_at = NOW()
       WHERE enrollment_id = $4 AND installment_number = 1`,
      [razorpay_order_id, razorpay_payment_id, razorpay_signature, enrollmentDbId]
    );

    // Check if all installments are paid
    const allInstallments = await client.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN payment_status = \'paid\' THEN 1 ELSE 0 END) as paid FROM payment_schedules WHERE enrollment_id = $1',
      [enrollmentDbId]
    );

    const { total: totalInstallments, paid: paidInstallments } = allInstallments.rows[0];
    const allPaid = totalInstallments === paidInstallments;
    const amountPaid = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payment_schedules WHERE enrollment_id = $1 AND payment_status = \'paid\'',
      [enrollmentDbId]
    );

    // Update enrollment with payment details
    const result = await client.query(
      `UPDATE course_enrollments 
       SET razorpay_order_id = $1, razorpay_payment_id = $2, razorpay_signature = $3,
           amount_paid = $4, 
           payment_status = $5,
           enrollment_status = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amountPaid.rows[0].total_paid,
        allPaid ? 'paid' : 'partial',
        allPaid ? 'enrolled' : 'pending', // 'enrolled' only when all payments done
        enrollmentDbId
      ]
    );

    if (!result.rows.length) {
      throw new Error('Failed to update enrollment');
    }

    await client.query('COMMIT');

    console.log(`✅ [COURSE PAYMENT] Payment verified: ${enrollment_id}, Installment 1/${totalInstallments}, Status: ${allPaid ? 'FULLY PAID' : 'PARTIAL'}`);

    res.json({
      success: true,
      message: allPaid ? 'Payment completed! Enrollment confirmed!' : `Installment 1 of ${totalInstallments} received. Remaining installments due on schedule.`,
      enrollment: result.rows[0],
      payment_status: allPaid ? 'fully_paid' : 'partial',
      installments_paid: paidInstallments,
      total_installments: totalInstallments,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [COURSE PAYMENT] Verification error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// Get all courses (admin)
router.get('/', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM courses ORDER BY course_type, name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create course (admin)
router.post('/', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { name, description, price, course_type, duration_hours, category } = req.body;

    if (!name || !price || !course_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO courses (name, description, price, course_type, duration_hours, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, price, course_type, duration_hours, category]
    );

    console.log(`✅ [COURSE ADMIN] Course created: ${result.rows[0].name}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update course (admin)
router.put('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { name, description, price, course_type, duration_hours, category, is_active } = req.body;

    const result = await pool.query(
      `UPDATE courses 
       SET name = $1, description = $2, price = $3, course_type = $4, duration_hours = $5, category = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, description, price, course_type, duration_hours, category, is_active, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }

    console.log(`✅ [COURSE ADMIN] Course updated: ${result.rows[0].name}`);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all enrollments (admin)
router.get('/admin/enrollments', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ce.*, 
        COUNT(DISTINCT ec.course_id) as course_count,
        STRING_AGG(DISTINCT c.name, ', ') as course_names
       FROM course_enrollments ce
       LEFT JOIN enrollment_courses ec ON ce.id = ec.enrollment_id
       LEFT JOIN courses c ON ec.course_id = c.id
       GROUP BY ce.id
       ORDER BY ce.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get enrollment details (admin)
router.get('/admin/enrollments/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const enrollment = await pool.query(
      'SELECT * FROM course_enrollments WHERE id = $1',
      [req.params.id]
    );

    if (!enrollment.rows.length) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const courses = await pool.query(
      `SELECT c.*, ec.course_price FROM enrollment_courses ec
       JOIN courses c ON ec.course_id = c.id
       WHERE ec.enrollment_id = $1`,
      [req.params.id]
    );

    res.json({
      enrollment: enrollment.rows[0],
      courses: courses.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update enrollment status (admin)
router.patch('/admin/enrollments/:id/status', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { enrollment_status, notes } = req.body;

    const result = await pool.query(
      `UPDATE course_enrollments 
       SET enrollment_status = $1, notes = $2, approved_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [enrollment_status, notes, req.user.id, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    console.log(`✅ [COURSE ADMIN] Enrollment status updated: ${req.params.id} → ${enrollment_status}`);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get enrollment statistics (admin)
router.get('/admin/stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(DISTINCT ce.id) as total_enrollments,
        COUNT(DISTINCT CASE WHEN ce.payment_status = 'paid' THEN ce.id END) as paid_enrollments,
        COUNT(DISTINCT CASE WHEN ce.enrollment_status = 'enrolled' THEN ce.id END) as active_enrollments,
        SUM(CASE WHEN ce.payment_status = 'paid' THEN ce.amount_paid ELSE 0 END) as total_revenue,
        c.name as course_name,
        COUNT(DISTINCT ec.enrollment_id) as enrollment_count,
        SUM(CASE WHEN ce.payment_status = 'paid' THEN ce.amount_paid ELSE 0 END) as course_revenue
       FROM courses c
       LEFT JOIN enrollment_courses ec ON c.id = ec.course_id
       LEFT JOIN course_enrollments ce ON ec.enrollment_id = ce.id
       WHERE c.is_active = true
       GROUP BY c.id, c.name
       ORDER BY course_revenue DESC NULLS LAST`
    );

    const totals = await pool.query(
      `SELECT 
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_enrollments,
        COUNT(CASE WHEN enrollment_status = 'enrolled' THEN 1 END) as active_enrollments,
        SUM(CASE WHEN payment_status = 'paid' THEN amount_paid ELSE 0 END) as total_revenue
       FROM course_enrollments`
    );

    res.json({
      totals: totals.rows[0],
      by_course: stats.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT SCHEDULE MANAGEMENT ENDPOINTS (Admin)
// ══════════════════════════════════════════════════════════════════════════════

// Get payment schedules for an enrollment (admin)
router.get('/admin/enrollments/:enrollment_id/payment-schedule', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*, 
              ce.enrollment_ref, ce.full_name, ce.email, ce.contact_number, ce.total_amount,
              ce.payment_status as enrollment_payment_status,
              ce.payment_plan
       FROM payment_schedules ps
       JOIN course_enrollments ce ON ps.enrollment_id = ce.id
       WHERE ps.enrollment_id = $1
       ORDER BY ps.installment_number ASC`,
      [req.params.enrollment_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all overdue payments (admin - for reminders)
router.get('/admin/payment-schedules/overdue', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*, ce.enrollment_ref, ce.full_name, ce.email, ce.contact_number
       FROM payment_schedules ps
       JOIN course_enrollments ce ON ps.enrollment_id = ce.id
       WHERE ps.payment_status = 'pending' AND ps.due_date < NOW()
       ORDER BY ps.due_date ASC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get upcoming payments (admin - for planning)
router.get('/admin/payment-schedules/upcoming', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const daysAhead = req.query.days || 7; // Default: next 7 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(daysAhead));

    const result = await pool.query(
      `SELECT ps.*, ce.enrollment_ref, ce.full_name, ce.email, ce.contact_number
       FROM payment_schedules ps
       JOIN course_enrollments ce ON ps.enrollment_id = ce.id
       WHERE ps.payment_status = 'pending' 
       AND ps.due_date >= NOW() 
       AND ps.due_date <= $1
       ORDER BY ps.due_date ASC`,
      [futureDate]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually mark a payment as received (for offline/manual payments)
router.patch('/admin/payment-schedules/:schedule_id/mark-paid', authenticate, authorize('super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { notes } = req.body;
    const scheduleId = req.params.schedule_id;

    // Update payment schedule
    const scheduleResult = await client.query(
      `UPDATE payment_schedules 
       SET payment_status = 'paid', paid_date = NOW(), 
           notes = COALESCE($1, notes),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [notes || null, scheduleId]
    );

    if (!scheduleResult.rows.length) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    const schedule = scheduleResult.rows[0];

    // Get all payment schedules for this enrollment
    const allSchedules = await client.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid,
              SUM(amount) as total_amount,
              SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) as amount_paid
       FROM payment_schedules 
       WHERE enrollment_id = $1`,
      [schedule.enrollment_id]
    );

    const { total: totalSchedules, paid: paidSchedules, total_amount, amount_paid } = allSchedules.rows[0];
    const allPaid = totalSchedules === paidSchedules;

    // Update enrollment payment status
    await client.query(
      `UPDATE course_enrollments 
       SET payment_status = $1, amount_paid = $2, 
           enrollment_status = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        allPaid ? 'paid' : 'partial',
        amount_paid,
        allPaid ? 'enrolled' : 'pending',
        schedule.enrollment_id
      ]
    );

    await client.query('COMMIT');

    console.log(`✅ [ADMIN] Payment marked paid: Schedule ${scheduleId}, Installment ${schedule.installment_number}/${schedule.total_installments}`);

    res.json({
      success: true,
      message: allPaid ? 'All payments received! Enrollment fully paid.' : `Installment ${schedule.installment_number}/${schedule.total_installments} marked as paid.`,
      schedule: scheduleResult.rows[0],
      enrollment_payment_status: allPaid ? 'fully_paid' : 'partial',
      installments_paid: paidSchedules,
      total_installments: totalSchedules,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [ADMIN] Error marking payment:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get payment statistics (admin dashboard)
router.get('/admin/payment-stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN payment_status = 'pending' THEN id END) as pending_payments,
        COUNT(DISTINCT CASE WHEN payment_status = 'paid' THEN id END) as paid_payments,
        COUNT(DISTINCT CASE WHEN payment_status = 'overdue' THEN id END) as overdue_payments,
        COUNT(DISTINCT CASE WHEN due_date < NOW() AND payment_status = 'pending' THEN id END) as overdue_pending,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(amount), 0) as total_expected
       FROM payment_schedules`
    );

    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL NOTIFICATION ENDPOINTS (Admin)
// ══════════════════════════════════════════════════════════════════════════════

// Manually send payment reminder for specific payment schedule
router.post('/admin/send-payment-reminder/:schedule_id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { sendPaymentReminder } = require('../utils/emailNotifier');
    
    // Get payment schedule with enrollment details
    const scheduleResult = await pool.query(
      `SELECT ps.*, 
              ce.enrollment_ref, ce.full_name, ce.email, ce.contact_number,
              ce.learning_mode, ce.batch_preference
       FROM payment_schedules ps
       JOIN course_enrollments ce ON ps.enrollment_id = ce.id
       WHERE ps.id = $1`,
      [req.params.schedule_id]
    );

    if (!scheduleResult.rows.length) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    const payment = scheduleResult.rows[0];
    const type = new Date(payment.due_date) < new Date() ? 'overdue' : 'upcoming';

    // Send email
    const result = await sendPaymentReminder(payment, payment, type);

    if (result.success) {
      // Update reminder tracking
      await pool.query(
        `UPDATE payment_schedules 
         SET reminder_sent = true, reminder_sent_date = NOW() 
         WHERE id = $1`,
        [req.params.schedule_id]
      );

      console.log(`✅ [ADMIN] Manual reminder sent: ${payment.enrollment_ref}`);
      res.json({
        success: true,
        message: `Reminder sent to ${payment.email}`,
        type: type,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (err) {
    console.error('❌ Error sending reminder:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Trigger bulk payment reminders (admin manual trigger)
router.post('/admin/send-bulk-reminders', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { sendPaymentReminders } = require('../utils/paymentReminderJob');

    // Send reminders
    const results = await sendPaymentReminders();

    res.json({
      success: true,
      message: `Bulk reminder job completed: ${results.sent} sent, ${results.failed} failed`,
      ...results,
    });
  } catch (err) {
    console.error('❌ Error in bulk reminder job:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get reminder statistics
router.get('/admin/reminder-stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { getReminderStats } = require('../utils/paymentReminderJob');
    const stats = await getReminderStats();

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
