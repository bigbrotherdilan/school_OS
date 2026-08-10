import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';

const stats = [
  { value: '500+', label: 'Schools' },
  { value: '12K+', label: 'Educators' },
  { value: '80K+', label: 'Students' },
  { value: '21', label: 'Days Saved / Year' },
];

const highlights = [
  { icon: 'groups', title: 'Student Management', desc: 'Enrollment, grades, attendance, medical info and guardian details in one place.' },
  { icon: 'payments', title: 'Fee Collection', desc: 'Automated fee bills via Mobile Money with real-time arrears tracking.' },
  { icon: 'analytics', title: 'Report Cards', desc: 'Every report card for the whole school in one click. Beautiful PDFs in minutes.' },
];

export default function LandingPage() {
  const [schoolSearch, setSchoolSearch] = useState('');
  const navigate = useNavigate();

  const handleSchoolSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(schoolSearch.trim() ? `/schools?q=${encodeURIComponent(schoolSearch.trim())}` : '/schools');
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      <PublicNavbar />

      {/* Hero */}
      <header className="relative pt-32 pb-16 md:pt-48 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-container/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-primary uppercase">The Operating System for Schools</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-primary tracking-tighter mb-6 leading-[1.05]">
            Run Your School Like a<br className="hidden sm:block" /> Modern Organization
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-on-surface-variant mb-10 leading-relaxed">
            School OS brings student records, attendance, fees, report cards, timetables, and parent
            communication into one secure platform -- so nothing falls through the cracks.
          </p>

          {/* Centered login CTA -- visible on mobile without opening the menu */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-14">
            <Link
              to="/login"
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-95 text-center"
            >
              Login to Your School
            </Link>
            <Link
              to="/schools"
              className="w-full sm:w-auto px-10 py-4 bg-white text-primary rounded-xl font-bold text-lg border border-outline-variant hover:bg-surface-container-low transition-all text-center"
            >
              Explore Schools
            </Link>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-16">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-outline-variant/20 shadow-sm">
                <div className="text-3xl font-extrabold text-primary">{stat.value}</div>
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Find your school -- compact search */}
          <form onSubmit={handleSchoolSearch} className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Find your school by name, city, or region..."
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-outline-variant/30 bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-base"
              />
            </div>
            <button
              type="submit"
              className="px-8 py-4 bg-secondary text-white rounded-xl font-bold text-base hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
            >
              Search Schools
            </button>
          </form>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="text-xs text-on-surface-variant">Popular:</span>
            {['Buea', 'Douala', 'Yaounde', 'Bamenda'].map((tag) => (
              <button
                key={tag}
                onClick={() => navigate(`/schools?q=${encodeURIComponent(tag)}`)}
                className="text-xs px-3 py-1 bg-white rounded-full text-primary font-semibold border border-outline-variant/30 hover:bg-primary hover:text-white transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Trusted by / social proof */}
      <section aria-labelledby="trusted-heading" className="py-14 border-y border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 id="trusted-heading" className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-8">
            Trusted by Schools Across Cameroon
          </h2>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50">
            {['Greenfield Academy', 'St. Mary\'s International', 'Bright Future Schools', 'Heritage Bilingual', 'Cameroon Bilingual'].map((name, i) => (
              <span key={i} className="text-lg md:text-xl font-bold text-primary whitespace-nowrap">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights -- teaser linking to the Features page */}
      <section aria-labelledby="highlights-heading" className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">Why Schools Switch</span>
            <h2 id="highlights-heading" className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">
              One Platform, Every School System
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-xl mx-auto">
              Stop juggling notebooks, spreadsheets, and cash envelopes. School OS runs it all.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {highlights.map((h, i) => (
              <article key={i} className="bg-white p-8 rounded-3xl border border-outline-variant/20 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                <span className="material-symbols-outlined text-primary text-4xl mb-4 inline-block bg-primary/10 p-3 rounded-2xl group-hover:scale-110 transition-transform">{h.icon}</span>
                <h3 className="text-xl font-bold text-primary mb-2">{h.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{h.desc}</p>
              </article>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/features" className="inline-flex items-center gap-2 text-primary font-bold hover:gap-4 transition-all">
              Explore all features <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-heading" className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-gradient-to-br from-primary to-primary-container rounded-[2rem] p-12 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold mb-6 relative z-10 tracking-tight">
              Ready to Make the Switch?
            </h2>
            <p className="text-lg opacity-80 mb-10 max-w-xl mx-auto relative z-10">
              500+ schools already made the jump. Set up yours in under 5 minutes -- free for 14 days, no credit card.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10">
              <Link
                to="/login"
                className="w-full sm:w-auto px-10 py-4 bg-white text-primary font-bold rounded-xl hover:bg-surface-container-low transition-colors shadow-lg text-center"
              >
                Login to Your School
              </Link>
              <Link
                to="/features"
                className="w-full sm:w-auto px-10 py-4 bg-secondary text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-center"
              >
                See the Features
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
