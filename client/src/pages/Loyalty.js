import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const TIER_STYLE = {
  basic:   { icon: '🥈', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
  gold:    { icon: '🥇', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
  diamond: { icon: '💎', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
};

const TXN_STYLE = {
  earned:   { color: '#059669', bg: '#ECFDF5', icon: '⬆️', label: 'Earned'   },
  redeemed: { color: '#DC2626', bg: '#FEF2F2', icon: '⬇️', label: 'Redeemed' },
  bonus:    { color: '#7C3AED', bg: '#F5F3FF', icon: '🎁', label: 'Bonus'    },
  expired:  { color: '#6B7280', bg: '#F3F4F6', icon: '⏰', label: 'Expired'  },
  adjusted: { color: '#D97706', bg: '#FFFBEB', icon: '✏️', label: 'Adjusted' },
};

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ onSaved }) {
  const [plans, setPlans]         = useState([]);
  const [settings, setSettings]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      api.get('/loyalty/plan-rates'),
      api.get('/loyalty/settings'),
    ]);
    setPlans(p.data);
    const map = {};
    s.data.forEach(r => { map[r.key] = r.value; });
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePlanRate = async (plan) => {
    setSaving(true);
    try {
      await api.put(`/loyalty/plan-rates/${plan.id}`, { points_per_100: plan.points_per_100 });
      onSaved && onSaved();
    } catch (err) { alert(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/loyalty/settings', {
        settings: Object.entries(settings).map(([key, value]) => ({ key, value }))
      });
      alert('Settings saved!');
      onSaved && onSaved();
    } catch (err) { alert(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="spinner" />;

  const rate = parseFloat(settings.points_redemption_rate || 100);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Per-tier earning rates */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 20 }}>🎯 Points Earning Rate</h3>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
          Set how many points a member earns per ₹100 spent, based on their membership tier.
        </p>
        {plans.map(plan => {
          const ts = TIER_STYLE[plan.tier] || TIER_STYLE.basic;
          return (
            <div key={plan.id} style={{ background: ts.bg, border: `1.5px solid ${ts.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{ts.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{plan.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{plan.discount_percent}% service discount</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>₹100 spent =</span>
                <input
                  type="number"
                  style={{ width: 80, padding: '6px 10px', border: `1.5px solid ${ts.border}`, borderRadius: 8, fontSize: 15, fontWeight: 700, textAlign: 'center', background: 'white' }}
                  value={plan.points_per_100}
                  min={0}
                  step={0.5}
                  onChange={e => setPlans(plans.map(p => p.id === plan.id ? { ...p, points_per_100: e.target.value } : p))}
                />
                <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>point(s)</span>
                <button className="btn btn-primary btn-sm" onClick={() => savePlanRate(plan)} disabled={saving}>Save</button>
              </div>
              <div style={{ fontSize: 11, color: ts.color, marginTop: 8, fontWeight: 500 }}>
                e.g. ₹1000 service → {Math.round((1000 / 100) * plan.points_per_100)} points earned
              </div>
            </div>
          );
        })}
      </div>

      {/* Redemption settings */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 20 }}>💸 Redemption Settings</h3>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
          Set how much a point is worth when a customer redeems them.
        </p>

        <div className="form-group">
          <label className="form-label">Points needed for ₹1 discount</label>
          <input
            type="number"
            className="form-control"
            value={settings.points_redemption_rate || 100}
            min={1}
            onChange={e => setSettings({ ...settings, points_redemption_rate: e.target.value })}
          />
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
            e.g. 100 means 100 points = ₹1 discount
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Points expiry (days, 0 = never)</label>
          <input
            type="number"
            className="form-control"
            value={settings.points_expiry_days || 365}
            min={0}
            onChange={e => setSettings({ ...settings, points_expiry_days: e.target.value })}
          />
        </div>

        {/* Live example */}
        <div style={{ background: '#F5F3FF', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#5B21B6' }}>📊 Live Example</div>
          <div style={{ fontSize: 13, color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Gold member pays ₹1,000 →
              <strong style={{ color: '#D97706' }}> +{Math.round((1000/100) * (plans.find(p=>p.tier==='gold')?.points_per_100 || 2))} points earned</strong>
            </div>
            <div>{rate} points = <strong style={{ color: '#8B5CF6' }}>₹1 discount</strong></div>
            <div>100 points = <strong style={{ color: '#8B5CF6' }}>₹{(100/rate).toFixed(2)} discount</strong></div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Customer Points Detail Modal ───────────────────────────────────────────────
function CustomerPointsModal({ customer, onClose, onRefresh }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [bonus, setBonus]   = useState({ points: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/loyalty/customer/${customer.id}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customer.id]);

  const addBonus = async () => {
    if (!bonus.points || parseFloat(bonus.points) <= 0) return alert('Enter valid points');
    setSaving(true);
    try {
      await api.post('/loyalty/bonus', {
        customer_id: customer.id,
        points: parseFloat(bonus.points),
        description: bonus.description || 'Bonus points',
      });
      setBonus({ points: '', description: '' });
      const r = await api.get(`/loyalty/customer/${customer.id}`);
      setData(r.data);
      onRefresh && onRefresh();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>⭐ Points — {customer.name}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="spinner" /> : (
            <>
              {/* Balance */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Current Balance', value: parseFloat(data.wallet.total_points || 0).toFixed(1), icon: '⭐', color: '#8B5CF6', bg: '#F5F3FF' },
                  { label: 'Lifetime Earned', value: parseFloat(data.wallet.lifetime_points || 0).toFixed(1), icon: '🏆', color: '#D97706', bg: '#FFFBEB' },
                  { label: '₹ Value', value: `₹${(parseFloat(data.wallet.total_points || 0) / data.redemption_rate).toFixed(2)}`, icon: '💰', color: '#059669', bg: '#ECFDF5' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 24 }}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Add bonus */}
              <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>🎁 Add Bonus Points</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" className="form-control" placeholder="Points" style={{ width: 100 }}
                    value={bonus.points} onChange={e => setBonus({ ...bonus, points: e.target.value })} min={1} />
                  <input className="form-control" placeholder="Reason (e.g. Birthday gift)"
                    value={bonus.description} onChange={e => setBonus({ ...bonus, description: e.target.value })} />
                  <button className="btn btn-primary btn-sm" onClick={addBonus} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                    {saving ? '...' : '+ Add'}
                  </button>
                </div>
              </div>

              {/* Transaction history */}
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>📋 Points History</div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {data.transactions.length > 0 ? data.transactions.map(t => {
                  const ts = TXN_STYLE[t.transaction_type] || TXN_STYLE.earned;
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: ts.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {ts.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.description}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                            {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {t.performed_by_name && ` · by ${t.performed_by_name}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: ts.color, whiteSpace: 'nowrap' }}>
                        {parseFloat(t.points) > 0 ? '+' : ''}{parseFloat(t.points).toFixed(1)} pts
                      </div>
                    </div>
                  );
                }) : (
                  <div className="empty-state">No points history yet</div>
                )}
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

