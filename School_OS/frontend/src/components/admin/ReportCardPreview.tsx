import { useTranslation } from 'react-i18next';

export interface ReportCardStyle {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  header_bg_color: string;
  table_header_bg: string;
  table_alt_row_bg: string;
  border_color: string;
  decision_bg_color: string;
  footer_text_color: string;

  header_font: 'times' | 'helvetica';
  header_font_size: number;
  body_font_size: number;
  table_font_size: number;
  title_font_size: number;
  info_font_size: number;

  show_page_border: boolean;
  page_border_width: number;
  page_margin_mm: number;
  show_logo: boolean;
  logo_size_mm: number;

  show_republic_header: boolean;
  show_ministry_header: boolean;
  header_underline_width: number;

  show_student_info: boolean;
  show_alternating_info_rows: boolean;
  info_row_height_mm: number;

  table_border_width: number;
  table_outer_border: number;
  show_alternating_rows: boolean;
  show_table_header_bg: boolean;
  table_row_padding: number;
  group_summary_style: 'merged' | 'inline';

  summary_header_bg: string;
  show_summary_borders: boolean;

  show_discipline: boolean;
  show_decision: boolean;
  decision_border_width: number;

  show_signatures: boolean;
  signature_line_width: number;
  show_footer: boolean;
  footer_font_size: number;
}

export const DEFAULT_REPORT_CARD_STYLE: ReportCardStyle = {
  primary_color: '#1A237E',
  secondary_color: '#283593',
  accent_color: '#F9A825',
  header_bg_color: '#E8EAF6',
  table_header_bg: '#C5CAE9',
  table_alt_row_bg: '#F5F5F5',
  border_color: '#37474F',
  decision_bg_color: '#E8F5E9',
  footer_text_color: '#78909C',

  header_font: 'times',
  header_font_size: 7.5,
  body_font_size: 7,
  table_font_size: 6.5,
  title_font_size: 13,
  info_font_size: 8,

  show_page_border: true,
  page_border_width: 2,
  page_margin_mm: 10,
  show_logo: true,
  logo_size_mm: 32,

  show_republic_header: true,
  show_ministry_header: true,
  header_underline_width: 1.5,

  show_student_info: true,
  show_alternating_info_rows: true,
  info_row_height_mm: 2,

  table_border_width: 0.5,
  table_outer_border: 1.5,
  show_alternating_rows: true,
  show_table_header_bg: true,
  table_row_padding: 3,
  group_summary_style: 'merged',

  summary_header_bg: '#E8EAF6',
  show_summary_borders: true,

  show_discipline: true,
  show_decision: true,
  decision_border_width: 1,

  show_signatures: true,
  signature_line_width: 45,
  show_footer: true,
  footer_font_size: 6.5,
};

interface ReportCardSubject {
  name: string;
  coef: number;
  score: number | null;
  grade: string;
  remarks?: string;
}

interface ReportCardPreviewProps {
  style: ReportCardStyle;
  studentName?: string;
  className?: string;
  admissionNumber?: string;
  termName?: string;
  academicYear?: string;
  dateOfBirth?: string | null;
  repeater?: string;
  subjects?: ReportCardSubject[];
  annualAverage?: number | null;
  classAverage?: number | null;
  bestAverage?: number | null;
  rank?: number | null;
  maxScale?: number;
  decision?: string;
  absences?: number;
  suspensions?: string;
  punishments?: string;
  warning?: string;
}

const FONT_STACK = {
  times: '"Times New Roman", Times, serif',
  helvetica: 'Helvetica, Arial, sans-serif',
};

