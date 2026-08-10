import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';

const values = [
  { icon: 'public', title: 'Built for African Schools', desc: 'FCFA currency, English and French, GCE and BAC grading, Mobile Money payments. We didn\'t adapt a Western tool -- we built School OS from scratch for schools here.' },
  { icon: 'accessibility_new', title: 'Any School Can Use It', desc: 'No IT department required. If a school administrator can send a WhatsApp message, they can run their whole school on School OS.' },
  { icon: 'verified_user', title: 'Security by Default', desc: 'Enterprise-grade encryption, automated backups, and role-based access. Your data lives on secure cloud servers, never in a notebook.' },
  { icon: 'volunteer_activism', title: 'Affordable for Every School', desc: 'A 14-day free trial and plans that start low enough that even the smallest private school can afford to escape the notebook era.' },
];

const milestones = [
  { year: 'The Problem', text: '80% of schools in Cameroon still run on paper. Records vanish. Fees go untracked. Report cards arrive weeks late. Parents are left in the dark.' },
  { year: 'The Insight', text: 'Teachers were burning out on paperwork and parents couldn\'t get results on time. That wasn\'t a market opportunity -- that was a crisis.' },
  { year: 'The Build', text: 'We built School OS from scratch: student records, attendance, fees, report cards, timetables, and parent communication in one platform.' },
  { year: 'The Mission', text: 'Every school, no matter how small, should run like a modern organization. That\'s the standard we hold ourselves to every day.' },
];

export default function AboutPage() {
  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      <PublicNavbar />

      {/* Hero */}
      <header className="relative pt-32 pb-20 md:pt-44 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-container/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full mb-6">
            <span className="material-symbols-outlined text-primary text-sm">flag</span>
            <span className="text-xs font-bold tracking-widest text-primary uppercase">Our Mission</span>
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-primary tracking-tighter mb-6 leading-[1.05]">
            Every School Deserves<br />a Modern Operating System
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-on-surface-variant leading-relaxed">
            School OS exists because we believe a child's records should never be lost to a rainy day,
            a parent should never be told to "come back tomorrow," and a teacher should never grade
            report cards at midnight.
          </p>
        </div>
      </header>

      {/* What is School OS */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">Who We Are</span>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">What is School OS?</h2>
          </div>
          <div className="bg-white rounded-3xl border border-outline-variant/20 shadow-lg p-10 md:p-14 text-on-surface-variant text-lg leading-relaxed space-y-6">
            <p>
              School OS is a school management platform built for African schools. It replaces every notebook,
              spreadsheet, and paper system in a school with one platform: student records, attendance, fee
              collection, report cards, timetables, and parent communication -- all from a single dashboard.
            </p>
            <p>
              Today, 80% of schools in Cameroon still run on paper. Teachers burn out on paperwork. Parents
              can't get their children's results on time. Fee money is collected in cash with no receipts.
              Student records disappear the moment a student transfers.
            </p>
            <p>
              We built School OS to fix that -- deliberately, from scratch, for the schools that need it most,
              not as a Western product bolted onto a new market.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">What We Stand For</span>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">Our Values</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v, i) => (
              <article key={i} className="p-8 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <span className="material-symbols-outlined text-primary text-4xl mb-4 inline-block bg-primary/10 p-3 rounded-2xl">{v.icon}</span>
                <h3 className="text-xl font-bold text-primary mb-2">{v.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{v.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">Our Story</span>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">The Road So Far</h2>
          </div>
          <div className="space-y-8">
            {milestones.map((m, i) => (
              <article key={i} className="flex flex-col md:flex-row gap-6 bg-white rounded-3xl border border-outline-variant/20 shadow-sm p-8">
                <div className="md:w-48 shrink-0">
                  <span className="text-sm font-black tracking-widest text-primary uppercase">{m.year}</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed">{m.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-gradient-to-br from-primary to-primary-container rounded-[2rem] p-12 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6 relative z-10 tracking-tight">
              Join the Schools That Escaped the Notebook
            </h2>
            <p className="text-lg opacity-80 mb-10 max-w-xl mx-auto relative z-10">
              500+ schools already made the switch. Your school is next.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10">
              <Link
                to="/login"
                className="w-full sm:w-auto px-10 py-4 bg-white text-primary font-bold rounded-xl hover:bg-surface-container-low transition-colors shadow-lg text-center"
              >
                Start Free -- No Credit Card
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