// ── Main Loyalty Page ─────────────────────────────────────────────────────────
export default function Loyalty() {
  const [tab, setTab]               = useState('settings');
  const [overview, setOverview]     = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading]       = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/loyalty/overview');
      setOverview(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'members') loadOverview();
  }, [tab, loadOverview]);

  const rate = parseFloat(overview?.settings?.points_redemption_rate || 100);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>⭐ Loyalty Program</h2>
          <p>Points earning rates, redemption settings, and member balances</p>
        </div>
      </div>

      <div className="tabs">
        {[
          { key: 'settings', label: '⚙️ Settings & Rates' },
          { key: 'members',  label: '👥 Members Points' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && <SettingsPanel onSaved={() => {}} />}

      {tab === 'members' && (
        loading ? <div className="spinner" /> : (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Member Points Balances</h3>
              <button className="btn btn-secondary btn-sm" onClick={loadOverview}>🔄 Refresh</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Membership</th>
                    <th>Points Balance</th>
                    <th>Rupee Value</th>
                    <th>Lifetime Points</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.customers?.map(c => {
                    const ts = TIER_STYLE[c.tier] || {};
                    const rupeeVal = (parseFloat(c.total_points || 0) / rate).toFixed(2);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{c.phone}</div>
                        </td>
                        <td>
                          {c.membership_name ? (
                            <span style={{ background: ts.bg, color: ts.color, padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                              {ts.icon} {c.membership_name}
                            </span>
                          ) : <span className="badge badge-gray">No Membership</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 18 }}>⭐</span>
                            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>
                              {parseFloat(c.total_points || 0).toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#059669' }}>₹{rupeeVal}</td>
                        <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                          {parseFloat(c.lifetime_points || 0).toFixed(1)} pts
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => setSelectedCustomer(c)}>
                            ⭐ View / Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!overview?.customers?.length && (
                    <tr><td colSpan={6}><div className="empty-state">No members with points yet</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {selectedCustomer && (
        <CustomerPointsModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onRefresh={loadOverview}
        />
      )}
    </div>
  );
}
