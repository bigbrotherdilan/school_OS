import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParentStore } from '../../stores/parentStore';
import { useTenantStore } from '../../stores/tenantStore';
import { parentApi, type AnalyticsResult } from '../../services/parentApi';

interface GradingConfig {
    scale_max: number;
    grade_a: number;
    grade_b: number;
    grade_c: number;
}

const ParentAnalytics: React.FC = () => {
    const { t } = useTranslation('parent');
    const { dashboardData, selectedWardId, setSelectedWardId } = useParentStore();
    const { schoolConfig } = useTenantStore();
    const wards = dashboardData?.wards || [];
    const [results, setResults] = useState<AnalyticsResult[]>([]);
    const [gradingConfig, setGradingConfig] = useState<GradingConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
    const [selectedSequence, setSelectedSequence] = useState<number | null>(null);

    useEffect(() => {
        if (wards.length > 0 && !selectedWardId) {
            setSelectedWardId(wards[0].id);
        }
    }, [wards, selectedWardId]);

    useEffect(() => {
        if (!selectedWardId) return;
        setLoading(true);
        parentApi.getAnalytics(selectedWardId)
            .then((data) => {
                const items = Array.isArray(data) ? data : (data?.results || []);
                setResults(items);
                if (data?.grading_config) setGradingConfig(data.grading_config);
            })
            .catch(() => setResults([]))
            .finally(() => setLoading(false));
    }, [selectedWardId]);

    const scaleMax = gradingConfig?.scale_max || schoolConfig.grading_scale_max;

    const availableTerms = useMemo(() => {
        const termMap = new Map<number, string>();
        results.forEach(r => {
            if (r.term_order && !termMap.has(r.term_order)) {
                termMap.set(r.term_order, r.term_name);
            }
        });
        return Array.from(termMap.entries()).sort((a, b) => a[0] - b[0]);
    }, [results]);

    const availableSequences = useMemo(() => {
        const seqMap = new Map<string, { order: number; name: string }>();
        results.forEach(r => {
            if (r.sequence_name && r.sequence_order) {
                const key = `${r.term_order}-${r.sequence_order}`;
                if (!seqMap.has(key)) {
                    seqMap.set(key, { order: r.sequence_order, name: r.sequence_name });
                }
            }
        });
        return Array.from(seqMap.entries())
            .filter(([key]) => selectedTerm === null || key.startsWith(`${selectedTerm}-`))
            .sort((a, b) => a[1].order - b[1].order);
    }, [results, selectedTerm]);

    const filteredResults = useMemo(() => {
        let filtered = results;
        if (selectedTerm !== null) {
            filtered = filtered.filter(r => r.term_order === selectedTerm);
        }
        if (selectedSequence !== null) {
            filtered = filtered.filter(r => r.sequence_order === selectedSequence);
        }
        return filtered;
    }, [results, selectedTerm, selectedSequence]);

    const subjectTrends = useMemo(() => {
        const trends: Record<string, { scores: { score: number; sequence_order: number; term_order: number }[] }> = {};
        results.forEach(r => {
            const scoreVal = parseFloat(r.score);
            if (scoreVal > 0) {
                if (!trends[r.subject_name]) trends[r.subject_name] = { scores: [] };
                trends[r.subject_name].scores.push({
                    score: scoreVal,
                    sequence_order: r.sequence_order,
                    term_order: r.term_order,
                });
            }
        });
        const result: Record<string, 'up' | 'down' | 'stable' | null> = {};
        Object.entries(trends).forEach(([name, data]) => {
            const sorted = data.scores.sort((a, b) => a.term_order - b.term_order || a.sequence_order - b.sequence_order);
            if (sorted.length >= 2) {
                const latest = sorted[sorted.length - 1].score;
                const prev = sorted[sorted.length - 2].score;
                if (latest > prev) result[name] = 'up';
                else if (latest < prev) result[name] = 'down';
                else result[name] = 'stable';
            } else {
                result[name] = null;
            }
        });
        return result;
    }, [results]);

    const subjectGroups = useMemo(() => {
        const groups: Record<string, { latest_score: number; scores: number[]; subject_name: string }> = {};
        filteredResults.forEach(r => {
            const scoreVal = parseFloat(r.score);
            if (scoreVal > 0) {
                if (!groups[r.subject_name]) {
                    groups[r.subject_name] = { latest_score: scoreVal, scores: [], subject_name: r.subject_name };
                }
                groups[r.subject_name].scores.push(scoreVal);
                const latestSort = r.term_order * 100 + r.sequence_order;
                const currentSort = groups[r.subject_name].scores.length > 0 ? latestSort : 0;
                if (latestSort >= currentSort) {
                    groups[r.subject_name].latest_score = scoreVal;
                }
            }
        });
        return groups;
    }, [filteredResults]);

    const wardData = wards.find((w) => w.id === selectedWardId);

    return (
        <div className="flex flex-col gap-5 pb-6">
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{t('Grades')}</h1>
                <p className="text-sm text-slate-500 mt-1">{t('Subject scores by sequence')}</p>
            </header>

            {/* Ward Selector */}
            {wards.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {wards.map((ward) => {
                        const isActive = ward.id === selectedWardId;
                        const initials = `${ward.first_name[0]}${ward.last_name[0]}`.toUpperCase();
                        return (
                            <button
                                key={ward.id}
                                onClick={() => {
                                    setSelectedWardId(ward.id);
                                    setSelectedTerm(null);
                                    setSelectedSequence(null);
                                }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-blue-900 text-white shadow-sm'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    isActive ? 'bg-white/20' : 'bg-slate-100'
                                }`}>
                                    {initials}
                                </span>
                                {ward.first_name}
                            </button>
                        );
                    })}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col gap-3 animate-pulse">
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
                        ))}
                    </div>
                    <div className="h-48 bg-slate-200 rounded-2xl" />
                </div>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                            <p className="text-xs font-semibold text-slate-500 uppercase">{t('Attendance')}</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-1">{wardData?.attendance_percentage != null ? `${wardData.attendance_percentage}%` : '-'}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                            <p className="text-xs font-semibold text-slate-500 uppercase">{t('Subjects')}</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-1">{Object.keys(subjectGroups).length}</p>
                        </div>
                    </div>

                    {/* Term Filters */}
                    {availableTerms.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            <button
                                onClick={() => { setSelectedTerm(null); setSelectedSequence(null); }}
                                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                    selectedTerm === null
                                        ? 'bg-blue-900 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {t('All')}
                            </button>
                            {availableTerms.map(([order, name]) => (
                                <button
                                    key={order}
                                    onClick={() => { setSelectedTerm(order); setSelectedSequence(null); }}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        selectedTerm === order
                                            ? 'bg-blue-900 text-white'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Sequence Filters */}
                    {availableSequences.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedSequence(null)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedSequence === null
                                        ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {t('All sequences')}
                            </button>
                            {availableSequences.map(([key, seq]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedSequence(seq.order)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                        selectedSequence === seq.order
                                            ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {seq.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Subject Breakdown */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                        <h2 className="font-bold text-slate-900 mb-4">
                            {selectedTerm !== null && selectedSequence !== null
                                ? `${availableTerms.find(t => t[0] === selectedTerm)?.[1] || ''} - ${availableSequences.find(s => s[1].order === selectedSequence)?.[1].name || ''}`
                                : selectedTerm !== null
                                    ? `${availableTerms.find(t => t[0] === selectedTerm)?.[1] || ''}`
                                    : t('All Results')
                            }
                        </h2>
                        {Object.keys(subjectGroups).length === 0 ? (
                            <div className="text-center py-8">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">analytics</span>
                                <p className="text-sm text-slate-500">{t('No grades available for this selection')}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(subjectGroups).map(([name, data]) => {
                                    const latestScore = data.latest_score;
                                    const pct = Math.min(100, (latestScore / scaleMax) * 100);
                                    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500';
                                    const trend = subjectTrends[name];
                                    return (
                                        <div key={name}>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">{name}</span>
                                                    {trend === 'up' && (
                                                        <span className="material-symbols-outlined text-emerald-500 text-sm">trending_up</span>
                                                    )}
                                                    {trend === 'down' && (
                                                        <span className="material-symbols-outlined text-red-500 text-sm">trending_down</span>
                                                    )}
                                                    {trend === 'stable' && (
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">trending_flat</span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold text-blue-900">{latestScore} / {scaleMax}</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                            {data.scores.length > 1 && (
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {t('{{count}} scores recorded', { count: data.scores.length })}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ParentAnalytics;
