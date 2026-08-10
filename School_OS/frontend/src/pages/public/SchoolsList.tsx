import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';
import { fetchSchools, fetchRegions, type PublicSchool, type RegionCount } from '../../services/publicApi';

export default function SchoolsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [search, setSearch] = useState(initialQuery);
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [schools, setSchools] = useState<PublicSchool[]>([]);
  const [regions, setRegions] = useState<RegionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const qParam = searchParams.get('q') || '';
  useEffect(() => {
    setSearch(qParam);
  }, [qParam]);

  useEffect(() => {
    fetchRegions().then(setRegions).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params: { q?: string; region?: string; education_type?: string } = {};
    if (search.trim()) params.q = search.trim();
    if (regionFilter) params.region = regionFilter;
    if (typeFilter) params.education_type = typeFilter;

    fetchSchools(params)
      .then((data) => {
        setSchools(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load schools. Make sure the backend server is running.');
        setLoading(false);
      });
  }, [search, regionFilter, typeFilter]);

  const exactMatch = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return schools.filter((s) => s.school_name.toLowerCase().includes(q));
  }, [search, schools]);

  const closeMatch = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return schools.filter(
      (s) =>
        !s.school_name.toLowerCase().includes(q) &&
        (s.region.toLowerCase().includes(q) || s.division?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q))
    );
  }, [search, schools]);

  const otherSchools = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        !s.school_name.toLowerCase().includes(q) &&
        !s.region.toLowerCase().includes(q) &&
        !s.division?.toLowerCase().includes(q) &&
        !s.address?.toLowerCase().includes(q)
    );
  }, [search, schools]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    setSearchParams(params);
  };

  const SchoolCard = ({ school }: { school: PublicSchool }) => (
    <Link
      to={`/schools/${school.slug}`}
      className="block bg-white rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-primary-container rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
            {school.logo_url ? (
              <img src={school.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white text-2xl">school</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-primary truncate group-hover:text-primary-container transition-colors">{school.school_name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0 bg-secondary-container/30 text-on-secondary-container">
                {school.education_type_display}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant mb-2">
              <span className="material-symbols-outlined text-sm">location_on</span>
              {school.region}{school.division ? `, ${school.division}` : ''}
            </div>
            {school.motto && (
              <p className="text-xs text-on-surface-variant/70 italic">"{school.motto}"</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-outline-variant/10">
          {school.student_count != null && (
            <div className="text-center">
              <div className="text-sm font-bold text-primary">{school.student_count.toLocaleString()}</div>
              <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Students</div>
            </div>
          )}
          {school.class_count != null && (
            <div className="text-center">
              <div className="text-sm font-bold text-primary">{school.class_count}</div>
              <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Classes</div>
            </div>
          )}
          <div className="ml-auto">
            <span className="material-symbols-outlined text-primary/40 group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
          </div>
        </div>
      </div>
    </Link>
  );

  const SectionHeader = ({ title, count, icon }: { title: string; count: number; icon: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
      <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-bold">{count}</span>
    </div>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <PublicNavbar />

      <section className="pt-24 pb-8 bg-gradient-to-b from-primary-container/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight mb-4">Find Your School</h1>
          <p className="text-on-surface-variant text-lg mb-8">Browse schools on School OS. View profiles, fees, programs, and enroll online.</p>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by school name, city, or region..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-outline-variant/30 bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-4 py-3.5 rounded-xl border border-outline-variant/30 bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            >
              <option value="">All Regions</option>
              {regions.map((r) => (
                <option key={r.name} value={r.name}>{r.name} ({r.count})</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3.5 rounded-xl border border-outline-variant/30 bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            >
              <option value="">All Types</option>
              <option value="anglophone">Anglophone</option>
              <option value="francophone">Francophone</option>
              <option value="bilingual">Bilingual</option>
            </select>
          </form>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
              <p className="text-on-surface-variant">Loading schools...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-error/40 text-7xl mb-4 block">cloud_off</span>
              <h2 className="text-2xl font-bold text-primary mb-2">Unable to Load Schools</h2>
              <p className="text-on-surface-variant">{error}</p>
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-on-surface-variant/30 text-7xl mb-4 block">school</span>
              <h2 className="text-2xl font-bold text-primary mb-2">No Schools Yet</h2>
              <p className="text-on-surface-variant">No schools have been registered on School OS yet. Schools will appear here once they sign up.</p>
            </div>
          ) : (
            <>
              {exactMatch.length > 0 && (
                <div className="mb-12">
                  <SectionHeader title="Exact Match" count={exactMatch.length} icon="match_word" />
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exactMatch.map((s) => <SchoolCard key={s.slug} school={s} />)}
                  </div>
                </div>
              )}

              {closeMatch.length > 0 && (
                <div className="mb-12">
                  <SectionHeader title="In This Area" count={closeMatch.length} icon="near_me" />
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {closeMatch.map((s) => <SchoolCard key={s.slug} school={s} />)}
                  </div>
                </div>
              )}

              {otherSchools.length > 0 && (
                <div className="mb-12">
                  <SectionHeader
                    title={search.trim() ? 'Other Schools' : 'All Schools'}
                    count={otherSchools.length}
                    icon="school"
                  />
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherSchools.map((s) => <SchoolCard key={s.slug} school={s} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
