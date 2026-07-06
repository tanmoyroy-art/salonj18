import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function CustomerAnalyticsModal({ customer, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/customers/${customer.id}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customer.id]);

  return (
    <div className="modal-overlay">
      <div className="modal modal-xl">
        <div className="modal-header">
          <h3>📊 {customer.name} — Customer Analytics</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="spinner" /> : (
            <>
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#EDE9FE' }}>📅</div>
                  <div className="stat-info">
                    <div className="value">{data.visit_stats.total_visits || 0}</div>
                    <div className="label">Total Visits</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#DCFCE7' }}>📆</div>
                  <div className="stat-info">
                    <div className="value">{data.visit_stats.visits_month || 0}</div>
                    <div className="label">This Month</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#DBEAFE' }}>💰</div>
                  <div className="stat-info">
                    <div className="value">₹{parseFloat(data.visit_stats.total_spent || 0).toLocaleString('en-IN')}</div>
                    <div className="label">Total Spent</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#FEF3C7' }}>⭐</div>
                  <div className="stat-info">
                    <div className="value">
                      {data.visit_stats.total_visits > 0
                        ? `₹${(parseFloat(data.visit_stats.total_spent || 0) / data.visit_stats.total_visits).toFixed(0)}`
                        : '—'}
                    </div>
                    <div className="label">Avg per Visit</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Favorite Services</div>
                  {data.favorite_services.length > 0 ? (
                    data.favorite_services.map(s => (
                      <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                        <span>{s.name}</span>
                        <span>
                          <span className="badge badge-purple">{s.times_taken}x</span>
                          <span style={{ marginLeft: 8, fontWeight: 600 }}>₹{parseFloat(s.total_spent).toLocaleString('en-IN')}</span>
                        </span>
                      </div>
                    ))
                  ) : <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>No completed visits yet</div>}
                </div>

                <div>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Monthly Spending Trend</div>
                  {data.monthly_trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={[...data.monthly_trend].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                        <Tooltip formatter={v => `₹${parseFloat(v).toLocaleString('en-IN')}`} />
                        <Bar dataKey="spent" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>No data yet</div>}
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div><strong>First Visit:</strong> {data.visit_stats.first_visit ? new Date(data.visit_stats.first_visit).toLocaleDateString('en-IN') : '—'}</div>
                  <div><strong>Last Visit:</strong> {data.visit_stats.last_visit ? new Date(data.visit_stats.last_visit).toLocaleDateString('en-IN') : '—'}</div>
                  <div><strong>This Week:</strong> {data.visit_stats.visits_week || 0} visits</div>
                  <div><strong>This Year:</strong> {data.visit_stats.visits_year || 0} visits</div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [analyticsCustomer, setAnalyticsCustomer] = useState(null);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/customers${q ? `?search=${q}` : ''}`);
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(() => load(val), 400);
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>👥 Customers</h2>
          <p>{customers.length} registered customers</p>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <div className="search-bar">
            <span>🔍</span>
            <input placeholder="Search by name or phone..." value={search} onChange={handleSearch} />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total Visits</th>
                <th>Last Visit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    {c.email && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{c.email}</div>}
                  </td>
                  <td>{c.phone}</td>
                  <td><span className="badge badge-purple">{c.total_appointments || 0}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {c.last_visit ? new Date(c.last_visit).toLocaleDateString('en-IN') : 'Never'}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => setAnalyticsCustomer(c)}>
                      📊 Analytics
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">No customers found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {analyticsCustomer && (
        <CustomerAnalyticsModal customer={analyticsCustomer} onClose={() => setAnalyticsCustomer(null)} />
      )}
    </div>
  );
}
