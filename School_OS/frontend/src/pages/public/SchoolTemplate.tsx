import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';

const school = {
  name: 'Saint Joseph Academy',
  location: 'Buea, South West Region',
  type: 'Private',
  level: 'Primary & Secondary',
  established: '1994',
  motto: 'Excellence Through Discipline',
  description:
    'Saint Joseph Academy is a leading co-educational institution in Buea, offering a world-class curriculum from early years through A-Levels. With a focus on academic rigor, moral values, and holistic development, we have produced top performers in GCE O/L and A/L examinations for over three decades.',
  stats: [
    { label: 'Students', value: '1,200+' },
    { label: 'Teachers', value: '65' },
    { label: 'Programs', value: '12' },
    { label: 'Pass Rate', value: '94%' },
  ],
  programs: [
    { icon: 'child_care', title: 'Early Years', desc: 'Nursery & Kindergarten (Ages 3-6). Play-based learning with foundational literacy and numeracy.' },
    { icon: 'menu_book', title: 'Primary School', desc: 'Classes 1-6. Strong foundation in English, French, Mathematics, and General Knowledge.' },
    { icon: 'science', title: 'Secondary School', desc: 'Forms 1-5. GCE O/L preparation with science, arts, and commercial tracks.' },
    { icon: 'school', title: 'A-Levels', desc: 'Lower & Upper Sixth. University preparation with specialized subject combinations.' },
  ],
  fees: [
    { level: 'Nursery', amount: '75,000 FCFA / term' },
    { level: 'Primary', amount: '95,000 FCFA / term' },
    { level: 'Secondary', amount: '120,000 FCFA / term' },
    { level: 'A-Levels', amount: '150,000 FCFA / term' },
  ],
  contact: {
    phone: '+237 677 000 000',
    email: 'info@saintjosephacademy.cm',
    address: 'Molyko, Buea, South West Region',
    hours: 'Mon - Fri, 7:00 AM - 4:00 PM',
  },
};

export default function SchoolTemplate() {
  return (
    <div className="bg-surface text-on-surface font-body selection:bg-secondary-container selection:text-on-secondary-container">
      <PublicNavbar />

      {/* School Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-b from-primary-container/5 to-transparent" id="home">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-primary rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <span className="material-symbols-outlined text-white text-4xl md:text-5xl">school</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight">{school.name}</h1>
                <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-wider uppercase">
                  {school.type}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  {school.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  Est. {school.established}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">category</span>
                  {school.level}
                </span>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link
                to="/login"
                className="bg-gradient-to-br from-primary to-primary-container text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Student Portal
              </Link>
              <button className="bg-secondary text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all">
                Enquire Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {school.stats.map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 text-center border border-outline-variant/10 shadow-sm">
                <div className="text-2xl font-extrabold text-primary">{stat.value}</div>
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16" id="about">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-outline-variant/10 shadow-sm">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">About the School</span>
            <h2 className="text-3xl font-bold text-primary mt-2 mb-6">{school.motto}</h2>
            <p className="text-on-surface-variant leading-relaxed text-lg max-w-4xl">{school.description}</p>
          </div>
        </div>
      </section>

      {/* Academic Programs */}
      <section className="py-16 bg-surface-container-low" id="academics">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">What We Offer</span>
            <h2 className="text-3xl font-bold text-primary mt-2">Academic Programs</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {school.programs.map((prog, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-primary-container rounded-2xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-2xl">{prog.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-primary mb-2">{prog.title}</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">{prog.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fee Structure */}
      <section className="py-16" id="fees">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <span className="text-secondary font-bold tracking-widest text-xs uppercase">Investment</span>
            <h2 className="text-3xl font-bold text-primary mt-2">Fee Structure</h2>
            <p className="text-on-surface-variant mt-2">Tuition fees per term for the current academic year.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {school.fees.map((fee, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-outline-variant/10 shadow-sm text-center">
                <div className="text-sm font-semibold text-on-surface-variant uppercase tracking-widest mb-2">{fee.level}</div>
                <div className="text-xl font-extrabold text-primary">{fee.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact & Inquiry */}
      <section className="py-16 bg-surface-container-low" id="contact">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-10">
            {/* Contact Info */}
            <div>
              <span className="text-secondary font-bold tracking-widest text-xs uppercase">Get in Touch</span>
              <h2 className="text-3xl font-bold text-primary mt-2 mb-8">Contact Information</h2>
              <div className="space-y-5">
                {[
                  { icon: 'call', label: 'Phone', value: school.contact.phone },
                  { icon: 'mail', label: 'Email', value: school.contact.email },
                  { icon: 'location_on', label: 'Address', value: school.contact.address },
                  { icon: 'schedule', label: 'Office Hours', value: school.contact.hours },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-white text-lg">{item.icon}</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{item.label}</div>
                      <div className="text-on-surface font-medium">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inquiry Form */}
            <div className="bg-white rounded-3xl p-8 border border-outline-variant/10 shadow-sm">
              <h3 className="text-xl font-bold text-primary mb-6">Send an Inquiry</h3>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">First Name</label>
                    <input
                      type="text"
                      placeholder="John"
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Last Name</label>
                    <input
                      type="text"
                      placeholder="Doe"
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Phone</label>
                  <input
                    type="tel"
                    placeholder="+237 6XX XXX XXX"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">I'm interested in</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                    <option>Admissions</option>
                    <option>Fee Information</option>
                    <option>Academic Programs</option>
                    <option>School Visit</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Message</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us what you'd like to know..."
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-3.5 rounded-xl font-bold hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  Send Inquiry
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
