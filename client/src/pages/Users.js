import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const ROLE_COLORS = {
  super_admin: 'badge-purple',
  receptionist: 'badge-info',
  stockist: 'badge-warning',
};

const ROLE_ICONS = {
  super_admin: '👑',
  receptionist: '💁',
  stockist: '📦',
};

function UserFormModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'receptionist', phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password || !form.role) {
      return alert('All fields except phone are required');
    }
    setLoading(true);
    try {
      await api.post('/auth/users', form);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>➕ Create New User</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-control"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Anita Kapoor"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                className="form-control"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="user@salon.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Mobile number"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'receptionist', label: '💁 Receptionist' },
                { value: 'stockist', label: '📦 Stockist' },
                { value: 'super_admin', label: '👑 Super Admin' },
              ].map(r => (
                <button
                  key={r.value}
                  type="button"
                  className={`btn btn-sm ${form.role === r.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm({ ...form, role: r.value })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input
              className="form-control"
              type="date"
              value={form.date_of_birth || ''}
              onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, fontSize: 13 }}>
            <strong>Role Permissions:</strong>
            <div style={{ marginTop: 6, color: 'var(--gray-600)' }}>
              {form.role === 'receptionist' && '• Can manage appointments, customers, and process payments'}
              {form.role === 'stockist' && '• Can manage products and add stock to inventory'}
              {form.role === 'super_admin' && '• Full access: services, specialists, analytics, users, and all features'}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : '✅ Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password || password.length < 6) return alert('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.patch(`/auth/users/${user.id}/password`, { password });
      alert('Password updated successfully');
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>🔑 Change Password — {user.name}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Updating...' : '🔑 Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleUser = async (id) => {
    try {
      await api.patch(`/auth/users/${id}/toggle`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  if (loading) return <div className="spinner" />;

  const byRole = {
    super_admin: users.filter(u => u.role === 'super_admin'),
    receptionist: users.filter(u => u.role === 'receptionist'),
    stockist: users.filter(u => u.role === 'stockist'),
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>👤 System Users</h2>
          <p>Manage staff accounts and access levels</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Create User
        </button>
      </div>

      {/* Role summary */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {Object.entries(byRole).map(([role, list]) => (
          <div className="stat-card" key={role}>
            <div className="stat-icon" style={{ background: role === 'super_admin' ? '#EDE9FE' : role === 'receptionist' ? '#DBEAFE' : '#FEF3C7', fontSize: 24 }}>
              {ROLE_ICONS[role]}
            </div>
            <div className="stat-info">
              <div className="value">{list.length}</div>
              <div className="label">
                {role === 'super_admin' ? 'Super Admins' : role === 'receptionist' ? 'Receptionists' : 'Stockists'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Date of Birth</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: u.role === 'super_admin' ? '#8B5CF6' : u.role === 'receptionist' ? '#3B82F6' : '#F59E0B',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, fontWeight: 700
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{u.email}</td>
                  <td style={{ fontSize: 13 }}>{u.phone || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {u.date_of_birth ? new Date(u.date_of_birth).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${ROLE_COLORS[u.role]}`}>
                      {ROLE_ICONS[u.role]} {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setPasswordUser(u)}>
                        🔑 Password
                      </button>
                      <button
                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleUser(u.id)}
                      >
                        {u.is_active ? '🚫 Disable' : '✅ Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">No users found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <UserFormModal onClose={() => setShowForm(false)} onSuccess={load} />}
      {passwordUser && <PasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />}
    </div>
  );
}
