import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import logo from '../assets/logo2.png'

const api = axios.create({ baseURL: '/api/public' });
const MEDIA_URL = (fn) => `/api/services/media/file/${fn}`;

const TIER_STYLE = {
  basic:   { icon: '🥈', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
  gold:    { icon: '🥇', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
  diamond: { icon: '💎', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
};

function generateSlots() {
  const slots = [];
  for (let h = 9; h <= 20; h++)
    for (let m of [0, 30]) {
      if (h === 20 && m === 30) continue;
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  return slots;
}
const ALL_SLOTS = generateSlots();
const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const toHHMM = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
function isConflict(slot, booked, needed) {
  const s = toMin(slot), e = s + needed;
  return booked.some(r => s < toMin(r.end) && e > toMin(r.start));
}

// ── Service Detail Popup ──────────────────────────────────────────────────────
function ServicePopup({ service, onClose }) {
  const [idx, setIdx] = useState(0);
  const media = (service.media || []).sort((a,b) => a.sort_order - b.sort_order);
  const cur = media[idx];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }} onClick={e=>e.stopPropagation()}>
        {/* Media */}
        {media.length > 0 && (
          <div style={{ position:'relative', height:260, background:'#000', borderRadius:'20px 20px 0 0', overflow:'hidden' }}>
            {cur?.file_type === 'video'
              ? <video key={cur.file_name} src={MEDIA_URL(cur.file_name)} controls autoPlay style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              : <img src={MEDIA_URL(cur.file_name)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            }
            {media.length > 1 && (
              <>
                <button onClick={()=>setIdx(i=>(i-1+media.length)%media.length)} style={navBtn('left')}>‹</button>
                <button onClick={()=>setIdx(i=>(i+1)%media.length)} style={navBtn('right')}>›</button>
                <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4 }}>
                  {media.map((_,i)=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background: i===idx?'white':'rgba(255,255,255,0.4)' }} />)}
                </div>
              </>
            )}
          </div>
        )}
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <h3 style={{ fontSize:20, fontWeight:800, color:'#1F2937' }}>{service.name}</h3>
            <span style={{ fontSize:24, fontWeight:900, color:'#8B5CF6' }}>₹{parseFloat(service.price).toLocaleString('en-IN')}</span>
          </div>
          {service.description && <p style={{ color:'#6B7280', fontSize:14, marginBottom:12 }}>{service.description}</p>}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <span style={pill('#EDE9FE','#5B21B6')}>⏱ {service.duration_minutes} min</span>
          </div>
          {service.products_used?.length > 0 && (
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Products Used</div>
              {service.products_used.map((p,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                  <span>{p.product_name}</span>
                  <span style={{ color:'#8B5CF6', fontWeight:600 }}>{p.quantity_ml} {p.unit_type}</span>
                </div>
              ))}
            </div>
          )}
          <button style={{ ...btnPrimary, width:'100%', marginTop:16 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const navBtn = (side) => ({ position:'absolute', [side]:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', color:'white', border:'none', borderRadius:'50%', width:36, height:36, cursor:'pointer', fontSize:20, lineHeight:1 });
const pill = (bg, color) => ({ background:bg, color, padding:'4px 12px', borderRadius:100, fontSize:12, fontWeight:600 });

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ result, paymentType, onReset }) {
  return (
    <div style={{ textAlign:'center', padding:'40px 20px' }}>
      <div style={{ fontSize:80, marginBottom:16 }}>{paymentType==='online' ? '💳' : '🎉'}</div>
      <h2 style={{ fontSize:28, fontWeight:800, color:'#1F2937', marginBottom:8 }}>Booking Confirmed!</h2>
      <p style={{ color:'#6B7280', marginBottom:32 }}>
        {paymentType==='online' ? 'Payment received. Your appointment is confirmed!' : 'See you at the salon! Payment at desk.'}
      </p>
      <div style={{ background:'linear-gradient(135deg,#8B5CF6,#EC4899)', borderRadius:16, padding:24, color:'white', marginBottom:24, textAlign:'left' }}>
        <div style={{ fontSize:12, opacity:0.8, marginBottom:4 }}>BOOKING ID</div>
        <div style={{ fontSize:28, fontWeight:800, marginBottom:16 }}>#{result.appointment_id}</div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:14, display:'flex', flexDirection:'column', gap:8 }}>
          <Row label="Services Total" value={`₹${parseFloat(result.total).toLocaleString('en-IN')}`} />
          {result.membership_discount>0 && <Row label="Membership Discount" value={`−₹${parseFloat(result.membership_discount).toFixed(2)}`} color="#86EFAC" />}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:10, marginTop:4, display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:800 }}>
            <span>{paymentType==='online' ? 'Paid Online' : 'Pay at Salon'}</span>
            <span>₹{parseFloat(result.payable).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
          </div>
        </div>
      </div>
      {paymentType !== 'online' && <p style={{ fontSize:13, color:'#9CA3AF', marginBottom:24 }}>💡 Payment collected at the salon. Please arrive 5 minutes early.</p>}
      <button style={{ ...btnPrimary, width:'100%' }} onClick={onReset}>+ Book Another Appointment</button>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:color||'rgba(255,255,255,0.9)' }}>
      <span>{label}</span><span style={{ fontWeight:600 }}>{value}</span>
    </div>
  );
}

