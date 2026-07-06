import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

function OfferFormModal({ offer, services, onClose, onSuccess }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    name: offer?.name || '',
    description: offer?.description || '',
    discount_percent: offer?.discount_percent || '',
    start_date: offer?.start_date ? offer.start_date.split('T')[0] : today,
    end_date: offer?.end_date ? offer.end_date.split('T')[0] : today,
    is_active: offer?.is_active ?? true,
    service_ids: offer?.services?.map(s => s.service_id) || [],
  });
  const [loading, setLoading] = useState(false);

  const toggleService = (id) => {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter(s => s !== id)
        : [...f.service_ids, id]
    }));
  };

  const selectAll = () => setForm(f => ({ ...f, service_ids: services.map(s => s.id) }));
  const clearAll  = () => setForm(f => ({ ...f, service_ids: [] }));

  const handleSubmit = async () => {
    if (!form.name || !form.discount_percent || !form.start_date || !form.end_date)
      return alert('Please fill all required fields');
    if (form.service_ids.length === 0)
      return alert('Select at least one service for this offer');
    if (new Date(form.end_date) < new Date(form.start_date))
      return alert('End date must be after start date');

    setLoading(true);
    try {
      if (offer?.id) {
        await api.put(`/offers/${offer.id}`, form);
      } else {
        await api.post('/offers', form);
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save offer');
    } finally { setLoading(false); }
  };

  const dayCount = form.start_date && form.end_date
    ? Math.max(0, Math.ceil((new Date(form.end_date) - new Date(form.start_date)) / 86400000) + 1)
    : 0;

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{offer?.id ? '✏️ Edit' : '🎉 New'} Festival Offer</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Offer Name *</label>
              <input className="form-control" placeholder="e.g. Diwali Special, Summer Sale"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Discount % *</label>
              <input type="number" className="form-control" placeholder="e.g. 20"
                value={form.discount_percent} min={1} max={100}
                onChange={e => setForm({ ...form, discount_percent: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input type="date" className="form-control" value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input type="date" className="form-control" value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>

          {dayCount > 0 && (
            <div style={{ background: '#EDE9FE', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#5B21B6', marginBottom: 16 }}>
              📅 Offer runs for <strong>{dayCount} day{dayCount > 1 ? 's' : ''}</strong>
              {' '}({new Date(form.start_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              {' '} → {new Date(form.end_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })})
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input className="form-control" placeholder="Short description shown to customers"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          {offer?.id && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                <span className="form-label" style={{ margin: 0 }}>Active</span>
              </label>
            </div>
          )}

          {/* Service selection */}
          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Services Included * ({form.service_ids.length} selected)
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={selectAll}>All</button>
                <button className="btn btn-secondary btn-sm" onClick={clearAll}>Clear</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {services.map(svc => {
                const sel = form.service_ids.includes(svc.id);
                return (
                  <div key={svc.id} onClick={() => toggleService(svc.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `2px solid ${sel ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 10, cursor: 'pointer', background: sel ? 'var(--primary-light)' : 'white', transition: 'all 0.15s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? 'var(--primary)' : 'var(--gray-300)'}`, background: sel ? 'var(--primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svc.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>₹{parseFloat(svc.price).toLocaleString('en-IN')} · {svc.duration_minutes}min</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          {form.service_ids.length > 0 && form.discount_percent && (
            <div style={{ background: 'linear-gradient(135deg,#FEF3C7,#FFFBEB)', border: '1.5px solid #FCD34D', borderRadius: 12, padding: 14, marginTop: 16 }}>
              <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 6 }}>🎉 Preview</div>
              <div style={{ fontSize: 13, color: '#78350F' }}>
                <strong>"{form.name || 'Offer'}"</strong> — {form.discount_percent}% off on {form.service_ids.length} service(s)
              </div>
              <div style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>
                ⚠️ During this offer period, membership discounts will be paused — customers get offer discount instead.
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : '🎉 Save Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Offers() {
  const [offers, setOffers]     = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editOffer, setEditOffer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([api.get('/offers'), api.get('/services')]);
      setOffers(o.data);
      setServices(s.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteOffer = async (id) => {
    if (!window.confirm('Delete this offer?')) return;
    try { await api.delete(`/offers/${id}`); load(); }
    catch (err) { alert(err.response?.data?.error || 'Delete failed'); }
  };

  const today = new Date().toISOString().split('T')[0];

  const getStatus = (offer) => {
    if (!offer.is_active) return { label: 'Inactive', cls: 'badge-gray' };
    if (today < offer.start_date.split('T')[0]) return { label: 'Upcoming', cls: 'badge-info' };
    if (today > offer.end_date.split('T')[0]) return { label: 'Expired', cls: 'badge-danger' };
    return { label: '🔥 Active Now', cls: 'badge-success' };
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🎉 Festival Offers</h2>
          <p>Create date-range discount offers for specific services</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditOffer(null); setShowForm(true); }}>
          + New Offer
        </button>
      </div>

      {/* Active offers banner */}
      {offers.filter(o => o.is_active && today >= o.start_date.split('T')[0] && today <= o.end_date.split('T')[0]).length > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🔥</span>
          <div>
            <div style={{ fontWeight: 700, color: 'white', fontSize: 15 }}>
              {offers.filter(o => o.is_active && today >= o.start_date.split('T')[0] && today <= o.end_date.split('T')[0]).length} offer(s) running today!
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
              Membership discounts are overridden by these offers for eligible services
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px,1fr))', gap: 16 }}>
        {offers.map(offer => {
          const status = getStatus(offer);
          const startD = offer.start_date.split('T')[0];
          const endD   = offer.end_date.split('T')[0];
          const days   = Math.ceil((new Date(endD) - new Date(startD)) / 86400000) + 1;
          const isLive = offer.is_active && today >= startD && today <= endD;

          return (
            <div key={offer.id} className="card" style={{ border: isLive ? '2px solid #F59E0B' : '1px solid var(--gray-200)', position: 'relative', overflow: 'hidden' }}>
              {isLive && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#F59E0B,#D97706)' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{offer.name}</div>
                  {offer.description && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{offer.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#D97706' }}>{offer.discount_percent}%</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>discount</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className={`badge ${status.cls}`}>{status.label}</span>
                <span className="badge badge-info">📅 {days} day{days>1?'s':''}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
                📆 {new Date(startD).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                {' '} → {new Date(endD).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
              </div>

              {offer.services?.length > 0 && (
                <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Services ({offer.services.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {offer.services.slice(0, 5).map(s => (
                      <span key={s.service_id} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500 }}>
                        {s.service_name}
                      </span>
                    ))}
                    {offer.services.length > 5 && (
                      <span style={{ background: 'var(--gray-200)', color: 'var(--gray-600)', padding: '2px 8px', borderRadius: 100, fontSize: 11 }}>
                        +{offer.services.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditOffer(offer); setShowForm(true); }}>✏️ Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteOffer(offer.id)}>🗑️ Delete</button>
              </div>
            </div>
          );
        })}

        {offers.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="icon">🎉</div>
            <h3>No offers yet</h3>
            <p>Create your first festival offer to give customers special discounts</p>
          </div>
        )}
      </div>

      {showForm && (
        <OfferFormModal
          offer={editOffer}
          services={services}
          onClose={() => setShowForm(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
