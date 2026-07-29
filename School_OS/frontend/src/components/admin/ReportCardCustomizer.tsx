import { useState } from 'react';
import { api } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';
import type { ReportCardStyle } from './ReportCardPreview';
import { DEFAULT_REPORT_CARD_STYLE } from './ReportCardPreview';

interface ReportCardCustomizerProps {
  style: ReportCardStyle;
  onChange: (style: ReportCardStyle) => void;
  templates: any[];
  onTemplateLoad: (style: ReportCardStyle) => void;
  onTemplatesRefresh: () => void;
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-outline-variant/30 cursor-pointer bg-transparent flex-shrink-0" />
      <span className="text-[10px] text-on-surface-variant w-16 truncate">{label}</span>
      <input type="text" value={value}
        onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
        className="flex-1 px-1.5 py-0.5 text-[10px] font-mono bg-surface-container-highest border border-outline-variant/30 rounded text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[10px] text-on-surface-variant">{label}</label>
      <button onClick={() => onChange(!checked)}
        className={`relative w-8 h-[16px] rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-container-highest'}`}>
        <div className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-on-surface-variant w-16 shrink-0 truncate">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-primary h-1" />
      <span className="text-[10px] font-mono text-on-surface-variant w-9 text-right">{value}{unit}</span>
    </div>
  );
}

function Section({ icon, label, children, defaultOpen = false }: {
  icon: string; label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-outline-variant/10 last:border-b-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-1.5 px-1">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] text-primary">{icon}</span>
          <span className="text-[10px] font-semibold text-on-surface uppercase tracking-wider">{label}</span>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant text-sm">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && <div className="pb-2 grid grid-cols-2 gap-x-3 gap-y-1.5 px-1">{children}</div>}
    </div>
  );
}

