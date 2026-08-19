import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';
import { useTranslation } from 'react-i18next';

export default function TrustPage() {
  const { t } = useTranslation('publicSite');
  return (
    <div className="bg-background text-on-surface font-body antialiased">
      <PublicNavbar />

      <main className="pt-24">
        {/* Hero */}
        <section className="px-6 py-20 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block px-4 py-1.5 bg-secondary-container text-on-secondary-container rounded-full text-sm font-bold tracking-widest mb-6 uppercase">
              {t('Trusted by 500+ Institutions')}
            </span>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-primary leading-[1.1] mb-8">
              {t('Built For Modern')} <span className="text-secondary">{t('African')}</span> {t('Schools')}
            </h1>
            <p className="text-xl text-on-surface-variant leading-relaxed mb-10 max-w-xl">
              {t('Experience the operating system that unifies administration, finance, and learning. Reduce manual workload by 70% while providing unparalleled transparency for parents and staff.')}
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 hover:scale-[1.02] transition-transform">
                {t('Explore Platform')} <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <div className="flex items-center gap-4 px-4 py-2 bg-surface-container-low rounded-xl">
                <span className="text-sm font-semibold text-primary">{t('Used by 12,000+ Educators')}</span>
              </div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-secondary/20 to-primary/10 rounded-[2.5rem] blur-2xl group-hover:blur-3xl transition-all duration-500" />
            <div className="relative bg-surface-container-low rounded-[2rem] p-10 flex items-center justify-center min-h-[400px] border border-outline-variant/20 shadow-2xl">
              <div className="text-center">
                <span className="material-symbols-outlined text-primary/30 text-[120px]">shield</span>
                <div className="mt-4 text-2xl font-bold text-primary/40">{t('Trusted Platform')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Level Grid */}
        <section className="px-6 py-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4 tracking-tight">{t('Engineered for Every Level')}</h2>
              <p className="text-on-surface-variant max-w-2xl mx-auto text-lg">
                {t('Whether you are nurturing toddlers or awarding degrees, School OS adapts to your institutional workflow.')}
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: 'child_care', title: t('Primary Schools'), desc: t('Streamline parent communication and early literacy tracking.') },
                { icon: 'school', title: t('Secondary Schools'), desc: t('Manage complex grading and career path tracking.') },
                { icon: 'account_balance', title: t('Universities'), desc: t('Scalable modules for research and course registration.') },
                { icon: 'workspace_premium', title: t('Training Centers'), desc: t('Short-course certificates and vocational tracking.') },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group relative bg-surface-container-lowest p-8 rounded-[2rem] hover:bg-primary transition-all duration-500 overflow-hidden"
                >
                  <div className="relative z-10">
                    <span className="material-symbols-outlined text-4xl text-secondary group-hover:text-white transition-colors mb-6">
                      {item.icon}
                    </span>
                    <h3 className="text-2xl font-bold text-primary group-hover:text-white mb-4">{item.title}</h3>
                    <p className="text-on-surface-variant group-hover:text-white/80">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data/Analytics Showcase */}
        <section className="bg-primary py-24 text-white overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="bg-surface-container-lowest/10 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/10 shadow-2xl flex items-center justify-center min-h-[350px]">
                <div className="text-center">
                  <span className="material-symbols-outlined text-white/20 text-[100px]">insights</span>
                  <div className="mt-2 text-xl font-bold text-white/30">{t('Analytics Dashboard')}</div>
                </div>
              </div>
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight tracking-tight">{t('Data That Drives Growth')}</h2>
                <div className="space-y-8">
                  <div className="flex gap-6">
                    <div className="w-14 h-14 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary-fixed">leaderboard</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{t('Performance Tracking')}</h4>
                      <p className="text-white/70">{t('Visualize student progress over terms with AI-powered trend analysis to identify students needing help.')}</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-14 h-14 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary-fixed">payments</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{t('Revenue Forecasts')}</h4>
                      <p className="text-white/70">{t('Predict upcoming cash flows based on billing cycles and collection history with 95% precision.')}</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-14 h-14 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary-fixed">download</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{t('One-Click Reports')}</h4>
                      <p className="text-white/70">{t('Export detailed compliance, academic, and financial reports in PDF or Excel format instantly.')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}