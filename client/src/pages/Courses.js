import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const COURSE_TYPES = {
  diploma: { label: 'Diploma', color: '#8B5CF6', bg: '#F5F3FF' },
  modular: { label: 'Modular', color: '#059669', bg: '#ECFDF5' },
  masterclass: { label: 'Masterclass', color: '#D97706', bg: '#FEF3C7' },
};

const LEARNING_MODES = {
  studio: 'Studio Classroom',
  online: 'Live Online',
  hybrid: 'Hybrid',
};

const BATCH_PREFERENCES = {
  weekday_morning: 'Weekday Morning',
  weekday_afternoon: 'Weekday Afternoon',
  weekend_intensive: 'Weekend Intensive',
};

// ── Course Card Component ──────────────────────────────────────────────────
function CourseCard({ course, onEdit, onDelete }) {
  const style = COURSE_TYPES[course.course_type];

  return (
    <div style={{
      background: style.bg,
      border: `2px solid ${style.color}`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
            {course.name}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
            {course.description}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B7280' }}>
            <span>📚 {course.duration_hours || 0}h</span>
            <span>💰 ₹{parseFloat(course.price).toLocaleString('en-IN')}</span>
            <span style={{
              background: style.color,
              color: 'white',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 600,
            }}>
              {style.label}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(course)}>
            ✏️ Edit
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(course.id)}>
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit Course Modal ──────────────────────────────────────────────────
function CourseModal({ course, onSave, onClose }) {
  const [form, setForm] = useState(course || {
    name: '',
    description: '',
    price: '',
    course_type: 'diploma',
    duration_hours: '',
    category: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.price) {
      alert('Name and price are required');
      return;
    }

    setLoading(true);
    try {
      if (form.id) {
        await api.put(`/courses/${form.id}`, form);
        alert('Course updated successfully');
      } else {
        await api.post('/courses', form);
        alert('Course created successfully');
      }
      onSave();
    } catch (err) {
      alert(err.response?.data?.error || 'Error saving course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>{form.id ? '✏️ Edit Course' : '➕ Add New Course'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Course Name *</label>
            <input
              className="form-control"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Advanced Hair Artistry"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Course description"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Price (₹) *</label>
              <input
                type="number"
                className="form-control"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="50000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (Hours)</label>
              <input
                type="number"
                className="form-control"
                value={form.duration_hours || ''}
                onChange={e => setForm({ ...form, duration_hours: e.target.value })}
                placeholder="80"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Course Type</label>
              <select
                className="form-control"
                value={form.course_type}
                onChange={e => setForm({ ...form, course_type: e.target.value })}
              >
                <option value="diploma">Diploma</option>
                <option value="modular">Modular</option>
                <option value="masterclass">Masterclass</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                className="form-control"
                value={form.category || ''}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="e.g., Hair, Makeup, Skincare"
              />
            </div>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
              />
              <span style={{ marginLeft: 8 }}>Active</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Course'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Enrollment Statistics Card ─────────────────────────────────────────────
function StatsCard({ label, value, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color, fontSize: 20 }}>{icon}</div>
      <div className="stat-info">
        <div className="value">{value}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
}

// ── Main Courses Admin Page ────────────────────────────────────────────────
export default function Courses() {
  const [tab, setTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [paymentSchedules, setPaymentSchedules] = useState({
    overdue: [],
    upcoming: [],
    stats: null,
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

  const loadCourses = useCallback(async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  }, []);

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await api.get('/courses/admin/enrollments');
      setEnrollments(res.data);
    } catch (err) {
      console.error('Error loading enrollments:', err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/courses/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  const loadPaymentSchedules = useCallback(async () => {
    try {
      const [overdueRes, upcomingRes, statsRes] = await Promise.all([
        api.get('/courses/admin/payment-schedules/overdue'),
        api.get('/courses/admin/payment-schedules/upcoming'),
        api.get('/courses/admin/payment-stats'),
      ]);
      setPaymentSchedules({
        overdue: overdueRes.data,
        upcoming: upcomingRes.data,
        stats: statsRes.data,
      });
    } catch (err) {
      console.error('Error loading payment schedules:', err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCourses(), loadEnrollments(), loadStats(), loadPaymentSchedules()]);
    } finally {
      setLoading(false);
    }
  }, [loadCourses, loadEnrollments, loadStats, loadPaymentSchedules]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteCourse = async (id) => {
    if (!window.confirm('Delete this course?')) return;
    try {
      await api.put(`/courses/${id}`, { is_active: false });
      alert('Course deleted successfully');
      loadCourses();
    } catch (err) {
      alert(err.response?.data?.error || 'Error deleting course');
    }
  };

  const handleUpdateEnrollmentStatus = async (enrollmentId, status) => {
    try {
      await api.patch(`/courses/admin/enrollments/${enrollmentId}/status`, {
        enrollment_status: status,
      });
      alert('Enrollment status updated');
      loadEnrollments();
    } catch (err) {
      alert(err.response?.data?.error || 'Error updating status');
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🎓 Course Management</h2>
          <p>Manage academy courses and student enrollments</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setEditingCourse(null);
          setShowCourseModal(true);
        }}>
          + Add Course
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <StatsCard
            label="Total Enrollments"
            value={stats.totals.total_enrollments}
            icon="📋"
            color="#EDE9FE"
          />
          <StatsCard
            label="Paid Enrollments"
            value={stats.totals.paid_enrollments}
            icon="✅"
            color="#ECFDF5"
          />
          <StatsCard
            label="Active Students"
            value={stats.totals.active_enrollments}
            icon="👥"
            color="#FEF3C7"
          />
          <StatsCard
            label="Total Revenue"
            value={`₹${parseFloat(stats.totals.total_revenue || 0).toLocaleString('en-IN')}`}
            icon="💰"
            color="#FCE7F3"
          />
        </div>
      )}

      <div className="tabs">
        {[
          { key: 'courses', label: '📚 Courses' },
          { key: 'enrollments', label: '👥 Enrollments' },
          { key: 'payments', label: '💳 Payment Tracking' },
          { key: 'stats', label: '📊 Statistics' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Courses Tab */}
      {tab === 'courses' && (
        <div className="card">
          {courses.length > 0 ? (
            courses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onEdit={course => {
                  setEditingCourse(course);
                  setShowCourseModal(true);
                }}
                onDelete={handleDeleteCourse}
              />
            ))
          ) : (
            <div className="empty-state">No courses yet</div>
          )}
        </div>
      )}

      {/* Enrollments Tab */}
      {tab === 'enrollments' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Courses</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length > 0 ? (
                  enrollments.map(enrollment => (
                    <tr key={enrollment.id} style={{
                      background: enrollment.enrollment_status === 'enrolled' ? '#F0FDF4' :
                                 enrollment.payment_status === 'paid' ? '#FEF3C7' : '#FCE7F3',
                    }}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{enrollment.full_name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{enrollment.contact_number}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{enrollment.email}</td>
                      <td>{enrollment.contact_number}</td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          {enrollment.course_names}
                          <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                            ({enrollment.course_count} course{enrollment.course_count > 1 ? 's' : ''})
                          </div>
                        </div>
                      </td>
                      <td>₹{parseFloat(enrollment.total_amount).toLocaleString('en-IN')}</td>
                      <td>
                        <span className="badge" style={{
                          background: enrollment.payment_status === 'paid' ? '#ECFDF5' : '#FEE2E2',
                          color: enrollment.payment_status === 'paid' ? '#059669' : '#DC2626',
                        }}>
                          {enrollment.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                        </span>
                      </td>
                      <td>
                        <select
                          value={enrollment.enrollment_status}
                          onChange={e => handleUpdateEnrollmentStatus(enrollment.id, e.target.value)}
                          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4 }}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="enrolled">Enrolled</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td>
                        <a href={`/courses/enrollment/${enrollment.id}`} className="btn btn-primary btn-sm">
                          View
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">No enrollments yet</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Tracking Tab */}
      {tab === 'payments' && paymentSchedules.stats && (
        <div>
          {/* Payment Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ background: '#FEF3C7', borderLeft: '4px solid #D97706', padding: 16 }}>
              <div style={{ fontSize: 12, color: '#92400E', marginBottom: 4 }}>Pending Payments</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#D97706', marginBottom: 4 }}>
                {paymentSchedules.stats.pending_payments}
              </div>
              <div style={{ fontSize: 12, color: '#92400E' }}>
                ₹{parseFloat(paymentSchedules.stats.total_pending).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="card" style={{ background: '#ECFDF5', borderLeft: '4px solid #059669', padding: 16 }}>
              <div style={{ fontSize: 12, color: '#047857', marginBottom: 4 }}>Paid Payments</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginBottom: 4 }}>
                {paymentSchedules.stats.paid_payments}
              </div>
              <div style={{ fontSize: 12, color: '#047857' }}>
                ₹{parseFloat(paymentSchedules.stats.total_collected).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="card" style={{ background: '#FEE2E2', borderLeft: '4px solid #DC2626', padding: 16 }}>
              <div style={{ fontSize: 12, color: '#991B1B', marginBottom: 4 }}>Overdue Payments</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626', marginBottom: 4 }}>
                {paymentSchedules.stats.overdue_pending}
              </div>
              <div style={{ fontSize: 12, color: '#991B1B' }}>
                Require immediate action
              </div>
            </div>
          </div>

          {/* Overdue Payments Section */}
          {paymentSchedules.overdue.length > 0 && (
            <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #DC2626' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#DC2626', marginBottom: 16 }}>
                ❌ Overdue Payments ({paymentSchedules.overdue.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #FCA5A5' }}>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#7F1D1D' }}>Student</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#7F1D1D' }}>Enrollment</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#7F1D1D' }}>Due Date</th>
                      <th style={{ textAlign: 'right', padding: 12, fontWeight: 700, color: '#7F1D1D' }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#7F1D1D' }}>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSchedules.overdue.map((payment, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #FECACA', background: '#FEF2F2' }}>
                        <td style={{ padding: 12, fontWeight: 600, color: '#374151' }}>{payment.full_name}</td>
                        <td style={{ padding: 12, color: '#6B7280' }}>{payment.enrollment_ref}</td>
                        <td style={{ padding: 12, color: '#DC2626', fontWeight: 600 }}>
                          {new Date(payment.due_date).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                          ₹{parseFloat(payment.amount).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: 12, color: '#6B7280', fontSize: 12 }}>
                          {payment.contact_number} | {payment.email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upcoming Payments Section */}
          {paymentSchedules.upcoming.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #D97706' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginBottom: 16 }}>
                📅 Upcoming Payments (Next 7 days) - {paymentSchedules.upcoming.length}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #FCD34D' }}>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#78350F' }}>Student</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#78350F' }}>Enrollment</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#78350F' }}>Due Date</th>
                      <th style={{ textAlign: 'right', padding: 12, fontWeight: 700, color: '#78350F' }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 700, color: '#78350F' }}>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSchedules.upcoming.map((payment, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #FEF3C7', background: '#FFFBEB' }}>
                        <td style={{ padding: 12, fontWeight: 600, color: '#374151' }}>{payment.full_name}</td>
                        <td style={{ padding: 12, color: '#6B7280' }}>{payment.enrollment_ref}</td>
                        <td style={{ padding: 12, color: '#D97706', fontWeight: 600 }}>
                          {new Date(payment.due_date).toLocaleDateString('en-IN')}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                          ₹{parseFloat(payment.amount).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: 12, color: '#6B7280', fontSize: 12 }}>
                          {payment.contact_number} | {payment.email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {paymentSchedules.overdue.length === 0 && paymentSchedules.upcoming.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                All Payments On Track!
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                No overdue or upcoming payments in the next 7 days
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {tab === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {stats.by_course.map(course => (
            <div key={course.id} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>
                {course.course_name}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6', marginBottom: 8 }}>
                {course.enrollment_count || 0}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Students Enrolled
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>
                ₹{parseFloat(course.course_revenue || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>Revenue Generated</div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Course Modal */}
      {showCourseModal && (
        <CourseModal
          course={editingCourse}
          onSave={() => {
            setShowCourseModal(false);
            load();
          }}
          onClose={() => setShowCourseModal(false)}
        />
      )}
    </div>
  );
}
