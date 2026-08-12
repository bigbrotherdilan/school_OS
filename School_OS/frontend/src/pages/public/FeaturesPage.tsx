import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';

const problems = [
  { icon: 'schedule', title: '21 Days Lost Every Year', desc: '10 hours a week on paperwork. Attendance by hand. Report cards at midnight. That is 21 full days gone. Every year.' },
  { icon: 'supervisor_account', title: 'Parents Left in the Dark', desc: '3 in 10 parents never see their child\'s report card on time. They drive to the school, wait in line, and get told "come back tomorrow."' },
  { icon: 'money_off', title: 'Cash Envelopes, No Records', desc: 'Fees collected in cash. No receipts. No tracking. You have no idea who paid, who did not, or where the money went.' },
  { icon: 'folder_off', title: 'Records That Vanish', desc: 'A student transfers. Their records? Lost. A parent asks for last year\'s grades? Check the notebook. If you can find it.' },
];

const comparison = [
  { feature: 'Attendance', notebook: 'Paper roll call, 15 min per class', schoolOs: 'Digital, 30 seconds' },
  { feature: 'Report Cards', notebook: 'Handwritten, 2 weeks per term', schoolOs: 'One-click, 30 minutes for whole school' },
  { feature: 'Fee Tracking', notebook: 'Cash envelopes, no records', schoolOs: 'Mobile Money, real-time dashboard' },
  { feature: 'Parent Updates', notebook: 'Notice board (if they read it)', schoolOs: 'WhatsApp, instant' },
  { feature: 'Student Records', notebook: 'Notebooks in a drawer', schoolOs: 'Secure, searchable, always available' },
];

const features = [
  { icon: 'groups', title: 'Student Management', desc: 'Every student\'s enrollment, grades, attendance, medical info, and guardian details -- in one place. No more digging through notebooks.', highlight: true },
  { icon: 'how_to_reg', title: 'Digital Attendance', desc: 'Mark attendance in 30 seconds. Parents get notified automatically. No more paper roll calls eating into your teaching time.' },
  { icon: 'payments', title: 'Fee Collection', desc: 'Automated fee bills via Mobile Money. Real-time arrears tracking. Parents pay on time. You stop chasing.' },
  { icon: 'analytics', title: 'Report Cards', desc: 'Generate every report card for the entire school in one click. Beautiful PDFs parents actually want to keep. What used to take 2 weeks takes 30 minutes.' },
  { icon: 'calendar_month', title: 'Timetabling', desc: 'Build clash-free timetables in minutes. No more "Sir, there is a room conflict" on Monday morning.' },
  { icon: 'notifications_active', title: 'Parent Communication', desc: 'Announcements, fee reminders, event notifications -- delivered via WhatsApp and SMS. Parents stop calling the office. You stop repeating yourself.' },
];

const faqs = [
  {
    q: 'What is School OS?',
    a: 'School OS replaces every notebook, spreadsheet, and paper system in your school with one platform. Student records, attendance, fees, report cards, timetables, parent communication -- all from a single dashboard. No more scattered data. No more midnight paperwork.',
  },
  {
    q: 'Is it really free to start?',
    a: 'Yes. 14-day free trial, no credit card. After that, plans start low enough that even the smallest private school can afford it. Because every school deserves to escape the notebook era.',
  },
  {
    q: 'Does it work for schools in Cameroon?',
    a: 'Built specifically for Cameroon. FCFA currency. English and French. GCE and BAC grading systems. Mobile Money payments via MTN and Orange. We didn\'t adapt a Western tool -- we built this from scratch for African schools.',
  },
  {
    q: 'How fast can I set up?',
    a: 'Under 5 minutes for the basics. Add your school, create one class, add a few students, generate your first report card. Most schools are fully running within 24 hours. No IT person needed.',
  },
  {
    q: 'What if I\'m not good with computers?',
    a: 'You don\'t need to be. If you can send a WhatsApp message, you can use School OS. We built it for school administrators, not software engineers. Every step is guided. Every action gives you feedback. You\'ll feel confident on day one.',
  },
  {
    q: 'Can parents see their child\'s results?',
    a: 'Yes. Parents get a portal where they see attendance, grades, report cards, and fee status -- in real time. No more driving to the school to ask "when are results ready?"',
  },
  {
    q: 'Is my data secure?',
    a: 'Enterprise-grade encryption. Automated backups. Role-based access. Your data lives on secure cloud servers, not in a notebook that can get wet, lost, or stolen.',
  },
];

