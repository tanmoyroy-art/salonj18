import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const AVATAR_COLORS = ['#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#14B8A6','#F97316'];

function SpecialistModal({ specialist, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: specialist?.name || '',
    phone: specialist?.phone || '',
    email: specialist?.email || '',
    specialization: specialist?.specialization || '',
    is_active: specialist?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) return alert('Name is required');
    setLoading(true);
    try {
      if (specialist?.id) {
        await api.put(`/services/specialists/${specialist.id}`, form);
      } else {
        await api.post('/services/specialists', form);
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save specialist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{specialist?.id ? '✏️ Edit' : '➕ New'} Specialist</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-control"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Priya Sharma"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Mobile number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Specialization</label>
            <input
              className="form-control"
              value={form.specialization}
              onChange={e => setForm({ ...form, specialization: e.target.value })}
              placeholder="e.g. Hair Coloring, Bridal, Skin Care"
            />
          </div>
          {specialist?.id && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                />
                <span className="form-label" style={{ margin: 0 }}>Active</span>
              </label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : '💾 Save Specialist'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Specialists() {
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSpec, setEditSpec] = useState(null);

  const load = async () => {
    try {
      // Fetch all (including inactive) for admin view
      const res = await api.get('/services/specialists');
      setSpecialists(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getColor = (name) =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>✂️ Specialists</h2>
          <p>Manage your salon's service specialists</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditSpec(null); setShowForm(true); }}>
          + Add Specialist
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {specialists.map(s => (
          <div key={s.id} className="card" style={{ opacity: s.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: getColor(s.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0
              }}>
                {getInitials(s.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                  {s.specialization || 'General'}
                </div>
              </div>
              <span className={`badge ${s.is_active ? 'badge-success' : 'badge-gray'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--gray-600)' }}>
              {s.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📱</span> {s.phone}
                </div>
              )}
              {s.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📧</span> {s.email}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                Joined: {new Date(s.created_at).toLocaleDateString('en-IN')}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setEditSpec(s); setShowForm(true); }}
              >
                ✏️ Edit Profile
              </button>
            </div>
          </div>
        ))}

        {specialists.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="icon">✂️</div>
            <h3>No specialists yet</h3>
            <p>Add your first specialist to assign them to appointments</p>
          </div>
        )}
      </div>

      {showForm && (
        <SpecialistModal
          specialist={editSpec}
          onClose={() => setShowForm(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
