import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function StockHistoryModal({ product, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/products/${product.id}/transactions`)
      .then(r => setTransactions(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>📋 Stock History: {product.name}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="spinner" /> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Containers</th>
                    <th>By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontSize: 12 }}>
                        {new Date(t.created_at).toLocaleDateString('en-IN')}<br />
                        <span style={{ color: 'var(--gray-400)' }}>
                          {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${t.transaction_type === 'addition' ? 'badge-success' : t.transaction_type === 'deduction' ? 'badge-danger' : 'badge-warning'}`}>
                          {t.transaction_type === 'addition' ? '▲ IN' : '▼ OUT'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ color: t.transaction_type === 'addition' ? 'var(--success)' : 'var(--danger)' }}>
                          {t.transaction_type === 'addition' ? '+' : '-'}{parseFloat(t.quantity_ml).toFixed(1)} {t.unit_type}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        {t.quantity_containers > 0
                          ? `${parseFloat(t.quantity_containers).toFixed(2)} ${t.container_label}(s)`
                          : '—'}
                      </td>
                      <td style={{ fontSize: 13 }}>{t.performed_by_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t.notes || '—'}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={6}><div className="empty-state">No transactions yet</div></td></tr>
                  )}
                </tbody>
              </table>
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

export default function StockOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [filter, setFilter] = useState('all'); // all | low | out

  useEffect(() => {
    api.get('/analytics/stock')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const products = data?.products || [];
  const summary = data?.summary || {};

  const filtered = products.filter(p => {
    if (filter === 'low') return p.low_stock && p.current_stock_ml > 0;
    if (filter === 'out') return p.current_stock_ml <= 0;
    return true;
  });

  // Chart data — top 10 products by stock level (ml)
  const chartData = [...products]
    .sort((a, b) => b.current_stock_ml - a.current_stock_ml)
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
      stock: parseFloat(p.current_stock_ml),
      reorder: parseFloat(p.reorder_level_ml),
      low: p.low_stock,
    }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📦 Stock Overview</h2>
          <p>Real-time inventory levels across all products</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EDE9FE' }}>🧴</div>
          <div className="stat-info">
            <div className="value">{summary.total_products || 0}</div>
            <div className="label">Total Products</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7' }}>⚠️</div>
          <div className="stat-info">
            <div className="value">{summary.low_stock_count || 0}</div>
            <div className="label">Low Stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEE2E2' }}>🚨</div>
          <div className="stat-info">
            <div className="value">{summary.out_of_stock || 0}</div>
            <div className="label">Out of Stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#DCFCE7' }}>✅</div>
          <div className="stat-info">
            <div className="value">{(summary.total_products || 0) - (summary.low_stock_count || 0)}</div>
            <div className="label">Well Stocked</div>
          </div>
        </div>
      </div>

      {/* Stock bar chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Stock Levels — Top Products</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => [`${v} ml`, n === 'stock' ? 'Current Stock' : 'Reorder Level']} />
            <Bar dataKey="stock" radius={[4, 4, 0, 0]} name="stock">
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.stock <= 0 ? '#EF4444' : entry.low ? '#F59E0B' : '#8B5CF6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Products table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Products</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'low', label: '⚠️ Low Stock' },
              { key: 'out', label: '🚨 Out of Stock' },
            ].map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Containers</th>
                <th>30-Day Usage</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const stockPct = Math.min(100, (p.current_stock_ml / Math.max(p.reorder_level_ml * 3, 1)) * 100);
                const daysLeft = p.usage_30_days > 0
                  ? Math.floor((p.current_stock_ml / (p.usage_30_days / 30)))
                  : null;

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
                      <div style={{ fontWeight: 600 }}>{parseFloat(p.current_stock_ml).toFixed(1)} {p.unit_type}</div>
                      <div className="stock-bar" style={{ marginTop: 4 }}>
                        <div className="stock-bar-fill" style={{
                          width: `${stockPct}%`,
                          background: p.current_stock_ml <= 0 ? '#EF4444' : p.low_stock ? '#F59E0B' : '#10B981'
                        }} />
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {p.unit_size_per_tube > 0
                        ? `${parseFloat(p.containers || 0).toFixed(1)} ${p.container_label}(s)`
                        : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {parseFloat(p.usage_30_days) > 0
                        ? <span>{parseFloat(p.usage_30_days).toFixed(1)} {p.unit_type}</span>
                        : <span style={{ color: 'var(--gray-400)' }}>No usage</span>}
                      {daysLeft !== null && (
                        <div style={{ fontSize: 11, color: daysLeft < 7 ? 'var(--danger)' : 'var(--gray-400)' }}>
                          ~{daysLeft} days left
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {parseFloat(p.reorder_level_ml).toFixed(0)} {p.unit_type}
                    </td>
                    <td>
                      {p.current_stock_ml <= 0
                        ? <span className="badge badge-danger">OUT OF STOCK</span>
                        : p.low_stock
                          ? <span className="badge badge-warning">LOW STOCK</span>
                          : <span className="badge badge-success">OK</span>}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setHistoryProduct(p)}>
                        📋 History
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      {filter === 'all' ? 'No products found' : `No products in "${filter}" status`}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyProduct && (
        <StockHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}
    </div>
  );
}
