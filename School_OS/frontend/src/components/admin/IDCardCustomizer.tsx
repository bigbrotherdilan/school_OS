import { useState } from 'react';
import { api } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';
import type { IDCardStyle } from './StudentIDCard';
import { DEFAULT_CARD_STYLE } from './StudentIDCard';

interface IDCardCustomizerProps {
  style: IDCardStyle;
  onChange: (style: IDCardStyle) => void;
  templates: any[];
  onTemplateLoad: (style: IDCardStyle) => void;
  onTemplatesRefresh: () => void;
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-outline-variant/30 cursor-pointer bg-transparent flex-shrink-0" />
      <span className="text-[10px] text-on-surface-variant w-12 truncate">{label}</span>
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

export default function IDCardCustomizer({ style, onChange, templates, onTemplateLoad, onTemplatesRefresh }: IDCardCustomizerProps) {
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const update = (partial: Partial<IDCardStyle>) => onChange({ ...style, ...partial });

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const activeTenantId = useTenantStore.getState().activeTenantId;
      await api.post('/documents/id-card-templates/', {
        name: templateName.trim(),
        primary_color: style.primary_color,
        secondary_color: '#FFFFFF',
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
        ...DEFAULT_CARD_STYLE,
        ...(t.style_config || {}),
        primary_color: t.primary_color || DEFAULT_CARD_STYLE.primary_color,
        accent_color: t.accent_color || DEFAULT_CARD_STYLE.accent_color,
      });
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary text-base">palette</span>
        <h2 className="text-xs font-semibold text-on-surface">Design Studio</h2>
      </div>
          {/* Template bar */}
          <div className="flex gap-1.5 mb-2">
            <select value="" onChange={(e) => { if (e.target.value) handleLoadTemplate(e.target.value); }}
              className="flex-1 px-2 py-1 bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface text-[11px] focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Load template...</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={() => onChange(DEFAULT_CARD_STYLE)}
              className="px-2 py-1 text-[10px] font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container">
              Reset
            </button>
          </div>

          {/* ── COLORS ── */}
          <Section icon="color_lens" label="Colors" defaultOpen={true}>
            <ColorPicker label="Primary" value={style.primary_color} onChange={(v) => update({ primary_color: v })} />
            <ColorPicker label="Dark Navy" value={style.dark_navy_color} onChange={(v) => update({ dark_navy_color: v })} />
            <ColorPicker label="Accent" value={style.accent_color} onChange={(v) => update({ accent_color: v })} />
          </Section>

          {/* ── BACKGROUND ── */}
          <Section icon="texture" label="Background" defaultOpen={true}>
            <Toggle label="Geometric polygons" checked={style.show_geometric_bg} onChange={(v) => update({ show_geometric_bg: v })} />
            {style.show_geometric_bg && (
              <>
                <Slider label="Cut position" value={style.geo_top_pct} min={5} max={40} unit="%" onChange={(v) => update({ geo_top_pct: v })} />
                <Slider label="Overlay opacity" value={style.geo_dark_opacity} min={0} max={1} step={0.05} onChange={(v) => update({ geo_dark_opacity: v })} />
              </>
            )}
          </Section>

          {/* ── STRIPE ── */}
          <Section icon="linear_scale" label="Stripe">
            <Toggle label="Gold stripe" checked={style.show_gold_stripe} onChange={(v) => update({ show_gold_stripe: v })} />
            {style.show_gold_stripe && (
              <>
                <Slider label="Position" value={style.stripe_top_pct} min={5} max={40} unit="%" onChange={(v) => update({ stripe_top_pct: v })} />
                <Slider label="Angle" value={style.stripe_angle} min={-30} max={0} unit="°" onChange={(v) => update({ stripe_angle: v })} />
                <Slider label="Width" value={style.stripe_width_pct} min={10} max={80} unit="%" onChange={(v) => update({ stripe_width_pct: v })} />
              </>
            )}
          </Section>

          {/* ── HEADER ── */}
          <Section icon="account_balance" label="Header">
            <Slider label="Logo size" value={style.logo_size} min={24} max={60} unit="px" onChange={(v) => update({ logo_size: v })} />
            <Slider label="School name" value={style.school_name_size} min={6} max={16} unit="pt" onChange={(v) => update({ school_name_size: v })} />
          </Section>

          {/* ── PHOTO ── */}
          <Section icon="photo_camera" label="Photo" defaultOpen={true}>
            <div className="col-span-2 flex gap-1">
              {(['rounded', 'circle', 'square'] as const).map((shape) => (
                <button key={shape} onClick={() => update({ photo_shape: shape })}
                  className={`flex-1 py-1 px-2 text-[10px] font-medium rounded border transition-all capitalize ${
                    style.photo_shape === shape
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                  }`}>
                  {shape}
                </button>
              ))}
            </div>
            <Slider label="Width" value={style.photo_width} min={40} max={120} unit="px" onChange={(v) => update({ photo_width: v })} />
            <Slider label="Height" value={style.photo_height} min={40} max={120} unit="px" onChange={(v) => update({ photo_height: v })} />
            <Slider label="Position" value={style.photo_top_pct} min={20} max={55} unit="%" onChange={(v) => update({ photo_top_pct: v })} />
            <Slider label="Border" value={style.photo_border_width} min={0} max={6} unit="px" onChange={(v) => update({ photo_border_width: v })} />
            <ColorPicker label="Border" value={style.photo_border_color} onChange={(v) => update({ photo_border_color: v })} />
          </Section>

          {/* ── TEXT ── */}
          <Section icon="text_fields" label="Text">
            <Slider label="Student name" value={style.student_name_size} min={8} max={18} unit="pt" onChange={(v) => update({ student_name_size: v })} />
            <Toggle label="Show class" checked={style.show_class} onChange={(v) => update({ show_class: v })} />
            <Toggle label="Show ID number" checked={style.show_id_number} onChange={(v) => update({ show_id_number: v })} />
            <Toggle label="Gold divider" checked={style.show_gold_divider} onChange={(v) => update({ show_gold_divider: v })} />
            <Toggle label="School motto" checked={style.show_motto} onChange={(v) => update({ show_motto: v })} />
          </Section>

          {/* ── FRONT FOOTER ── */}
          <Section icon="call_to_action" label="Front Footer">
            <Toggle label="Show footer" checked={style.show_footer} onChange={(v) => update({ show_footer: v })} />
            {style.show_footer && (
              <Slider label="Height" value={style.footer_height} min={16} max={40} unit="px" onChange={(v) => update({ footer_height: v })} />
            )}
          </Section>

          {/* ── CARD ── */}
          <Section icon="crop" label="Card">
            <Slider label="Corner radius" value={style.card_border_radius} min={0} max={30} unit="px" onChange={(v) => update({ card_border_radius: v })} />
          </Section>

          {/* ── BACK SIDE ── */}
          <Section icon="flip_to_back" label="Back Side" defaultOpen={false}>
            <Toggle label="QR code" checked={style.show_qr_code} onChange={(v) => update({ show_qr_code: v })} />
            {style.show_qr_code && (
              <Slider label="QR size" value={style.qr_size} min={40} max={80} unit="px" onChange={(v) => update({ qr_size: v })} />
            )}
            <Toggle label="Terms & conditions" checked={style.show_terms} onChange={(v) => update({ show_terms: v })} />
            <Toggle label="Footer" checked={style.show_back_footer} onChange={(v) => update({ show_back_footer: v })} />
            {style.show_back_footer && (
              <Slider label="Footer height" value={style.back_footer_height} min={20} max={50} unit="px" onChange={(v) => update({ back_footer_height: v })} />
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
