import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const COURSE_TYPES = {
  diploma: { label: 'Diploma', icon: '🎓', color: '#8B5CF6' },
  modular: { label: 'Modular', icon: '📚', color: '#059669' },
  masterclass: { label: 'Masterclass', icon: '⭐', color: '#D97706' },
};

// Razorpay script loader
const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CourseEnrollment() {
  const [step, setStep] = useState(1); // 1: form, 2: courses, 3: review, 4: payment, 5: success
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    contact_number: '',
    whatsapp_number: '',
    email: '',
    residential_address: '',
    city: '',
    state: '',
    pin_code: '',
    educational_qualification: '',
    prior_beauty_experience: false,
    experience_years: '',
    selected_course_ids: [],
    learning_mode: 'studio',
    batch_preference: 'weekday_morning',
    payment_plan: 'full',
    payment_mode: 'upi',
    installment_months: 4,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadCoursesAndRazorpay();
  }, []);

  const loadCoursesAndRazorpay = async () => {
    try {
      const [coursesRes, razorpayLoaded] = await Promise.all([
        api.get('/courses/public/list'),
        loadRazorpay(),
      ]);
      setCourses(coursesRes.data);
      setRazorpayReady(razorpayLoaded);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.contact_number.trim()) newErrors.contact_number = 'Contact number is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (formData.selected_course_ids.length === 0) newErrors.selected_course_ids = 'Select at least one course';
    if (!formData.learning_mode) newErrors.learning_mode = 'Learning mode is required';
    if (!formData.batch_preference) newErrors.batch_preference = 'Batch preference is required';
    if (!formData.payment_plan) newErrors.payment_plan = 'Payment plan is required';
    if (!formData.payment_mode) newErrors.payment_mode = 'Payment mode is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCourseToggle = (courseId) => {
    setFormData(prev => ({
      ...prev,
      selected_course_ids: prev.selected_course_ids.includes(courseId)
        ? prev.selected_course_ids.filter(id => id !== courseId)
        : [...prev.selected_course_ids, courseId],
    }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  const handleSubmitForm = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const response = await api.post('/courses/public/enroll', formData);
      setEnrollmentId(response.data.enrollment_id);
      setTotalAmount(response.data.total_amount);
      setStep(4); // Go to payment processing
      
      // Auto-trigger payment after a short delay
      setTimeout(() => {
        handlePaymentWithEnrollmentId(response.data.enrollment_id, response.data.total_amount);
      }, 500);
    } catch (err) {
      alert(err.response?.data?.error || 'Error submitting enrollment');
      setSubmitting(false);
    }
  };

  const handlePaymentWithEnrollmentId = async (enrId, amount) => {
    if (!razorpayReady) {
      alert('Payment system not ready. Please refresh and try again.');
      setSubmitting(false);
      return;
    }

    try {
      // Create Razorpay order
      const orderResponse = await api.post('/courses/public/create-payment-order', {
        enrollment_id: enrId,
        amount: amount,
      });

      const options = {
        key: orderResponse.data.key_id,
        amount: orderResponse.data.amount,
        currency: orderResponse.data.currency,
        order_id: orderResponse.data.order_id,
        name: 'J Eighteen Beauty Salon Academy',
        description: 'Course Enrollment',
        image: '/assets/logo.png',
        handler: async (response) => {
          // Verify payment
          try {
            const verifyResponse = await api.post('/courses/public/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              enrollment_id: enrId,
              amount: amount,
            });

            if (verifyResponse.data.success) {
              setStep(5); // Success
            }
          } catch (err) {
            alert('Payment verification failed');
            setStep(3); // Go back to step 3
          }
        },
        prefill: {
          name: formData.full_name,
          email: formData.email,
          contact: formData.contact_number,
        },
        theme: { color: '#8B5CF6' },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating payment order');
      setStep(3); // Go back to step 3
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedCoursesInfo = () => {
    return formData.selected_course_ids.map(id => courses.find(c => c.id === id)).filter(Boolean);
  };

  const getTotalCoursePrice = () => {
    return getSelectedCoursesInfo().reduce((sum, c) => sum + parseFloat(c.price || 0), 0);
  };

  const getInstallmentPlan = () => {
    const total = getTotalCoursePrice();
    const months = parseInt(formData.installment_months);
    
    const plans = {
      4: { downPayment: 0.5, monthlyPercentage: 16.67 },
      6: { downPayment: 0.4, monthlyPercentage: 12 },
      9: { downPayment: 0.3, monthlyPercentage: 7.78 }
    };
    
    const plan = plans[months] || plans[4];
    const downPayment = Math.round(total * plan.downPayment);
    const remainingAmount = total - downPayment;
    const monthlyAmount = Math.round(remainingAmount / (months - 1));
    
    return {
      months,
      downPayment,
      monthlyAmount,
      remainingAmount,
      total,
      downPaymentPercentage: Math.round(plan.downPayment * 100)
    };
  };

  if (loading) return <div className="spinner" />;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F5F3FF 0%, #FDF4FF 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1F2937', marginBottom: 8 }}>
            🎓 J Eighteen Beauty Salon Academy
          </h1>
          <p style={{ fontSize: 16, color: '#6B7280' }}>Course Enrollment Form</p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40, gap: 8 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} style={{
              flex: 1,
              height: 8,
              background: s <= step ? '#8B5CF6' : '#E5E7EB',
              borderRadius: 4,
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* STEP 1: Personal Information */}
        {step === 1 && (
          <div className="card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#1F2937' }}>
              📋 Step 1: Candidate Profile
            </h2>

            {/* Personal Details Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleFormChange}
                  className="form-control"
                  placeholder="Your full name"
                />
                {errors.full_name && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.full_name}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleFormChange}
                  className="form-control"
                />
              </div>
            </div>

            {/* Personal Details Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  Gender
                </label>
                <select name="gender" value={formData.gender} onChange={handleFormChange} className="form-control">
                  <option value="">Select Gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  Contact Number *
                </label>
                <input
                  type="tel"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handlePhoneChange}
                  maxLength="10"
                  className="form-control"
                  placeholder="10-digit mobile number"
                />
                {errors.contact_number && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.contact_number}</div>}
              </div>
            </div>

            {/* Contact Details Row 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  name="whatsapp_number"
                  value={formData.whatsapp_number}
                  onChange={handlePhoneChange}
                  maxLength="10"
                  className="form-control"
                  placeholder="WhatsApp number (if different)"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  className="form-control"
                  placeholder="your.email@example.com"
                />
                {errors.email && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.email}</div>}
              </div>
            </div>

            {/* Address */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                Residential Address
              </label>
              <input
                type="text"
                name="residential_address"
                value={formData.residential_address}
                onChange={handleFormChange}
                className="form-control"
                placeholder="Your residential address"
              />
            </div>

            {/* City, State, Pin Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleFormChange}
                  className="form-control"
                  placeholder="City"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleFormChange}
                  className="form-control"
                  placeholder="State"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                  Pin Code
                </label>
                <input
                  type="text"
                  name="pin_code"
                  value={formData.pin_code}
                  onChange={handleFormChange}
                  className="form-control"
                  placeholder="Pin code"
                />
              </div>
            </div>

            {/* Education & Experience */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                Educational Qualification
              </label>
              <input
                type="text"
                name="educational_qualification"
                value={formData.educational_qualification}
                onChange={handleFormChange}
                className="form-control"
                placeholder="e.g., 12th Pass, Bachelor's Degree"
              />
            </div>

            {/* Beauty Experience */}
            <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 10, marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="prior_beauty_experience"
                  checked={formData.prior_beauty_experience}
                  onChange={handleFormChange}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Do you have prior beauty industry experience?
                </span>
              </label>
              {formData.prior_beauty_experience && (
                <input
                  type="number"
                  name="experience_years"
                  value={formData.experience_years}
                  onChange={handleFormChange}
                  className="form-control"
                  placeholder="Years of experience"
                  style={{ marginTop: 10 }}
                  min="0"
                />
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                style={{ flex: 1 }}
              >
                Next: Select Courses →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Course Selection */}
        {step === 2 && (
          <div className="card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#1F2937' }}>
              📚 Step 2: Course Selection
            </h2>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Check all applicable courses (select at least one):
              </p>

              {/* Group courses by type */}
              {Object.keys(COURSE_TYPES).map(type => {
                const typeCourses = courses.filter(c => c.course_type === type);
                if (typeCourses.length === 0) return null;

                return (
                  <div key={type} style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: COURSE_TYPES[type].color, marginBottom: 12 }}>
                      {COURSE_TYPES[type].icon} {COURSE_TYPES[type].label}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                      {typeCourses.map(course => (
                        <label key={course.id} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: 12,
                          background: formData.selected_course_ids.includes(course.id) ? '#F5F3FF' : '#F9FAFB',
                          border: `2px solid ${formData.selected_course_ids.includes(course.id) ? '#8B5CF6' : '#E5E7EB'}`,
                          borderRadius: 10,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.selected_course_ids.includes(course.id)}
                            onChange={() => handleCourseToggle(course.id)}
                            style={{ marginTop: 2 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                              {course.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                              {course.description}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#8B5CF6' }}>
                              ₹{parseFloat(course.price).toLocaleString('en-IN')} • {course.duration_hours}h
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {errors.selected_course_ids && (
                <div style={{ fontSize: 12, color: '#DC2626', marginTop: 12, background: '#FEE2E2', padding: 10, borderRadius: 6 }}>
                  {errors.selected_course_ids}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                style={{ flex: 1 }}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={formData.selected_course_ids.length === 0}
                style={{ flex: 1 }}
              >
                Next: Learning Preferences →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Learning Preferences & Review */}
        {step === 3 && (
          <div className="card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#1F2937' }}>
              🎓 Step 3: Learning Mode & Payment
            </h2>

            {/* Learning Mode */}
            <div style={{ marginBottom: 24, background: '#F9FAFB', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                Learning Mode *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { value: 'studio', label: '🏢 Studio Classroom (Kolkata)' },
                  { value: 'online', label: '🖥️ Live Online / Hybrid' },
                  { value: 'hybrid', label: '🔄 Hybrid' },
                ].map(option => (
                  <label key={option.value} style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="learning_mode"
                      value={option.value}
                      checked={formData.learning_mode === option.value}
                      onChange={handleFormChange}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Batch Preference */}
            <div style={{ marginBottom: 24, background: '#F9FAFB', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                Batch Preference *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { value: 'weekday_morning', label: '🌅 Weekday Morning' },
                  { value: 'weekday_afternoon', label: '☀️ Weekday Afternoon' },
                  { value: 'weekend_intensive', label: '📅 Weekend Intensive' },
                ].map(option => (
                  <label key={option.value} style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="batch_preference"
                      value={option.value}
                      checked={formData.batch_preference === option.value}
                      onChange={handleFormChange}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Payment Plan */}
            <div style={{ marginBottom: 24, background: '#F9FAFB', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                Payment Plan *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { value: 'full', label: 'Full Payment' },
                  { value: 'installment', label: 'Installments / EMI' },
                ].map(option => (
                  <label key={option.value} style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_plan"
                      value={option.value}
                      checked={formData.payment_plan === option.value}
                      onChange={handleFormChange}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</span>
                  </label>
                ))}
              </div>

              {/* Show installment options if selected */}
              {formData.payment_plan === 'installment' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E5E7EB' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                    Select Installment Duration
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[4, 6, 9].map(months => {
                      const plan = getInstallmentPlan();
                      const isSelected = formData.installment_months === months.toString();
                      
                      return (
                        <label key={months} style={{
                          padding: 12,
                          border: `2px solid ${isSelected ? '#8B5CF6' : '#E5E7EB'}`,
                          background: isSelected ? '#F5F3FF' : '#FFFFFF',
                          borderRadius: 10,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}>
                          <input
                            type="radio"
                            name="installment_months"
                            value={months}
                            checked={formData.installment_months === months.toString()}
                            onChange={handleFormChange}
                            style={{ marginRight: 8 }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#8B5CF6' : '#374151' }}>
                            {months}-Month Plan
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Display installment breakdown */}
                  {getTotalCoursePrice() > 0 && (() => {
                    const planData = getInstallmentPlan();
                    return (
                      <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 12 }}>
                          📊 Installment Breakdown ({planData.months}-Month Plan)
                        </div>
                        
                        {/* Down Payment */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#FEF3C7', borderRadius: 6, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                              💰 Upfront Payment ({planData.downPaymentPercentage}%)
                            </div>
                            <div style={{ fontSize: 11, color: '#B45309' }}>Due immediately</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>
                            ₹{planData.downPayment.toLocaleString('en-IN')}
                          </div>
                        </div>

                        {/* Monthly Installments */}
                        {Array.from({ length: planData.months - 1 }).map((_, idx) => {
                          const month = idx + 1;
                          const amount = month === planData.months - 1 
                            ? (planData.total - planData.downPayment - (planData.monthlyAmount * (planData.months - 2)))
                            : planData.monthlyAmount;
                          
                          return (
                            <div key={month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: month % 2 === 0 ? '#F0FDF4' : '#FFFFFF', borderRadius: 6, marginBottom: 8, border: '1px solid #E5E7EB' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                                  📅 Month {month}
                                </div>
                                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Due after {month * 30} days</div>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
                                ₹{amount.toLocaleString('en-IN')}
                              </div>
                            </div>
                          );
                        })}

                        {/* Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#EDE9FE', borderRadius: 6, marginTop: 12, fontWeight: 700, color: '#5B21B6' }}>
                          <span>Total Amount:</span>
                          <span>₹{planData.total.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Show full payment amount if selected */}
              {formData.payment_plan === 'full' && getTotalCoursePrice() > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: '#ECFDF5', borderRadius: 8, border: '1px solid #BBFBEE' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#047857' }}>💳 Full Amount Due Today:</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                      ₹{getTotalCoursePrice().toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Mode */}
            <div style={{ marginBottom: 24, background: '#F9FAFB', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                Payment Mode *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { value: 'upi', label: '📱 UPI / GPay' },
                  { value: 'netbanking', label: '🏦 Net Banking / IMPS' },
                  { value: 'card', label: '💳 Card / Cash' },
                ].map(option => (
                  <label key={option.value} style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_mode"
                      value={option.value}
                      checked={formData.payment_mode === option.value}
                      onChange={handleFormChange}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Selected Courses Summary */}
            <div style={{ background: '#EDE9FE', padding: 16, borderRadius: 10, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6', marginBottom: 12 }}>📋 Selected Courses:</div>
              {getSelectedCoursesInfo().map(course => (
                <div key={course.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#374151' }}>
                  <span>{course.name}</span>
                  <span style={{ fontWeight: 600, color: '#8B5CF6' }}>₹{parseFloat(course.price).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #C4B5FD', paddingTop: 12, marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#5B21B6' }}>
                <span>Total Amount:</span>
                <span>₹{getTotalCoursePrice().toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setStep(2)}
                style={{ flex: 1 }}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitForm}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                {submitting ? 'Submitting...' : 'Proceed to Payment →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Payment */}
        {step === 4 && (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment Processing</h2>
            <p style={{ color: '#6B7280', marginBottom: 24 }}>Redirecting to payment...</p>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        )}

        {/* STEP 5: Success */}
        {step === 5 && (
          <div className="card" style={{ padding: 32, textAlign: 'center', background: '#ECFDF5' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginBottom: 8 }}>
              Enrollment Successful!
            </h2>
            <p style={{ fontSize: 16, color: '#047857', marginBottom: 24 }}>
              Thank you for enrolling! Your enrollment has been confirmed.
            </p>
            <div style={{ background: 'white', padding: 20, borderRadius: 10, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Enrollment ID</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>{enrollmentId}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Total Amount Paid</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>
                  ₹{totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
              A confirmation email will be sent to <strong>{formData.email}</strong>
            </p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.href = '/'}
              style={{ width: '100%' }}
            >
              ← Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
