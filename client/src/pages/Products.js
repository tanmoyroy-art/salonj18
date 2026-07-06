import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const UNITS = ['ml', 'g', 'l', 'kg'];

function AddStockModal({ product, onClose, onSuccess }) {
  const [inputType, setInputType] = useState('containers');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState('');

  const calcPreview = (val, type) => {
    if (!val || !product.unit_size_per_tube) return;
    const num = parseFloat(val);
    if (type === 'containers') {
      setPreview(`= ${(num * product.unit_size_per_tube).toFixed(1)} ${product.unit_type} total`);
    } else {
      setPreview(`= ${(num / product.unit_size_per_tube).toFixed(2)} ${product.container_label}(s)`);
    }
  };

  const handleQuantityChange = (val) => {
    setQuantity(val);
    calcPreview(val, inputType);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        notes,
        quantity_ml: inputType === 'ml' ? quantity : 0,
        quantity_containers: inputType === 'containers' ? quantity : 0,
      };
      const res = await api.post(`/products/${product.id}/stock`, payload);
      alert(res.data.message);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>📦 Add Stock: {product.name}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Current stock: <strong>{parseFloat(product.current_stock_ml).toFixed(1)} {product.unit_type}</strong>
            {product.unit_size_per_tube > 0 && (
              <span> = <strong>{product.current_stock_containers} {product.container_label}(s)</strong></span>
            )}
          </div>

          {product.unit_size_per_tube > 0 && (
            <div className="form-group">
              <label className="form-label">Add by</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${inputType === 'containers' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => { setInputType('containers'); setPreview(''); setQuantity(''); }}
                >
                  By {product.container_label}(s)
                </button>
                <button
                  className={`btn ${inputType === 'ml' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => { setInputType('ml'); setPreview(''); setQuantity(''); }}
                >
                  By {product.unit_type}
                </button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Quantity {inputType === 'containers' ? `(${product.container_label}s)` : `(${product.unit_type})`}
            </label>
            <input
              type="number"
              className="form-control"
              placeholder={inputType === 'containers' ? `e.g. 10 ${product.container_label}s` : `e.g. 800 ${product.unit_type}`}
              value={quantity}
              onChange={e => handleQuantityChange(e.target.value)}
              min="0.01"
              step="0.01"
            />
            {preview && (
              <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>
                🔄 {preview}
                {product.unit_size_per_tube > 0 && (
                  <span style={{ color: 'var(--gray-500)', marginLeft: 8 }}>
                    (1 {product.container_label} = {product.unit_size_per_tube} {product.unit_type})
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Received from supplier"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !quantity}>
            {loading ? 'Adding...' : '📦 Add to Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({ product, categories, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    category_id: product?.category_id || '',
    unit_type: product?.unit_type || 'ml',
    unit_size_per_tube: product?.unit_size_per_tube || '',
    container_label: product?.container_label || 'tube',
    reorder_level_ml: product?.reorder_level_ml || 500,
    price_per_unit: product?.price_per_unit || '',
    description: product?.description || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (product?.id) {
        await api.put(`/products/${product.id}`, form);
      } else {
        await api.post('/products', form);
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{product?.id ? '✏️ Edit' : '➕ Add'} Product</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dove Shampoo" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unit Type *</label>
              <select className="form-control" value={form.unit_type} onChange={e => setForm({ ...form, unit_type: e.target.value })}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Container Label</label>
              <input className="form-control" value={form.container_label} onChange={e => setForm({ ...form, container_label: e.target.value })} placeholder="tube / bottle / jar / sachet" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Size per {form.container_label || 'container'} ({form.unit_type})
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>e.g. 80 means 1 tube = 80ml</span>
            </label>
            <input
              type="number"
              className="form-control"
              value={form.unit_size_per_tube}
              onChange={e => setForm({ ...form, unit_size_per_tube: e.target.value })}
              placeholder={`e.g. 80 ${form.unit_type}`}
              min="0"
            />
          </div>

          {form.unit_size_per_tube > 0 && (
            <div className="alert alert-info" style={{ fontSize: 13 }}>
              📦 Example: If you add <strong>800 {form.unit_type}</strong>, it will be shown as <strong>{(800 / form.unit_size_per_tube).toFixed(1)} {form.container_label}(s)</strong>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Reorder Level ({form.unit_type})</label>
              <input type="number" className="form-control" value={form.reorder_level_ml} onChange={e => setForm({ ...form, reorder_level_ml: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Price per {form.unit_type} (₹)</label>
              <input type="number" className="form-control" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !form.name}>
            {loading ? 'Saving...' : '💾 Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Products({ readonly = false }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStock, setShowStock] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const [p, c] = await Promise.all([api.get('/products'), api.get('/products/categories')]);
      setProducts(p.data);
      setCategories(c.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🧴 Products</h2>
          <p>Manage salon products and inventory</p>
        </div>
        {!readonly && (
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true); }}>
            + Add Product
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <div className="search-bar">
            <span>🔍</span>
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Stock ({`ml/g`})</th>
                <th>Containers</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const stockPct = Math.min(100, (p.current_stock_ml / (p.reorder_level_ml * 3)) * 100);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {p.unit_size_per_tube > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                          1 {p.container_label} = {p.unit_size_per_tube} {p.unit_type}
                        </div>
                      )}
                    </td>
                    <td><span className="badge badge-gray">{p.category_name || '—'}</span></td>
                    <td>
                      <div>{parseFloat(p.current_stock_ml).toFixed(1)} {p.unit_type}</div>
                      <div className="stock-bar" style={{ marginTop: 4 }}>
                        <div className="stock-bar-fill" style={{
                          width: `${stockPct}%`,
                          background: p.low_stock ? (p.current_stock_ml <= 0 ? '#EF4444' : '#F59E0B') : '#10B981'
                        }} />
                      </div>
                    </td>
                    <td>
                      {p.unit_size_per_tube > 0 ? (
                        <span>{parseFloat(p.current_stock_containers || 0).toFixed(1)} {p.container_label}(s)</span>
                      ) : '—'}
                    </td>
                    <td>
                      {p.current_stock_ml <= 0
                        ? <span className="badge badge-danger">OUT</span>
                        : p.low_stock
                          ? <span className="badge badge-warning">LOW</span>
                          : <span className="badge badge-success">OK</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!readonly && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowStock(p)}>+ Stock</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditProduct(p); setShowForm(true); }}>Edit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state">No products found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSuccess={load}
        />
      )}

      {showStock && (
        <AddStockModal
          product={showStock}
          onClose={() => setShowStock(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
