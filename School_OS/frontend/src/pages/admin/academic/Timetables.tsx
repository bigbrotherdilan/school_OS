import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../../services/api';
import { useToastStore } from '../../../stores/toastStore';
import { useSectionStore } from '../../../stores/sectionStore';
import { downloadPdf } from '../../../utils/pdf';
import {
  CalendarDays, Wand2, LayoutGrid, Pencil,
  CheckCircle2, AlertTriangle, Printer, FileDown, CheckSquare, Square, RefreshCw
} from 'lucide-react';
import TimetableWizard from './components/wizard/TimetableWizard';
import TimetableGridView from './components/TimetableGridView';
import TimetableSnapshotGrid from './components/TimetableSnapshotGrid';

type View = 'list' | 'wizard' | 'grid';

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  generated: 'bg-blue-100 text-blue-700',
  relaxed:   'bg-amber-100 text-amber-700',
  infeasible:'bg-red-100 text-red-700',
  draft:     'bg-surface-container-highest text-on-surface-variant',
};

const DEFAULT_PERIODS = [
  { start: '07:30', end: '08:20' }, { start: '08:20', end: '09:10' },
  { start: '09:10', end: '10:00' }, { start: '10:30', end: '11:20' },
  { start: '11:20', end: '12:10' }, { start: '12:10', end: '13:00' },
  { start: '13:40', end: '14:30' }, { start: '14:30', end: '15:20' },
  { start: '15:20', end: '16:10' },
];

