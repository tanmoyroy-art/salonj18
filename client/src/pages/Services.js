import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const MEDIA_URL = (filename) => `/api/services/media/file/${filename}`;

// ── Media Thumbnail ───────────────────────────────────────────────────────────
function MediaThumb({ item, onDelete, canDelete }) {
  return (
    <div style={{ position: 'relative', width: 90, height: 90, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
      {item.file_type === 'video' ? (
        <video src={MEDIA_URL(item.file_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
      ) : (
        <img src={MEDIA_URL(item.file_name)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: 'white' }}>
        {item.file_type === 'video' ? '🎥' : '🖼️'}
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(item.id)}
          style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >×</button>
      )}
    </div>
  );
}

// ── Service Detail Popup (hover) ──────────────────────────────────────────────
function ServiceDetailPopup({ service, onClose }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const media = service.media || [];
  const current = media[mediaIdx];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>💆 {service.name}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* Media viewer */}
          {media.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ width: '100%', height: 300, background: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
                {current?.file_type === 'video' ? (
                  <video
                    key={current.file_name}
                    src={MEDIA_URL(current.file_name)}
                    controls
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <img
                    src={MEDIA_URL(current.file_name)}
                    alt={service.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
                {media.length > 1 && (
                  <>
                    <button onClick={() => setMediaIdx(i => (i - 1 + media.length) % media.length)}
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>‹</button>
                    <button onClick={() => setMediaIdx(i => (i + 1) % media.length)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>›</button>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {media.length > 1 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                  {media.map((m, i) => (
                    <div key={m.id} onClick={() => setMediaIdx(i)}
                      style={{ width: 60, height: 60, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${i === mediaIdx ? '#8B5CF6' : 'transparent'}`, flexShrink: 0 }}>
                      {m.file_type === 'video'
                        ? <video src={MEDIA_URL(m.file_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        : <img src={MEDIA_URL(m.file_name)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              {service.description && <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 12 }}>{service.description}</p>}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span className="badge badge-info">⏱ {service.duration_minutes} min</span>
                <span className="badge badge-purple" style={{ fontSize: 14 }}>₹{parseFloat(service.price).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {service.products_required?.length > 0 && (
            <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Products Used</div>
              {service.products_required.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{p.product_name}</span>
                  <span style={{ color: '#8B5CF6', fontWeight: 600 }}>{p.quantity_ml} {p.unit_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Service Form Modal ────────────────────────────────────────────────────────
function ServiceFormModal({ service, products, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    duration_minutes: service?.duration_minutes || 30,
    price: service?.price || '',
    products_required: service?.products_required || [],
  });
  const [media, setMedia] = useState(service?.media || []);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQty, setProductQty] = useState('');
  const fileInputRef = useRef();

  const addProduct = () => {
    if (!selectedProduct || !productQty) return;
    const prod = products.find(p => p.id === parseInt(selectedProduct));
    const exists = form.products_required.find(p => p.product_id === parseInt(selectedProduct));
    if (exists) {
      setForm({ ...form, products_required: form.products_required.map(p => p.product_id === parseInt(selectedProduct) ? { ...p, quantity_ml: productQty } : p) });
    } else {
      setForm({ ...form, products_required: [...form.products_required, { product_id: parseInt(selectedProduct), product_name: prod?.name, unit_type: prod?.unit_type, quantity_ml: parseFloat(productQty) }] });
    }
    setSelectedProduct(''); setProductQty('');
  };

  const removeProduct = (pid) => setForm({ ...form, products_required: form.products_required.filter(p => p.product_id !== pid) });

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (!service?.id) { alert('Please save the service first before uploading media.'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await api.post(`/services/${service.id}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMedia(prev => [...prev, ...res.data]);
    } catch (err) { alert(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const deleteMedia = async (mediaId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await api.delete(`/services/media/${mediaId}`);
      setMedia(prev => prev.filter(m => m.id !== mediaId));
    } catch (err) { alert('Delete failed'); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (service?.id) {
        await api.put(`/services/${service.id}`, form);
      } else {
        await api.post('/services', form);
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save service');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{service?.id ? '✏️ Edit' : '➕ New'} Service</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Service Name *</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hair Wash & Blow Dry" />
            </div>
            <div className="form-group">
              <label className="form-label">Price (₹) *</label>
              <input type="number" className="form-control" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Duration (minutes) *</label>
              <input type="number" className="form-control" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          {/* Products */}
          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
            <label className="form-label">Products Used in This Service</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select className="form-control" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit_type})</option>)}
              </select>
              <input type="number" className="form-control" style={{ width: 120 }} placeholder="Qty (ml/g)" value={productQty} onChange={e => setProductQty(e.target.value)} />
              <button className="btn btn-primary" onClick={addProduct}>Add</button>
            </div>
            <div className="pill-list">
              {form.products_required.map(p => (
                <span key={p.product_id} className="pill">
                  🧴 {p.product_name}: {p.quantity_ml} {p.unit_type}
                  <span className="remove" onClick={() => removeProduct(p.product_id)}>×</span>
                </span>
              ))}
              {!form.products_required.length && <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>No products added</span>}
            </div>
          </div>

          {/* Media Upload */}
          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 16 }}>
            <label className="form-label">📸 Images & Videos</label>
            {!service?.id && (
              <div className="alert alert-info" style={{ marginBottom: 12 }}>Save the service first, then you can upload images and videos.</div>
            )}
            {service?.id && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {media.sort((a,b) => a.sort_order - b.sort_order).map(m => (
                    <MediaThumb key={m.id} item={m} onDelete={deleteMedia} canDelete={true} />
                  ))}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: 90, height: 90, borderRadius: 8, border: '2px dashed #D1D5DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, background: '#F9FAFB' }}
                  >
                    <span style={{ fontSize: 24 }}>+</span>
                    <span>Add</span>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={handleUpload} />
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {uploading ? '⏳ Uploading...' : 'Supported: JPG, PNG, GIF, WebP, MP4, WebM, MOV · Max 50MB each'}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !form.name || !form.price}>
            {loading ? 'Saving...' : '💾 Save Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Services Page ────────────────────────────────────────────────────────
export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editService, setEditService] = useState(null);
  const [previewService, setPreviewService] = useState(null);

  const load = async () => {
    try {
      const [s, p] = await Promise.all([api.get('/services'), api.get('/products')]);
      setServices(s.data);
      setProducts(p.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleService = async (id) => {
    try { await api.patch(`/services/${id}/toggle`); load(); }
    catch (err) { console.error(err); }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>💆 Services</h2>
          <p>Manage salon services, media, and product usage</p>
        </div>
        {user.role === 'super_admin' && (
          <button className="btn btn-primary" onClick={() => { setEditService(null); setShowForm(true); }}>+ New Service</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {services.map(s => {
          const firstMedia = s.media?.find(m => m.file_type === 'image') || s.media?.[0];
          return (
            <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: s.is_active ? 1 : 0.6 }}>
              {/* Media preview */}
              {firstMedia ? (
                <div style={{ height: 160, background: '#000', position: 'relative', cursor: 'pointer' }} onClick={() => setPreviewService(s)}>
                  {firstMedia.file_type === 'video'
                    ? <video src={MEDIA_URL(firstMedia.file_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    : <img src={MEDIA_URL(firstMedia.file_name)} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                  {s.media?.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 100, padding: '2px 10px', fontSize: 12 }}>
                      +{s.media.length - 1} more
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0)'}
                  />
                </div>
              ) : (
                <div
                  style={{ height: 80, background: 'linear-gradient(135deg, #EDE9FE, #FDF4FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, cursor: 'pointer' }}
                  onClick={() => setPreviewService(s)}
                >💆</div>
              )}

              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>₹{parseFloat(s.price).toLocaleString('en-IN')}</div>
                </div>
                {s.description && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>{s.description}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span className="badge badge-info">⏱ {s.duration_minutes} min</span>
                  <span className={`badge ${s.is_active ? 'badge-success' : 'badge-gray'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                  {s.media?.length > 0 && <span className="badge badge-purple">📸 {s.media.length} media</span>}
                </div>

                {user.role === 'super_admin' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditService(s); setShowForm(true); }}>✏️ Edit</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleService(s.id)}>
                      {s.is_active ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setPreviewService(s)}>👁️ Preview</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!services.length && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="icon">💆</div>
            <h3>No services yet</h3>
            <p>Create your first service to get started</p>
          </div>
        )}
      </div>

      {showForm && (
        <ServiceFormModal service={editService} products={products} onClose={() => setShowForm(false)} onSuccess={load} />
      )}
      {previewService && (
        <ServiceDetailPopup service={previewService} onClose={() => setPreviewService(null)} />
      )}
    </div>
  );
}
