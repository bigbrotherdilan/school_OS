import { useState, useEffect } from 'react';
import { api } from '../../../services/api';

export default function CommunityEthos() {
  const [cultureData, setCultureData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCultureData = async () => {
      try {
        const [studentsRes, attendanceRes, sectionsRes] = await Promise.all([
          api.get('/students/students/', { params: { limit: 1000 } }),
          api.get('/attendance/sessions/', { params: { limit: 50 } }),
          api.get('/academic/sections/'),
        ]);
        setCultureData({
          students: studentsRes.data.results || studentsRes.data || [],
          attendance: attendanceRes.data.results || attendanceRes.data || [],
          sections: sectionsRes.data.results || sectionsRes.data || [],
          values: [
            { id: '1', name: 'Excellence', description: 'Pursuing the highest standards in academics, character, and community service.', icon: 'emoji_events', color: '#f59e0b', behaviors: ['High expectations', 'Continuous improvement', 'Merit recognition'] },
            { id: '2', name: 'Integrity', description: 'Acting with honesty, transparency, and moral courage in all interactions.', icon: 'verified', color: '#10b981', behaviors: ['Honest communication', 'Accountability', 'Ethical decision-making'] },
            { id: '3', name: 'Inclusivity', description: 'Celebrating linguistic and cultural diversity as a source of strength.', icon: 'diversity_3', color: '#6366f1', behaviors: ['Bilingual fluency', 'Cultural respect', 'Equal opportunity'] },
            { id: '4', name: 'Discipline', description: 'Fostering self-regulation, responsibility, and consistent effort.', icon: 'military_tech', color: '#8b5cf6', behaviors: ['Punctuality', 'Preparedness', 'Self-motivation'] },
            { id: '5', name: 'Service', description: 'Contributing positively to the school and the broader community.', icon: 'volunteer_activism', color: '#ef4444', behaviors: ['Community engagement', 'Peer mentoring', 'Social responsibility'] },
          ],
        });
      } catch (err) {
        console.error('Failed to fetch culture data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCultureData();
  }, []);

  const getSectionStats = (students: any[], sections: any[]) => {
    return sections.map(section => {
      const sectionStudents = students.filter(s => s.stream === section.id);
      const activeStudents = sectionStudents.filter(s => s.status === 'active');
      return {
        ...section,
        total_students: sectionStudents.length,
        active_students: activeStudents.length,
        registered_students: sectionStudents.filter(s => s.status === 'registered').length,
      };
    });
  };

  const getAttendanceRate = (attendance: any[]) => {
    if (!attendance.length) return 0;
    let totalRecords = 0;
    let presentRecords = 0;
    attendance.forEach(session => {
      if (session.records) {
        totalRecords += session.records.length;
        presentRecords += session.records.filter((r: any) => r.status === 'present').length;
      }
    });
    return totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-secondary/10 text-secondary';
      case 'registered': return 'bg-primary/10 text-primary';
      case 'inactive': return 'bg-warning/10 text-warning';
      case 'suspended': return 'bg-error/10 text-error';
      default: return 'bg-outline-variant/10 text-outline';
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-12 space-y-8 max-w-[1400px] mx-auto bg-surface min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-4">diversity_3</span>
            <p className="text-on-surface-variant">Loading community pulse...</p>
          </div>
        </div>
      </div>
    );
  }

  const students = cultureData?.students || [];
  const attendance = cultureData?.attendance || [];
  const sections = cultureData?.sections || [];
  const values = cultureData?.values || [];

  const sectionStats = getSectionStats(students, sections);
  const totalStudents = students.length;
  const activeStudents = students.filter((s: any) => s.status === 'active').length;
  const attendanceRate = getAttendanceRate(attendance);
  const anglophoneSection = sections.find((s: any) => s.language === 'en');
  const francophoneSection = sections.find((s: any) => s.language === 'fr');

  return (
    <div className="p-4 lg:p-12 space-y-12 max-w-[1400px] mx-auto bg-surface min-h-screen">
      {/* Header */}
      <section className="flex flex-col gap-6">
        <div>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-primary/60 mb-3 block">Perspective & Culture</span>
          <h1 className="text-[3.5rem] font-black leading-tight tracking-[-0.04em] text-on-surface">Community Ethos</h1>
        </div>
        <p className="text-body-lg text-on-surface-variant max-w-xl leading-relaxed">
          Nurturing the institutional soul through radical engagement and the curation of core values. Monitor the pulse of student life across all bilingual sections.
        </p>
      </section>

      {/* Key Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Students"
          value={totalStudents}
          subtitle={`${activeStudents} active • ${totalStudents - activeStudents} pending`}
          icon="groups"
          color="bg-blue-500"
        />
        <MetricCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          subtitle={attendanceRate >= 85 ? 'Healthy' : attendanceRate >= 70 ? 'Needs Attention' : 'Critical'}
          icon="how_to_reg"
          color={attendanceRate >= 85 ? 'bg-emerald-500' : attendanceRate >= 70 ? 'bg-amber-500' : 'bg-red-500'}
        />
        <MetricCard
          label="Anglophone Section"
          value={sectionStats.find(s => s.language === 'en')?.active_students || 0}
          subtitle={`${sectionStats.find(s => s.language === 'en')?.total_students || 0} enrolled`}
          icon="translate"
          color="bg-indigo-500"
        />
        <MetricCard
          label="Francophone Section"
          value={sectionStats.find(s => s.language === 'fr')?.active_students || 0}
          subtitle={`${sectionStats.find(s => s.language === 'fr')?.total_students || 0} enrolled`}
          icon="translate"
          color="bg-violet-500"
        />
      </section>

      {/* Bilingual Section Pulse */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionPulseCard
          section={anglophoneSection}
          stats={sectionStats.find(s => s.language === 'en')}
          students={students.filter((s: any) => s.stream === anglophoneSection?.id)}
          label="Anglophone Section"
          color="bg-indigo-500"
        />
        <SectionPulseCard
          section={francophoneSection}
          stats={sectionStats.find(s => s.language === 'fr')}
          students={students.filter((s: any) => s.stream === francophoneSection?.id)}
          label="Francophone Section"
          color="bg-violet-500"
        />
      </section>

      {/* Core Values */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-on-surface">Core Values & Institutional Culture</h2>
          <button className="bg-primary text-white px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">add</span>
            Add Value
          </button>
        </div>
        {values.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {values.map((value: any) => (
              <ValueCard key={value.id} value={value} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/30 p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-outline mb-4 block">sentiment_satisfied</span>
            <h4 className="text-lg font-bold text-on-surface mb-2">No Core Values Defined</h4>
            <p className="text-sm text-on-surface-variant max-w-sm mx-auto mb-6">
              Define the institutional values that guide your community. These shape culture, inform decisions, and align behavior.
            </p>
            <button className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 mx-auto">
              <span className="material-symbols-outlined">add</span>
              Create First Value
            </button>
          </div>
        )}
      </section>

      {/* Student Life Indicators */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LifeIndicatorCard
          title="Engagement"
          value={`${Math.min(100, Math.round((activeStudents / Math.max(totalStudents, 1)) * 100))}%`}
          description="Active participation in school life"
          icon="volunteer_activism"
          trend="up"
          color="bg-emerald-500"
        />
        <LifeIndicatorCard
          title="Well-being"
          value={`${attendanceRate}%`}
          description="Attendance as proxy for student wellness"
          icon="favorite"
          trend={attendanceRate >= 85 ? 'up' : attendanceRate >= 70 ? 'neutral' : 'down'}
          color={attendanceRate >= 85 ? 'bg-emerald-500' : attendanceRate >= 70 ? 'bg-amber-500' : 'bg-red-500'}
        />
        <LifeIndicatorCard
          title="Inclusion"
          value={`${sections.length} sections`}
          description="Bilingual & specialized pathways available"
          icon="diversity_3"
          trend="up"
          color="bg-blue-500"
        />
      </section>

      {/* Recent Student Activity */}
      <section>
        <h2 className="text-2xl font-bold text-on-surface mb-6">Recent Community Activity</h2>
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-outline-variant/15">
            <h3 className="text-lg font-bold text-on-surface">New Registrations (Last 10)</h3>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {students.slice(0, 10).map((student: any) => (
              <div key={student.id} className="p-4 hover:bg-surface-container-low/50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {student.first_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-on-surface">{student.first_name} {student.last_name}</div>
                    <div className="text-sm text-on-surface-variant">
                      {student.current_class?.name || 'Unassigned'} • {student.stream_display || student.section_display || 'No Section'}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(student.status)}`}>
                  {student.status}
                </span>
              </div>
            ))}
            {students.length === 0 && (
              <div className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl mb-4 block">group_off</span>
                No students registered yet
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 border-t border-outline-variant/10 text-center flex flex-col items-center gap-10">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center grayscale opacity-30 shadow-2xl shadow-slate-400/20">
          <span className="material-symbols-outlined text-white text-3xl">diversity_3</span>
        </div>
        <p className="text-body-lg italic font-serif text-on-surface-variant max-w-2xl leading-relaxed opacity-60">
          "Community is not merely a collection of individuals, but a curated resonance of purpose and institutional culture. We are the curators of our collective future."
        </p>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[0.6rem] font-black uppercase tracking-[0.5em] text-primary/40">- Digital Curator Charter v1.0</p>
          <div className="flex gap-2 mt-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-primary/20"></div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function MetricCard({ label, value, subtitle, icon, color }: { label: string; value: string | number; subtitle: string; icon: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{label}</p>
          <p className="text-3xl font-bold text-on-surface tabular-nums">{value}</p>
          <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function SectionPulseCard({ section, stats, students, label, color }: { section: any; stats: any; students: any[]; label: string; color: string }) {
  const statusCounts = {
    active: students.filter(s => s.status === 'active').length,
    registered: students.filter(s => s.status === 'registered').length,
    inactive: students.filter(s => s.status === 'inactive').length,
    suspended: students.filter(s => s.status === 'suspended').length,
    withdrawn: students.filter(s => s.status === 'withdrawn').length,
    graduated: students.filter(s => s.status === 'graduated').length,
  };

  const classDistribution = students.reduce((acc: any, s) => {
    const cls = s.current_class?.name || 'Unassigned';
    acc[cls] = (acc[cls] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{section?.language === 'en' ? 'translate' : 'language'}</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-on-surface">{label}</h3>
          <p className="text-sm text-on-surface-variant">{section?.section_type || 'Grammar'} • {section?.language === 'en' ? 'English' : 'French'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-container p-4 rounded-xl text-center">
          <p className="text-2xl font-bold text-on-surface">{stats?.active_students || 0}</p>
          <p className="text-xs font-medium text-secondary uppercase">Active</p>
        </div>
        <div className="bg-surface-container p-4 rounded-xl text-center">
          <p className="text-2xl font-bold text-on-surface">{stats?.registered_students || 0}</p>
          <p className="text-xs font-medium text-primary uppercase">Registered</p>
        </div>
        <div className="bg-surface-container p-4 rounded-xl text-center">
          <p className="text-2xl font-bold text-on-surface">{stats?.total_students || 0}</p>
          <p className="text-xs font-medium text-outline uppercase">Total</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <p className="text-sm font-medium text-on-surface-variant">Status Distribution</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} className={`px-2 py-1 rounded-full text-[10px] font-bold ${count > 0 ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-outline'}`}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-on-surface-variant mb-3">Classes</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(classDistribution as Record<string, number>).slice(0, 8).map(([cls, count]) => (
            <span key={cls} className="px-3 py-1.5 bg-surface-container rounded-lg text-sm font-medium text-on-surface border border-outline-variant/15">
              {cls} ({count})
            </span>
          ))}
          {Object.keys(classDistribution).length > 8 && (
            <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium">
              +{Object.keys(classDistribution).length - 8} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ValueCard({ value }: { value: any }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6 hover:border-primary/30 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            {value.icon || 'sentiment_satisfied'}
          </span>
        </div>
        {value.color && (
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: value.color }} />
        )}
      </div>
      <h4 className="text-lg font-bold text-on-surface mb-2">{value.name || value.title}</h4>
      <p className="text-sm text-on-surface-variant leading-relaxed">{value.description || value.body}</p>
      {value.behaviors && value.behaviors.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {value.behaviors.slice(0, 4).map((b: string, i: number) => (
            <span key={i} className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant text-[10px] font-medium rounded-full">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LifeIndicatorCard({ title, value, description, icon, trend, color }: { title: string; value: string; description: string; icon: string; trend: 'up' | 'down' | 'neutral'; color: string }) {
  const trendIcons = { up: 'trending_up', down: 'trending_down', neutral: 'trending_flat' };
  const trendColors = { up: 'text-secondary', down: 'text-error', neutral: 'text-outline' };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white`}>
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        <span className={`material-symbols-outlined text-xl ${trendColors[trend]}`}>{trendIcons[trend]}</span>
      </div>
      <p className="text-3xl font-bold text-on-surface mb-1">{value}</p>
      <h4 className="text-lg font-semibold text-on-surface mb-1">{title}</h4>
      <p className="text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}