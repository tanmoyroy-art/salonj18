import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const LEARNING_MODES = {
  studio: { label: 'Studio Classroom (Kolkata)', icon: '🏢' },
  online: { label: 'Live Online', icon: '🖥️' },
  hybrid: { label: 'Hybrid', icon: '🔄' },
};

const BATCH_PREFERENCES = {
  weekday_morning: { label: 'Weekday Morning', icon: '🌅' },
  weekday_afternoon: { label: 'Weekday Afternoon', icon: '☀️' },
  weekend_intensive: { label: 'Weekend Intensive', icon: '📅' },
};

const PAYMENT_PLANS = {
  full: { label: 'Full Payment', color: '#059669' },
  installment: { label: 'Installments/EMI', color: '#D97706' },
};

const PAYMENT_MODES = {
  upi: { label: 'UPI / GPay', icon: '📱' },
  netbanking: { label: 'Net Banking / IMPS', icon: '🏦' },
  card: { label: 'Card / Cash', icon: '💳' },
};

const STATUS_COLORS = {
  pending: { bg: '#FEE2E2', color: '#DC2626', label: '⏳ Pending' },
  approved: { bg: '#FEF3C7', color: '#92400E', label: '✅ Approved' },
  enrolled: { bg: '#ECFDF5', color: '#059669', label: '✅ Enrolled' },
  rejected: { bg: '#F3E8FF', color: '#7C3AED', label: '❌ Rejected' },
};

const PAYMENT_STATUS_COLORS = {
  pending: { bg: '#FEE2E2', color: '#DC2626', label: '⏳ Pending Payment' },
  partial: { bg: '#FEF3C7', color: '#92400E', label: '⚠️ Partial Payment' },
  paid: { bg: '#ECFDF5', color: '#059669', label: '✅ Paid' },
};

