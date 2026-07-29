import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { parentApi, type ChildSummary } from '../../services/parentApi';
import { useTenantStore } from '../../stores/tenantStore';
import { useParentStore } from '../../stores/parentStore';

const ParentChildDetail: React.FC = () => {
    const { childId } = useParams<{ childId: string }>();
    const { schoolConfig } = useTenantStore();
    const { dashboardData } = useParentStore();
    const [summary, setSummary] = useState<ChildSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTerm, setSelectedTerm] = useState<number>(0);
    const [selectedSequence, setSelectedSequence] = useState<number>(0);

    const ward = dashboardData?.wards.find(w => w.id === childId);

    useEffect(() => {
        if (!childId) return;
        setLoading(true);
        parentApi.getChildSummary(childId)
            .then(data => {
                setSummary(data);
                if (data.terms.length > 0) {
                    const lastTermIdx = data.terms.length - 1;
                    setSelectedTerm(lastTermIdx);
                    const lastTerm = data.terms[lastTermIdx];
                    if (lastTerm.sequences.length > 0) {
                        setSelectedSequence(lastTerm.sequences.length - 1);
                    }
                }
            })
            .catch(() => setError('Failed to load child details.'))
            .finally(() => setLoading(false));
    }, [childId]);

    if (loading) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-32 bg-slate-200 rounded-2xl" />
                <div className="h-12 bg-slate-200 rounded-xl" />
                <div className="h-64 bg-slate-200 rounded-2xl" />
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
                <span className="material-symbols-outlined text-5xl text-slate-300">cloud_off</span>
                <p className="text-slate-500 text-center text-lg">{error || 'Student not found'}</p>
                <Link to="/parent" className="px-6 py-3 bg-blue-900 text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const currentTerm = summary.terms[selectedTerm];
    const currentSequence = currentTerm?.sequences[selectedSequence];
    const scaleMax = currentSequence?.subjects[0]?.out_of || schoolConfig.grading_scale_max;

    return (
        <div className="flex flex-col gap-5 pb-6">
            {/* Back Navigation */}
            <Link to="/parent" className="flex items-center gap-2 text-sm font-semibold text-blue-900 hover:underline">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Dashboard
            </Link>

            {/* Child Header */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                    {summary.student.photo_url && summary.student.photo_url.startsWith('http') && !summary.student.photo_url.includes('aida-public') ? (
                        <img src={summary.student.photo_url} alt={summary.student.first_name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xl">
                            {summary.student.first_name[0]}{summary.student.last_name[0]}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-slate-900">{summary.student.first_name} {summary.student.last_name}</h1>
                        <p className="text-sm text-slate-500">{summary.student.grade} · {summary.student.campus}</p>
                        <p className="text-xs text-slate-400 mt-0.5">#{summary.student.admission_number}</p>
                    </div>
                </div>

                {/* Attendance Ring */}
                <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                            <circle
                                cx="32" cy="32" r="28" fill="none"
                                stroke={summary.attendance.percentage !== null && summary.attendance.percentage >= 80 ? '#10b981' : summary.attendance.percentage !== null && summary.attendance.percentage >= 60 ? '#f59e0b' : '#ef4444'}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${(summary.attendance.percentage || 0) * 1.759} 175.9`}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">
                            {summary.attendance.percentage !== null ? `${summary.attendance.percentage}%` : '-'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900">Attendance</p>
                        <p className="text-xs text-slate-500">
                            {summary.attendance.present_days} / {summary.attendance.total_days} days present
                        </p>
                    </div>
                </div>
            </div>

            {/* Term Tabs */}
            {summary.terms.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {summary.terms.map((term, idx) => (
                        <button
                            key={term.term_id}
                            onClick={() => {
                                setSelectedTerm(idx);
                                setSelectedSequence(Math.min(selectedSequence, term.sequences.length - 1));
                            }}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                idx === selectedTerm
                                    ? 'bg-blue-900 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {term.term_name}
                        </button>
                    ))}
                </div>
            )}

            {/* Sequence Tabs */}
            {currentTerm && currentTerm.sequences.length > 0 && (
                <div className="flex gap-2">
                    {currentTerm.sequences.map((seq, idx) => (
                        <button
                            key={seq.sequence_id}
                            onClick={() => setSelectedSequence(idx)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                idx === selectedSequence
                                    ? 'bg-blue-900 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {seq.sequence_name}
                            {!seq.is_locked && (
                                <span className="w-2 h-2 rounded-full bg-amber-400" title="Not yet finalised" />
                            )}
                            {seq.is_locked && !seq.is_shared && (
                                <span className="w-2 h-2 rounded-full bg-slate-300" title="Marks finalised - not yet shared" />
                            )}
                            {seq.is_locked && seq.is_shared && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Results visible" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Subject Marks Table */}
            {currentSequence ? (
                currentSequence.is_locked && currentSequence.is_shared ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="font-bold text-slate-900">
                                {currentSequence.sequence_name} - {currentTerm.term_name}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Subject scores (out of {scaleMax})</p>
                        </div>
                        {currentSequence.subjects.length === 0 ? (
                            <div className="p-8 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">analytics</span>
                                <p className="text-sm text-slate-500">No results available for this sequence.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {currentSequence.subjects.map((subj, i) => {
                                    const pct = (subj.score / subj.out_of) * 100;
                                    const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500';
                                    return (
                                        <div key={`${subj.name}-${i}`} className="px-5 py-4 flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-bold text-blue-900">{i + 1}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-semibold text-slate-800 truncate">{subj.name}</span>
                                                    <span className="text-sm font-bold text-blue-900 ml-2">{subj.score} / {subj.out_of}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                                </div>
                                                {subj.coefficient !== 1 && (
                                                    <p className="text-[10px] text-slate-400 mt-1">Coefficient: {subj.coefficient}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                        <span className="material-symbols-outlined text-4xl text-amber-300 mb-3 block">
                            {currentSequence.is_locked ? 'visibility_off' : 'lock_open'}
                        </span>
                        <p className="text-sm font-bold text-slate-900 mb-1">
                            {currentSequence.is_locked ? 'Results not yet shared' : 'Results pending'}
                        </p>
                        <p className="text-xs text-slate-500">
                            {currentSequence.is_locked
                                ? 'Marks have been finalised but are not yet visible to parents. The school admin will share them soon.'
                                : 'Results will appear here once the exam session closes and marks are finalised by the admin.'}
                        </p>
                    </div>
                )
            ) : (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">school</span>
                    <p className="text-sm text-slate-500">No sequences available for this term.</p>
                </div>
            )}

            {/* Quick Nav */}
            <div className="flex gap-3">
                <Link to="/parent/analytics" className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 text-center hover:bg-slate-50 transition-colors">
                    View All Grades
                </Link>
                <Link to="/parent/reports" className="flex-1 py-3 bg-blue-900 rounded-xl text-sm font-bold text-white text-center active:scale-[0.98] transition-transform">
                    Report Cards
                </Link>
            </div>
        </div>
    );
};

export default ParentChildDetail;
