/**
 * Payment Reminder Scheduled Job
 * Runs daily to send email reminders for upcoming and overdue payments
 * 
 * Can be called manually or via cron job (e.g., node-cron, agenda, etc.)
 */

const { pool } = require('../db');
const { sendPaymentReminder } = require('./emailNotifier');

/**
 * Send payment reminders for upcoming and overdue payments
 * Runs once per day (typically at 8 AM)
 */
async function sendPaymentReminders() {
  const client = await pool.connect();
  try {
    console.log(`\n📧 [REMINDER JOB] Starting payment reminder job at ${new Date().toISOString()}`);

    // Get all pending payments (upcoming + overdue)
    const result = await client.query(`
      SELECT 
        ps.*, 
        ce.enrollment_ref, 
        ce.full_name, 
        ce.email, 
        ce.contact_number,
        ce.learning_mode,
        ce.batch_preference
      FROM payment_schedules ps
      JOIN course_enrollments ce ON ps.enrollment_id = ce.id
      WHERE ps.payment_status = 'pending'
      AND ps.reminder_sent = false
      AND (
        -- Upcoming: Due in next 3 days
        ps.due_date <= NOW() + INTERVAL '3 days'
        -- OR Overdue: Past due date
        OR ps.due_date < NOW()
      )
      ORDER BY ps.due_date ASC
    `);

    const payments = result.rows;
    console.log(`📋 Found ${payments.length} payments requiring reminders`);

    if (payments.length === 0) {
      console.log('✅ No payments to remind about.');
      return { sent: 0, failed: 0, message: 'No reminders sent' };
    }

    let sent = 0;
    let failed = 0;

    // Send reminders for each payment
    for (const payment of payments) {
      try {
        const type = new Date(payment.due_date) < new Date() ? 'overdue' : 'upcoming';
        
        // Send email
        const emailResult = await sendPaymentReminder(payment, payment, type);

        if (emailResult.success) {
          // Mark reminder as sent
          await client.query(
            `UPDATE payment_schedules 
             SET reminder_sent = true, reminder_sent_date = NOW() 
             WHERE id = $1`,
            [payment.id]
          );
          
          sent++;
          console.log(`  ✅ ${type.toUpperCase()}: ${payment.enrollment_ref} → ${payment.email}`);
        } else {
          failed++;
          console.log(`  ❌ ${type.toUpperCase()}: ${payment.enrollment_ref} → Failed`);
        }
      } catch (err) {
        failed++;
        console.error(`  ❌ Error processing ${payment.enrollment_ref}:`, err.message);
      }

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📊 Payment Reminder Job Summary:`);
    console.log(`  ✅ Sent: ${sent}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📅 Completed at ${new Date().toISOString()}\n`);

    return {
      sent,
      failed,
      total: payments.length,
      message: `Sent ${sent} reminders, ${failed} failed`,
    };
  } catch (err) {
    console.error('❌ [REMINDER JOB] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get statistics about reminders
 */
async function getReminderStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_pending,
        COUNT(CASE WHEN reminder_sent = true THEN 1 END) as reminders_sent,
        COUNT(CASE WHEN reminder_sent = false THEN 1 END) as reminders_pending,
        COUNT(CASE WHEN due_date < NOW() AND payment_status = 'pending' THEN 1 END) as overdue_count
      FROM payment_schedules
      WHERE payment_status = 'pending'
    `);

    return result.rows[0];
  } catch (err) {
    console.error('Error getting reminder stats:', err.message);
    return null;
  }
}

module.exports = {
  sendPaymentReminders,
  getReminderStats,
};
