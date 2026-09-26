/**
 * Email Notification System for Payment Reminders
 * Sends automated email reminders for upcoming and overdue installments
 */

const nodemailer = require('nodemailer');

/**
 * Initialize email transporter
 * Supports Gmail, SendGrid, or custom SMTP
 */
function getEmailTransporter() {
  // Using Gmail or custom SMTP - configure in .env
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

/**
 * Send payment reminder email
 * @param {object} payment - Payment schedule object
 * @param {object} enrollment - Enrollment object
 * @param {string} type - 'upcoming' or 'overdue'
 */
async function sendPaymentReminder(payment, enrollment, type = 'upcoming') {
  try {
    // Don't send if email not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️ Email not configured. Skipping reminder.');
      return { success: false, message: 'Email not configured' };
    }

    const transporter = getEmailTransporter();
    const dueDate = new Date(payment.due_date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let subject, htmlContent;

    if (type === 'overdue') {
      subject = `⚠️ URGENT: Overdue Payment - ${enrollment.enrollment_ref}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">⚠️ Payment Overdue</h2>
          </div>
          <div style="background: #FEE2E2; padding: 20px; border: 2px solid #FCA5A5;">
            <p>Dear <strong>${enrollment.full_name}</strong>,</p>
            
            <p>This is to remind you that your course enrollment installment payment is <strong>OVERDUE</strong>.</p>
            
            <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
              <p style="margin: 8px 0;"><strong>Enrollment ID:</strong> ${enrollment.enrollment_ref}</p>
              <p style="margin: 8px 0;"><strong>Installment:</strong> ${payment.installment_number} of ${payment.total_installments}</p>
              <p style="margin: 8px 0;"><strong>Due Date:</strong> ${dueDate} (OVERDUE)</p>
              <p style="margin: 8px 0;"><strong>Amount:</strong> ₹${parseFloat(payment.amount).toLocaleString('en-IN')}</p>
            </div>
            
            <p style="color: #DC2626; font-weight: bold;">Please arrange payment at your earliest convenience to avoid disruption of your course access.</p>
            
            <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Payment Details:</strong></p>
              <p style="margin: 8px 0;">WhatsApp: ${process.env.WHATSAPP_NUMBER || 'Contact Admin'}</p>
              <p style="margin: 8px 0;">Email: ${process.env.ACADEMY_EMAIL || 'academy@example.com'}</p>
            </div>
            
            <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
              <em>This is an automated message from J Eighteen Beauty Salon Academy. Please don't reply to this email.</em>
            </p>
          </div>
        </div>
      `;
    } else {
      subject = `📅 Payment Reminder - Installment ${payment.installment_number} of ${payment.total_installments}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D97706; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">📅 Payment Reminder</h2>
          </div>
          <div style="background: #FEF3C7; padding: 20px; border: 2px solid #FCD34D;">
            <p>Dear <strong>${enrollment.full_name}</strong>,</p>
            
            <p>This is a friendly reminder that your course enrollment installment payment is due soon.</p>
            
            <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
              <p style="margin: 8px 0;"><strong>Enrollment ID:</strong> ${enrollment.enrollment_ref}</p>
              <p style="margin: 8px 0;"><strong>Installment:</strong> ${payment.installment_number} of ${payment.total_installments}</p>
              <p style="margin: 8px 0;"><strong>Due Date:</strong> ${dueDate}</p>
              <p style="margin: 8px 0;"><strong>Amount:</strong> ₹${parseFloat(payment.amount).toLocaleString('en-IN')}</p>
            </div>
            
            <p>Please arrange payment before the due date to maintain uninterrupted access to your course.</p>
            
            <div style="background: #FFFBEB; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #FEF3C7;">
              <p style="margin: 8px 0;"><strong>Payment Methods Available:</strong></p>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>UPI / Google Pay</li>
                <li>Net Banking</li>
                <li>Card Payment</li>
                <li>Cash at academy</li>
              </ul>
            </div>
            
            <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Contact Us:</strong></p>
              <p style="margin: 8px 0;">WhatsApp: ${process.env.WHATSAPP_NUMBER || 'Contact Admin'}</p>
              <p style="margin: 8px 0;">Email: ${process.env.ACADEMY_EMAIL || 'academy@example.com'}</p>
            </div>
            
            <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
              <em>This is an automated message from J Eighteen Beauty Salon Academy. Please don't reply to this email.</em>
            </p>
          </div>
        </div>
      `;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: enrollment.email,
      subject: subject,
      html: htmlContent,
      cc: process.env.ACADEMY_EMAIL || undefined,
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ [EMAIL] Reminder sent: ${type.toUpperCase()} - ${enrollment.enrollment_ref} (${enrollment.email})`);
    return { success: true, message: `Email sent to ${enrollment.email}` };
  } catch (err) {
    console.error(`❌ [EMAIL] Error sending reminder:`, err.message);
    return { success: false, message: `Error: ${err.message}` };
  }
}

/**
 * Send bulk payment reminders (for scheduled job)
 * @param {array} payments - Array of payment schedules
 */
async function sendBulkReminders(payments, enrollmentMap) {
  const results = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const payment of payments) {
    const enrollment = enrollmentMap[payment.enrollment_id];
    if (!enrollment) continue;

    const type = new Date(payment.due_date) < new Date() ? 'overdue' : 'upcoming';
    const result = await sendPaymentReminder(payment, enrollment, type);

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push(`${enrollment.enrollment_ref}: ${result.message}`);
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Send enrollment confirmation email with payment schedule
 * @param {object} enrollment - Enrollment object
 * @param {array} paymentSchedules - Array of payment schedule entries
 */
async function sendEnrollmentConfirmation(enrollment, paymentSchedules) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️ Email not configured. Skipping confirmation.');
      return { success: false, message: 'Email not configured' };
    }

    const transporter = getEmailTransporter();

    // Build payment schedule table
    let scheduleHtml = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">';
    scheduleHtml += '<tr style="background: #F3F4F6; border-bottom: 2px solid #E5E7EB;">';
    scheduleHtml += '<th style="padding: 10px; text-align: left; font-weight: 700;">Installment</th>';
    scheduleHtml += '<th style="padding: 10px; text-align: left; font-weight: 700;">Due Date</th>';
    scheduleHtml += '<th style="padding: 10px; text-align: right; font-weight: 700;">Amount</th>';
    scheduleHtml += '</tr>';

    for (const schedule of paymentSchedules) {
      const dueDate = new Date(schedule.due_date).toLocaleDateString('en-IN');
      scheduleHtml += `<tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 10px;">${schedule.installment_number} of ${schedule.total_installments}</td>
        <td style="padding: 10px;">${dueDate}</td>
        <td style="padding: 10px; text-align: right; font-weight: 600;">₹${parseFloat(schedule.amount).toLocaleString('en-IN')}</td>
      </tr>`;
    }
    scheduleHtml += '</table>';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🎉 Enrollment Confirmed!</h2>
        </div>
        <div style="background: #ECFDF5; padding: 20px; border: 2px solid #86EFAC;">
          <p>Dear <strong>${enrollment.full_name}</strong>,</p>
          
          <p>Thank you for enrolling with <strong>J Eighteen Beauty Salon Academy</strong>!</p>
          
          <p>Your enrollment has been confirmed. Here are your enrollment details:</p>
          
          <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <p style="margin: 8px 0;"><strong>Enrollment ID:</strong> ${enrollment.enrollment_ref}</p>
            <p style="margin: 8px 0;"><strong>Name:</strong> ${enrollment.full_name}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${enrollment.email}</p>
            <p style="margin: 8px 0;"><strong>Phone:</strong> ${enrollment.contact_number}</p>
            <p style="margin: 8px 0;"><strong>Learning Mode:</strong> ${enrollment.learning_mode}</p>
            <p style="margin: 8px 0;"><strong>Batch:</strong> ${enrollment.batch_preference}</p>
          </div>
          
          <p><strong>Payment Schedule:</strong></p>
          ${scheduleHtml}
          
          <p style="color: #059669; font-weight: bold;">Please ensure timely payment to maintain uninterrupted course access.</p>
          
          <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Need Help?</strong></p>
            <p style="margin: 8px 0;">WhatsApp: ${process.env.WHATSAPP_NUMBER || 'Contact Admin'}</p>
            <p style="margin: 8px 0;">Email: ${process.env.ACADEMY_EMAIL || 'academy@example.com'}</p>
          </div>
          
          <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
            <em>Welcome to J Eighteen Beauty Salon Academy!</em>
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: enrollment.email,
      subject: `✅ Enrollment Confirmed - ${enrollment.enrollment_ref}`,
      html: htmlContent,
      cc: process.env.ACADEMY_EMAIL || undefined,
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ [EMAIL] Enrollment confirmation sent: ${enrollment.enrollment_ref} (${enrollment.email})`);
    return { success: true, message: `Confirmation email sent to ${enrollment.email}` };
  } catch (err) {
    console.error(`❌ [EMAIL] Error sending confirmation:`, err.message);
    return { success: false, message: `Error: ${err.message}` };
  }
}

module.exports = {
  sendPaymentReminder,
  sendBulkReminders,
  sendEnrollmentConfirmation,
};