export default function FeaturesPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      <PublicNavbar />

      {/* Hero */}
      <header className="relative pt-32 pb-20 md:pt-44 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-container/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full mb-6">
            <span className="material-symbols-outlined text-primary text-sm">dashboard</span>
            <span className="text-xs font-bold tracking-widest text-primary uppercase">The Escape Plan</span>
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-primary tracking-tighter mb-6 leading-[1.05]">
            Everything Your School Needs
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-on-surface-variant mb-10 leading-relaxed">
            One platform. Every system. No notebooks. No spreadsheets. No midnight grading.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-95 text-center"
            >
              Start Free -- No Credit Card
            </Link>
            <a
              href="#the-cost"
              className="w-full sm:w-auto px-8 py-4 bg-white text-primary rounded-xl font-bold text-lg border border-outline-variant hover:bg-surface-container-low transition-all text-center"
            >
              See What You're Escaping From
            </a>
          </div>
        </div>
      </header>

      {/* The Enemy -- What The Notebook Costs You */}
      <section id="the-cost" aria-labelledby="problems-heading" className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-error font-bold tracking-widest text-xs uppercase">The Enemy</span>
            <h2 id="problems-heading" className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">
              What The Notebook Costs You
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-xl mx-auto">
              Every day your school runs on paper, you're paying for it -- in time, money, and trust.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {problems.map((item, i) => (
              <article key={i} className="p-8 bg-surface-container-lowest rounded-2xl shadow-sm border-l-4 border-error group hover:shadow-md transition-shadow">
                <span className="material-symbols-outlined text-error text-4xl mb-4 group-hover:scale-110 transition-transform inline-block">{item.icon}</span>
                <h3 className="text-xl font-bold text-primary mb-2">{item.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pick a Side */}
      <section aria-labelledby="pick-side-heading" className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">Choose Your Side</span>
            <h2 id="pick-side-heading" className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">
              The Notebook vs. School OS
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-xl mx-auto">
              Every school uses one of these. The question is: which one are you still using?
            </p>
          </div>

          <div className="hidden md:block bg-white rounded-3xl border border-outline-variant/20 shadow-lg overflow-hidden">
            <div className="grid grid-cols-3 border-b border-outline-variant/20">
              <div className="p-5" />
              <div className="p-5 text-center bg-error/5 border-x border-outline-variant/20">
                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-error">note</span>
                  <span className="font-bold text-error text-lg">The Notebook</span>
                </div>
              </div>
              <div className="p-5 text-center bg-primary/5">
                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-primary">school</span>
                  <span className="font-bold text-primary text-lg">School OS</span>
                </div>
              </div>
            </div>
            {comparison.map((row, i) => (
              <div key={i} className={`grid grid-cols-3 ${i < comparison.length - 1 ? 'border-b border-outline-variant/10' : ''}`}>
                <div className="p-5 flex items-center">
                  <span className="font-semibold text-on-surface">{row.feature}</span>
                </div>
                <div className="p-5 text-center bg-error/5 border-x border-outline-variant/20 flex items-center justify-center">
                  <span className="text-sm text-on-surface-variant">{row.notebook}</span>
                </div>
                <div className="p-5 text-center bg-primary/5 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{row.schoolOs}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="md:hidden space-y-4">
            {comparison.map((row, i) => (
              <div key={i} className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-primary/5 border-b border-outline-variant/10">
                  <span className="font-bold text-primary text-sm">{row.feature}</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-error text-lg shrink-0 mt-0.5">note</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-error/70 block mb-0.5">The Notebook</span>
                      <span className="text-sm text-on-surface-variant">{row.notebook}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">school</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70 block mb-0.5">School OS</span>
                      <span className="text-sm font-medium text-primary">{row.schoolOs}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/login"
              className="inline-block px-10 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Choose Your Side -- Start Free
            </Link>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section aria-labelledby="features-heading" className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-xl">
              <span className="text-secondary font-bold tracking-widest text-xs uppercase">The Escape Plan</span>
              <h2 id="features-heading" className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">
                Everything Your School Needs
              </h2>
              <p className="text-on-surface-variant text-lg mt-4">
                One platform. Every system. No notebooks. No spreadsheets. No midnight grading.
              </p>
            </div>
            <Link to="/schools" className="text-primary font-bold flex items-center gap-2 hover:gap-4 transition-all">
              Explore Schools <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <article className="md:col-span-2 bg-primary p-10 rounded-3xl text-white relative overflow-hidden flex flex-col justify-between min-h-[340px]">
              <div className="relative z-10">
                <span className="material-symbols-outlined text-5xl mb-4">{features[0].icon}</span>
                <h3 className="text-3xl font-bold mb-3">{features[0].title}</h3>
                <p className="opacity-80 text-base max-w-md leading-relaxed">{features[0].desc}</p>
              </div>
              <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
              <Link to="/find-teachers" className="relative z-10 self-start text-white flex items-center gap-2 mt-6 hover:gap-4 transition-all font-semibold">
                Explore Marketplace <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </article>

            <div className="flex flex-col gap-4 md:gap-6">
              {features.slice(1, 3).map((f, i) => (
                <article key={i} className="bg-surface-container-high p-8 rounded-3xl flex-1 flex flex-col justify-between group hover:bg-primary hover:text-white transition-colors duration-300">
                  <div>
                    <span className="material-symbols-outlined text-3xl mb-3 text-primary group-hover:text-white transition-colors">{f.icon}</span>
                    <h3 className="text-xl font-bold mb-2 text-primary group-hover:text-white transition-colors">{f.title}</h3>
                    <p className="text-sm text-on-surface-variant group-hover:text-white/80 transition-colors">{f.desc}</p>
                  </div>
                </article>
              ))}
            </div>

            {features.slice(3).map((f, i) => (
              <article key={i} className="bg-surface-container-high p-8 rounded-3xl group hover:bg-primary hover:text-white transition-colors duration-300">
                <span className="material-symbols-outlined text-3xl mb-3 text-primary group-hover:text-white transition-colors">{f.icon}</span>
                <h3 className="text-xl font-bold mb-2 text-primary group-hover:text-white transition-colors">{f.title}</h3>
                <p className="text-sm text-on-surface-variant group-hover:text-white/80 transition-colors">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section aria-labelledby="how-it-works-heading" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">5 Minutes. That's It.</span>
            <h2 id="how-it-works-heading" className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">
              Escape the Notebook in 3 Steps
            </h2>
            <p className="text-on-surface-variant mt-4 max-w-xl mx-auto">
              No IT department. No training manual. If you can send a WhatsApp, you can do this.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: 'person_add', title: 'Add Your School', desc: 'Type your school name. Upload a logo if you want. Takes 60 seconds. Done.' },
              { step: '02', icon: 'group_add', title: 'Add Students & Classes', desc: 'One class, a few students. Or import your whole school from Excel. Your choice.' },
              { step: '03', icon: 'rocket_launch', title: 'Generate Your First Report Card', desc: 'Click one button. Watch a beautiful PDF appear. That\'s the moment you never go back to the notebook.' },
            ].map((item, i) => (
              <article key={i} className="relative text-center p-8">
                <div className="text-6xl font-extrabold text-primary/10 mb-4">{item.step}</div>
                <span className="material-symbols-outlined text-primary text-5xl mb-4 inline-block">{item.icon}</span>
                <h3 className="text-xl font-bold text-primary mb-3">{item.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{item.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-outline-variant" />
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="py-24 bg-surface-container-low">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">Still Thinking?</span>
            <h2 id="faq-heading" className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-2">
              Questions We Get a Lot
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <article key={i} className="bg-white rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-container-low transition-colors"
                  aria-expanded={openFaq === i}
                >
                  <h3 className="text-lg font-bold text-primary pr-4">{faq.q}</h3>
                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="text-on-surface-variant leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </article>
            ))}
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
              The Notebook Era Is Over
            </h2>
            <p className="text-lg opacity-80 mb-10 max-w-xl mx-auto relative z-10">
              500+ schools already made the switch. They stopped losing records, stopped grading at midnight, and stopped guessing who paid. Your turn.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10">
              <Link
                to="/login"
                className="w-full sm:w-auto px-10 py-4 bg-white text-primary font-bold rounded-xl hover:bg-surface-container-low transition-colors shadow-lg text-center"
              >
                Start Free -- No Credit Card
              </Link>
              <Link
                to="/schools"
                className="w-full sm:w-auto px-10 py-4 bg-secondary text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-center"
              >
                Explore Schools
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