// ── Razorpay Payment Handler ──────────────────────────────────────────────────
async function initiateRazorpay({ appointmentId, amount, customerName, customerPhone, customerEmail, onSuccess, onFailure }) {
  try {
    const orderRes = await axios.post('/api/payment/create-order', { appointment_id: appointmentId, amount });
    const { order_id, key_id } = orderRes.data;

    const options = {
      key: key_id,
      amount: Math.round(amount * 100),
      currency: 'INR',
      name: 'Salon',
      description: 'Appointment Payment',
      order_id,
      prefill: { name: customerName, contact: customerPhone, email: customerEmail || '' },
      theme: { color: '#8B5CF6' },
      handler: async (response) => {
        try {
          await axios.post('/api/payment/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            appointment_id: appointmentId,
          });
          onSuccess();
        } catch (err) {
          onFailure('Payment verification failed. Please contact support.');
        }
      },
      modal: { ondismiss: () => onFailure('Payment cancelled') },
    };

    if (!window.Razorpay) {
      onFailure('Razorpay SDK not loaded. Please refresh the page.');
      return;
    }
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (res) => onFailure(res.error?.description || 'Payment failed'));
    rzp.open();
  } catch (err) {
    onFailure(err.response?.data?.error || 'Could not create payment order');
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PublicBooking() {
  const phoneRef = useRef(null);
  const location = useLocation();
  const [services, setServices]       = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [blackoutDates, setBlackoutDates] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form fields
  const [phone, setPhone]             = useState('');
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [dob, setDob]                 = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [categoryTab, setCategoryTab] = useState('All');
  const [serviceSearch, setServiceSearch] = useState('');
  const [date, setDate]               = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [time, setTime]               = useState('');
  const [notes, setNotes]             = useState('');

  // State
  const [customer, setCustomer]           = useState(null);
  const [phoneLooking, setPhoneLooking]   = useState(false);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [result, setResult]               = useState(null);
  const [paymentType, setPaymentType]     = useState(null); // 'desk' | 'online'
  const [errors, setErrors]               = useState({});
  const [popupService, setPopupService]   = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [activeOffer, setActiveOffer]     = useState(null);

  // Load Razorpay SDK
  useEffect(() => {
    if (window.Razorpay) { setRazorpayLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // Load each independently so one failure doesn't block the whole page
    const loadData = async () => {
      try {
        const s = await api.get('/services');
        setServices(s.data || []);
      } catch (e) { console.error('Services load error:', e.response?.data?.error || e.message); setServices([]); }

      try {
        const sp = await api.get('/specialists');
        setSpecialists(sp.data || []);
      } catch (e) { console.error('Specialists load error:', e.message); setSpecialists([]); }

      try {
        const b = await api.get('/blackout-dates');
        setBlackoutDates((b.data || []).map(d => d.date));
      } catch (e) { console.error('Blackout dates load error:', e.message); setBlackoutDates([]); }

      setLoadingData(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!services.length) return;

    const params = new URLSearchParams(location.search);
    const serviceId = parseInt(params.get("service"));

    if (!serviceId) return;

    const exists = services.some(s => s.id === serviceId);

    if (exists) {
      setSelectedServices([serviceId]);

      const service = services.find(s => s.id === serviceId);

      if (service?.category_name) {
        setCategoryTab(service.category_name);
      }
    }
  }, [services, location.search]);

  // Phone lookup
  useEffect(() => {
    if (phone.length !== 10) { setCustomer(null); return; }
    const t = setTimeout(async () => {
      setPhoneLooking(true);
      try {
        const res = await api.get(`/customer-lookup/${phone}`);
        if (res.data.exists) {
          const c = res.data.customer;
          setCustomer(c);
          setName(c.name||''); setEmail(c.email||'');
          setDob(c.date_of_birth ? c.date_of_birth.split('T')[0] : '');
        } else setCustomer(null);
      } catch { setCustomer(null); }
      finally { setPhoneLooking(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [phone]);

  // Check active offer when date or services change
  useEffect(() => {
    if (!date || !selectedServices.length) { setActiveOffer(null); return; }
    axios.get('/api/offers/public', { params: { date } })
      .then(r => {
        const match = r.data.find(o => o.service_ids?.some(id => selectedServices.includes(id)));
        setActiveOffer(match || null);
      })
      .catch(() => setActiveOffer(null));
  }, [date, selectedServices]);

  // Load booked slots
  useEffect(() => {
    if (!date) { setBookedSlots([]); setTime(''); return; }
    setLoadingSlots(true); setTime('');
    api.get('/booked-slots', { params: { date, specialist_id: specialistId||'' } })
      .then(r => setBookedSlots(r.data))
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, specialistId]);

  const totalDuration = selectedServices.reduce((s,id) => s + (services.find(x=>x.id===id)?.duration_minutes||0), 0);
  const subtotal = selectedServices.reduce((s,id) => s + parseFloat(services.find(x=>x.id===id)?.price||0), 0);
  const isBlackout = blackoutDates.includes(date);
  // Offer beats membership — one discount at a time
  const offerActive = activeOffer && activeOffer.service_ids?.some(id => selectedServices.includes(id));
  const offerDiscountAmt = offerActive ? (subtotal * parseFloat(activeOffer.discount_percent||0)) / 100 : 0;
  const hasMembership = customer?.membership_name && !isBlackout && !offerActive;
  const discountPct = hasMembership ? parseFloat(customer.discount_percent||0) : 0;
  const discountAmt = (subtotal * discountPct) / 100;
  const payable = subtotal - offerDiscountAmt - discountAmt;

  const toggleService = useCallback((id) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
    setTime('');
  }, []);

  // Derived: unique category list and filtered services
  const categories = useMemo(() => {
    const cats = [...new Set(services.map(s => s.category_name || 'Other').filter(Boolean))].sort();
    return ['All', ...cats];
  }, [services]);

  const filteredServices = useMemo(() => {
    let list = services;
    if (categoryTab !== 'All') list = list.filter(s => (s.category_name || 'Other') === categoryTab);
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q));
    }
    return list;
  }, [services, categoryTab, serviceSearch]);

  const validate = () => {
    const e = {};
    if (!phone || phone.length!==10) e.phone = 'Enter a valid 10-digit number';
    if (!name.trim()) e.name = 'Name is required';
    if (!selectedServices.length) e.services = 'Select at least one service';
    if (!date) e.date = 'Select a date';
    if (isBlackout) e.date = 'Blackout day — please pick another date';
    if (!time) e.time = 'Select a time slot';
    setErrors(e);
    return !Object.keys(e).length;
  };

  // Book appointment (returns appointment data)
  const bookAppointment = async () => {
    const res = await api.post('/book', {
      customer: { name, phone, email, date_of_birth: dob||null },
      services: selectedServices,
      specialist_id: specialistId||null,
      appointment_date: `${date}T${time}:00`,
      notes,
      apply_membership: true,
    });
    return res.data;
  };

  const handlePayDesk = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = await bookAppointment();
      setResult(data);
      setPaymentType('desk');
    } catch (err) {
      alert(err.response?.data?.error || 'Booking failed');
    } finally { setSubmitting(false); }
  };

  const handlePayOnline = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = await bookAppointment();
      initiateRazorpay({
        appointmentId: data.appointment_id,
        amount: data.payable,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        onSuccess: (verifyResponse) => {
          setResult({ ...data, points_earned: verifyResponse?.points_earned || 0 });
          setPaymentType('online');
          setSubmitting(false);
        },
        onFailure: (msg) => {
          alert(msg);
          // Appointment is booked but payment failed — show desk option
          setResult(data);
          setPaymentType('desk');
          setSubmitting(false);
        },
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Booking failed');
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setResult(null); setPhone(''); setName(''); setEmail(''); setDob('');
    setSelectedServices([]); setDate(''); setSpecialistId(''); setTime(''); setNotes('');
    setCustomer(null); setErrors({}); setPaymentType(null);
    setTimeout(() => phoneRef.current?.focus(), 100);
  };

  const today = new Date().toISOString().split('T')[0];

  if (loadingData) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:BG }}>
      <div style={{ color:'white', fontSize:18, textAlign:'center' }}><div style={{ fontSize:40, marginBottom:12 }}>
        <img src={logo} alt="J Eighteen Beauty Salon Academy" style={{ height:100, width:100, marginRight:12 }} />
        </div>Loading...</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:BG, paddingBottom:60 }}>
      {/* Header */}
      <div style={{ padding:'24px 24px 0', maxWidth:680, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
          <div style={{ width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
            <img src={logo} alt="J Eighteen Beauty Salon Academy" style={{ height:40, marginRight:12 }} />
          </div>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:'serif' }}>
                J Eighteen Beauty Salon Academy
            </div>
            <div style={{ color:'#A78BFA', fontSize:11, letterSpacing:2, textTransform:'uppercase' }}>Book an Appointment</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>
        <div style={card}>
          {result ? (
            <SuccessScreen result={result} paymentType={paymentType} onReset={resetForm} />
          ) : (
            <>
              <h2 style={{ fontSize:22, fontWeight:800, color:'#1F2937', marginBottom:4 }}>Book Your Appointment</h2>
              <p style={{ color:'#6B7280', fontSize:14, marginBottom:28 }}>Fill in your details and we'll see you soon!</p>

              {/* 1. Phone */}
              <Section label="1. Contact Number" error={errors.phone}>
                <div style={{ position:'relative' }}>
                  <input ref={phoneRef} style={inp(errors.phone)} type="tel" placeholder="10-digit mobile number"
                    maxLength={10} value={phone}
                    onChange={e=>{ setPhone(e.target.value.replace(/\D/g,'')); setErrors(x=>({...x,phone:null})); }} />
                  {phoneLooking && <span style={sfx}>🔍</span>}
                  {!phoneLooking && customer && <span style={{...sfx,color:'#059669'}}>✓</span>}
                </div>
                {customer && (
                  <div style={{ marginTop:8, padding:'8px 12px', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:8, fontSize:13, color:'#065F46' }}>
                    ✅ Welcome back, <strong>{customer.name}</strong>! Details filled in.
                    {customer.membership_name && (
                      <span style={{ marginLeft:8, background:TIER_STYLE[customer.tier]?.bg, color:TIER_STYLE[customer.tier]?.color, padding:'1px 8px', borderRadius:100, fontWeight:700, fontSize:12 }}>
                        {TIER_STYLE[customer.tier]?.icon} {customer.membership_name}
                      </span>
                    )}
                    {customer.total_points > 0 && (
                      <div style={{ marginTop:4, fontSize:12 }}>⭐ Points balance: <strong>{parseFloat(customer.total_points).toFixed(1)} pts</strong></div>
                    )}
                  </div>
                )}
              </Section>

              {/* 2. Name */}
              <Section label="2. Full Name" error={errors.name}>
                <input style={inp(errors.name)} placeholder="Your full name" value={name}
                  onChange={e=>{ setName(e.target.value); setErrors(x=>({...x,name:null})); }} />
              </Section>

              {/* 3 & 4 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Section label="3. Email"><input style={inp()} type="email" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></Section>
                <Section label="4. Date of Birth"><input style={inp()} type="date" value={dob} onChange={e=>setDob(e.target.value)} /></Section>
              </div>

              {/* 5. Services — Category tabs + search + card grid */}
              <Section label="5. Select Services" error={errors.services}>

                {/* Search bar */}
                <div style={{ position:'relative', marginBottom:10 }}>
                  <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#9CA3AF' }}>🔍</span>
                  <input
                    style={{ ...inp(), paddingLeft:36 }}
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={e => setServiceSearch(e.target.value)}
                  />
                </div>

                {/* Category tabs */}
                {categories.length > 2 && (
                  <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:12, scrollbarWidth:'none' }}>
                    {categories.map(cat => (
                      <button key={cat} type="button" onClick={() => setCategoryTab(cat)}
                        style={{
                          padding:'5px 14px', borderRadius:100, border:'none', cursor:'pointer',
                          background: categoryTab===cat ? '#8B5CF6' : '#F3F4F6',
                          color: categoryTab===cat ? 'white' : '#374151',
                          fontSize:12, fontWeight:600, whiteSpace:'nowrap',
                          flexShrink:0, transition:'all 0.15s'
                        }}>
                        {cat}
                        {cat !== 'All' && (
                          <span style={{ marginLeft:5, opacity:0.7 }}>
                            ({services.filter(s=>(s.category_name||'Other')===cat).length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected count pill */}
                {selectedServices.length > 0 && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                    {selectedServices.map(id => {
                      const svc = services.find(x=>x.id===id);
                      return svc ? (
                        <span key={id} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#8B5CF6', color:'white', padding:'3px 10px', borderRadius:100, fontSize:12, fontWeight:600 }}>
                          {svc.name}
                          <span style={{ cursor:'pointer', fontSize:15, lineHeight:1 }}
                            onClick={()=>{ toggleService(id); setErrors(x=>({...x,services:null})); }}>×</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Service grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, maxHeight:420, overflowY:'auto', paddingRight:2 }}>
                  {filteredServices.map(svc => {
                    const sel = selectedServices.includes(svc.id);
                    const firstImg = svc.media?.find(m=>m.file_type==='image') || svc.media?.[0];
                    return (
                      <div key={svc.id}
                        style={{
                          border:`2px solid ${sel?'#8B5CF6':'#E5E7EB'}`,
                          borderRadius:12, overflow:'hidden',
                          background: sel?'#F5F3FF':'white',
                          transition:'all 0.15s',
                          display:'flex', flexDirection:'column',
                          boxShadow: sel ? '0 0 0 3px #EDE9FE' : '0 1px 3px rgba(0,0,0,0.06)',
                        }}>
                        {/* Image */}
                        <div style={{ height:90, background:'#F3F4F6', position:'relative', cursor:'pointer', flexShrink:0 }}
                          onClick={() => setPopupService(svc)}>
                          {firstImg
                            ? (firstImg.file_type==='video'
                                ? <video src={MEDIA_URL(firstImg.file_name)} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />
                                : <img src={MEDIA_URL(firstImg.file_name)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />)
                            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>💆</div>
                          }
                          {/* View details overlay */}
                          <div style={{ position:'absolute', bottom:4, right:4, background:'rgba(0,0,0,0.55)', color:'white', borderRadius:6, padding:'2px 7px', fontSize:10 }}>
                            👁️ Details
                          </div>
                          {/* Selected tick */}
                          {sel && (
                            <div style={{ position:'absolute', top:6, left:6, width:22, height:22, borderRadius:'50%', background:'#8B5CF6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <span style={{ color:'white', fontSize:13 }}>✓</span>
                            </div>
                          )}
                        </div>

                        {/* Info — click to select */}
                        <div style={{ padding:'10px 10px', cursor:'pointer', flex:1 }}
                          onClick={()=>{ toggleService(svc.id); setErrors(x=>({...x,services:null})); }}>
                          <div style={{ fontWeight:700, fontSize:13, color:'#1F2937', marginBottom:3, lineHeight:1.3 }}>{svc.name}</div>
                          {svc.category_name && (
                            <div style={{ fontSize:10, color:'#8B5CF6', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }}>{svc.category_name}</div>
                          )}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:11, color:'#6B7280' }}>⏱ {svc.duration_minutes}min</span>
                            <span style={{ fontWeight:800, fontSize:14, color: sel?'#8B5CF6':'#374151' }}>
                              ₹{parseFloat(svc.price).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredServices.length === 0 && (
                    <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'24px', color:'#9CA3AF', fontSize:13 }}>
                      No services found {serviceSearch ? `for "${serviceSearch}"` : `in ${categoryTab}`}
                    </div>
                  )}
                </div>

                {/* Session summary */}
                {selectedServices.length > 0 && (
                  <div style={{ marginTop:10, fontSize:12, color:'#7C3AED', background:'#EDE9FE', padding:'7px 12px', borderRadius:8, display:'flex', justifyContent:'space-between' }}>
                    <span>✅ <strong>{selectedServices.length}</strong> service{selectedServices.length>1?'s':''} selected</span>
                    <span>⏱ <strong>{totalDuration} min</strong> total</span>
                  </div>
                )}
                <div style={{ marginTop:6, fontSize:11, color:'#9CA3AF' }}>💡 Tap image to see full details · Tap card to select</div>
              </Section>

              {/* 6. Date */}
              <Section label="6. Date of Appointment" error={errors.date}>
                <input style={inp(errors.date||isBlackout)} type="date" min={today} value={date}
                  onChange={e=>{ setDate(e.target.value); setErrors(x=>({...x,date:null})); }} />
                {isBlackout && <div style={{ marginTop:6, fontSize:12, color:'#DC2626', background:'#FEF2F2', padding:'6px 12px', borderRadius:8 }}>🚫 Blackout day — membership discount not available</div>}
              </Section>

              {/* 7. Specialist */}
              <Section label="7. Preferred Specialist">
                <select style={inp()} value={specialistId} onChange={e=>setSpecialistId(e.target.value)}>
                  <option value="">Any Available Specialist</option>
                  {specialists.map(s=><option key={s.id} value={s.id}>{s.name}{s.specialization?` — ${s.specialization}`:''}</option>)}
                </select>
              </Section>

              {/* 8. Time */}
              <Section label={`8. Select Time${totalDuration>0?` (session: ${totalDuration} min)`:''}`} error={errors.time}>
                {!date ? <div style={hint}>Select a date first</div>
                : !selectedServices.length ? <div style={hint}>Select services first to see available times</div>
                : loadingSlots ? <div style={hint}>Loading available times…</div>
                : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                    {ALL_SLOTS.map(slot=>{
                      const conflict = isConflict(slot, bookedSlots, totalDuration);
                      const endMin = toMin(slot)+totalDuration;
                      const isPast = date===today && toMin(slot)<=(new Date().getHours()*60+new Date().getMinutes());
                      const disabled = conflict||isPast||endMin>toMin('21:00');
                      const sel = time===slot;
                      return (
                        <button key={slot} type="button" disabled={disabled}
                          onClick={()=>{ setTime(slot); setErrors(x=>({...x,time:null})); }}
                          title={conflict?`Booked until ${toHHMM(endMin)}`:''}
                          style={{ padding:'9px 4px', borderRadius:8, border:`2px solid ${sel?'#8B5CF6':disabled?'#F3F4F6':'#E5E7EB'}`, background:sel?'#8B5CF6':disabled?'#F9FAFB':'white', color:sel?'white':disabled?'#D1D5DB':'#374151', fontSize:13, fontWeight:sel?700:400, cursor:disabled?'not-allowed':'pointer', textDecoration:disabled&&conflict?'line-through':'none', transition:'all 0.1s' }}>
                          {slot}
                          {sel&&totalDuration>0&&<div style={{ fontSize:10, opacity:0.85, marginTop:1 }}>→{toHHMM(endMin)}</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {time&&totalDuration>0&&<div style={{ marginTop:8, fontSize:13, color:'#059669', background:'#ECFDF5', padding:'6px 12px', borderRadius:8 }}>✅ Session: <strong>{time}</strong> → <strong>{toHHMM(toMin(time)+totalDuration)}</strong> ({totalDuration} min)</div>}
                <div style={{ marginTop:8, display:'flex', gap:12, fontSize:11, color:'#9CA3AF' }}>
                  <span>⬜ Available</span><span style={{ color:'#D1D5DB' }}>— Unavailable</span><span style={{ color:'#8B5CF6', fontWeight:700 }}>■ Selected</span>
                </div>
              </Section>

              {/* 9. Notes */}
              <Section label="9. Special Requests (Optional)">
                <textarea style={{ ...inp(), minHeight:80, resize:'vertical' }} placeholder="Allergies, preferences, special instructions…" value={notes} onChange={e=>setNotes(e.target.value)} />
              </Section>

              {/* Price Summary */}
              {selectedServices.length>0 && (
                <div style={{ background:'linear-gradient(135deg,#F5F3FF,#FDF4FF)', border:'1.5px solid #C4B5FD', borderRadius:14, padding:20, marginBottom:24 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#5B21B6', marginBottom:14 }}>💰 PRICE SUMMARY</div>
                  {selectedServices.map(id=>{
                    const svc=services.find(x=>x.id===id);
                    return svc?<div key={id} style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginBottom:6, color:'#374151' }}>
                      <span>{svc.name} <span style={{ color:'#9CA3AF' }}>({svc.duration_minutes}min)</span></span>
                      <span>₹{parseFloat(svc.price).toLocaleString('en-IN')}</span>
                    </div>:null;
                  })}
                  <div style={{ borderTop:'1px solid #DDD6FE', margin:'12px 0' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#6B7280', marginBottom:6 }}>
                    <span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {offerActive && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#D97706', fontWeight:600, marginBottom:6, background:'#FEF3C7', padding:'6px 10px', borderRadius:8 }}>
                      <span>🎉 {activeOffer.name} ({activeOffer.discount_percent}% Festival Offer)</span>
                      <span>−₹{offerDiscountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  {offerActive && customer?.membership_name && (
                    <div style={{ fontSize:12, color:'#B45309', marginBottom:6 }}>
                      ⚠️ Festival offer active — membership discount paused for this visit
                    </div>
                  )}
                  {hasMembership && !offerActive && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#059669', fontWeight:600, marginBottom:6, background:'#ECFDF5', padding:'6px 10px', borderRadius:8 }}>
                      <span>{TIER_STYLE[customer.tier]?.icon} {customer.membership_name} ({discountPct}%)</span>
                      <span>−₹{discountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  {isBlackout && customer?.membership_name && !offerActive && (
                    <div style={{ fontSize:12, color:'#DC2626', marginBottom:6 }}>
                      🚫 Blackout day — membership discount not applicable
                    </div>
                  )}
                  <div style={{ borderTop:'2px solid #8B5CF6', paddingTop:12, marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, fontSize:16, color:'#5B21B6' }}>Total Payable</span>
                    <span style={{ fontWeight:900, fontSize:26, color:'#8B5CF6' }}>₹{payable.toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                  </div>
                </div>
              )}

              {/* Payment Options */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <button style={{ ...btnSecondary, padding:'14px', fontSize:15, opacity:submitting?0.7:1 }}
                  onClick={handlePayDesk} disabled={submitting}>
                  🏦 Pay at Salon Desk
                </button>
                <button style={{ ...btnPrimary, padding:'14px', fontSize:15, opacity:submitting?0.7:1, background:'linear-gradient(135deg,#059669,#047857)' }}
                  onClick={handlePayOnline} disabled={submitting||!razorpayLoaded}>
                  💳 Pay Now (Online)
                </button>
              </div>
              <div style={{ textAlign:'center', fontSize:11, color:'#9CA3AF', marginTop:8 }}>
                🔒 Online payments powered by Razorpay · Secure & encrypted
              </div>

              {Object.keys(errors).length>0 && (
                <div style={{ marginTop:12, fontSize:13, color:'#DC2626', textAlign:'center' }}>⚠️ Please fix the errors above.</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Service detail popup */}
      {popupService && <ServicePopup service={popupService} onClose={()=>setPopupService(null)} />}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const BG = 'linear-gradient(160deg,#1E1B2E 0%,#2D1B69 55%,#1a1a3e 100%)';
const card = { background:'white', borderRadius:20, padding:'32px 28px', boxShadow:'0 25px 60px rgba(0,0,0,0.35)' };
const inp = (err) => ({ width:'100%', padding:'10px 14px', border:`1.5px solid ${err?'#EF4444':'#E5E7EB'}`, borderRadius:10, fontSize:14, fontFamily:'inherit', outline:'none', background:'white', boxSizing:'border-box', color:'#1F2937' });
const sfx = { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:16 };
const hint = { fontSize:13, color:'#9CA3AF', fontStyle:'italic', padding:'12px 16px', background:'#F9FAFB', borderRadius:8 };
const btnPrimary = { background:'linear-gradient(135deg,#8B5CF6,#7C3AED)', color:'white', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 15px rgba(139,92,246,0.4)' };
const btnSecondary = { background:'#F3F4F6', color:'#374151', border:'1.5px solid #E5E7EB', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' };

function Section({ label, error, children, style }) {
  return (
    <div style={{ marginBottom:20, ...style }}>
      <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#374151', marginBottom:8 }}>{label}</label>
      {children}
      {error && <div style={{ fontSize:12, color:'#DC2626', marginTop:4 }}>⚠️ {error}</div>}
    </div>
  );
}
