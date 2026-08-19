import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import PublicNavbar from '../../components/layout/public/PublicNavbar';
import PublicFooter from '../../components/layout/public/PublicFooter';
import { fetchSchoolProfile, submitEnrollmentInquiry, type PublicSchoolProfile } from '../../services/publicApi';
import { useTranslation } from 'react-i18next';

function formatFee(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' FCFA';
}

function groupFeesByClass(fees: PublicSchoolProfile['fee_structures']) {
  const grouped: Record<string, { category: string; amount: number }[]> = {};
  for (const fee of fees) {
    const key = fee.class_name || '_all';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ category: fee.category_name, amount: fee.amount });
  }
  return grouped;
}

export default function SchoolProfile() {
  const { t } = useTranslation('publicSite');
  const { schoolId } = useParams();
  const [school, setSchool] = useState<PublicSchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'programs' | 'fees' | 'enroll'>('about');
  const [enrollSubmitted, setEnrollSubmitted] = useState(false);
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    fetchSchoolProfile(schoolId)
      .then((data) => {
        setSchool(data);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [schoolId]);

  if (loading) {
    return (
      <div className="bg-surface text-on-surface min-h-screen">
        <PublicNavbar />
        <div className="pt-32 pb-20 text-center px-6">
          <div className="inline-block w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant">{t('Loading school profile...')}</p>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (notFound || !school) {
    return (
      <div className="bg-surface text-on-surface min-h-screen">
        <PublicNavbar />
        <div className="pt-32 pb-20 text-center px-6">
          <span className="material-symbols-outlined text-on-surface-variant/30 text-[100px] block mb-4">school_off</span>
          <h1 className="text-4xl font-bold text-primary mb-4">{t('School Not Found')}</h1>
          <p className="text-on-surface-variant mb-8">{t("The school you're looking for doesn't exist or has been removed.")}</p>
          <Link to="/schools" className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all inline-block">
            {t('Browse All Schools')}
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const tabs = [
    { id: 'about' as const, label: t('About'), icon: 'info' },
    { id: 'programs' as const, label: t('Classes'), icon: 'menu_book' },
    { id: 'fees' as const, label: t('Fees'), icon: 'payments' },
    { id: 'enroll' as const, label: t('Enroll Online'), icon: 'how_to_reg' },
  ];

  const feeGroups = groupFeesByClass(school.fee_structures);
  const hasClassSpecificFees = feeGroups['_all'] === undefined || Object.keys(feeGroups).length > 1;

  const handleEnroll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnrollSubmitting(true);
    setEnrollError('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await submitEnrollmentInquiry({
        school_id: school.id,
        child_first_name: fd.get('child_first_name') as string,
        child_middle_name: fd.get('child_middle_name') as string || undefined,
        child_last_name: fd.get('child_last_name') as string,
        date_of_birth: fd.get('date_of_birth') as string || undefined,
        gender: fd.get('gender') as string || undefined,
        grade: fd.get('grade') as string || undefined,
        parent_name: fd.get('parent_name') as string,
        relationship: fd.get('relationship') as string || undefined,
        parent_phone: fd.get('parent_phone') as string,
        email: fd.get('email') as string || undefined,
        notes: fd.get('notes') as string || undefined,
      });
      setEnrollSubmitted(true);
    } catch {
      setEnrollError(t('Something went wrong. Please try again.'));
    } finally {
      setEnrollSubmitting(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <PublicNavbar />

      <div className="pt-20 bg-gradient-to-b from-primary-container/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Link to="/" className="hover:text-primary transition-colors">{t('Home')}</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <Link to="/schools" className="hover:text-primary transition-colors">{t('Schools')}</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary font-semibold">{school.school_name}</span>
          </div>
        </div>
      </div>

      <section className="pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-primary rounded-2xl flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
              {school.logo_url ? (
                <img src={school.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-white text-4xl md:text-5xl">school</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight">{school.school_name}</h1>
                <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-wider uppercase">
                  {school.education_type_display}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                {school.region && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    {school.region}{school.division ? `, ${school.division}` : ''}
                  </span>
                )}
                {school.active_academic_year && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">calendar_today</span>
                    {school.active_academic_year.name}
                  </span>
                )}
                {school.motto && (
                  <span className="flex items-center gap-1.5 italic">
                    "{school.motto}"
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => setActiveTab('enroll')}
                className="bg-secondary text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all text-sm"
              >
                {t('Enroll Now')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('Students'), value: school.student_count?.toLocaleString() ?? '-', icon: 'groups' },
              { label: t('Teachers'), value: school.teacher_count?.toLocaleString() ?? '-', icon: 'person' },
              { label: t('Classes'), value: String(school.classes.length || '-'), icon: 'menu_book' },
              { label: t('Type'), value: school.school_type_display || '-', icon: 'category' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 text-center border border-outline-variant/10 shadow-sm">
                <span className="material-symbols-outlined text-primary text-xl mb-1 block">{stat.icon}</span>
                <div className="text-xl font-extrabold text-primary">{stat.value}</div>
                <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-on-surface-variant border-transparent hover:text-primary hover:border-primary/30'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-7xl mx-auto px-6">

          {activeTab === 'about' && (
            <div className="space-y-8">
              {school.motto && (
                <div className="bg-white rounded-3xl p-8 md:p-10 border border-outline-variant/10 shadow-sm">
                  <h2 className="text-2xl font-bold text-primary mb-2">{school.motto}</h2>
                </div>
              )}
              <div className="bg-white rounded-3xl p-8 md:p-10 border border-outline-variant/10 shadow-sm">
                <h3 className="text-xl font-bold text-primary mb-6">{t('Contact Information')}</h3>
                <div className="grid md:grid-cols-2 gap-5">
                  {school.address && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-lg">location_on</span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('Address')}</div>
                        <div className="text-on-surface font-medium text-sm">{school.address}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'programs' && (
            <div>
              {school.classes.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">{t('Class information not available yet.')}</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {school.classes.map((cls) => (
                    <div key={cls.name} className="bg-white rounded-2xl p-6 border border-outline-variant/10 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-xl">school</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-primary">{cls.name}</h3>
                        <p className="text-xs text-on-surface-variant">{cls.cycle_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'fees' && (
            <div>
              {school.fee_structures.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">{t('Fee information not available yet.')}</div>
              ) : (
                <div className="space-y-6">
                  {hasClassSpecificFees ? (
                    Object.entries(feeGroups).map(([className, fees]) => (
                      <div key={className}>
                        <h3 className="text-lg font-bold text-primary mb-3">
                          {className === '_all' ? t('All Classes (Unified Fee)') : className}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-3">
                          {fees.map((fee, i) => (
                            <div key={i} className="bg-white rounded-xl p-5 border border-outline-variant/10 shadow-sm flex justify-between items-center">
                              <span className="text-on-surface font-medium">{fee.category}</span>
                              <span className="text-primary font-extrabold">{formatFee(fee.amount)} <span className="text-xs font-normal text-on-surface-variant">/ {t('year')}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                      {feeGroups['_all']?.map((fee, i) => (
                        <div key={i} className="bg-white rounded-xl p-5 border border-outline-variant/10 shadow-sm flex justify-between items-center">
                          <span className="text-on-surface font-medium">{fee.category}</span>
                          <span className="text-primary font-extrabold">{formatFee(fee.amount)} <span className="text-xs font-normal text-on-surface-variant">/ {t('year')}</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'enroll' && (
            <div className="max-w-2xl mx-auto">
              {enrollSubmitted ? (
                <div className="bg-white rounded-3xl p-12 border border-outline-variant/10 shadow-sm text-center">
                  <span className="material-symbols-outlined text-secondary text-6xl mb-4 block">check_circle</span>
                  <h2 className="text-2xl font-bold text-primary mb-3">{t('Enrollment Inquiry Submitted!')}</h2>
                  <p className="text-on-surface-variant mb-6">
                    {t('Thank you for your interest in')} {school.school_name}. {t('The school administration will contact you shortly.')}
                  </p>
                  <button
                    onClick={() => { setEnrollSubmitted(false); }}
                    className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all"
                  >
                    {t('Submit Another')}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 md:p-10 border border-outline-variant/10 shadow-sm">
                  <div className="text-center mb-8">
                    <span className="material-symbols-outlined text-primary text-4xl mb-3 block">how_to_reg</span>
                    <h2 className="text-2xl font-bold text-primary mb-2">{t('Enroll at')} {school.school_name}</h2>
                    <p className="text-on-surface-variant text-sm">{t('Fill out the form below and the school will contact you to finalize enrollment.')}</p>
                  </div>
                  {enrollError && (
                    <div className="bg-error-container/30 text-error rounded-xl p-4 mb-6 text-sm font-medium">{enrollError}</div>
                  )}
                  <form className="space-y-4" onSubmit={handleEnroll}>
                    <input type="hidden" name="school_id" value={school.id} />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t("Child's First Name")} *</label>
                        <input name="child_first_name" type="text" required placeholder={t('First name')}
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t("Child's Middle Name")}</label>
                        <input name="child_middle_name" type="text" placeholder={t('Middle name')}
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t("Child's Last Name")} *</label>
                        <input name="child_last_name" type="text" required placeholder={t('Last name')}
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Date of Birth')}</label>
                        <input name="date_of_birth" type="date"
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Gender')}</label>
                        <select name="gender"
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                          <option value="">{t('Select')}</option>
                          <option value="male">{t('Male')}</option>
                          <option value="female">{t('Female')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Grade / Class Applying For')}</label>
                      <select name="grade"
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                        <option value="">{t('Select level')}</option>
                        {school.classes.map((cls) => (
                          <option key={cls.name} value={cls.name}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="border-t border-outline-variant/20 pt-4 mt-4">
                      <h3 className="font-bold text-primary mb-3">{t('Parent / Guardian Information')}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Parent Name')} *</label>
                        <input name="parent_name" type="text" required placeholder={t('Full name')}
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Relationship')}</label>
                        <select name="relationship"
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                          <option value="">{t('Select')}</option>
                          <option value="father">{t('Father')}</option>
                          <option value="mother">{t('Mother')}</option>
                          <option value="guardian">{t('Guardian')}</option>
                          <option value="other">{t('Other')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Phone Number')} *</label>
                        <input name="parent_phone" type="tel" required placeholder={t('+237 6XX XXX XXX')}
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Email')}</label>
                        <input name="email" type="email" placeholder={t('parent@email.com')}
                          className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('Additional Notes')}</label>
                      <textarea name="notes" rows={3} placeholder={t('Any special requirements, previous school, medical conditions, etc.')}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
                    </div>
                    <button
                      type="submit"
                      disabled={enrollSubmitting}
                      className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {enrollSubmitting ? t('Submitting...') : t('Submit Enrollment Inquiry')}
                    </button>
                    <p className="text-xs text-on-surface-variant text-center">
                      {t('By submitting, you agree to be contacted by')} {school.school_name} {t('regarding this enrollment.')}
                    </p>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}