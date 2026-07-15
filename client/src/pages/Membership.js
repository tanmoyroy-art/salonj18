import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import MembershipCard from '../components/MembershipCard';

const TIER_STYLE = {
  basic:   { bg: '#F9FAFB', border: '#D1D5DB', badge: 'badge-gray',   icon: '🥈', label: 'Basic'   },
  gold:    { bg: '#FFFBEB', border: '#FCD34D', badge: 'badge-warning', icon: '🥇', label: 'Gold'    },
  diamond: { bg: '#F5F3FF', border: '#C4B5FD', badge: 'badge-purple', icon: '💎', label: 'Diamond' },
};

// ── Plan Editor ───────────────────────────────────────────────────────────────
function PlanCard({ plan, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...plan });
  const [loading, setLoading] = useState(false);
  const ts = TIER_STYLE[plan.tier] || TIER_STYLE.basic;

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/membership/plans/${plan.id}`, form);
      onSave();
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background: ts.bg, border: `2px solid ${ts.border}`, borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{ts.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{plan.name}</div>
          <span className={`badge ${ts.badge}`}>{ts.label}</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(!editing)}>
          {editing ? '✕ Cancel' : '✏️ Edit'}
        </button>
      </div>

      {editing ? (
        <div>
          <div className="form-group">
            <label className="form-label">Plan Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Discount %</label>
              <input type="number" className="form-control" value={form.discount_percent} min={0} max={100}
                onChange={e => setForm({ ...form, discount_percent: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Price (₹)</label>
              <input type="number" className="form-control" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Duration (days)</label>
              <input type="number" className="form-control" value={form.duration_days}
                onChange={e => setForm({ ...form, duration_days: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Active</label>
              <select className="form-control" value={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Benefits Description</label>
            <textarea className="form-control" rows={2} value={form.benefits || ''}
              onChange={e => setForm({ ...form, benefits: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6B7280', fontSize: 14 }}>Discount</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#8B5CF6' }}>{plan.discount_percent}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6B7280', fontSize: 14 }}>Price</span>
            <span style={{ fontWeight: 700 }}>₹{parseFloat(plan.price).toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#6B7280', fontSize: 14 }}>Duration</span>
            <span style={{ fontWeight: 600 }}>{plan.duration_days} days</span>
          </div>
          {plan.benefits && <div style={{ fontSize: 12, color: '#6B7280' }}>{plan.benefits}</div>}
        </div>
      )}
    </div>
  );
}

// ── Blackout Calendar ─────────────────────────────────────────────────────────
function BlackoutCalendar({ blackouts, onAdd, onRemove }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [addDate, setAddDate] = useState('');
  const [addReason, setAddReason] = useState('');
  const [loading, setLoading] = useState(false);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const blackoutSet = new Set(blackouts.map(b => b.date.split('T')[0].slice(0, 10)));
  const blackoutMap = {};
  blackouts.forEach(b => { blackoutMap[b.date.split('T')[0].slice(0, 10)] = b; });

  const handleAdd = async () => {
    if (!addDate) return;
    setLoading(true);
    try {
      await onAdd(addDate, addReason);
      setAddDate(''); setAddReason('');
    } finally { setLoading(false); }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>←</button>
        <strong style={{ fontSize: 16 }}>{MONTH_NAMES[viewMonth]} {viewYear}</strong>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth}>→</button>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', padding: '4px 0' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isBlackout = blackoutSet.has(dateStr);
          const isPast = new Date(dateStr) < new Date(today.toISOString().split('T')[0]);
          const isToday = dateStr === today.toISOString().split('T')[0];

          return (
            <div
              key={day}
              title={isBlackout ? blackoutMap[dateStr]?.reason || 'Blackout' : ''}
              style={{
                textAlign: 'center', padding: '8px 4px', borderRadius: 8, fontSize: 13,
                background: isBlackout ? '#FEE2E2' : isToday ? '#EDE9FE' : 'transparent',
                color: isBlackout ? '#991B1B' : isPast ? '#D1D5DB' : '#374151',
                border: isToday ? '2px solid #8B5CF6' : isBlackout ? '1px solid #FECACA' : '1px solid transparent',
                fontWeight: isToday || isBlackout ? 700 : 400,
                cursor: isBlackout ? 'pointer' : 'default',
                position: 'relative',
              }}
              onClick={() => isBlackout && onRemove(blackoutMap[dateStr])}
            >
              {day}
              {isBlackout && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#EF4444' }} />}
            </div>
          );
        })}
      </div>

      <div style={{ background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: 12, color: '#991B1B', marginBottom: 16 }}>
        🔴 Red dates = membership discount blocked. Click a red date to remove it.
      </div>

      {/* Add blackout */}
      <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>➕ Add Blackout Date</div>
        <div className="form-row">
          <div className="form-group" style={{ margin: 0 }}>
            <input type="date" className="form-control" value={addDate} min={today.toISOString().split('T')[0]}
              onChange={e => setAddDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <input className="form-control" placeholder="Reason (e.g. Diwali Offer)" value={addReason}
              onChange={e => setAddReason(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-danger btn-sm" style={{ marginTop: 10 }} onClick={handleAdd} disabled={!addDate || loading}>
          {loading ? 'Adding…' : '🚫 Block This Date'}
        </button>
      </div>
    </div>
  );
}

// ── Assign Membership Modal ───────────────────────────────────────────────────
function AssignModal({ plans, onClose, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [customerForm, setCustomerForm] = useState({
    name: '', phone: '', email: '', whatsapp_number: '', date_of_birth: '',
  });
  const [plan, setPlan] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [loading, setLoading] = useState(false);

  // payment step state
  const [step, setStep] = useState('form'); // 'form' | 'payment' | 'done'
  const [pendingMembership, setPendingMembership] = useState(null);
  const [upiData, setUpiData] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(null);

  const lookup = async () => {
    try {
      const res = await api.get(`/customers/lookup/${phone}`);
      if (res.data.exists) { setCustomer(res.data.customer); setIsNewCustomer(false); }
      else {
        setCustomer(null); setIsNewCustomer(true);
        setCustomerForm({ name: '', phone, email: '', whatsapp_number: '', date_of_birth: '' });
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setCustomer(null); setIsNewCustomer(true);
        setCustomerForm({ name: '', phone, email: '', whatsapp_number: '', date_of_birth: '' });
        return;
      }
      alert(err.response?.data?.error || 'Lookup failed');
    }
  };

  const handleAssign = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      const payload = { plan_id: Number(plan), start_date: startDate, payment_method: paymentMethod };
      if (customer) payload.customer_id = customer.id;
      else payload.customer = customerForm;

      const res = await api.post('/membership/assign', payload);
      setPendingMembership(res.data.membership);

      if (paymentMethod === 'upi') {
        const upiRes = await api.get(`/membership/upi-string/${res.data.membership.id}`);
        setUpiData(upiRes.data);
      }
      setStep('payment');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign');
    } finally { setLoading(false); }
  };

  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      const res = await api.post(`/membership/${pendingMembership.id}/confirm-payment`);
      setPointsEarned(res.data.points_earned);
      setStep('done');
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm payment');
    } finally { setConfirming(false); }
  };

  const selectedPlan = plans.find(p => p.id === parseInt(plan));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>🎫 Assign Membership</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {step === 'form' && (
          <>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Customer Phone</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" placeholder="Mobile number" value={phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPhone(value);
                      if (isNewCustomer) {
                        setCustomerForm(prev => ({ ...prev, phone: value, whatsapp_number: sameWhatsapp ? value : prev.whatsapp_number }));
                      }
                    }}
                    onKeyDown={e => e.key === 'Enter' && lookup()} />
                  <button className="btn btn-primary btn-sm" onClick={lookup}>Find</button>
                </div>
                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={sameWhatsapp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSameWhatsapp(checked);
                        setCustomerForm(prev => ({ ...prev, whatsapp_number: checked ? prev.phone : '' }));
                      }}
                    /> Same as Contact Number
                  </label>
                </div>
              </div>

              {customer && <div className="alert alert-success">✅ {customer.name} ({customer.phone})</div>}

              {isNewCustomer && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <h4>Create New Customer</h4>
                  <div className="form-group">
                    <label>Name</label>
                    <input className="form-control" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input className="form-control" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>WhatsApp Number</label>
                    <input className="form-control" value={customerForm.whatsapp_number} disabled={sameWhatsapp}
                      onChange={(e) => setCustomerForm({ ...customerForm, whatsapp_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input type="date" className="form-control" value={customerForm.date_of_birth} onChange={(e) => setCustomerForm({ ...customerForm, date_of_birth: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Membership Plan</label>
                <select className="form-control" value={plan} onChange={e => setPlan(e.target.value)}>
                  <option value="">Select plan</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {TIER_STYLE[p.tier]?.icon} {p.name} — {p.discount_percent}% off · ₹{parseFloat(p.price).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlan && (
                <div style={{ background: '#F5F3FF', borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>
                  <strong>{selectedPlan.name}</strong>: {selectedPlan.discount_percent}% discount for {selectedPlan.duration_days} days · ₹{parseFloat(selectedPlan.price).toLocaleString('en-IN')}
                  {selectedPlan.points_per_100 > 0 && (
                    <div style={{ marginTop: 4, color: '#8B5CF6' }}>
                      ⭐ Earns ~{Math.floor((parseFloat(selectedPlan.price) / 100) * selectedPlan.points_per_100)} loyalty points on payment
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="upi">UPI (QR code)</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={!plan || loading}>
                {loading ? 'Processing…' : 'Continue to Payment →'}
              </button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, marginBottom: 12 }}>
                Amount Due: <strong>₹{parseFloat(pendingMembership.amount_paid).toLocaleString('en-IN')}</strong>
              </div>

              {paymentMethod === 'upi' && upiData && (
                <div style={{ marginBottom: 16 }}>
                  <img
                    alt="UPI QR"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiData.upi_string)}`}
                    style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
                  />
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                    Scan to pay {upiData.upi_name} ({upiData.upi_id})
                  </div>
                </div>
              )}

              {paymentMethod !== 'upi' && (
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 13, color: '#6B7280' }}>
                  Collect payment via {paymentMethod}, then confirm below.
                </div>
              )}

              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: 10, fontSize: 12, color: '#92400E' }}>
                ⚠️ Membership stays inactive and no loyalty points are added until payment is confirmed.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep('form')}>← Back</button>
              <button className="btn btn-primary" onClick={handleConfirmPayment} disabled={confirming}>
                {confirming ? 'Confirming…' : '✅ Confirm Payment Received'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Membership Activated</div>
              {pointsEarned > 0 && (
                <div style={{ color: '#8B5CF6', fontWeight: 600 }}>+{pointsEarned} loyalty points credited</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Membership() {
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cardData,setCardData]=useState(null);
  const [showCard,setShowCard]=useState(false);

  const load = useCallback(async () => {
    try {
      const [p, m, b] = await Promise.all([
        api.get('/membership/plans'),
        api.get('/membership/all'),
        api.get('/membership/blackout'),
      ]);
      setPlans(p.data);
      setMemberships(m.data);
      setBlackouts(b.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addBlackout = async (date, reason) => {
    await api.post('/membership/blackout', { date, reason });
    load();
  };
  const openMembershipCard = async(customerId)=>{
    try{
        const res = await api.get(
            `/membership/card/${customerId}`
        );
        setCardData(res.data);
        setShowCard(true);
    }catch(err){
        alert(
            err.response?.data?.error ||
            "Unable to load membership card."
        );
    }
  };
  const removeBlackout = async (row) => {
    if (!window.confirm(`Remove blackout for ${row.date}?`)) return;
    await api.delete(`/membership/blackout/${row.id}`);
    load();
  };

  const cancelMembership = async (id) => {
    if (!window.confirm('Cancel this membership?')) return;
    await api.patch(`/membership/${id}/cancel`);
    load();
  };

  if (loading) return <div className="spinner" />;

  const activeMemberships = memberships.filter(m => m.status === 'active');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🎫 Membership System</h2>
          <p>Manage plans, assign memberships, and control blackout dates</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAssign(true)}>+ Assign Membership</button>
      </div>

      {/* Summary */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EDE9FE' }}>🎫</div>
          <div className="stat-info">
            <div className="value">{activeMemberships.length}</div>
            <div className="label">Active Members</div>
          </div>
        </div>
        {plans.map(p => (
          <div className="stat-card" key={p.id}>
            <div className="stat-icon" style={{ background: '#FEF3C7', fontSize: 22 }}>{TIER_STYLE[p.tier]?.icon}</div>
            <div className="stat-info">
              <div className="value">{memberships.filter(m => m.tier === p.tier && m.status === 'active').length}</div>
              <div className="label">{p.name} Members</div>
            </div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEE2E2' }}>🚫</div>
          <div className="stat-info">
            <div className="value">{blackouts.length}</div>
            <div className="label">Blackout Dates</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {[
          { key: 'plans', label: '📋 Plans' },
          { key: 'members', label: '👥 Active Members' },
          { key: 'blackout', label: '🚫 Blackout Calendar' },
          { key: 'history', label: '📜 All History' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} onSave={load} />)}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Discount</th>
                  <th>Valid Until</th>
                  <th>Paid</th>
                  <th>Member ID</th>
                  <th>Card</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeMemberships.map(m => {
                  const ts = TIER_STYLE[m.tier] || TIER_STYLE.basic;
                  const daysLeft = Math.ceil((new Date(m.end_date) - new Date()) / 86400000);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{m.customer_name}</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.customer_phone}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 16 }}>{ts.icon}</span>{' '}
                        <span className={`badge ${ts.badge}`}>{m.plan_name}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#8B5CF6' }}>{m.discount_percent}%</td>
                      <td>
                        <div style={{ fontSize: 13 }}>{new Date(m.end_date).toLocaleDateString('en-IN')}</div>
                        <div style={{ fontSize: 11, color: daysLeft < 30 ? '#EF4444' : '#9CA3AF' }}>
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                        </div>
                      </td>
                      <td>₹{parseFloat(m.amount_paid || 0).toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-primary">{m.membership_card_id}</span></td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => openMembershipCard(m.customer_id)}>🪪 View Card</button>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => cancelMembership(m.id)}>Cancel</button>
                      </td>
                    </tr>
                  );
                })}
                {activeMemberships.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state">No active memberships</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blackout Tab */}
      {tab === 'blackout' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>🗓️ Blackout Calendar</h3>
            <BlackoutCalendar blackouts={blackouts} onAdd={addBlackout} onRemove={removeBlackout} />
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>📋 All Blackout Dates</h3>
            {blackouts.length > 0 ? (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {[...blackouts].sort((a, b) => new Date(a.date) - new Date(b.date)).map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {new Date(b.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{b.reason || 'No reason'}</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => removeBlackout(b)}>Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No blackout dates set</div>
            )}
          </div>
        </div>
      )}
      {showCard && (
          <MembershipCard
              data={cardData}
              onClose={()=>setShowCard(false)}
          />
      )}
      {/* History Tab */}
      {tab === 'history' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Customer</th><th>Plan</th><th>Start</th><th>End</th><th>Paid</th><th>Status</th></tr>
              </thead>
              <tbody>
                {memberships.map(m => {
                  const ts = TIER_STYLE[m.tier] || TIER_STYLE.basic;
                  return (
                    <tr key={m.id}>
                      <td><div style={{ fontWeight: 500 }}>{m.customer_name}</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.customer_phone}</div></td>
                      <td><span style={{ fontSize: 16 }}>{ts.icon}</span> <span className={`badge ${ts.badge}`}>{m.plan_name}</span></td>
                      <td style={{ fontSize: 13 }}>{new Date(m.start_date).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontSize: 13 }}>{new Date(m.end_date).toLocaleDateString('en-IN')}</td>
                      <td>₹{parseFloat(m.amount_paid || 0).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${m.status === 'active' ? 'badge-success' : m.status === 'cancelled' ? 'badge-danger' : 'badge-gray'}`}>{m.status}</span></td>
                    </tr>
                  );
                })}
                {memberships.length === 0 && <tr><td colSpan={6}><div className="empty-state">No membership history</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAssign && <AssignModal plans={plans} onClose={() => setShowAssign(false)} onSuccess={load} />}
    </div>
  );
}
