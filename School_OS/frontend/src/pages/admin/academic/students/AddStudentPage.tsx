import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, GraduationCap, ShieldAlert, Heart, Users, Camera, X, RotateCcw, CheckCircle2, CreditCard } from 'lucide-react';
import { useToastStore } from '../../../../stores/toastStore';
import { api } from '../../../../services/api';
import { useTranslation } from 'react-i18next';

export default function AddStudentPage() {
  const { t } = useTranslation('adminAcademicMgmt');
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [registeredStudent, setRegisteredStudent] = useState<any>(null);

  const [series, setSeries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'M',
    blood_group: '',
    emergency_contact: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    relationship_type: 'father',
    section: '',
    series: '',
    current_class: ''
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Start camera
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      setIsCameraOpen(true);
      // Attach stream after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      addToast(t('Camera access denied. Please allow camera permissions.'), 'error');
    }
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setPhotoBlob(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.85);
  };

  // Retake photo
  const retakePhoto = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
    openCamera();
  };

  // Discard photo
  const discardPhoto = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
    stopCamera();
  };

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [sectionsRes, classesRes, seriesRes] = await Promise.all([
          api.get('/academic/sections/'),
          api.get('/academic/classes/'),
          api.get('/academic/series/')
        ]);
        setSections(sectionsRes.data.results || sectionsRes.data);
        setClasses(classesRes.data.results || classesRes.data);
        setSeries(seriesRes.data.results || seriesRes.data);
      } catch (error) {
        addToast(t('Failed to load academic data.'), 'error');
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchOptions();
  }, [addToast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'section') {
        newData.current_class = '';
        newData.series = '';
      }
      if (name === 'current_class') {
        newData.series = '';
      }
      return newData;
    });
  };

  const goToPlacement = () => {
    const hasParentInfo = !!(formData.parent_name.trim() || formData.parent_phone.trim() || formData.parent_email.trim());
    if (hasParentInfo) {
      if (!formData.parent_name.trim()) {
        addToast(t('Parent name is required to create a parent account.'), 'error');
        return;
      }
      if (!formData.parent_email.trim()) {
        addToast(t('Parent email is required to create a parent account. Leave all parent fields blank to register without one.'), 'error');
        return;
      }
    }
    setStep(4);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Upload photo first if present
      let photoUrl = '';
      if (photoBlob) {
        const fd = new FormData();
        fd.append('photo', photoBlob, 'student_photo.jpg');
        const uploadRes = await api.post('/students/upload-photo/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photoUrl = uploadRes.data.photo_url || '';
      }

      const payload: any = {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
      };

      if (photoUrl) payload.photo_url = photoUrl;
      if (formData.blood_group) payload.blood_group = formData.blood_group;
      if (formData.emergency_contact) payload.emergency_contact = formData.emergency_contact;
      if (formData.section) payload.stream = formData.section;
      if (formData.series) payload.series = formData.series;
      if (formData.current_class) payload.current_class = formData.current_class;
      if (formData.parent_name) payload.parent_name = formData.parent_name;
      if (formData.parent_phone) payload.parent_phone = formData.parent_phone;
      if (formData.parent_email) payload.parent_email = formData.parent_email;
      if (formData.relationship_type) payload.relationship_type = formData.relationship_type;

      const response = await api.post('/students/students/', payload);
      setRegisteredStudent(response.data);
      addToast(t('Welcome aboard! {{first_name}} is now registered. Admission #{{admission_number}}', { first_name: response.data.first_name, admission_number: response.data.admission_number || t('Generated') }), 'success');
    } catch (error: any) {
      const data = error.response?.data;
      let detail = t('Failed to register student.');
      if (typeof data === 'string') {
        detail = data;
      } else if (data?.detail) {
        detail = data.detail;
      } else if (data?.message) {
        detail = data.message;
      } else if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          detail = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
        }
      }
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button onClick={() => { stopCamera(); navigate('/admin/academic'); }} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> {t('Back to Registry')}
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 block mb-3">{t('Academic Management')}</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">{t('Register New Student')}</h1>
        <p className="text-on-surface-variant mt-2 text-lg">{t('Onboard a student into the institutional database securely.')}</p>
      </section>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-12 border-b border-outline-variant/15 pb-8 overflow-x-auto">
        {[
          { num: 1, label: t('Personal Info'), icon: User },
          { num: 2, label: t('Medical & Emergency'), icon: Heart },
          { num: 3, label: t('Parent / Guardian'), icon: Users },
          { num: 4, label: t('Academic Placement'), icon: GraduationCap },
          { num: 5, label: t('Verification'), icon: ShieldAlert }
        ].map((s) => (
          <div key={s.num} className={`flex items-center gap-3 shrink-0 ${step === s.num ? 'opacity-100' : 'opacity-40'} transition-opacity`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${step >= s.num ? 'bg-primary text-white shadow-lg' : 'bg-surface-container-high text-on-surface-variant'}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">{s.label}</span>
            {s.num !== 5 && <div className="w-8 h-px bg-outline-variant/30 border-dashed border-b mx-1" />}
          </div>
        ))}
      </div>

      <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm max-w-3xl">
        {registeredStudent ? (
          <div className="space-y-8 animate-in fade-in text-on-surface">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">{t('Registration Complete')}</h3>
              <p className="text-on-surface-variant text-sm font-bold">
                {t('{{first_name}} {{last_name}} is now in the registry.', { first_name: registeredStudent.first_name, last_name: registeredStudent.last_name })}
              </p>
            </div>

            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20 space-y-4 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Admission No')}</span>
                <span className="text-sm font-black text-primary">{registeredStudent.admission_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Status')}</span>
                <span className="text-sm font-black text-secondary">{t('Registered (Pending)')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Placement')}</span>
                <span className="text-sm font-black">
                  {registeredStudent.section_display || '—'}
                  <span className="mx-2 opacity-20">/</span>
                  {registeredStudent.class_display || '—'}
                  {registeredStudent.series_code && (
                    <>
                      <span className="mx-2 opacity-20">/</span>
                      {registeredStudent.series_code}
                    </>
                  )}
                </span>
              </div>
            </div>

            {registeredStudent.parent && (
              <div className="p-6 bg-secondary-container/20 rounded-2xl border border-secondary/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary">
                  <Users className="w-4 h-4" /> {t('Parent Account Created')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">{t('Email')}</p>
                    <p className="font-black">{registeredStudent.parent.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">{t('Temporary Password')}</p>
                    <p className="font-black text-secondary select-all">{registeredStudent.parent.temp_password}</p>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-on-secondary-container/70">
                  {t('Share these credentials with the parent. They can change the password on first login.')}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={() => navigate('/admin/finance/transactions/new', { state: { studentId: registeredStudent.id } })}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all"
              >
                <CreditCard className="w-5 h-5" /> {t('Record Payment')}
              </button>
              <button
                onClick={() => navigate('/admin/academic')}
                className="flex-1 px-8 py-4 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all"
              >
                Back to Registry
              </button>
            </div>
            <p className="text-[11px] font-bold text-on-surface-variant/60 text-center">
              {t('No invoice needed — the system will build the payable from the class fee structures when you record the first payment.')}
            </p>
          </div>
        ) : (
        <>
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4">{t('Personal Information')}</h3>

            {/* Photo Capture */}
            <div className="flex flex-col items-center gap-4">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt={t('Student preview')} className="w-32 h-32 rounded-3xl object-cover border-4 border-primary/20 shadow-lg" />
                  <button onClick={discardPhoto} className="absolute -top-2 -right-2 w-7 h-7 bg-error text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : isCameraOpen ? (
                <div className="relative rounded-3xl overflow-hidden border-4 border-primary/20 shadow-lg">
                  <video ref={videoRef} autoPlay playsInline muted className="w-64 h-48 object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    <button onClick={capturePhoto} className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                      <Camera className="w-4 h-4" /> {t('Snap')}
                    </button>
                    <button onClick={stopCamera} className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-all flex items-center gap-2">
                      <X className="w-4 h-4" /> {t('Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={openCamera} className="w-32 h-32 rounded-3xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group">
                  <Camera className="w-8 h-8 text-on-surface-variant/40 group-hover:text-primary transition-colors" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 group-hover:text-primary transition-colors">{t('Take Photo')}</span>
                </button>
              )}
              {photoPreview && (
                <button onClick={retakePhoto} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                  <RotateCcw className="w-3 h-3" /> {t('Retake')}
                </button>
              )}
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/30">{t('Optional — Student Profile Photo')}</p>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('First Name')}</label>
                <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('e.g., Marcus')} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Middle Name')}</label>
                <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('e.g., Nfon')} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Last Name')}</label>
                <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('e.g., Aurelius')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Date of Birth')}</label>
                <input required type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Legal Gender')}</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="M">{t('Male')}</option>
                  <option value="F">{t('Female')}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-6">
              <button onClick={() => setStep(2)} disabled={!formData.first_name || !formData.last_name || !formData.date_of_birth} className="px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {t('Next: Medical & Emergency')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Medical & Emergency */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4 flex items-center gap-3">
              <Heart className="text-primary w-5 h-5" /> {t('Medical & Emergency')}
            </h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Blood Group')}</label>
                <select name="blood_group" value={formData.blood_group} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="">{t('Select')}</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Emergency Contact Phone')}</label>
                <input type="tel" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('+237 6XX XXX XXX')} />
              </div>
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(1)} className="px-8 py-4 bg-surface-container-low text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all">{t('Back')}</button>
              <button onClick={() => setStep(3)} className="px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
                {t('Next: Parent / Guardian')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Parent / Guardian Info */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4 flex items-center gap-3">
              <Users className="text-primary w-5 h-5" /> {t('Parent / Guardian Information')}
            </h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Parent / Guardian Name')}</label>
                <input type="text" name="parent_name" value={formData.parent_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('Full name')} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Relationship')}</label>
                <select name="relationship_type" value={formData.relationship_type} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="father">{t('Father')}</option>
                  <option value="mother">{t('Mother')}</option>
                  <option value="guardian">{t('Guardian')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Parent Phone')} <span className="text-on-surface-variant/40 normal-case tracking-normal">{t('(optional)')}</span></label>
                <input type="tel" name="parent_phone" value={formData.parent_phone} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('+237 6XX XXX XXX')} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Parent Email')}</label>
                <input type="email" name="parent_email" value={formData.parent_email} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder={t('email@example.com')} />
              </div>
            </div>
            <p className="text-[11px] font-bold text-on-surface-variant/60 leading-relaxed">
              {t('To create a parent login,')} <span className="text-primary">{t('name and email are required')}</span> {t('(phone is optional). Leave all parent fields blank to register the student without a parent account — you can link one later.')}
            </p>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="px-8 py-4 bg-surface-container-low text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all">Back</button>
              <button onClick={goToPlacement} className="px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
                {t('Next: Academic Placement')}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Academic Placement */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4">{t('Academic Placement')}</h3>
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Section')}</label>
                <select name="section" value={formData.section} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="">{t('Select Section')}</option>
                  {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  {isLoadingOptions && <option disabled>{t('Loading...')}</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Grade Level / Class')}</label>
                <select name="current_class" value={formData.current_class} onChange={handleChange} disabled={!formData.section} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50">
                  <option value="">{t('Select Class')}</option>
                  {classes.filter((c: any) => !formData.section || c.stream == formData.section).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {isLoadingOptions && <option disabled>{t('Loading...')}</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('Series / Track')} <span className="text-on-surface-variant/40">{t('(2nd Cycle only)')}</span></label>
                <select name="series" value={formData.series} onChange={handleChange} disabled={!formData.current_class} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50">
                  <option value="">{t('Select Series (optional for 1st Cycle)')}</option>
                  {series.filter((s: any) => !formData.section || s.stream == formData.section).map((s: any) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                  {isLoadingOptions && <option disabled>{t('Loading...')}</option>}
                </select>
              </div>
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(3)} className="px-8 py-4 bg-surface-container-low text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all">Back</button>
              <button onClick={() => setStep(5)} disabled={!formData.current_class} className="px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{t('Review Details')}</button>
            </div>
          </div>
        )}

        {/* Step 5: Verification */}
        {step === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 text-on-surface">
            <h3 className="text-xl font-bold tracking-tight border-b border-outline-variant/10 pb-4">{t('Verify Registration')}</h3>
            <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/20 space-y-4 shadow-inner">
              {/* Photo preview in verification */}
              {photoPreview && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Photo')}</span>
                  <img src={photoPreview} alt={t('Student')} className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Full Name')}</span>
                <span className="text-sm font-black">{formData.first_name} {formData.last_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('DOB / Gender')}</span>
                <span className="text-sm font-black">{formData.date_of_birth} ({formData.gender === 'M' ? t('Male') : t('Female')})</span>
              </div>
              {formData.blood_group && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Blood Group')}</span>
                  <span className="text-sm font-black">{formData.blood_group}</span>
                </div>
              )}
              {formData.emergency_contact && (
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Emergency Contact')}</span>
                  <span className="text-sm font-black">{formData.emergency_contact}</span>
                </div>
              )}
              {formData.parent_name && (
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-outline-variant/20">
                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Parent/Guardian')}</span>
                  <span className="text-sm font-black">{formData.parent_name} ({formData.relationship_type})</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-dashed border-outline-variant/20">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('Placement')}</span>
                <span className="text-sm font-black text-primary">
                  {sections.find(s => String(s.id) === formData.section)?.name || t('Not Set')}
                  <span className="mx-2 opacity-20">/</span>
                  {classes.find(c => String(c.id) === formData.current_class)?.name || t('Unassigned')}
                  {formData.series && (
                    <>
                      <span className="mx-2 opacity-20">/</span>
                      {series.find(s => String(s.id) === formData.series)?.code || ''}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="p-6 bg-secondary-container/20 rounded-2xl border border-secondary/10 flex items-start gap-4">
              <ShieldAlert className="w-5 h-5 text-secondary shrink-0" />
              <p className="text-xs font-bold text-on-secondary-container/80 leading-relaxed">
                {t('By confirming, this student will be added to the registry as')} <span className="text-secondary">REGISTERED</span>{t('. They will become')} <span className="text-secondary">ACTIVE</span>{t(' once their initial fees are verified by the treasury.')}
              </p>
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(4)} disabled={isSubmitting} className="px-8 py-4 bg-surface-container-low text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all">Back</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-3 px-8 py-4 bg-secondary text-on-secondary rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50">
                {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <Save className="w-5 h-5" />}
                {isSubmitting ? t('Registering...') : t('Confirm Registration')}
              </button>
            </div>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}
