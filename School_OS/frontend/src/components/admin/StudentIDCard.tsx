/**
 * StudentIDCard - Premium two-sided ID card preview component.
 * Renders front and back at CR80 standard size (85.6mm × 53.98mm).
 * Fully style-aware with position, size, and layout controls.
 */
import { useTranslation } from 'react-i18next';

export interface IDCardStyle {
  // Colors
  primary_color: string;
  dark_navy_color: string;
  accent_color: string;
  bg_color: string;

  // Card
  card_border_radius: number;

  // Geometric Background
  show_geometric_bg: boolean;
  geo_top_pct: number;
  geo_dark_opacity: number;

  // Gold Stripe
  show_gold_stripe: boolean;
  stripe_top_pct: number;
  stripe_angle: number;
  stripe_width_pct: number;

  // Logo
  logo_size: number;

  // School Name
  school_name_size: number;

  // Photo
  photo_shape: 'rounded' | 'circle' | 'square';
  photo_width: number;
  photo_height: number;
  photo_top_pct: number;
  photo_border_width: number;
  photo_border_color: string;

  // Student Info
  student_name_size: number;
  show_class: boolean;
  show_id_number: boolean;
  show_gold_divider: boolean;

  // Motto
  show_motto: boolean;

  // Footer
  show_footer: boolean;
  footer_height: number;

  // Back side
  show_qr_code: boolean;
  qr_size: number;
  show_terms: boolean;
  show_back_footer: boolean;
  back_footer_height: number;
}

export const DEFAULT_CARD_STYLE: IDCardStyle = {
  primary_color: '#0B2348',
  dark_navy_color: '#081A36',
  accent_color: '#F2B01E',
  bg_color: '#FFFFFF',

  card_border_radius: 18,

  show_geometric_bg: true,
  geo_top_pct: 18,
  geo_dark_opacity: 0.6,

  show_gold_stripe: true,
  stripe_top_pct: 20,
  stripe_angle: -12,
  stripe_width_pct: 40,

  logo_size: 44,

  school_name_size: 11,

  photo_shape: 'rounded',
  photo_width: 72,
  photo_height: 82,
  photo_top_pct: 36,
  photo_border_width: 3,
  photo_border_color: '#FFFFFF',

  student_name_size: 13,
  show_class: true,
  show_id_number: true,
  show_gold_divider: true,

  show_motto: true,

  show_footer: true,
  footer_height: 24,

  show_qr_code: true,
  qr_size: 62,
  show_terms: true,
  show_back_footer: true,
  back_footer_height: 38,
};

export interface StudentIDCardData {
  school_name: string;
  school_logo?: string;
  school_motto?: string;
  school_website?: string;
  school_address?: string;
  school_phone?: string;
  school_email?: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  gender: string;
  date_of_birth: string;
  blood_group?: string;
  emergency_contact?: string;
  photo_url?: string;
  academic_year?: string;
}

