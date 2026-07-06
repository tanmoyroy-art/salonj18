import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const [daily, setDaily] = useState(null);
  const [sales, setSales] = useState(null);
  const [stock, setStock] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      api.get(`/analytics/daily?date=${today}`),
      api.get(`/analytics/sales?period=${period}`),
      api.get('/analytics/stock'),
      api.get(`/analytics/top-customers?period=${period}`)
    ]).then(([d, s, st, tc]) => {
      setDaily(d.data);
      setSales(s.data);
      setStock(st.data);
      setTopCustomers(tc.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="spinner" />;

  const summary = daily?.summary || {};
  const stockSummary = stock?.summary || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Overview Dashboard</h2>
          <p>Today: {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['week', 'month', 'year'].map(p => (
            <button key={p} className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setPeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Today's stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EDE9FE' }}>📅</div>
          <div className="stat-info">
            <div className="value">{summary.total_appointments || 0}</div>
            <div className="label">Today's Appointments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#DCFCE7' }}>✅</div>
          <div className="stat-info">
            <div className="value">{summary.completed || 0}</div>
            <div className="label">Completed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#DBEAFE' }}>💰</div>
          <div className="stat-info">
            <div className="value">₹{parseFloat(summary.total_revenue || 0).toLocaleString('en-IN')}</div>
            <div className="label">Today's Revenue</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7' }}>⏳</div>
          <div className="stat-info">
            <div className="value">₹{parseFloat(summary.pending_payments || 0).toLocaleString('en-IN')}</div>
            <div className="label">Pending Payments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEE2E2' }}>⚠️</div>
          <div className="stat-info">
            <div className="value">{stockSummary.low_stock_count || 0}</div>
            <div className="label">Low Stock Items</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Revenue Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={sales?.daily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tickFormatter={d => d?.slice(5)} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={(v) => `₹${parseFloat(v).toLocaleString('en-IN')}`} />
              <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Today by Service</h3>
          </div>
          {daily?.by_service?.length > 0 ? (
            <div>
              {daily.by_service.map(s => (
                <div key={s.service_name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--gray-700)' }}>{s.service_name}</span>
                  <span>
                    <span className="badge badge-purple">{s.count}x</span>
                    <span style={{ marginLeft: 8, fontWeight: 600 }}>₹{parseFloat(s.revenue).toLocaleString('en-IN')}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div>No services today</div>
            </div>
          )}
        </div>
      </div>

      {/* Top Customers + Low Stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Customers</h3>
          </div>
          {topCustomers.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Visits</th>
                    <th>Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.slice(0, 5).map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{c.phone}</div>
                      </td>
                      <td>{c.visits}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{parseFloat(c.total_spent).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>No data for this period</div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">⚠️ Low Stock Alert</h3>
          </div>
          {stock?.products?.filter(p => p.low_stock).length > 0 ? (
            <div>
              {stock.products.filter(p => p.low_stock).slice(0, 6).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.category_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: p.current_stock_ml <= 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                      {p.current_stock_ml <= 0 ? 'OUT' : `${parseFloat(p.current_stock_ml).toFixed(0)} ${p.unit_type}`}
                    </div>
                    {p.unit_size_per_tube > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.containers} {p.container_label}(s)</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div>✅ All products stocked</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
