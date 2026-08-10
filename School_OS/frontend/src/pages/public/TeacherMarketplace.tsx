import { useState, useEffect, useCallback } from 'react';
import { Search, Star, MapPin, BookOpen, Award, Clock, Filter, ChevronDown, GraduationCap, Languages, Loader2 } from 'lucide-react';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';
import { fetchPublicTeachers, type PublicTeacher } from '../../services/publicApi';

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  available: 'Available for Hire',
};

const DEPARTMENTS = ['', 'Science', 'Mathematics', 'Arts', 'Languages', 'Physical Education', 'Technology'];

export default function TeacherMarketplace() {
  const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [region, setRegion] = useState('');
  const [availability, setAvailability] = useState('');
  const [minRating, setMinRating] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<PublicTeacher | null>(null);
  const [regions, setRegions] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    fetchPublicTeachers().then((all) => {
      const counts = new Map<string, number>();
      for (const t of all) {
        const name = t.school?.region;
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
      setRegions([...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  const fetchTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      const teachers = await fetchPublicTeachers({
        q: search || undefined,
        subject: subject || undefined,
        region: region || undefined,
        availability: availability || undefined,
        min_rating: minRating || undefined,
      });
      setTeachers(teachers);
    } catch (err) {
      console.error('Failed to fetch teachers:', err);
      setTeachers([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, subject, region, availability, minRating]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTeachers();
  };

  return (
    <div className="min-h-screen bg-surface">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 block mb-4">National Teacher Marketplace</span>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-4">Find Great Teachers</h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 font-medium">
            Discover qualified educators across Cameroon. Search by subject, region, rating, and availability.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, subject, or school..."
                className="w-full pl-14 pr-6 py-5 bg-white rounded-2xl text-sm font-bold shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary/30"
              />
            </div>
            <button type="submit" className="px-8 py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all">
              Search
            </button>
          </form>

          <button onClick={() => setShowFilters(!showFilters)} className="mt-6 flex items-center gap-2 mx-auto text-white/50 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            <Filter className="w-4 h-4" /> Advanced Filters <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </section>

      {/* Filters */}
      {showFilters && (
        <section className="bg-white border-b border-outline-variant/10 py-8 px-4 animate-in fade-in duration-300">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                <option value="">All Subjects</option>
                {DEPARTMENTS.filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Region</label>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r.name} value={r.name}>{r.name} ({r.count})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Availability</label>
              <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                <option value="">Any</option>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="available">Available for Hire</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Rating</label>
              <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="w-full bg-surface-container-high border border-outline-variant/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      <section className="max-w-6xl mx-auto py-16 px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-on-surface">{teachers.length} Teacher{teachers.length !== 1 ? 's' : ''} Found</h2>
        </div>

        {isLoading ? (
          <div className="py-32 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/40">Searching...</p>
          </div>
        ) : teachers.length === 0 ? (
          <div className="py-32 text-center space-y-4">
            <GraduationCap className="w-16 h-16 mx-auto text-on-surface-variant/20" />
            <h3 className="text-xl font-bold text-on-surface/60">No teachers found</h3>
            <p className="text-sm text-on-surface-variant">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                onClick={() => setSelectedTeacher(teacher)}
                className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden cursor-pointer group hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
              >
                <div className="p-8">
                  <div className="flex items-start gap-5 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500">
                      {teacher.profile_photo ? (
                        <img src={teacher.profile_photo} alt="" className="w-full h-full rounded-2xl object-cover" />
                      ) : (
                        teacher.first_name?.[0] || 'T'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-on-surface group-hover:text-primary transition-colors truncate">{teacher.name}</h3>
                      <p className="text-xs text-on-surface-variant font-medium truncate">{teacher.qualification || 'Educator'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold">{teacher.average_rating > 0 ? teacher.average_rating.toFixed(1) : 'New'}</span>
                        {teacher.total_reviews > 0 && <span className="text-[10px] text-on-surface-variant">({teacher.total_reviews} reviews)</span>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <MapPin className="w-3 h-3" />
                      <span className="font-medium">{teacher.school?.name} — {teacher.school?.region}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <BookOpen className="w-3 h-3" />
                      <span className="font-medium">{teacher.subjects_taught?.join(', ') || teacher.department || 'General'}</span>
                    </div>
                    {teacher.years_of_experience && (
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{teacher.years_of_experience} years experience</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      teacher.availability === 'available' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                      'bg-surface-container-high text-on-surface-variant border-outline-variant/10'
                    }`}>
                      {AVAILABILITY_LABELS[teacher.availability] || teacher.availability}
                    </span>
                    {teacher.languages_spoken?.map((lang) => (
                      <span key={lang} className="px-3 py-1 bg-primary/5 text-primary rounded-full text-[9px] font-black uppercase tracking-widest border border-primary/10 flex items-center gap-1">
                        <Languages className="w-2.5 h-2.5" /> {lang}
                      </span>
                    ))}
                  </div>

                  {teacher.specializations && teacher.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {teacher.specializations.slice(0, 3).map((s) => (
                        <span key={s} className="px-2.5 py-1 bg-surface-container rounded-lg text-[10px] font-bold text-on-surface-variant">{s}</span>
                      ))}
                      {teacher.specializations.length > 3 && (
                        <span className="px-2.5 py-1 bg-surface-container rounded-lg text-[10px] font-bold text-on-surface-variant">+{teacher.specializations.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {teacher.hourly_rate && (
                  <div className="px-8 py-4 bg-surface-container-low/50 border-t border-outline-variant/5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">Hourly Rate</span>
                    <span className="text-sm font-black text-primary">{Number(teacher.hourly_rate).toLocaleString()} XAF</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detail Modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTeacher(null)}>
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl border border-outline-variant/10 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-10 bg-gradient-to-br from-slate-900 to-primary/90 text-white">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black text-3xl">
                  {selectedTeacher.first_name?.[0] || 'T'}
                </div>
                <div>
                  <h2 className="text-2xl font-black">{selectedTeacher.name}</h2>
                  <p className="text-white/60 text-sm font-medium">{selectedTeacher.qualification}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold">{selectedTeacher.average_rating > 0 ? selectedTeacher.average_rating.toFixed(1) : 'New'}</span>
                    </div>
                    <span className="text-white/30">|</span>
                    <span className="text-sm text-white/60">{selectedTeacher.school?.name}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-10 overflow-y-auto space-y-8">
              {selectedTeacher.teaching_philosophy && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Teaching Philosophy</h4>
                  <p className="text-sm text-on-surface leading-relaxed">{selectedTeacher.teaching_philosophy}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3">Subjects</h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTeacher.subjects_taught || []).map(s => (
                      <span key={s} className="px-3 py-1.5 bg-primary/5 text-primary rounded-xl text-xs font-bold border border-primary/10">{s}</span>
                    ))}
                    {(!selectedTeacher.subjects_taught || selectedTeacher.subjects_taught.length === 0) && (
                      <span className="text-xs text-on-surface-variant italic">{selectedTeacher.department || 'General'}</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3">Languages</h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTeacher.languages_spoken || []).map(l => (
                      <span key={l} className="px-3 py-1.5 bg-surface-container rounded-xl text-xs font-bold">{l}</span>
                    ))}
                    {(!selectedTeacher.languages_spoken || selectedTeacher.languages_spoken.length === 0) && (
                      <span className="text-xs text-on-surface-variant italic">Not specified</span>
                    )}
                  </div>
                </div>
              </div>

              {selectedTeacher.certifications && selectedTeacher.certifications.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
                    <Award className="w-3 h-3" /> Certifications
                  </h4>
                  <ul className="space-y-2">
                    {selectedTeacher.certifications.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-on-surface">
                        <CheckCircle className="w-3 h-3 text-secondary shrink-0" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTeacher.achievements && selectedTeacher.achievements.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3">Achievements</h4>
                  <ul className="space-y-2">
                    {selectedTeacher.achievements.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-on-surface">
                        <Award className="w-3 h-3 text-amber-500 shrink-0" /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between p-6 bg-surface-container-low rounded-2xl">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Availability</p>
                  <p className="text-sm font-bold">{AVAILABILITY_LABELS[selectedTeacher.availability] || selectedTeacher.availability}</p>
                </div>
                {selectedTeacher.hourly_rate && (
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Hourly Rate</p>
                    <p className="text-lg font-black text-primary">{Number(selectedTeacher.hourly_rate).toLocaleString()} XAF</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-outline-variant/10 flex justify-end">
              <button onClick={() => setSelectedTeacher(null)} className="px-8 py-3 bg-surface-container-high text-on-surface rounded-xl font-black text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}

function CheckCircle({ className = '' }: { className?: string }) {
  return <span className={`material-symbols-outlined text-secondary text-sm ${className}`}>check_circle</span>;
}