function StudentIDCardFront({ data, style }: { data: StudentIDCardData; style: IDCardStyle }) {
  const { t } = useTranslation('adminStaffOps');
  const s = style;
  const CARD_W = 340;
  const CARD_H = 213;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: s.card_border_radius,
        background: s.bg_color,
        boxShadow: '0 12px 32px rgba(0,0,0,.18)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Geometric Background ── */}
      {s.show_geometric_bg && (
        <>
          <div
            className="absolute"
            style={{
              top: `${s.geo_top_pct}%`,
              left: '-10%',
              width: '130%',
              height: '85%',
              background: s.primary_color,
              clipPath: 'polygon(0 18%, 100% 0, 100% 100%, 0 100%)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: `${s.geo_top_pct + 4}%`,
              left: '-5%',
              width: '120%',
              height: '80%',
              background: s.dark_navy_color,
              clipPath: 'polygon(0 22%, 100% 5%, 100% 100%, 0 100%)',
              opacity: s.geo_dark_opacity,
            }}
          />
        </>
      )}

      {/* ── Gold Diagonal Stripe ── */}
      {s.show_gold_stripe && (
        <div
          className="absolute"
          style={{
            top: `${s.stripe_top_pct}%`,
            left: '5%',
            width: `${s.stripe_width_pct}%`,
            height: 2.5,
            background: s.accent_color,
            transform: `rotate(${s.stripe_angle}deg)`,
            transformOrigin: 'left center',
          }}
        />
      )}

      {/* ── Header: Logo + School Name ── */}
      <div
        className="relative flex items-start justify-between"
        style={{ padding: '14px 18px 0', zIndex: 10 }}
      >
        <div className="flex items-center gap-2.5">
          {data.school_logo ? (
            <img
              src={data.school_logo}
              alt={t('School Logo')}
              style={{ width: s.logo_size, height: s.logo_size, borderRadius: 8, objectFit: 'contain' }}
            />
          ) : (
            <div
              style={{
                width: s.logo_size,
                height: s.logo_size,
                borderRadius: 8,
                background: s.primary_color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: s.accent_color, fontSize: s.logo_size * 0.4, fontWeight: 800 }}>
                {data.school_name?.charAt(0) || 'S'}
              </span>
            </div>
          )}
          <div>
            <div
              style={{
                fontSize: s.school_name_size,
                fontWeight: 800,
                color: s.primary_color,
                letterSpacing: '0.5px',
                lineHeight: 1.15,
                textTransform: 'uppercase',
              }}
            >
              {data.school_name?.split('\n')[0] || data.school_name}
            </div>
            {data.school_name?.split('\n')[1] && (
              <div
                style={{
                  fontSize: s.school_name_size - 3,
                  fontWeight: 600,
                  color: s.primary_color,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}
              >
                {data.school_name.split('\n')[1]}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Motto ── */}
      {data.school_motto && s.show_motto && (
        <div
          className="relative text-right"
          style={{
            padding: '2px 18px 0',
            zIndex: 10,
            fontSize: 7,
            fontWeight: 500,
            color: '#5E6472',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}
        >
          {data.school_motto}
        </div>
      )}

      {/* ── Student Photo ── */}
      <div
        className="relative flex justify-center"
        style={{ marginTop: (s.photo_top_pct / 100) * CARD_H * 0.3, zIndex: 10 }}
      >
        <div
          style={{
            width: s.photo_width,
            height: s.photo_height,
            borderRadius: s.photo_shape === 'circle' ? s.photo_width / 2 : s.photo_shape === 'rounded' ? 10 : 2,
            border: `${s.photo_border_width}px solid ${s.photo_border_color}`,
            boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            overflow: 'hidden',
            background: '#F6F7F9',
          }}
        >
          {data.photo_url ? (
            <img
              src={data.photo_url}
              alt={data.student_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#D9DDE5',
              }}
            >
              <span style={{ fontSize: s.photo_width * 0.33, color: '#5E6472', fontWeight: 700 }}>
                {data.student_name?.charAt(0) || '?'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Student Info ── */}
      <div
        className="relative text-center"
        style={{ marginTop: 6, zIndex: 10 }}
      >
        <div
          style={{
            fontSize: s.student_name_size,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            lineHeight: 1.2,
          }}
        >
          {data.student_name}
        </div>

        {s.show_class && (
          <div
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: '#FFFFFF',
              opacity: 0.85,
              marginTop: 1,
            }}
          >
            {data.class_name}
          </div>
        )}

        {s.show_gold_divider && (
          <div
            className="mx-auto"
            style={{
              width: 80,
              height: 1.5,
              background: s.accent_color,
              marginTop: 4,
              borderRadius: 1,
            }}
          />
        )}

        {s.show_id_number && (
          <>
            <div
              style={{
                fontSize: 6.5,
                fontWeight: 600,
                color: '#FFFFFF',
                opacity: 0.7,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              {t('ID No.')}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '1px',
                marginTop: 1,
              }}
            >
              {data.admission_number}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {s.show_footer && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5"
          style={{
            height: s.footer_height,
            background: '#FFFFFF',
            clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 100%)',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 9 }}>🌐</span>
          <span
            style={{
              fontSize: 7,
              fontWeight: 600,
              color: s.primary_color,
              letterSpacing: '0.3px',
            }}
          >
            {data.school_website || data.school_email || ''}
          </span>
        </div>
      )}
    </div>
  );
}


function StudentIDCardBack({ data, style }: { data: StudentIDCardData; style: IDCardStyle }) {
  const { t } = useTranslation('adminStaffOps');
  const s = style;

  const detailRows = [
    { icon: '👤', label: 'Name', value: data.student_name },
    { icon: '📅', label: 'Date of Birth', value: data.date_of_birth || '-' },
    { icon: '🩸', label: 'Blood Group', value: data.blood_group || '-' },
    { icon: '📞', label: 'Emergency Contact', value: data.emergency_contact || '-' },
  ];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 340,
        height: 213,
        borderRadius: s.card_border_radius,
        background: '#FFFFFF',
        boxShadow: '0 12px 32px rgba(0,0,0,.18)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Header: School Name ── */}
      <div
        className="text-center"
        style={{ padding: '14px 18px 0', zIndex: 10, position: 'relative' }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: s.primary_color,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          {data.school_name}
        </div>
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 6 }}>
          <div style={{ flex: 1, height: 0.75, background: '#D9DDE5' }} />
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: s.primary_color,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, height: 0.75, background: '#D9DDE5' }} />
        </div>
      </div>

      {/* ── Student Details + QR Code ── */}
      <div
        className="relative flex"
        style={{ padding: '10px 18px 0', gap: 12, zIndex: 10 }}
      >
        <div style={{ flex: 1 }}>
          {detailRows.map((row) => (
            <div key={row.label} className="flex items-center" style={{ marginBottom: 8, gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: s.primary_color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  flexShrink: 0,
                }}
              >
                {row.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 6.5,
                    fontWeight: 600,
                    color: '#5E6472',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    lineHeight: 1,
                  }}
                >
                  {t(row.label)}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: s.primary_color,
                    lineHeight: 1.2,
                    marginTop: 1,
                  }}
                >
                  {row.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {s.show_qr_code && (
          <div
            className="flex flex-col items-center"
            style={{ flexShrink: 0, paddingTop: 2 }}
          >
            <div
              style={{
                width: s.qr_size,
                height: s.qr_size,
                border: '1.5px solid #D9DDE5',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FFFFFF',
                position: 'relative',
              }}
            >
              <svg width={s.qr_size * 0.77} height={s.qr_size * 0.77} viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="14" height="14" rx="2" fill={s.primary_color} />
                <rect x="7" y="7" width="8" height="8" rx="1" fill="#FFFFFF" />
                <rect x="9" y="9" width="4" height="4" rx="0.5" fill={s.primary_color} />
                <rect x="30" y="4" width="14" height="14" rx="2" fill={s.primary_color} />
                <rect x="33" y="7" width="8" height="8" rx="1" fill="#FFFFFF" />
                <rect x="35" y="9" width="4" height="4" rx="0.5" fill={s.primary_color} />
                <rect x="4" y="30" width="14" height="14" rx="2" fill={s.primary_color} />
                <rect x="7" y="33" width="8" height="8" rx="1" fill="#FFFFFF" />
                <rect x="9" y="35" width="4" height="4" rx="0.5" fill={s.primary_color} />
                <rect x="22" y="4" width="4" height="4" fill={s.primary_color} />
                <rect x="22" y="12" width="4" height="4" fill={s.primary_color} />
                <rect x="22" y="22" width="4" height="4" fill={s.primary_color} />
                <rect x="4" y="22" width="4" height="4" fill={s.primary_color} />
                <rect x="12" y="22" width="4" height="4" fill={s.primary_color} />
                <rect x="30" y="22" width="4" height="4" fill={s.primary_color} />
                <rect x="38" y="22" width="4" height="4" fill={s.primary_color} />
                <rect x="22" y="30" width="4" height="4" fill={s.primary_color} />
                <rect x="30" y="30" width="4" height="4" fill={s.primary_color} />
                <rect x="38" y="30" width="4" height="4" fill={s.primary_color} />
                <rect x="22" y="38" width="4" height="4" fill={s.primary_color} />
                <rect x="30" y="38" width="4" height="4" fill={s.primary_color} />
                <rect x="38" y="38" width="4" height="4" fill={s.primary_color} />
              </svg>
            </div>
            <div
              style={{
                fontSize: 6,
                fontWeight: 500,
                color: '#5E6472',
                marginTop: 3,
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {t('Scan for School Info')}
            </div>
          </div>
        )}
      </div>

      {/* ── Terms & Conditions ── */}
      {s.show_terms && (
        <div style={{ padding: '6px 18px 0', position: 'relative', zIndex: 10 }}>
          <div style={{ height: 0.5, background: '#D9DDE5', marginBottom: 5 }} />
          <div style={{ fontSize: 7, fontWeight: 700, color: s.primary_color, marginBottom: 3 }}>
            {t('Terms & Conditions')}
          </div>
          <div style={{ fontSize: 6, color: '#5E6472', lineHeight: 1.5 }}>
            {t('• This ID card is the property of the school.')}{' '}
            {t('• Carry it at all times.')}{' '}
            {t('• Report loss immediately.')}{' '}
            {t('• Non-transferable.')}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      {s.show_back_footer && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: s.back_footer_height,
            background: s.primary_color,
            clipPath: 'polygon(0 35%, 100% 0, 100% 100%, 0 100%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'flex-end',
            padding: '0 18px 8px',
          }}
        >
          <div
            className="absolute"
            style={{
              top: 0,
              right: 0,
              width: 0,
              height: 0,
              borderLeft: '16px solid transparent',
              borderTop: `16px solid ${s.accent_color}`,
            }}
          />
          <div className="flex justify-between w-full" style={{ paddingTop: 10 }}>
            <div style={{ flex: 1 }}>
              {data.school_address && (
                <div style={{ fontSize: 6.5, color: '#FFFFFF', lineHeight: 1.4, opacity: 0.9 }}>
                  📍 {data.school_address}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flex: 1 }}>
              {data.school_phone && (
                <div style={{ fontSize: 6.5, color: '#FFFFFF', opacity: 0.9, lineHeight: 1.4 }}>
                  ☎ {data.school_phone}
                </div>
              )}
              {data.school_email && (
                <div style={{ fontSize: 6.5, color: '#FFFFFF', opacity: 0.9, lineHeight: 1.4 }}>
                  ✉ {data.school_email}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function StudentIDCard({
  data,
  side = 'both',
  style,
}: {
  data: StudentIDCardData;
  side?: 'front' | 'back' | 'both';
  style?: Partial<IDCardStyle>;
}) {
  const { t } = useTranslation('adminStaffOps');
  const s = { ...DEFAULT_CARD_STYLE, ...style };

  if (side === 'front') return <StudentIDCardFront data={data} style={s} />;
  if (side === 'back') return <StudentIDCardBack data={data} style={s} />;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#5E6472',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: 8,
          }}
        >
          {t('Front')}
        </div>
        <StudentIDCardFront data={data} style={s} />
      </div>
      <div className="text-center">
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#5E6472',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: 8,
          }}
        >
          {t('Back')}
        </div>
        <StudentIDCardBack data={data} style={s} />
      </div>
    </div>
  );
}

export type { StudentIDCardData as IDCardData };
