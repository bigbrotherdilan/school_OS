import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../../stores/toastStore';
import { ArrowLeft, UserCircle, CheckCircle, Users, Search, Link2 } from 'lucide-react';
import { api } from '../../../services/api';
import CredentialsCard from '../../../components/ui/CredentialsCard';

const RELATIONSHIP_TYPES = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
];

export default function AddParentPage() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    default_language: 'en',
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState('guardian');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('guardian');

  useEffect(() => {
    api.get('/students/students/').then(({ data }) => {
      const list = data.results || data;
      if (Array.isArray(list)) setStudents(list);
    }).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/staff/parents/onboard/', {
        ...formData,
        links: selectedStudentIds.map(student_id => ({ student_id, relationship_type: relationshipType })),
      });
      setResult(res.data);
      addToast(`Parent ${formData.first_name} created.`, 'success');
    } catch (error: any) {
      const data = error.response?.data;
      let detail = 'Failed to create parent.';
      if (typeof data === 'string') detail = data;
      else if (data?.detail) detail = data.detail;
      else if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          detail = `${firstKey}: ${Array.isArray(val) ? (Array.isArray(val[0]) ? (val[0][0] || 'invalid') : val[0]) : val}`;
        }
      }
      addToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const { data } = await api.get(`/students/parent-student-links/search/?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      addToast('Search failed.', 'error');
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent || !linkStudentId) return;
    setIsSubmitting(true);
    try {
      await api.post('/students/parent-student-links/link/', {
        parent_user: selectedParent.id,
        student: linkStudentId,
        relationship_type: linkRelationship,
      });
      addToast(`${selectedParent.full_name} linked to student.`, 'success');
      setSelectedParent(null);
      setLinkStudentId('');
      setSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to link parent.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="p-4 lg:p-12 max-w-[1000px] mx-auto bg-surface min-h-screen">
        <button onClick={() => navigate('/admin/operations')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Operations
        </button>

        <div className="bg-surface-container-lowest p-12 rounded-3xl border border-outline-variant/10 shadow-sm max-w-lg mx-auto text-center space-y-8">
          <div className="w-20 h-20 rounded-3xl bg-teal-500/15 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-teal-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-on-surface mb-2">Parent Account Created</h2>
            <p className="text-on-surface-variant">{result.user.full_name} has been added to the system.</p>
            {result.linked_students && result.linked_students.length > 0 && (
              <p className="text-xs font-bold text-success mt-2">
                Linked to {result.linked_students.length} student{result.linked_students.length > 1 ? 's' : ''} in {result.user.home_school}.
              </p>
            )}
          </div>

          <div className="bg-surface-container-low p-6 rounded-2xl space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Email</span>
              <span className="font-bold text-on-surface">{result.user.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Home School</span>
              <span className="font-bold text-on-surface">{result.user.home_school}</span>
            </div>
          </div>

          {result.temp_password && (
            <CredentialsCard email={result.user.email} password={result.temp_password} label="Parent Temporary Password" note="This parent is global: they can be linked to children at any other school. This password is shown only once — share it in person or by phone." />
          )}

          <button onClick={() => navigate('/admin/operations')} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
            Return to Operations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 max-w-[1200px] mx-auto bg-surface min-h-screen">
      <button onClick={() => navigate('/admin/operations')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Operations
      </button>

      <section className="mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600/80 block mb-3">Family Hub</span>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">Manage Parents</h1>
        <p className="text-on-surface-variant mt-2 text-lg leading-relaxed max-w-3xl">
          Parents are global accounts — they are not tied to a school. Create one, give them the
          temporary password, and any school can link them to a child.
        </p>
      </section>

      <div className="flex gap-3 mb-8">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'create' ? 'bg-teal-600 text-white shadow-lg' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          Create New Parent
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'link' ? 'bg-teal-600 text-white shadow-lg' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          Link Existing Parent
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8 max-w-4xl">
          <div className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
              <UserCircle className="text-teal-600 w-6 h-6" /> Parent Details
            </h3>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">First Name</label>
                <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Last Name</label>
                <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email Address</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="e.g. parent@email.com" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Phone (optional)</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all placeholder:text-on-surface-variant/40" placeholder="+237 6XX XXX XXX" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Preferred Language</label>
                <select name="default_language" value={formData.default_language} onChange={handleChange} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all">
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Relationship to Selected Students</label>
                <select value={relationshipType} onChange={e => setRelationshipType(e.target.value)} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all">
                  {RELATIONSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-outline-variant/10 pb-4">
              <Users className="text-teal-600 w-6 h-6" /> Link Students (optional, this school only)
            </h3>
            {students.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No students yet in this school. Register students first, then come back to link them.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-2">
                {students.map((s: any) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    className={`text-left p-4 rounded-xl border text-sm font-bold transition-all ${selectedStudentIds.includes(s.id) ? 'bg-teal-600/10 border-teal-600 text-teal-800' : 'bg-surface-container-high border-transparent text-on-surface hover:border-teal-600/40'}`}
                  >
                    {s.full_name || `${s.first_name} ${s.last_name}`}
                    <span className="block text-[10px] font-semibold text-on-surface-variant mt-1">{s.class_display || 'Unassigned'} · {s.admission_number || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6">
            <button disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.email} type="submit" className="flex items-center gap-3 px-8 py-4 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-teal-600/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <CheckCircle className="w-5 h-5" />}
              {isSubmitting ? 'Creating Parent...' : 'Create Parent Account'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8 max-w-4xl">
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 pb-2">
              <Search className="text-teal-600 w-6 h-6" /> Find an Existing Parent
            </h3>
            <p className="text-sm text-on-surface-variant">Search by email or name across all schools. The parent does not need any account at this school.</p>
            <div className="flex gap-3 pt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                placeholder="e.g. parent@email.com or a name"
                className="flex-1 bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all"
              />
              <button type="button" onClick={handleSearch} className="px-6 py-3 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 active:scale-95 transition-all flex items-center gap-2">
                <Search className="w-4 h-4" /> Search
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((p: any) => (
                <div key={p.id} className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${selectedParent?.id === p.id ? 'border-teal-600 bg-teal-600/10' : 'border-outline-variant/15 bg-surface-container-high'}`}>
                  <div>
                    <p className="text-sm font-black text-on-surface">{p.full_name}</p>
                    <p className="text-xs text-on-surface-variant font-semibold">{p.email} {p.phone ? `· ${p.phone}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-lowest px-3 py-1.5 rounded-lg">{p.linked_students} linked student(s)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedParent(selectedParent?.id === p.id ? null : p)}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedParent?.id === p.id ? 'bg-teal-600 text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest'}`}
                    >
                      {selectedParent?.id === p.id ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchQuery && !isSubmitting && searchResults.length === 0 && (
            <p className="text-sm text-on-surface-variant">No parents found. Try the <button type="button" className="text-teal-600 font-bold underline" onClick={() => setMode('create')}>Create New Parent</button> tab instead.</p>
          )}

          {selectedParent && (
            <form onSubmit={handleLink} className="border-t border-outline-variant/15 pt-8 space-y-6">
              <h3 className="text-lg font-black flex items-center gap-2 text-on-surface">
                <Link2 className="w-5 h-5 text-teal-600" /> Link {selectedParent.full_name} to a Student
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Student</label>
                  <select required value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all">
                    <option value="">Select a student...</option>
                    {students.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.full_name || `${s.first_name} ${s.last_name}`} — {s.class_display || 'Unassigned'}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Relationship</label>
                  <select value={linkRelationship} onChange={e => setLinkRelationship(e.target.value)} className="w-full bg-surface-container-highest border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-xl px-4 py-3 text-sm font-bold shadow-inner transition-all">
                    {RELATIONSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button disabled={isSubmitting || !linkStudentId} type="submit" className="flex items-center gap-3 px-8 py-4 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-teal-600/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Link2 className="w-5 h-5" /> Link Parent to Student
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