export default function ReportCardCustomizer({ style, onChange, templates, onTemplateLoad, onTemplatesRefresh }: ReportCardCustomizerProps) {
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const update = (partial: Partial<ReportCardStyle>) => onChange({ ...style, ...partial });

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const activeTenantId = useTenantStore.getState().activeTenantId;
      await api.post('/reports/report-card-templates/', {
        name: templateName.trim(),
        primary_color: style.primary_color,
        secondary_color: style.secondary_color,
        accent_color: style.accent_color,
        style_config: style,
        tenant: activeTenantId,
      });
      setTemplateName('');
      setShowSave(false);
      onTemplatesRefresh();
    } catch (err) {
      console.error('Failed to save template', err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (id: string) => {
    const t = templates.find((t: any) => t.id === id);
    if (t) {
      onTemplateLoad({
        ...DEFAULT_REPORT_CARD_STYLE,
        ...(t.style_config || {}),
        primary_color: t.primary_color || DEFAULT_REPORT_CARD_STYLE.primary_color,
        secondary_color: t.secondary_color || DEFAULT_REPORT_CARD_STYLE.secondary_color,
        accent_color: t.accent_color || DEFAULT_REPORT_CARD_STYLE.accent_color,
      });
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary text-base">palette</span>
        <h2 className="text-xs font-semibold text-on-surface">Report Card Design Studio</h2>
      </div>

      {/* Template bar */}
      <div className="flex gap-1.5 mb-2">
        <select value="" onChange={(e) => { if (e.target.value) handleLoadTemplate(e.target.value); }}
          className="flex-1 px-2 py-1 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface text-[11px] focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">Load template...</option>
          {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={() => onChange(DEFAULT_REPORT_CARD_STYLE)}
          className="px-2 py-1 text-[10px] font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container">
          Reset
        </button>
      </div>

      {/* ── COLORS ── */}
      <Section icon="color_lens" label="Colors" defaultOpen={true}>
        <ColorPicker label="Primary" value={style.primary_color} onChange={(v) => update({ primary_color: v })} />
        <ColorPicker label="Secondary" value={style.secondary_color} onChange={(v) => update({ secondary_color: v })} />
        <ColorPicker label="Accent" value={style.accent_color} onChange={(v) => update({ accent_color: v })} />
        <ColorPicker label="Border" value={style.border_color} onChange={(v) => update({ border_color: v })} />
        <ColorPicker label="Table Header" value={style.table_header_bg} onChange={(v) => update({ table_header_bg: v })} />
        <ColorPicker label="Alt Rows" value={style.table_alt_row_bg} onChange={(v) => update({ table_alt_row_bg: v })} />
        <ColorPicker label="Decision BG" value={style.decision_bg_color} onChange={(v) => update({ decision_bg_color: v })} />
        <ColorPicker label="Footer Text" value={style.footer_text_color} onChange={(v) => update({ footer_text_color: v })} />
      </Section>

      {/* ── TYPOGRAPHY ── */}
      <Section icon="text_fields" label="Typography" defaultOpen={true}>
        <div className="col-span-2 flex gap-1">
          {(['times', 'helvetica'] as const).map((ff) => (
            <button key={ff} onClick={() => update({ header_font: ff })}
              className={`flex-1 py-1 px-2 text-[10px] font-medium rounded border transition-all capitalize ${
                style.header_font === ff
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
              }`}>
              {ff}
            </button>
          ))}
        </div>
        <Slider label="Title" value={style.title_font_size} min={8} max={16} step={0.5} unit="pt" onChange={(v) => update({ title_font_size: v })} />
        <Slider label="Header" value={style.header_font_size} min={5} max={10} step={0.5} unit="pt" onChange={(v) => update({ header_font_size: v })} />
        <Slider label="Body" value={style.body_font_size} min={5} max={9} step={0.5} unit="pt" onChange={(v) => update({ body_font_size: v })} />
        <Slider label="Table" value={style.table_font_size} min={4} max={8} step={0.5} unit="pt" onChange={(v) => update({ table_font_size: v })} />
        <Slider label="Info" value={style.info_font_size} min={5} max={10} step={0.5} unit="pt" onChange={(v) => update({ info_font_size: v })} />
      </Section>

      {/* ── PAGE ── */}
      <Section icon="crop" label="Page">
        <Toggle label="Page border" checked={style.show_page_border} onChange={(v) => update({ show_page_border: v })} />
        {style.show_page_border && (
          <Slider label="Border width" value={style.page_border_width} min={0.5} max={3} step={0.25} unit="px" onChange={(v) => update({ page_border_width: v })} />
        )}
        <Slider label="Margin" value={style.page_margin_mm} min={4} max={15} unit="mm" onChange={(v) => update({ page_margin_mm: v })} />
      </Section>

      {/* ── HEADER ── */}
      <Section icon="account_balance" label="Header">
        <Toggle label="Show republic header" checked={style.show_republic_header} onChange={(v) => update({ show_republic_header: v })} />
        <Toggle label="Show ministry" checked={style.show_ministry_header} onChange={(v) => update({ show_ministry_header: v })} />
        <Toggle label="Show logo" checked={style.show_logo} onChange={(v) => update({ show_logo: v })} />
        {style.show_logo && (
          <Slider label="Logo size" value={style.logo_size_mm} min={15} max={50} unit="mm" onChange={(v) => update({ logo_size_mm: v })} />
        )}
        <Slider label="Underline" value={style.header_underline_width} min={0.25} max={2} step={0.25} unit="px" onChange={(v) => update({ header_underline_width: v })} />
      </Section>

      {/* ── STUDENT INFO ── */}
      <Section icon="person" label="Student Info">
        <Toggle label="Show section" checked={style.show_student_info} onChange={(v) => update({ show_student_info: v })} />
        {style.show_student_info && (
          <>
            <Toggle label="Alt row colors" checked={style.show_alternating_info_rows} onChange={(v) => update({ show_alternating_info_rows: v })} />
            <Slider label="Row height" value={style.info_row_height_mm} min={0.5} max={3} step={0.25} unit="mm" onChange={(v) => update({ info_row_height_mm: v })} />
          </>
        )}
      </Section>

      {/* ── ACADEMIC TABLE ── */}
      <Section icon="table_chart" label="Academic Table" defaultOpen={true}>
        <Slider label="Border" value={style.table_border_width} min={0.1} max={1} step={0.1} unit="px" onChange={(v) => update({ table_border_width: v })} />
        <Slider label="Outer border" value={style.table_outer_border} min={0.5} max={2} step={0.25} unit="px" onChange={(v) => update({ table_outer_border: v })} />
        <Toggle label="Header background" checked={style.show_table_header_bg} onChange={(v) => update({ show_table_header_bg: v })} />
        <Toggle label="Alt row colors" checked={style.show_alternating_rows} onChange={(v) => update({ show_alternating_rows: v })} />
        <Slider label="Cell padding" value={style.table_row_padding} min={1} max={5} unit="px" onChange={(v) => update({ table_row_padding: v })} />
      </Section>

      {/* ── SECTIONS ── */}
      <Section icon="view_agenda" label="Sections">
        <Toggle label="Discipline" checked={style.show_discipline} onChange={(v) => update({ show_discipline: v })} />
        <Toggle label="Decision" checked={style.show_decision} onChange={(v) => update({ show_decision: v })} />
        {style.show_decision && (
          <Slider label="Decision border" value={style.decision_border_width} min={0.25} max={2} step={0.25} unit="px" onChange={(v) => update({ decision_border_width: v })} />
        )}
        <Toggle label="Signatures" checked={style.show_signatures} onChange={(v) => update({ show_signatures: v })} />
        {style.show_signatures && (
          <Slider label="Signature line" value={style.signature_line_width} min={20} max={60} unit="chars" onChange={(v) => update({ signature_line_width: v })} />
        )}
        <Toggle label="Footer" checked={style.show_footer} onChange={(v) => update({ show_footer: v })} />
        {style.show_footer && (
          <Slider label="Footer size" value={style.footer_font_size} min={4} max={10} step={0.5} unit="pt" onChange={(v) => update({ footer_font_size: v })} />
        )}
      </Section>

      {/* Save template */}
      <div className="pt-1.5 col-span-2">
        <button onClick={() => setShowSave(!showSave)}
          className="w-full py-1 text-[10px] font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
          Save as Template
        </button>
        {showSave && (
          <div className="flex gap-1.5 mt-1.5">
            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-2 py-1 text-[10px] bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()}
              className="px-2.5 py-1 text-[10px] font-medium rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-all">
              {savingTemplate ? '...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
