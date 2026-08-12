import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, GraduationCap, Users, Camera, X, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import { useToastStore } from '../../../../stores/toastStore';
import { api } from '../../../../services/api';

export default function EditStudentPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToastStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
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

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      addToast('Camera access denied. Please allow camera permissions.', 'error');
    }
  };

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

  const retakePhoto = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
    openCamera();
  };

  const discardPhoto = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
    stopCamera();
  };

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
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
        addToast("Failed to load academic data.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptions();
  }, [addToast]);

  useEffect(() => {
    if (!id) return;
    const fetchStudent = async () => {
      try {
        const response = await api.get(`/students/students/${id}/`);
        const student = response.data;
        setFormData({
          first_name: student.first_name,
          last_name: student.last_name,
          date_of_birth: student.date_of_birth ? student.date_of_birth.split('T')[0] : '',
          gender: student.gender,
          blood_group: student.blood_group || '',
          emergency_contact: student.emergency_contact || '',
          parent_name: '',
          parent_phone: '',
          parent_email: '',
          relationship_type: 'father',
          section: student.stream || '',
          series: student.series || '',
          current_class: student.current_class || ''
        });
        if (student.photo_url) {
          setPhotoPreview(student.photo_url);
        }
      } catch (error) {
        addToast('Failed to load student details.', 'error');
      }
    };
    fetchStudent();
  }, [id, addToast]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try {
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

      const response = await api.patch(`/students/students/${id}/`, payload);
      addToast(`Student ${response.data.first_name} ${response.data.last_name} updated successfully.`, 'success');
      navigate('/admin/academic');
    } catch (error: any) {
      const data = error.response?.data;
      let detail = 'Failed to update student.';
      if (typeof data === 'string') {
        detail = data;
      } else if (data?.detail) {
        detail = data.detail;
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
      <button onClick={() => navigate('/admin/academic')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Registry
      </button>

      <section className="mb-12">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary/80 block mb-3">Academic Management</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Edit Student</h1>
        <p className="text-on-surface-variant mt-2 text-lg">Update student information and academic placement.</p>
      </section>

      <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-4">

          {/* Photo Capture */}
          <section className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4 flex items-center gap-3">
              <User className="text-primary w-6 h-6" /> Personal Information
            </h3>

            <div className="flex flex-col items-center gap-4">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Student preview" className="w-32 h-32 rounded-3xl object-cover border-4 border-primary/20 shadow-lg" />
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
                      <Camera className="w-4 h-4" /> Snap
                    </button>
                    <button onClick={stopCamera} className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-all flex items-center gap-2">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={openCamera} className="w-32 h-32 rounded-3xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group">
                  <Camera className="w-8 h-8 text-on-surface-variant/40 group-hover:text-primary transition-colors" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 group-hover:text-primary transition-colors">Take Photo</span>
                </button>
              )}
              {photoPreview && (
                <button onClick={retakePhoto} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                  <RotateCcw className="w-3 h-3" /> Retake
                </button>
              )}
              <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/30">Optional — Student Profile Photo</p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">First Name</label>
                <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g., Marcus" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Last Name</label>
                <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g., Aurelius" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Date of Birth</label>
                <input required type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Legal Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-outline-variant/10">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Blood Group</label>
                <select name="blood_group" value={formData.blood_group} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="">Select</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Emergency Contact Phone</label>
                <input type="tel" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="+237 6XX XXX XXX" />
              </div>
            </div>
          </section>

          {/* Academic Placement */}
          <section className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4 flex items-center gap-3">
              <GraduationCap className="text-primary w-5 h-5" /> Academic Placement
            </h3>
            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Section</label>
                <select name="section" value={formData.section} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="">Select Section</option>
                  {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  {isLoading && <option disabled>Loading...</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Grade Level / Class</label>
                <select name="current_class" value={formData.current_class} onChange={handleChange} disabled={!formData.section} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50">
                  <option value="">Select Class</option>
                  {classes.filter((c: any) => !formData.section || c.stream == formData.section).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {isLoading && <option disabled>Loading...</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Series / Track <span className="text-on-surface-variant/40">(2nd Cycle only)</span></label>
                <select name="series" value={formData.series} onChange={handleChange} disabled={!formData.current_class} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer disabled:opacity-50">
                  <option value="">Select Series (optional for 1st Cycle)</option>
                  {series.filter((s: any) => !formData.section || s.stream == formData.section).map((s: any) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                  {isLoading && <option disabled>Loading...</option>}
                </select>
              </div>
            </div>
          </section>

          {/* Parent / Guardian Info (optional update) */}
          <section className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-on-surface border-b border-outline-variant/10 pb-4 flex items-center gap-3">
              <Users className="text-primary w-5 h-5" /> Parent / Guardian Information (Optional Update)
            </h3>
            <p className="text-sm text-on-surface-variant">To create/update a parent account, provide name and email. Phone is optional. Leave all blank to skip.</p>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Parent / Guardian Name</label>
                <input type="text" name="parent_name" value={formData.parent_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Relationship</label>
                <select name="relationship_type" value={formData.relationship_type} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all appearance-none cursor-pointer">
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Parent Phone <span className="text-on-surface-variant/40 normal-case tracking-normal">(optional)</span></label>
                <input type="tel" name="parent_phone" value={formData.parent_phone} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="+237 6XX XXX XXX" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Parent Email</label>
                <input type="email" name="parent_email" value={formData.parent_email} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-5 py-4 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="email@example.com" />
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-6 border-t border-outline-variant/10">
            <button onClick={() => navigate('/admin/academic')} className="px-8 py-4 bg-surface-container-low text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all mr-4">
              Cancel
            </button>
            <button disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.date_of_birth} type="submit" className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}