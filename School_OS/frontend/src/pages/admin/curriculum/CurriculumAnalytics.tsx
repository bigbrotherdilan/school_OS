import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';

const COLORS = {
  compliant: '#16a34a',
  at_risk: '#ea580c',
  non_compliant: '#dc2626',
  blue: '#2563eb',
};

interface TeacherCompliance {
  teacher_name: string;
  modules_created: number;
  lessons_total: number;
  completed_lessons: number;
  coverage_pct: number;
  compliance_status: 'compliant' | 'at_risk' | 'non_compliant';
}

interface Metadata {
  academic_years: string[];
  terms: string[];
  classes: string[];
  subjects: string[];
}

export default function CurriculumAnalytics() {
  const { t } = useTranslation('adminAcademicMgmt');
  const [data, setData] = useState<TeacherCompliance[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);

  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [complianceRes, metaRes] = await Promise.all([
          api.get('/logbook/modules/teacher-compliance/', {
            params: {
              academic_year: academicYear || undefined,
              term: term || undefined,
              class: selectedClass || undefined,
              subject: selectedSubject || undefined,
            },
          }),
          api.get('/reports/analytics/metadata/'),
        ]);
        setData(complianceRes.data);
        setMetadata(metaRes.data);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [academicYear, term, selectedClass, selectedSubject]);

  const compliantCount = data.filter((d) => d.compliance_status === 'compliant').length;
  const atRiskCount = data.filter((d) => d.compliance_status === 'at_risk').length;
  const nonCompliantCount = data.filter((d) => d.compliance_status === 'non_compliant').length;
  const avgCoverage = data.length
    ? data.reduce((sum, d) => sum + d.coverage_pct, 0) / data.length
    : 0;

  const pieData = [
    { name: t('Compliant'), value: compliantCount, color: COLORS.compliant },
    { name: t('At Risk'), value: atRiskCount, color: COLORS.at_risk },
    { name: t('Non-Compliant'), value: nonCompliantCount, color: COLORS.non_compliant },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-12 space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div>
        <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">
          {t('Analytics')}
        </span>
        <h2 className="text-4xl font-semibold tracking-tight text-on-surface">
          {t('Curriculum Compliance')}
        </h2>
        <p className="text-on-surface-variant text-lg mt-2">
          {t('Teacher compliance with curriculum coverage requirements.')}
        </p>
      </div>

      {metadata && (
        <div className="flex flex-wrap gap-3">
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface"
          >
            <option value="">{t('All Academic Years')}</option>
            {metadata.academic_years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface"
          >
            <option value="">{t('All Terms')}</option>
            {metadata.terms.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface"
          >
            <option value="">{t('All Classes')}</option>
            {metadata.classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface"
          >
            <option value="">{t('All Subjects')}</option>
            {metadata.subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">school</span>
          <p className="text-on-surface text-xl font-medium">{t('No curriculum data yet')}</p>
          <p className="text-on-surface-variant mt-2">
            {t('Teachers have not started creating curriculum modules.')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
              <p className="text-on-surface-variant text-sm">{t('Compliant Teachers')}</p>
              <p className="text-3xl font-semibold text-green-600 mt-1">{compliantCount}</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
              <p className="text-on-surface-variant text-sm">{t('At Risk')}</p>
              <p className="text-3xl font-semibold text-orange-500 mt-1">{atRiskCount}</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
              <p className="text-on-surface-variant text-sm">{t('Non-Compliant')}</p>
              <p className="text-3xl font-semibold text-red-600 mt-1">{nonCompliantCount}</p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
              <p className="text-on-surface-variant text-sm">{t('Average Coverage %')}</p>
              <p className="text-3xl font-semibold text-blue-600 mt-1">{avgCoverage.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
              <h3 className="text-lg font-semibold text-on-surface mb-4">
                {t('Teacher Coverage')}
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
                <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="teacher_name"
                    width={140}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, t('Coverage')]} />
                  <Bar dataKey="coverage_pct" radius={[0, 4, 4, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={index} fill={COLORS[entry.compliance_status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm">
              <h3 className="text-lg font-semibold text-on-surface mb-4">
                {t('Compliance Status Distribution')}
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container text-outline text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-3">{t('Teacher Name')}</th>
                    <th className="px-6 py-3">{t('Modules Created')}</th>
                    <th className="px-6 py-3">{t('Lessons Total')}</th>
                    <th className="px-6 py-3">{t('Completed Lessons')}</th>
                    <th className="px-6 py-3">{t('Coverage %')}</th>
                    <th className="px-6 py-3">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-outline-variant/10 hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-6 py-4 text-on-surface font-medium">{row.teacher_name}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{row.modules_created}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{row.lessons_total}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{row.completed_lessons}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.coverage_pct}%`,
                                backgroundColor: COLORS[row.compliance_status],
                              }}
                            />
                          </div>
                          <span className="text-sm text-on-surface-variant">
                            {row.coverage_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: COLORS[row.compliance_status] }}
                        >
                          {row.compliance_status === 'compliant'
                            ? t('Compliant')
                            : row.compliance_status === 'at_risk'
                            ? t('At Risk')
                            : t('Non-Compliant')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