export default function ReportCardPreview({
  style: st,
  studentName = '',
  className = 'N/A',
  admissionNumber = '',
  termName = '1ST TERM',
  academicYear = '',
  dateOfBirth,
  repeater,
  subjects = [],
  annualAverage,
  classAverage,
  bestAverage,
  rank,
  maxScale = 20,
  decision,
  absences,
  suspensions = '-',
  punishments = '-',
  warning = '-',
}: ReportCardPreviewProps) {
  const { t } = useTranslation('adminStaffOps');
  const font = FONT_STACK[st.header_font];
  const scale = 0.42;
  const previewW = 210 * scale;
  const previewH = 297 * scale;
  const totalCoef = subjects.reduce((s, subj) => s + subj.coef, 0);
  const fmt = (v?: number | null) => (v === undefined || v === null || Number.isNaN(v) ? '-' : v.toFixed(2));
  const rankSuffix = (n: number) =>
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';

function InnerBorderedRow({ children, borderColor, borderWidth }: { children: React.ReactNode; borderColor: string; borderWidth: number }) {
  return (
    <div className="flex" style={{ borderTop: `${Math.max(borderWidth, 0.1)}px solid ${borderColor}` }}>
      {children}
    </div>
  );
}

  return (
    <div
      className="bg-white mx-auto overflow-hidden shadow-xl"
      style={{
        width: `${previewW}mm`,
        minHeight: `${previewH}mm`,
        fontFamily: font,
        border: st.show_page_border ? `${st.page_border_width * 0.5}px solid ${st.border_color}` : 'none',
        borderRadius: '1px',
      }}
    >
      <div style={{ margin: `${st.page_margin_mm * scale}mm` }}>
        {/* ════════════════ HEADER ════════════════ */}
        <div className="flex justify-between items-start" style={{ color: st.primary_color, fontFamily: font }}>
          {/* Left: Republic of Cameroon (EN) */}
          <div className="text-left" style={{ width: '32%' }}>
            {st.show_republic_header && (
              <>
                <div className="font-bold leading-tight" style={{ fontSize: `${st.header_font_size * scale * 2.5}px` }}>
                  {t('REPUBLIC OF CAMEROON')}
                </div>
                <div className="italic" style={{ fontSize: `${st.header_font_size * scale * 2}px`, color: st.secondary_color }}>
                  {t('Peace – Work – Fatherland')}
                </div>
              </>
            )}
          </div>

          {/* Center: Logo + Title */}
          <div className="text-center" style={{ width: '36%' }}>
            {st.show_logo && (
              <div
                className="mx-auto rounded-full flex items-center justify-center text-white font-bold mb-1"
                style={{
                  width: `${st.logo_size_mm * scale * 0.7}mm`,
                  height: `${st.logo_size_mm * scale * 0.7}mm`,
                  backgroundColor: st.primary_color,
                  fontSize: `${st.body_font_size * scale * 1.8}px`,
                  border: `2px solid ${st.accent_color}`,
                  boxShadow: `0 0 0 2px ${st.primary_color}40`,
                }}
              >
                <span style={{ transform: 'scale(1.2)' }}>S</span>
              </div>
            )}
            <div className="font-bold leading-tight mt-1" style={{ fontSize: `${st.title_font_size * scale * 2.2}px`, color: st.primary_color }}>
              {termName}
            </div>
            <div className="font-bold tracking-wide" style={{ fontSize: `${st.title_font_size * scale * 1.8}px`, color: st.accent_color }}>
              {t('REPORT CARD')}
            </div>
            <div className="italic" style={{ fontSize: `${st.header_font_size * scale * 2}px`, color: st.secondary_color }}>
              {t('Academic Year {{year}}', { year: academicYear })}
            </div>
          </div>

          {/* Right: Republic of Cameroon (FR) + Ministry */}
          <div className="text-right" style={{ width: '32%' }}>
            {st.show_republic_header && (
              <>
                <div className="font-bold leading-tight" style={{ fontSize: `${st.header_font_size * scale * 2.5}px` }}>
                  {t('RÉPUBLIQUE DU CAMEROUN')}
                </div>
                <div className="italic" style={{ fontSize: `${st.header_font_size * scale * 2}px`, color: st.secondary_color }}>
                  {t('Paix – Travail – Patrie')}
                </div>
              </>
            )}
            {st.show_ministry_header && (
              <div className="mt-1" style={{ fontSize: `${st.header_font_size * scale * 2}px`, color: st.secondary_color }}>
                <div className="font-bold">{t('MINISTRY OF SECONDARY')}</div>
                <div className="font-bold" style={{ marginTop: '-0.5px' }}>{t('EDUCATION')}</div>
                <div className="italic text-[2.8px]">{t('Regional Delegation')}</div>
              </div>
            )}
          </div>
        </div>

        {/* Gold accent underline */}
        <div
          className="w-full mt-1 mb-2"
          style={{
            height: `${st.header_underline_width * 0.3}px`,
            background: `linear-gradient(90deg, ${st.accent_color}, ${st.primary_color}, ${st.accent_color})`,
          }}
        />

        {/* ════════════════ STUDENT INFO ════════════════ */}
        {st.show_student_info && (
          <div
            className="mb-2"
            style={{
              border: `${st.table_outer_border * 0.3}px solid ${st.border_color}`,
              fontSize: `${st.info_font_size * scale * 2.2}px`,
              color: st.primary_color,
            }}
          >
            <div className="flex" style={{ borderBottom: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>
              <div className="flex-1 p-1" style={st.show_alternating_info_rows ? { backgroundColor: st.table_alt_row_bg } : {}}>
                <span className="font-bold">{t('Class :')}</span> {className}
              </div>
              <div className="flex-1 p-1" style={{ borderLeft: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>
                <span className="font-bold">{t('Class Master :')}</span> _______________
              </div>
            </div>
            <div className="flex" style={{ borderBottom: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>
              <div className="flex-1 p-1">
                <span className="font-bold">{t('Surname & Name :')}</span> {studentName}
              </div>
              <div className="flex-1 p-1" style={{ borderLeft: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>
                <span className="font-bold">{t('Number on roll :')}</span> _______________
              </div>
            </div>
            <div className="flex" style={{ borderBottom: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>
              <div className="flex-1 p-1" style={st.show_alternating_info_rows ? { backgroundColor: st.table_alt_row_bg } : {}}>
                <span className="font-bold">{t('Admission No :')}</span> {admissionNumber}
              </div>
              <div className="flex-1 p-1" style={{ borderLeft: `${st.table_border_width * 0.2}px solid ${st.border_color}`, ...(st.show_alternating_info_rows ? { backgroundColor: st.table_alt_row_bg } : {}) }}>
                <span className="font-bold">{t('Repeater :')}</span> {repeater || '-'}
              </div>
            </div>
            <div className="flex">
              <div className="flex-1 p-1">
                <span className="font-bold">{t('Date of birth :')}</span> {dateOfBirth || '-'}
              </div>
              <div className="flex-1 p-1" style={{ borderLeft: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>
                <span className="font-bold">{t('Tel :')}</span> _______________
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ ACADEMIC TABLE ════════════════ */}
        <div
          className="mb-2"
          style={{
            border: `${st.table_outer_border * 0.3}px solid ${st.border_color}`,
            fontSize: `${st.table_font_size * scale * 2}px`,
            color: st.primary_color,
          }}
        >
          {/* Table Header */}
          <div
            className="flex font-bold text-center"
            style={{
              backgroundColor: st.show_table_header_bg ? st.table_header_bg : 'transparent',
              borderBottom: `${st.table_border_width * 0.25}px solid ${st.border_color}`,
              color: st.primary_color,
            }}
          >
            <div className="py-1 px-1 text-left" style={{ flex: '3', borderRight: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>{t('SUBJECTS')}</div>
            <div className="py-1 px-1" style={{ flex: '0.8', borderRight: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>{t('COEF.')}</div>
            <div className="py-1 px-1" style={{ flex: '1.5', borderRight: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>{termName}</div>
            <div className="py-1 px-1" style={{ flex: '0.8', borderRight: `${st.table_border_width * 0.2}px solid ${st.border_color}` }}>{t('GRADE')}</div>
            <div className="py-1 px-1" style={{ flex: '1.5' }}>{t('REMARKS')}</div>
          </div>

          {/* Subject Rows */}
          {subjects.map((subj, i) => (
            <InnerBorderedRow key={subj.name} borderColor={st.border_color} borderWidth={st.table_border_width * 0.15}>
              <div className="py-0.5 px-1" style={{ flex: '3', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, ...(st.show_alternating_rows && i % 2 === 1 ? { backgroundColor: st.table_alt_row_bg } : {}) }}>
                {subj.name}
              </div>
              <div className="py-0.5 px-1 text-center" style={{ flex: '0.8', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, ...(st.show_alternating_rows && i % 2 === 1 ? { backgroundColor: st.table_alt_row_bg } : {}) }}>
                {subj.coef}
              </div>
              <div className="py-0.5 px-1 text-center font-bold" style={{ flex: '1.5', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, ...(st.show_alternating_rows && i % 2 === 1 ? { backgroundColor: st.table_alt_row_bg } : {}) }}>
                {subj.score ?? '-'}
              </div>
              <div className="py-0.5 px-1 text-center" style={{ flex: '0.8', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, ...(st.show_alternating_rows && i % 2 === 1 ? { backgroundColor: st.table_alt_row_bg } : {}) }}>
                <span style={{ color: subj.grade === 'A' ? '#2E7D32' : subj.grade === 'D' ? '#C62828' : st.primary_color }}>{subj.grade}</span>
              </div>
              <div className="py-0.5 px-1 text-[9px] italic" style={{ flex: '1.5', ...(st.show_alternating_rows && i % 2 === 1 ? { backgroundColor: st.table_alt_row_bg } : {}) }}>
                {subj.remarks || (subj.score && subj.score >= 15 ? t('Excellent') : subj.score && subj.score >= 12 ? t('Good') : subj.score && subj.score >= 10 ? t('Fair') : subj.score ? t('Weak') : '-')}
              </div>
            </InnerBorderedRow>
          ))}

          {/* Total Row */}
          <InnerBorderedRow borderColor={st.border_color} borderWidth={st.table_border_width * 0.4}>
            <div className="py-1 px-1 font-bold" style={{ flex: '3', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, backgroundColor: st.table_header_bg }}>
              {t('TOTAL')}
            </div>
            <div className="py-1 px-1 text-center font-bold" style={{ flex: '0.8', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, backgroundColor: st.table_header_bg }}>
              {totalCoef}
            </div>
            <div className="py-1 px-1 text-center font-bold" style={{ flex: '1.5', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, backgroundColor: st.table_header_bg }}>
              {fmt(annualAverage)}
            </div>
            <div className="py-1 px-1 text-center font-bold" style={{ flex: '0.8', borderRight: `${Math.max(st.table_border_width * 0.15, 0.1)}px solid ${st.border_color}`, backgroundColor: st.table_header_bg }}>
              -
            </div>
            <div className="py-1 px-1 text-center italic" style={{ flex: '1.5', backgroundColor: st.table_header_bg, color: st.secondary_color }}>
              /{maxScale}
            </div>
          </InnerBorderedRow>
        </div>

        {/* ════════════════ ANNUAL SUMMARY ════════════════ */}
        <div
          className="mb-2"
          style={{
            border: st.show_summary_borders ? `${st.table_outer_border * 0.3}px solid ${st.border_color}` : 'none',
            fontSize: `${st.table_font_size * scale * 2}px`,
            color: st.primary_color,
          }}
        >
          <div
            className="font-bold text-center py-0.5"
            style={{
              backgroundColor: st.summary_header_bg,
              borderBottom: st.show_summary_borders ? `${st.table_border_width * 0.2}px solid ${st.border_color}` : 'none',
              letterSpacing: '1px',
            }}
          >
            {t('ANNUAL PERFORMANCE SUMMARY')}
          </div>
          <div className="flex text-center">
            <div className="flex-1 py-1 px-1" style={{ borderRight: st.show_summary_borders ? `${st.table_border_width * 0.15}px solid ${st.border_color}` : 'none', backgroundColor: st.table_header_bg }}>
              <div className="font-bold">{t('{{term}} Av.', { term: termName })}</div>
              <div className="text-lg font-bold" style={{ color: st.accent_color }}>{fmt(annualAverage)}</div>
            </div>
            <div className="flex-1 py-1 px-1" style={{ borderRight: st.show_summary_borders ? `${st.table_border_width * 0.15}px solid ${st.border_color}` : 'none' }}>
              <div className="font-bold">{t('Class Av.')}</div>
              <div className="text-lg font-bold" style={{ color: st.secondary_color }}>{fmt(classAverage)}</div>
            </div>
            <div className="flex-1 py-1 px-1" style={{ borderRight: st.show_summary_borders ? `${st.table_border_width * 0.15}px solid ${st.border_color}` : 'none', backgroundColor: st.table_header_bg }}>
              <div className="font-bold">{t('Best Av.')}</div>
              <div className="text-lg">{fmt(bestAverage)}</div>
            </div>
            <div className="flex-1 py-1 px-1" style={{ borderRight: st.show_summary_borders ? `${st.table_border_width * 0.15}px solid ${st.border_color}` : 'none' }}>
              <div className="font-bold">{t('Rank')}</div>
              <div className="text-lg font-bold" style={{ color: rank !== undefined && rank !== null && rank <= 3 ? '#2E7D32' : st.primary_color }}>
                {rank !== undefined && rank !== null ? <>{rank}<sup>{rankSuffix(rank)}</sup></> : '-'}
              </div>
            </div>
            <div className="flex-1 py-1 px-1" style={{ backgroundColor: st.table_header_bg }}>
              <div className="font-bold">{t('Annual Av.')}</div>
              <div className="text-lg font-bold" style={{ color: st.accent_color }}>{fmt(annualAverage)}</div>
            </div>
          </div>
        </div>

        {/* ════════════════ DISCIPLINE ════════════════ */}
        {st.show_discipline && (
          <div
            className="mb-2"
            style={{
              border: `${st.table_outer_border * 0.3}px solid ${st.border_color}`,
              fontSize: `${st.table_font_size * scale * 2}px`,
              color: st.primary_color,
            }}
          >
            <div
              className="font-bold text-center py-0.5 uppercase tracking-wide"
              style={{
                backgroundColor: st.table_header_bg,
                borderBottom: `${st.table_border_width * 0.2}px solid ${st.border_color}`,
              }}
            >
              {t('Discipline & Conduct')}
            </div>
            <div className="flex text-center">
              <div className="flex-1 py-1" style={{ borderRight: `${st.table_border_width * 0.15}px solid ${st.border_color}` }}>
                <span className="font-bold">{t('Absences :')}</span> {absences ?? '-'}
              </div>
              <div className="flex-1 py-1" style={{ borderRight: `${st.table_border_width * 0.15}px solid ${st.border_color}` }}>
                <span className="font-bold">{t('Suspensions :')}</span> {suspensions}
              </div>
              <div className="flex-1 py-1" style={{ borderRight: `${st.table_border_width * 0.15}px solid ${st.border_color}` }}>
                <span className="font-bold">{t('Punishments :')}</span> {punishments}
              </div>
              <div className="flex-1 py-1">
                <span className="font-bold">{t('Warning :')}</span> {warning}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ DECISION ════════════════ */}
        {st.show_decision && (
          <div
            className="mb-2 font-bold text-center"
            style={{
              border: `${st.decision_border_width * 0.3}px solid ${st.border_color}`,
              backgroundColor: st.decision_bg_color,
              color: st.primary_color,
              fontSize: `${st.body_font_size * scale * 2.2}px`,
              padding: '2px 0',
              letterSpacing: '0.5px',
            }}
          >
            <span style={{ color: '#2E7D32' }}>{t('DECISION :')}</span> {decision || '-'}
          </div>
        )}

        {/* ════════════════ SIGNATURES ════════════════ */}
        {st.show_signatures && (
          <div
            className="flex justify-between mt-2 pt-2"
            style={{
              fontSize: `${st.body_font_size * scale * 2}px`,
              color: st.primary_color,
              borderTop: `${st.table_border_width * 0.2}px dashed ${st.border_color}`,
            }}
          >
            <div className="text-center" style={{ width: '28%' }}>
              <div className="mb-1" style={{ borderTop: `${st.table_border_width * 0.2}px solid ${st.border_color}`, paddingTop: '0.5px', width: `${st.signature_line_width * scale * 1.2}mm` }} />
              <div className="font-bold text-[7px]">{t('CLASS MASTER')}</div>
            </div>
            <div className="text-center" style={{ width: '28%' }}>
              <div className="mb-1" style={{ borderTop: `${st.table_border_width * 0.2}px solid ${st.border_color}`, paddingTop: '0.5px', width: `${st.signature_line_width * scale * 1.2}mm` }} />
              <div className="font-bold text-[7px]">{t("PARENTS' SIGNATURE")}</div>
            </div>
            <div className="text-center" style={{ width: '28%' }}>
              <div className="mb-1" style={{ borderTop: `${st.table_border_width * 0.2}px solid ${st.border_color}`, paddingTop: '0.5px', width: `${st.signature_line_width * scale * 1.2}mm` }} />
              <div className="font-bold text-[7px]">{t('PRINCIPAL')}</div>
            </div>
          </div>
        )}

        {/* ════════════════ FOOTER ════════════════ */}
        {st.show_footer && (
          <div
            className="text-center mt-2"
            style={{
              color: st.footer_text_color,
              fontSize: `${st.footer_font_size * scale * 2}px`,
              borderTop: `0.5px solid ${st.footer_text_color}40`,
              paddingTop: '1px',
            }}
          >
            {t('Generated by School OS — Official Report Card — {{date}}', { date: new Date().toLocaleDateString('en-GB') })}
          </div>
        )}
      </div>
    </div>
  );
}