export default function EnrollmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState(null);
  const [courses, setCourses] = useState([]);
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadEnrollmentDetails();
  }, [id]);

  const loadEnrollmentDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/courses/admin/enrollments/${id}`);
      setEnrollment(res.data.enrollment);
      setCourses(res.data.courses);
      setNotes(res.data.enrollment.notes || '');
      
      // Load payment schedules if EMI
      if (res.data.enrollment.payment_plan === 'installment') {
        try {
          const schedRes = await api.get(`/courses/admin/enrollments/${res.data.enrollment.id}/payment-schedule`);
          setPaymentSchedules(schedRes.data);
        } catch (err) {
          console.warn('Could not load payment schedule:', err);
        }
      }
    } catch (err) {
      console.error('Error loading enrollment:', err);
      alert('Failed to load enrollment details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Change enrollment status to ${newStatus}?`)) return;

    setUpdating(true);
    try {
      await api.patch(`/courses/admin/enrollments/${id}/status`, {
        enrollment_status: newStatus,
        notes: notes,
      });
      alert('Enrollment status updated successfully');
      loadEnrollmentDetails();
    } catch (err) {
      alert(err.response?.data?.error || 'Error updating status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="spinner" />;
  if (!enrollment) return <div className="page-header"><p>Enrollment not found</p></div>;

  const statusInfo = STATUS_COLORS[enrollment.enrollment_status] || STATUS_COLORS.pending;
  const paymentStatusInfo = PAYMENT_STATUS_COLORS[enrollment.payment_status] || PAYMENT_STATUS_COLORS.pending;
  const learningModeInfo = LEARNING_MODES[enrollment.learning_mode] || {};
  const batchInfo = BATCH_PREFERENCES[enrollment.batch_preference] || {};
  const paymentPlanInfo = PAYMENT_PLANS[enrollment.payment_plan] || {};
  const paymentModeInfo = PAYMENT_MODES[enrollment.payment_mode] || {};

  const totalAmount = courses.reduce((sum, c) => sum + parseFloat(c.course_price || 0), 0);
  const amountPaid = parseFloat(enrollment.amount_paid || 0);
  const amountDue = totalAmount - amountPaid;

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => navigate('/courses')}
              style={{ marginRight: 8 }}
            >
              ← Back
            </button>
            <div>
              <h2>📋 Enrollment Details</h2>
              <p style={{ color: '#6B7280', marginTop: 4 }}>ID: {id}</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {enrollment.enrollment_status !== 'enrolled' && (
            <button 
              className="btn btn-primary"
              onClick={() => handleStatusChange('enrolled')}
              disabled={updating}
            >
              ✅ Mark as Enrolled
            </button>
          )}
          {enrollment.enrollment_status !== 'rejected' && (
            <button 
              className="btn btn-danger"
              onClick={() => handleStatusChange('rejected')}
              disabled={updating}
            >
              ❌ Reject
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Enrollment Status */}
        <div className="card" style={{ 
          background: statusInfo.bg,
          borderLeft: `4px solid ${statusInfo.color}`,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Enrollment Status</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: statusInfo.color }}>
            {statusInfo.label}
          </div>
          <select
            value={enrollment.enrollment_status}
            onChange={e => handleStatusChange(e.target.value)}
            disabled={updating}
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${statusInfo.color}`,
              background: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="enrolled">Enrolled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Payment Status */}
        <div className="card" style={{
          background: paymentStatusInfo.bg,
          borderLeft: `4px solid ${paymentStatusInfo.color}`,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Payment Status</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: paymentStatusInfo.color }}>
            {paymentStatusInfo.label}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: '#6B7280' }}>
            <div>Paid: ₹{amountPaid.toLocaleString('en-IN')}</div>
            {amountDue > 0 && <div style={{ color: '#DC2626' }}>Due: ₹{amountDue.toLocaleString('en-IN')}</div>}
          </div>
        </div>
      </div>

      {/* Student Information */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title">👤 Student Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          {/* Personal Details */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 16 }}>PERSONAL DETAILS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Full Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.full_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Date of Birth</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                  {enrollment.date_of_birth ? new Date(enrollment.date_of_birth).toLocaleDateString('en-IN') : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Gender</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.gender || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Contact Number</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.contact_number}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>WhatsApp Number</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.whatsapp_number || 'Same'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Email Address</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.email}</div>
              </div>
            </div>
          </div>

          {/* Address & Education */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 16 }}>ADDRESS & BACKGROUND</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Residential Address</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.residential_address || 'N/A'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>City</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.city || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>State</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.state || 'N/A'}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Pin Code</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.pin_code || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Educational Qualification</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{enrollment.educational_qualification || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Prior Beauty Experience</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                  {enrollment.prior_beauty_experience ? `Yes (${enrollment.experience_years || 0} years)` : 'No'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Selection */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title">📚 Selected Courses</h3>
        <div style={{ marginTop: 16 }}>
          {courses.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              {courses.map(course => (
                <div key={course.id} style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  padding: 12,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    {course.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                    {course.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      <span style={{ marginRight: 8 }}>📚 {course.duration_hours}h</span>
                      <span>{course.course_type}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#8B5CF6' }}>
                      ₹{parseFloat(course.course_price).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No courses selected</div>
          )}
        </div>
      </div>

      {/* Learning Preferences */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Learning Mode */}
        <div className="card">
          <h3 className="card-title">🎓 Learning Mode</h3>
          <div style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: '#374151' }}>
            {learningModeInfo.icon} {learningModeInfo.label}
          </div>
        </div>

        {/* Batch Preference */}
        <div className="card">
          <h3 className="card-title">📅 Batch Preference</h3>
          <div style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: '#374151' }}>
            {batchInfo.icon} {batchInfo.label}
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title">💳 Payment Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          {/* Payment Details */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 16 }}>PAYMENT DETAILS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Total Amount</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#8B5CF6' }}>
                  ₹{totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Amount Paid</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                  ₹{amountPaid.toLocaleString('en-IN')}
                </div>
              </div>
              {amountDue > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Amount Due</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
                    ₹{amountDue.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 16 }}>PAYMENT MODE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Plan</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: paymentPlanInfo.color }}>
                  {paymentPlanInfo.label}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Mode</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                  {paymentModeInfo.icon} {paymentModeInfo.label}
                </div>
              </div>
              {enrollment.razorpay_payment_id && (
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Razorpay Payment ID</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', wordBreak: 'break-all' }}>
                    {enrollment.razorpay_payment_id}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Schedule (for EMI) */}
      {enrollment.payment_plan === 'installment' && paymentSchedules.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title">💳 Payment Schedule (Installments)</h3>
          <div style={{ marginTop: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#374151' }}>Installment</th>
                    <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#374151' }}>Due Date</th>
                    <th style={{ textAlign: 'right', padding: 12, fontWeight: 700, color: '#374151' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#374151' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#374151' }}>Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentSchedules.map((schedule, idx) => {
                    const statusColor = schedule.payment_status === 'paid' ? '#059669' : 
                                      new Date(schedule.due_date) < new Date() ? '#DC2626' : '#6B7280';
                    const statusLabel = schedule.payment_status === 'paid' ? '✅ Paid' : 
                                      new Date(schedule.due_date) < new Date() ? '❌ Overdue' : '⏳ Pending';
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: 12, color: '#374151', fontWeight: 600 }}>
                          {schedule.installment_number} of {schedule.total_installments}
                        </td>
                        <td style={{ padding: 12, color: '#374151' }}>
                          {new Date(schedule.due_date).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', color: '#374151', fontWeight: 600 }}>
                          ₹{parseFloat(schedule.amount).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: 12, color: statusColor, fontWeight: 600 }}>
                          {statusLabel}
                        </td>
                        <td style={{ padding: 12, color: '#6B7280' }}>
                          {schedule.paid_date ? new Date(schedule.paid_date).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* EMI Summary */}
            <div style={{ marginTop: 20, padding: 16, background: '#F9FAFB', borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Total Installments</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>
                    {paymentSchedules.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Paid</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                    ₹{paymentSchedules
                      .filter(s => s.payment_status === 'paid')
                      .reduce((sum, s) => sum + parseFloat(s.amount), 0)
                      .toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Pending</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626' }}>
                    ₹{paymentSchedules
                      .filter(s => s.payment_status !== 'paid')
                      .reduce((sum, s) => sum + parseFloat(s.amount), 0)
                      .toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Notes */}
      <div className="card">
        <h3 className="card-title">📝 Admin Notes</h3>
        <div style={{ marginTop: 16 }}>
          <textarea
            className="form-control"
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about this enrollment..."
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              setUpdating(true);
              try {
                await api.patch(`/courses/admin/enrollments/${id}/status`, {
                  enrollment_status: enrollment.enrollment_status,
                  notes: notes,
                });
                alert('Notes saved');
              } catch (err) {
                alert('Error saving notes');
              } finally {
                setUpdating(false);
              }
            }}
            disabled={updating}
            style={{ marginTop: 12 }}
          >
            💾 Save Notes
          </button>
        </div>
      </div>

      {/* Enrollment Dates */}
      <div style={{ marginTop: 24, padding: 16, background: '#F9FAFB', borderRadius: 10, fontSize: 12, color: '#6B7280' }}>
        <div>Created: {new Date(enrollment.created_at).toLocaleString('en-IN')}</div>
        <div>Updated: {new Date(enrollment.updated_at).toLocaleString('en-IN')}</div>
      </div>
    </div>
  );
}