export default function Timetables() {
  const { addToast } = useToastStore();
  const { activeSectionId } = useSectionStore();
  const allStoreSections = useSectionStore((st: any) => st.sections);

  // ── shared data ──────────────────────────────────────────────────────── //
  const [timetables, setTimetables] = useState<any[]>([]);
  const [years,      setYears]      = useState<any[]>([]);
  const [subjects,   setSubjects]   = useState<any[]>([]);
  const [teachers,   setTeachers]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);

  // ── view state ───────────────────────────────────────────────────────── //
  const [view,       setView]       = useState<View>('list');
  const [selected,   setSelected]   = useState<any>(null);   // timetable for grid view

  // ── class selection (inline view + PDF/print export) ─────────────────── //
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenTick, setRegenTick] = useState(0);

  // ── filters ──────────────────────────────────────────────────────────── //
  const [yearFilter, setYearFilter] = useState<string>('auto');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // Sections derived from the loaded timetables (stable, ordered).
  const sectionNames = useMemo(() => {
    const map = new Map<string, number>();
    for (const tt of timetables) {
      const name = tt.section_name || 'General';
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [timetables]);

  // Default the section filter to the section currently selected in the app
  // (side bar), but only once — the user's own choice is never overridden.
  const sectionDefaulted = useRef(false);
  useEffect(() => {
    if (sectionDefaulted.current) return;
    const active = allStoreSections.find((s: any) => s.id === activeSectionId);
    if (active && sectionNames.some((s: any) => s.name === active.name)) {
      sectionDefaulted.current = true;
      setSectionFilter(active.name);
    }
  }, [sectionNames, allStoreSections, activeSectionId]);

  // ── load all base data ───────────────────────────────────────────────── //
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ttRes, yearsRes, subsRes, tchRes] = await Promise.all([
        api.get('/timetable/timetables/'),
        api.get('/academic/academic-years/'),
        api.get('/academic/subjects/'),
        api.get('/staff/teachers/'),
      ]);
      setTimetables(ttRes.data.results   || ttRes.data);
      setYears(     yearsRes.data.results || yearsRes.data);
      setSubjects(  subsRes.data.results  || subsRes.data);
      setTeachers(  tchRes.data.results   || tchRes.data || []);
    } catch {
      addToast('Failed to load timetable data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [activeSectionId]);

  // ── derived ──────────────────────────────────────────────────────────── //
  const activeYear = useMemo(() => {
    return years.find((y: any) => y.is_active) || years[0];
  }, [years]);

  useEffect(() => {
    if (yearFilter === 'auto' && activeYear) setYearFilter(String(activeYear.id));
  }, [activeYear]);

  const yearId = yearFilter === 'auto' ? String(activeYear?.id || '') : yearFilter;

  const filtered = useMemo(() =>
    timetables.filter((tt: any) => {
      if (yearFilter !== 'all' && String(tt.academic_year) !== yearId) return false;
      if (sectionFilter !== 'all' && (tt.section_name || 'General') !== sectionFilter) return false;
      return true;
    }), [timetables, yearFilter, yearId, sectionFilter]);

  // Timetable used to seed week defaults for the wizard
  const timetableSample = useMemo(() =>
    filtered.find((tt: any) => tt.periods?.length) || filtered[0] || null,
    [filtered]);

  // ── open a class grid ─────────────────────────────────────────────────── //
  const openGrid = async (tt: any) => {
    try {
      const res = await api.get(`/timetable/timetables/${tt.id}/`);
      setSelected(res.data);
      setView('grid');
    } catch {
      addToast('Failed to load timetable.', 'error');
    }
  };

  // ── select classes for inline view / export ───────────────────────────── //
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const allSelected = filtered.length > 0 && filtered.every((tt: any) => selectedIds.includes(tt.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filtered.map((tt: any) => tt.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSnapshots([]);
  };

  // Fetch detail for every selected timetable (kept ordered by class name).
  useEffect(() => {
    let cancelled = false;
    if (selectedIds.length === 0) {
      setSnapshots([]);
      return;
    }
    setLoadingSnapshots(true);
    Promise.all(selectedIds.map((id: string) =>
      api.get(`/timetable/timetables/${id}/`).then(r => r.data).catch(() => null)
    )).then(results => {
      if (cancelled) return;
      setSnapshots(results.filter(Boolean));
      setLoadingSnapshots(false);
    });
    return () => { cancelled = true; };
  }, [selectedIds.join(','), regenTick]);

  // Drop selections that disappeared after a reload.
  useEffect(() => {
    const known = new Set(filtered.map((tt: any) => tt.id));
    setSelectedIds(prev => prev.filter(id => known.has(id)));
  }, [filtered]);

  const handleExportPdf = async () => {
    if (snapshots.length === 0) return;
    setExporting(true);
    try {
      const ids = snapshots.map(s => s.id).join(',');
      const year = snapshots[0].academic_year_name || 'Timetables';
      await downloadPdf(`/timetable/timetables/export_pdf/?ids=${ids}`, `${year}_Timetables.pdf`);
      addToast(`Exported ${snapshots.length} timetable(s) to PDF.`, 'success');
    } catch {
      addToast('PDF export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  // ── regenerate the filtered scope (section or whole year) ──────────────── //
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    if (yearFilter === 'all') {
      addToast('Select a specific academic year to regenerate.', 'info');
      return;
    }
    const scope = sectionFilter === 'all'
      ? `the whole year (${filtered.length} classes)`
      : `the ${sectionFilter} section`;
    const ok = window.confirm(
      `Regenerate ${scope} from the current lessons?\n\n` +
      'All classes are solved together in one pass, so shared teachers are never double-booked. ' +
      'Locked slots stay fixed and committed slots of other sections stay reserved. ' +
      'Published timetables are skipped — unpublish them to include them.'
    );
    if (!ok) return;
    setRegenerating(true);
    try {
      let stream: string | null = null;
      if (sectionFilter !== 'all') {
        const tt = filtered.find((t: any) =>
          (t.section_name || 'General') === sectionFilter && t.class_details?.stream);
        stream = tt?.class_details?.stream ?? null;
      }
      const res = await api.post('/timetable/timetables/generate_school/', {
        academic_year: yearId,
        stream: stream || 'none',
      });
      addToast(res.data.message || 'Timetables regenerated.', 'success');
      if (res.data.skipped?.length) {
        addToast(`Skipped ${res.data.skipped.length} published: ${res.data.skipped.map((s: any) => s.class_name).join(', ')}`, 'info');
      }
      await fetchAll();
      setRegenTick(t => t + 1);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to regenerate timetables.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  // ── wizard completion ─────────────────────────────────────────────────── //
  const handleWizardDone = async (_result: any) => {
    await fetchAll();
    setView('list');
    addToast('Timetables ready. Click any class row to edit the grid.', 'success');
  };

  // ── status badge ─────────────────────────────────────────────────────── //
  const badge = (status: string) => (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
      {status || 'draft'}
    </span>
  );

  const periodsOf = (tt: any) => tt?.periods?.length ? tt.periods : DEFAULT_PERIODS;
  const daysOf    = (tt: any) => tt?.working_days?.length ? tt.working_days : [1,2,3,4,5];

  // ── render ────────────────────────────────────────────────────────────── //
  if (view === 'grid' && selected) {
    return (
      <TimetableGridView
        initialSelected={selected}
        onBack={() => { setView('list'); setSelected(null); fetchAll(); }}
        subjects={subjects}
        teachers={teachers}
      />
    );
  }

  if (view === 'wizard') {
    return (
      <TimetableWizard
        sectionId={activeSectionId || null}
        yearId={yearId}
        timetableSample={timetableSample}
        onDone={handleWizardDone}
        onCancel={() => setView('list')}
      />
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────── //
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Timetables</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Generate and manage class schedules across your school.</p>
        </div>
        <button
          onClick={() => setView('wizard')}
          className="bg-primary text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <Wand2 className="w-4 h-4" /> New Timetable Wizard
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-outline">Academic Year</span>
          <button
            onClick={() => setYearFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${yearFilter === 'all' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            All
          </button>
          {years.map((y: any) => (
            <button
              key={y.id}
              onClick={() => setYearFilter(String(y.id))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${String(y.id) === yearFilter ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              {y.name}
            </button>
          ))}
        </div>

        {sectionNames.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-outline-variant/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline">Section</span>
            <button
              onClick={() => setSectionFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${sectionFilter === 'all' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              All sections
            </button>
            {sectionNames.map((s: any) => (
              <button
                key={s.name}
                onClick={() => setSectionFilter(s.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${sectionFilter === s.name ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                {s.name} <span className="opacity-60">({s.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-on-surface-variant animate-pulse">Loading timetables…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 border-dashed">
          <CalendarDays className="w-12 h-12 text-outline mx-auto mb-4" />
          <p className="font-bold text-on-surface-variant">No timetables match the selected filters.</p>
          <p className="text-sm text-outline mt-1 mb-6">Try another year or section, or use the wizard to set up your school week and generate schedules.</p>
          <button
            onClick={() => setView('wizard')}
            className="bg-primary text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/25 hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Start Wizard
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
                title={allSelected ? 'Clear selection' : 'Select all classes — their timetables are shown below, class by class'}
              >
                {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                {allSelected ? 'Clear all' : 'Select all classes'}
              </button>
              <span className="text-sm font-bold text-on-surface">
                {filtered.length} timetable{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 mr-1">
                  <span className="text-xs font-black text-primary bg-primary/10 rounded-full px-3 py-1">{selectedIds.length} selected</span>
                  <button
                    onClick={handleExportPdf}
                    disabled={exporting || snapshots.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-white shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                    title="Download a PDF with one page per selected class"
                  >
                    <FileDown className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export PDF'}
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={snapshots.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40"
                    title="Print the selected timetables"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
              <span className="text-xs text-outline">{filtered.filter((t: any) => t.generation_status === 'published').length} published</span>
              <span className="text-outline">·</span>
              <span className="text-xs text-outline">{filtered.filter((t: any) => t.generation_status === 'generated').length} generated</span>
              <button
                onClick={handleRegenerate}
                disabled={regenerating || filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all disabled:opacity-40"
                title={sectionFilter === 'all'
                  ? 'Regenerate all classes of this year in one pass (clash-free)'
                  : `Regenerate the whole ${sectionFilter} section in one pass (clash-free)`}
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Solving...' : sectionFilter === 'all' ? 'Regenerate year' : `Regenerate ${sectionFilter}`}
              </button>
            </div>
          </div>

          <div className="divide-y divide-outline-variant/10">
            {filtered.map((tt: any) => {
              const isSel = selectedIds.includes(tt.id);
              return (
              <div
                key={tt.id}
                onClick={() => toggleSelect(tt.id)}
                className={`w-full flex items-center justify-between px-5 py-4 transition-colors text-left group cursor-pointer ${
                  isSel ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-container/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(tt.id); }}
                    className="shrink-0"
                    title={isSel ? 'Deselect this class' : 'Select this class to view / export'}
                  >
                    {isSel
                      ? <CheckSquare className="w-5 h-5 text-primary" />
                      : <Square className="w-5 h-5 text-outline group-hover:text-on-surface-variant" />}
                  </button>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tt.generation_status === 'published' ? 'bg-green-100 text-green-700' :
                    tt.generation_status === 'generated' ? 'bg-blue-100 text-blue-700' :
                    'bg-surface-container text-on-surface-variant'
                  }`}>
                    {tt.generation_status === 'published' ? <CheckCircle2 className="w-4 h-4" /> :
                     tt.generation_status === 'infeasible' ? <AlertTriangle className="w-4 h-4" /> :
                     <LayoutGrid className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{tt.class_name}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {tt.section_name} · {daysOf(tt).length} days × {periodsOf(tt).length} periods
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {badge(tt.generation_status || 'draft')}
                  <button
                    onClick={(e) => { e.stopPropagation(); openGrid(tt); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    title="Open the interactive grid editor for this class"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">›</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected-class timetables — shown immediately, class by class */}
      {selectedIds.length > 0 && (
        <div id="timetable-snapshots" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-on-surface">
                {snapshots.length === 1 ? `${snapshots[0]?.class_name} — weekly timetable` : 'Weekly timetables'}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {snapshots.length === 1
                  ? 'Showing the full weekly grid for this class.'
                  : `Showing ${snapshots.length} classes of the section — scroll down to go class by class.`}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handleExportPdf}
                disabled={exporting || snapshots.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-white shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
              >
                <FileDown className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={handlePrint}
                disabled={snapshots.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>

          {loadingSnapshots ? (
            <div className="text-center py-16 text-on-surface-variant animate-pulse">Loading timetables…</div>
          ) : (
            snapshots.map((tt: any) => (
              <TimetableSnapshotGrid key={tt.id} tt={tt} />
            ))
          )}

          <style>{`
            @media print {
              body * { visibility: hidden; }
              #timetable-snapshots, #timetable-snapshots * { visibility: visible; }
              #timetable-snapshots { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12px; }
              .snapshot-card { break-after: page; page-break-after: always; }
              .snapshot-card:last-child { break-after: auto; page-break-after: auto; }
            }
          `}</style>
        </div>
      )}

      {/* Section summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',     value: filtered.length,                                                              color: 'text-on-surface' },
            { label: 'Generated', value: filtered.filter((t: any) => ['generated','published'].includes(t.generation_status)).length, color: 'text-blue-600' },
            { label: 'Published', value: filtered.filter((t: any) => t.generation_status === 'published').length,     color: 'text-green-600' },
            { label: 'Draft',     value: filtered.filter((t: any) => !t.generation_status || t.generation_status === 'draft').length, color: 'text-outline' },
          ].map(s => (
            <div key={s.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm p-4 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-outline mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
