import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';

const contactChannels = [
  { icon: 'mail', label: 'Email', value: 'hello@schoolos.sos', href: 'mailto:hello@schoolos.sos' },
  { icon: 'call', label: 'Phone / WhatsApp', value: '+237 6 00 00 00 00', href: 'tel:+237600000000' },
  { icon: 'schedule', label: 'Response Time', value: 'Within 24 hours, Mon - Fri' },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General inquiry', message: '' });
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus('error');
      return;
    }
    setStatus('success');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      <PublicNavbar />

      {/* Hero */}
      <header className="relative pt-32 pb-16 md:pt-44 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-container/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full mb-6">
            <span className="material-symbols-outlined text-primary text-sm">support_agent</span>
            <span className="text-xs font-bold tracking-widest text-primary uppercase">We're Here to Help</span>
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-primary tracking-tighter mb-6 leading-[1.05]">
            Talk to the School OS Team
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-on-surface-variant leading-relaxed">
            Questions about onboarding, fees, or features? We respond within 24 hours -- and we don't
            make you hunt for an answer.
          </p>
        </div>
      </header>

      {/* Contact channels + form */}
      <section className="py-16 pb-24">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-10">
          {/* Left: channels */}
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Get in touch</h2>
            <div className="space-y-4">
              {contactChannels.map((c, i) => (
                <div key={i} className="flex items-start gap-4 bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-3 rounded-xl shrink-0">{c.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-primary uppercase tracking-wider">{c.label}</div>
                    {c.href ? (
                      <a href={c.href} className="text-on-surface-variant hover:text-primary transition-colors">{c.value}</a>
                    ) : (
                      <div className="text-on-surface-variant">{c.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary text-white rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <span className="material-symbols-outlined text-4xl mb-4 inline-block">rocket_launch</span>
              <h3 className="text-xl font-bold mb-2">Ready to get started?</h3>
              <p className="opacity-80 text-sm mb-6 leading-relaxed">
                Set up your school in under 5 minutes. No credit card required for the 14-day free trial.
              </p>
              <Link
                to="/login"
                className="inline-block px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-surface-container-low transition-colors"
              >
                Start Free
              </Link>
            </div>
          </div>

          {/* Right: form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-outline-variant/20 shadow-lg p-8 md:p-10 space-y-5">
            <h2 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Send us a message</h2>

            {status === 'success' && (
              <div className="flex items-center gap-3 bg-secondary/10 border border-secondary/20 text-secondary rounded-xl px-5 py-4">
                <span className="material-symbols-outlined">check_circle</span>
                <span className="text-sm font-semibold">Message sent. We'll get back to you within 24 hours.</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-3 bg-error/10 border border-error/20 text-error rounded-xl px-5 py-4">
                <span className="material-symbols-outlined">error</span>
                <span className="text-sm font-semibold">Please fill in your name, email, and message.</span>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-bold text-primary mb-2">Full name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full px-5 py-4 rounded-xl border border-outline-variant/30 bg-surface text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-primary mb-2">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@school.sos"
                className="w-full px-5 py-4 rounded-xl border border-outline-variant/30 bg-surface text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-bold text-primary mb-2">Subject</label>
              <select
                id="subject"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                className="w-full px-5 py-4 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                <option>General inquiry</option>
                <option>Start a free trial</option>
                <option>Pricing & plans</option>
                <option>Technical support</option>
                <option>Partnerships</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-bold text-primary mb-2">Message</label>
              <textarea
                id="message"
                name="message"
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder="How can we help?"
                className="w-full px-5 py-4 rounded-xl border border-outline-variant/30 bg-surface text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-95"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
