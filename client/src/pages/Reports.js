import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [salesData, setSalesData] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let params = `period=${period}`;
      if (period === 'custom' && customFrom && customTo) {
        params = `from=${customFrom}&to=${customTo}`;
      }

      const [sales, daily, customers] = await Promise.all([
        api.get(`/analytics/sales?${params}`),
        api.get(`/analytics/daily?date=${today}`),
        api.get(`/analytics/top-customers?period=${period === 'custom' ? 'month' : period}`),
      ]);

      setSalesData(sales.data);
      setDailyData(daily.data);
      setTopCustomers(customers.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, today]);

  useEffect(() => { load(); }, [load]);

  const totals = salesData?.totals || {};
  const daily = salesData?.daily || [];

  // Build pie chart from today's services
  const servicesPie = dailyData?.by_service || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📈 Sales Reports</h2>
          <p>Revenue and appointment analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {['week', 'month', 'year', 'custom'].map(p => (
            <button
              key={p}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={load}>Apply</button>
          </div>
        </div>
      )}

      {loading ? <div className="spinner" /> : (
        <>
          {/* Summary stats */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#EDE9FE' }}>📅</div>
              <div className="stat-info">
                <div className="value">{totals.total_appointments || 0}</div>
                <div className="label">Total Appointments</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#DCFCE7' }}>✅</div>
              <div className="stat-info">
                <div className="value">{totals.total_completed || 0}</div>
                <div className="label">Completed</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#DBEAFE' }}>💰</div>
              <div className="stat-info">
                <div className="value">₹{parseFloat(totals.total_revenue || 0).toLocaleString('en-IN')}</div>
                <div className="label">Total Revenue</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#FEF3C7' }}>📊</div>
              <div className="stat-info">
                <div className="value">
                  ₹{totals.total_completed > 0
                    ? Math.round(totals.total_revenue / totals.total_completed).toLocaleString('en-IN')
                    : 0}
                </div>
                <div className="label">Avg per Appointment</div>
              </div>
            </div>
          </div>

          {/* Revenue line chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3 className="card-title">Revenue Over Time</h3>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                {salesData?.from} → {salesData?.to}
              </div>
            </div>
            {daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip
                    formatter={(v, n) => [n === 'revenue' ? `₹${parseFloat(v).toLocaleString('en-IN')}` : v, n === 'revenue' ? 'Revenue' : 'Appointments']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} dot={false} name="revenue" />
                  <Line type="monotone" dataKey="appointments" stroke="#EC4899" strokeWidth={2} dot={false} name="appointments" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No data for this period</div>
            )}
          </div>

          {/* 2-column: bar chart + pie */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Daily Appointments</h3>
              </div>
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#8B5CF6" radius={[3, 3, 0, 0]} name="Completed" />
                    <Bar dataKey="appointments" fill="#EDE9FE" radius={[3, 3, 0, 0]} name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">No data</div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Today's Services</h3>
              </div>
              {servicesPie.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={servicesPie} dataKey="count" nameKey="service_name" cx="50%" cy="50%" outerRadius={60}>
                        {servicesPie.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {servicesPie.map((s, i) => (
                      <div key={s.service_name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{s.service_name}</span>
                        <span style={{ fontWeight: 600 }}>{s.count}x</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>No services today</div>
              )}
            </div>
          </div>

          {/* Today's payment breakdown + top customers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Today's Payment Methods</h3>
              </div>
              {dailyData?.by_payment_method?.length > 0 ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Count</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.by_payment_method.map(p => (
                        <tr key={p.payment_method}>
                          <td style={{ textTransform: 'uppercase', fontWeight: 500 }}>
                            {p.payment_method === 'cash' ? '💵' : p.payment_method === 'card' ? '💳' : p.payment_method === 'upi' ? '📱' : '💰'}
                            {' '}{p.payment_method}
                          </td>
                          <td>{p.count}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            ₹{parseFloat(p.total).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>No payments today</div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Top Customers ({period})</h3>
              </div>
              {topCustomers.length > 0 ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Visits</th>
                        <th>Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.slice(0, 5).map((c, i) => (
                        <tr key={c.id}>
                          <td>
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: i < 3 ? ['#F59E0B', '#9CA3AF', '#D97706'][i] : 'var(--gray-200)',
                              color: i < 3 ? 'white' : 'var(--gray-600)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700
                            }}>
                              {i + 1}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{c.phone}</div>
                          </td>
                          <td>{c.visits}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            ₹{parseFloat(c.total_spent).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>No data</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
