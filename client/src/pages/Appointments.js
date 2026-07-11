import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const TIER_STYLE = {
  basic:   { icon: '🥈', color: '#6B7280', bg: '#F3F4F6' },
  gold:    { icon: '🥇', color: '#D97706', bg: '#FEF3C7' },
  diamond: { icon: '💎', color: '#7C3AED', bg: '#EDE9FE' },
};

// ── Customer lookup with membership check ─────────────────────────────────────
function CustomerLookup({ onSelect }) {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [creating, setCreating] = useState(false);

  const handleLookup = async () => {
    if (!phone.trim()) return;
    setResult(null); setNotFound(false);
    try {
      // Use public endpoint so we also get membership data
      const res = await api.get(`/public/customer-lookup/${phone.trim()}`);
      if (res.data.exists) setResult(res.data.customer);
    } catch {
      setNotFound(true);
      setNewCustomer(prev => ({ ...prev, phone: phone.trim() }));
    }
  };

  const handleCreate = async () => {
    if (!newCustomer.name || !newCustomer.phone) return alert('Name and phone required');
    setCreating(true);
    try {
      const res = await api.post('/customers', newCustomer);
      onSelect(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create customer');
    } finally { setCreating(false); }
  };

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Customer Mobile Number</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-control"
            placeholder="Enter 10-digit mobile number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
          />
          <button className="btn btn-primary" onClick={handleLookup}>Lookup</button>
        </div>
      </div>

      {result && (
        <div>
          <div className="alert alert-success" style={{ marginBottom: result.membership_name ? 8 : 0 }}>
            <strong>✅ Found:</strong> {result.name} ({result.phone})
            <button className="btn btn-success btn-sm" style={{ marginLeft: 12 }} onClick={() => onSelect(result)}>
              Select →
            </button>
          </div>
          {result.membership_name && (
            <div style={{
              background: TIER_STYLE[result.tier]?.bg || '#F3F4F6',
              border: `1px solid`,
              borderColor: TIER_STYLE[result.tier]?.color || '#ccc',
              borderRadius: 8, padding: '8px 14px', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
            }}>
              <span style={{ fontSize: 18 }}>{TIER_STYLE[result.tier]?.icon}</span>
              <div>
                <strong>{result.membership_name} Member</strong> · {result.discount_percent}% discount on all services
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  Valid until: {new Date(result.membership_end).toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {notFound && (
        <div>
          <div className="alert alert-warning">⚠️ Customer not found. Create a new profile:</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : '➕ Create & Select'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Appointment Modal ─────────────────────────────────────────────────────
function NewAppointmentModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(null);
  const [specialists, setSpecialists] = useState([]);
  const [services, setServices] = useState([]);
  const [blackoutDates, setBlackoutDates] = useState([]);
  const [form, setForm] = useState({
    specialist_id: '',
    appointment_date: new Date().toISOString().slice(0, 16),
    notes: '',
    services: [],
  });
  const [loading, setLoading] = useState(false);

  const [activeOffer, setActiveOffer] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/services/specialists'),
      api.get('/services'),
      api.get('/membership/blackout'),
    ]).then(([s, sv, b]) => {
      setSpecialists(s.data);
      setServices(sv.data);
      setBlackoutDates(b.data.map(d => d.date?.split('T')[0]));
    });
  }, []);

  // Check for active offer when date changes
  useEffect(() => {
    const apptDate = form.appointment_date?.split('T')[0];
    if (!apptDate || !form.services.length) { setActiveOffer(null); return; }
    const svcIds = form.services.map(s => s.service_id).join(',');
    api.get(`/offers/active?date=${apptDate}`)
      .then(r => {
        // Find offer that covers any selected service
        const selIds = form.services.map(s => s.service_id);
        const match = r.data.find(o => o.services?.some(s => selIds.includes(s.service_id)));
        setActiveOffer(match || null);
      })
      .catch(() => setActiveOffer(null));
  }, [form.appointment_date, form.services.length]);

  const toggleService = (svc) => {
    const exists = form.services.find(s => s.service_id === svc.id);
    if (exists) setForm({ ...form, services: form.services.filter(s => s.service_id !== svc.id) });
    else setForm({ ...form, services: [...form.services, { service_id: svc.id, price: svc.price }] });
  };

  const subtotal = form.services.reduce((sum, s) => {
    const svc = services.find(sv => sv.id === s.service_id);
    return sum + parseFloat(svc?.price || 0);
  }, 0);

  // Membership discount calculation
  const apptDate = form.appointment_date?.split('T')[0];
  const isBlackout = blackoutDates.includes(apptDate);
  // Offer takes priority over membership
  const offerDiscountPct = activeOffer ? parseFloat(activeOffer.discount_percent || 0) : 0;
  const offerDiscountAmt = (subtotal * offerDiscountPct) / 100;
  const hasMembership = customer?.membership_name && !isBlackout && !activeOffer;
  const membershipDiscountPct = hasMembership ? parseFloat(customer.discount_percent || 0) : 0;
  const membershipDiscountAmt = (subtotal * membershipDiscountPct) / 100;
  const payable = subtotal - offerDiscountAmt - membershipDiscountAmt;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/appointments', {
        customer_id: customer.id,
        specialist_id: form.specialist_id || null,
        appointment_date: form.appointment_date,
        services: form.services,
        notes: form.notes,
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create appointment');
    } finally { setLoading(false); }
  };

  const stepLabels = ['Customer', 'Services', 'Details'];

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>📅 New Appointment</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* Step indicator */}
          <div style={{ display: 'flex', marginBottom: 24 }}>
            {stepLabels.map((s, i) => (
              <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                  background: step > i + 1 ? 'var(--success)' : step === i + 1 ? 'var(--primary)' : 'var(--gray-200)',
                  color: step >= i + 1 ? 'white' : 'var(--gray-400)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600
                }}>{step > i + 1 ? '✓' : i + 1}</div>
                <div style={{ fontSize: 11, color: step === i + 1 ? 'var(--primary)' : 'var(--gray-400)' }}>{s}</div>
              </div>
            ))}
          </div>

          {/* Step 1: Customer */}
          {step === 1 && (
            customer ? (
              <div>
                <div className="alert alert-success">
                  <strong>✅ Customer:</strong> {customer.name} ({customer.phone})
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={() => setCustomer(null)}>Change</button>
                </div>
                {customer.membership_name && (
                  <div style={{
                    background: TIER_STYLE[customer.tier]?.bg || '#F3F4F6',
                    border: `1px solid ${TIER_STYLE[customer.tier]?.color || '#ccc'}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 10
                  }}>
                    <span style={{ fontSize: 20 }}>{TIER_STYLE[customer.tier]?.icon}</span>
                    <div>
                      <strong>{customer.membership_name} Member</strong> — {customer.discount_percent}% discount will be applied automatically
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        Valid until: {new Date(customer.membership_end).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <CustomerLookup onSelect={(c) => { setCustomer(c); setStep(2); }} />
            )
          )}

          {/* Step 2: Services */}
          {step === 2 && (
            <div>
              <h4 style={{ marginBottom: 16 }}>Select Services</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {services.map(svc => {
                  const selected = form.services.find(s => s.service_id === svc.id);
                  return (
                    <div
                      key={svc.id}
                      onClick={() => toggleService(svc)}
                      style={{
                        padding: 14,
                        border: `2px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
                        borderRadius: 10, cursor: 'pointer',
                        background: selected ? 'var(--primary-light)' : 'white',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{svc.name}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{parseFloat(svc.price).toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                        ⏱ {svc.duration_minutes} min
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.services.length > 0 && (
                <div style={{ marginTop: 16, padding: 14, background: 'var(--primary-light)', borderRadius: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>{form.services.length} service(s) — Subtotal</span>
                    <strong>₹{subtotal.toLocaleString('en-IN')}</strong>
                  </div>
                  {activeOffer && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706', marginBottom: 4, background: '#FEF3C7', padding: '4px 8px', borderRadius: 6 }}>
                      <span>🎉 {activeOffer.name} ({activeOffer.discount_percent}%)</span>
                      <strong>−₹{offerDiscountAmt.toFixed(2)}</strong>
                    </div>
                  )}
                  {hasMembership && !activeOffer && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginBottom: 4 }}>
                      <span>{TIER_STYLE[customer.tier]?.icon} {customer.membership_name} ({customer.discount_percent}%)</span>
                      <strong>−₹{membershipDiscountAmt.toFixed(2)}</strong>
                    </div>
                  )}
                  {activeOffer && customer?.membership_name && (
                    <div style={{ fontSize: 11, color: '#B45309', marginBottom: 4 }}>
                      ⚠️ Festival offer active — membership discount paused
                    </div>
                  )}
                  {(activeOffer || hasMembership) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid #C4B5FD', paddingTop: 6, marginTop: 6 }}>
                      <span>Payable</span>
                      <span>₹{payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Specialist</label>
                  <select className="form-control" value={form.specialist_id} onChange={e => setForm({ ...form, specialist_id: e.target.value })}>
                    <option value="">Any Available</option>
                    {specialists.map(s => <option key={s.id} value={s.id}>{s.name} — {s.specialization || 'General'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date & Time</label>
                  <input type="datetime-local" className="form-control" value={form.appointment_date}
                    onChange={e => setForm({ ...form, appointment_date: e.target.value })} />
                </div>
              </div>

              {isBlackout && (
                <div className="alert alert-warning">
                  ⚠️ This date is a blackout day — membership discount will <strong>not</strong> apply.
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any special instructions..." />
              </div>

              {/* Booking Summary */}
              <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📋 Booking Summary</div>
                <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                  <div style={{ marginBottom: 4 }}>👤 {customer?.name} ({customer?.phone})</div>
                  {form.services.map(s => {
                    const svc = services.find(sv => sv.id === s.service_id);
                    return (
                      <div key={s.service_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span>💆 {svc?.name}</span>
                        <span>₹{parseFloat(svc?.price || 0).toLocaleString('en-IN')}</span>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 8, paddingTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {activeOffer && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706', marginBottom: 4, background: '#FEF3C7', padding: '4px 8px', borderRadius: 6 }}>
                        <span>🎉 {activeOffer.name} ({activeOffer.discount_percent}%)</span>
                        <span>−₹{offerDiscountAmt.toFixed(2)}</span>
                      </div>
                    )}
                    {hasMembership && !activeOffer && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginBottom: 4 }}>
                        <span>{TIER_STYLE[customer.tier]?.icon} {customer.membership_name} ({customer.discount_percent}% off)</span>
                        <span>−₹{membershipDiscountAmt.toFixed(2)}</span>
                      </div>
                    )}
                    {activeOffer && customer?.membership_name && (
                      <div style={{ fontSize: 11, color: '#B45309', marginBottom: 4 }}>
                        ⚠️ Festival offer active — membership discount paused
                      </div>
                    )}
                    {!hasMembership && !activeOffer && customer?.membership_name && isBlackout && (
                      <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 4 }}>
                        🚫 Blackout day — membership discount not applied
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: 'var(--primary)', marginTop: 4 }}>
                      <span>Total Payable</span>
                      <span>₹{payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>← Back</button>}
          {step < 3 && (
            <button className="btn btn-primary"
              disabled={(step === 1 && !customer) || (step === 2 && form.services.length === 0)}
              onClick={() => setStep(step + 1)}>
              Next →
            </button>
          )}
          {step === 3 && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Booking...' : '✅ Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ appointment, onClose, onSuccess }) {
  const membershipDiscount = parseFloat(appointment.membership_discount || 0);
  const subtotal = parseFloat(appointment.total_amount || 0);

  const [extraDiscount, setExtraDiscount]   = useState(0);
  const [paymentMethod, setPaymentMethod]   = useState('cash');
  const [amountPaid, setAmountPaid]         = useState('');
  const [pointsData, setPointsData]         = useState(null);
  const [redeemPoints, setRedeemPoints]     = useState(0);
  const [loadingPoints, setLoadingPoints]   = useState(true);
  const [result, setResult]                 = useState(null);

  const tierStyle = TIER_STYLE[appointment.membership_tier] || {};

  // Load customer points balance
  useEffect(() => {
    api.get(`/loyalty/lookup/${appointment.customer_phone}`)
      .then(r => setPointsData(r.data))
      .catch(() => setPointsData(null))
      .finally(() => setLoadingPoints(false));
  }, [appointment.customer_phone]);

  const maxRedeemable = pointsData ? parseFloat(pointsData.total_points || 0) : 0;
  const redemptionRate = pointsData?.redemption_rate || 100;
  const pointsDiscountAmt = parseFloat(redeemPoints || 0) / redemptionRate;

  const totalDiscount = membershipDiscount + parseFloat(extraDiscount || 0) + pointsDiscountAmt;
  const netPayable    = Math.max(0, subtotal - totalDiscount);
  const balance       = netPayable - parseFloat(amountPaid || 0);

  useEffect(() => {
    setAmountPaid(netPayable.toFixed(2));
  }, [netPayable]);

  const handleSubmit = async () => {
    try {
      const res = await api.patch(`/appointments/${appointment.id}/payment`, {
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        extra_discount: extraDiscount,
        redeem_points: parseFloat(redeemPoints || 0),
      });
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Payment failed');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>💳 Process Payment</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* Customer & services */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{appointment.customer_name}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {appointment.services?.map(s => s.service_name).join(', ')}
            </div>
          </div>

          {/* Bill breakdown */}
          <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: 'var(--gray-600)' }}>Services Total</span>
              <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Membership discount — auto applied */}
            {membershipDiscount > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8,
                background: tierStyle.bg || '#F3F4F6', borderRadius: 8, padding: '8px 10px'
              }}>
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{tierStyle.icon}</span>
                  {appointment.membership_plan_name} discount ({appointment.membership_discount_percent}%)
                </span>
                <span style={{ color: '#059669', fontWeight: 700 }}>−₹{membershipDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Extra manual discount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: 'var(--gray-600)' }}>Extra Discount (₹)</span>
              <input
                type="number"
                style={{ width: 100, padding: '4px 8px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 14, textAlign: 'right' }}
                value={extraDiscount}
                min={0}
                max={subtotal}
                onChange={e => setExtraDiscount(e.target.value)}
              />
            </div>

            <div style={{ borderTop: '2px solid var(--gray-200)', paddingTop: 10, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 20, color: 'var(--primary)' }}>
                <span>Total Payable</span>
                <span>₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['cash', 'card', 'upi', 'other'].map(m => (
                <button key={m}
                  className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setPaymentMethod(m)}>
                  {m === 'cash' ? '💵' : m === 'card' ? '💳' : m === 'upi' ? '📱' : '💰'} {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Amount paid */}
          <div className="form-group">
            <label className="form-label">Amount Received (₹)</label>
            <input
              type="number"
              className="form-control"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              min={0}
              style={{ fontSize: 20, fontWeight: 700 }}
            />
          </div>

          {/* Points redemption section */}
          {!loadingPoints && pointsData && maxRedeemable > 0 && (
            <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#92400E' }}>
                ⭐ Redeem Loyalty Points
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                Available: <strong>{maxRedeemable.toFixed(1)} pts</strong> = <strong>₹{pointsData.points_value_rupees}</strong> discount
                &nbsp;({redemptionRate} pts = ₹1)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  style={{ width: 100, padding: '6px 10px', border: '1.5px solid #FCD34D', borderRadius: 8, fontSize: 14, textAlign: 'center' }}
                  value={redeemPoints}
                  min={0}
                  max={maxRedeemable}
                  step={redemptionRate}
                  onChange={e => setRedeemPoints(Math.min(parseFloat(e.target.value)||0, maxRedeemable))}
                />
                <span style={{ fontSize: 13, color: '#6B7280' }}>pts</span>
                {parseFloat(redeemPoints) > 0 && (
                  <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                    = ₹{pointsDiscountAmt.toFixed(2)} off
                  </span>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setRedeemPoints(maxRedeemable)}>Use All</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setRedeemPoints(0)}>Clear</button>
              </div>
            </div>
          )}

          {balance > 0.01 && (
            <div className="alert alert-warning">⚠️ Balance remaining: ₹{balance.toFixed(2)}</div>
          )}
          {balance <= 0.01 && amountPaid > 0 && (
            <div className="alert alert-success">✅ Full payment received</div>
          )}

          {/* Post-payment success */}
          {result && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: 14, marginTop: 8 }}>
              <div style={{ fontWeight: 700, color: '#065F46', marginBottom: 6 }}>✅ Payment Confirmed!</div>
              {result.points_earned > 0 && (
                <div style={{ fontSize: 13, color: '#059669' }}>
                  ⭐ <strong>+{result.points_earned} loyalty points</strong> have been added to customer's account!
                </div>
              )}
              {result.points_redeemed > 0 && (
                <div style={{ fontSize: 13, color: '#D97706', marginTop: 4 }}>
                  🎁 {result.points_redeemed} points redeemed for ₹{parseFloat(result.points_discount||0).toFixed(2)} discount
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { if (result) { onSuccess(); } onClose(); }}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button className="btn btn-success" onClick={handleSubmit} disabled={!amountPaid}>
              ✅ Confirm Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Appointments Page ────────────────────────────────────────────────────
export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [paymentAppt, setPaymentAppt] = useState(null);
  const [filter, setFilter] = useState({ date: new Date().toISOString().split('T')[0], status: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.date) params.append('date', filter.date);
      if (filter.status) params.append('status', filter.status);
      const res = await api.get(`/appointments?${params}`);
      setAppointments(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const statusColors = {
    scheduled: 'badge-info',
    in_progress: 'badge-warning',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    pending_verification: 'badge-warning',
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📅 Appointments</h2>
          <p>{appointments.length} appointments</p>
        </div>
        {['super_admin', 'receptionist'].includes(user.role) && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Appointment</button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={filter.date}
              onChange={e => setFilter({ ...filter, date: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-control" value={filter.status}
              onChange={e => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setFilter({ date: '', status: '' })}>Clear</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Services</th>
                <th>Specialist</th>
                <th>Date & Time</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Payable</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => {
                const subtotal = parseFloat(a.total_amount || 0);
                const memDiscount = parseFloat(a.membership_discount || 0);
                const offerDisc = parseFloat(a.offer_discount || 0);
                const totalDiscount = parseFloat(a.discount || (memDiscount + offerDisc));
                const payable = subtotal - totalDiscount;
                const tierStyle = TIER_STYLE[a.membership_tier] || {};

                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.customer_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{a.customer_phone}</div>
                      {a.membership_plan_name && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          <span style={{
                            background: tierStyle.bg || '#F3F4F6',
                            color: tierStyle.color || '#374151',
                            padding: '1px 6px', borderRadius: 100, fontWeight: 600
                          }}>
                            {tierStyle.icon} {a.membership_plan_name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {a.services?.map(s => s.service_name).join(', ') || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{a.specialist_name || '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {new Date(a.appointment_date).toLocaleDateString('en-IN')}<br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        {new Date(a.appointment_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>₹{subtotal.toLocaleString('en-IN')}</td>
                    <td>
                      {parseFloat(a.offer_discount || 0) > 0 ? (
                        <span style={{ color: '#D97706', fontWeight: 600, fontSize: 13 }}>
                          🎉 −₹{parseFloat(a.offer_discount).toFixed(2)}<br />
                          <span style={{ fontSize: 11, color: '#6B7280' }}>{a.offer_name} ({a.offer_discount_percent}%)</span>
                        </span>
                      ) : memDiscount > 0 ? (
                        <span style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>
                          −₹{memDiscount.toFixed(2)}<br />
                          <span style={{ fontSize: 11, color: '#6B7280' }}>({a.membership_discount_percent}%)</span>
                        </span>
                      ) : <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      ₹{payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td><span className={`badge ${statusColors[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                    <td>
                      <span className={`badge ${a.payment_status === 'paid' ? 'badge-success' : a.payment_status === 'partial' ? 'badge-warning' : 'badge-gray'}`}>
                        {a.payment_status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {a.status === 'scheduled' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => updateStatus(a.id, 'in_progress')}>Start</button>
                            <button className="btn btn-danger btn-sm" onClick={() => updateStatus(a.id, 'cancelled')}>Cancel</button>
                          </>
                        )}
                        {a.status === 'in_progress' && (
                          <button className="btn btn-success btn-sm" onClick={() => updateStatus(a.id, 'completed')}>Complete</button>
                        )}
                        {a.status === 'completed' && a.payment_status !== 'paid' && (
                          <button className="btn btn-primary btn-sm" onClick={() => setPaymentAppt(a)}>💳 Pay</button>
                        )}
                        {a.payment_status === 'pending_verification' && (
                          <button className="btn btn-success btn-sm"
                            onClick={async () => {
                              // Fetch UTR details first
                              const upi = await api.get(`/appointments/${a.id}/upi-details`);
                              const utr = upi.data?.utr_number || 'Not submitted';
                              const confirmed = window.confirm(
                                `UPI Payment Details:\n\n` +
                                `Customer: ${a.customer_name}\n` +
                                `Amount: ₹${upi.data?.amount || a.total_amount}\n` +
                                `UTR Number: ${utr}\n` +
                                `Submitted: ${upi.data?.submitted_at ? new Date(upi.data.submitted_at).toLocaleString('en-IN') : '-'}\n\n` +
                                `Please check your UPI app/bank statement and confirm this UTR matches.\n\n` +
                                `Click OK to VERIFY and mark as PAID.`
                              );
                              if (!confirmed) return;
                              try {
                                await api.patch(`/appointments/${a.id}/verify-upi`);
                                load();
                              } catch (err) { alert(err.response?.data?.error || 'Verification failed'); }
                            }}>
                            ✅ Verify UPI
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {appointments.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state">No appointments found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && <NewAppointmentModal onClose={() => setShowNew(false)} onSuccess={load} />}
      {paymentAppt && <PaymentModal appointment={paymentAppt} onClose={() => setPaymentAppt(null)} onSuccess={load} />}
    </div>
  );
}
