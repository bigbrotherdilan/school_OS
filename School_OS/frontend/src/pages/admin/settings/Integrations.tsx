import { useNavigate } from 'react-router-dom';
import {
  Mail,
  ShieldCheck,
  MessageSquareText,
  GraduationCap,
  Video,
  Wallet,
  ArrowUpRight,
  Lock,
  Plug,
} from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';

type Status = 'connected' | 'available' | 'coming_soon';

interface Integration {
  icon: typeof Mail;
  name: string;
  description: string;
  status: Status;
  route?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    icon: Mail,
    name: 'Email / SMTP',
    description: 'Send password resets, notifications, and alerts through your own SMTP server.',
    status: 'available',
    route: '/admin/settings/email',
  },
  {
    icon: Wallet,
    name: 'Online Payments',
    description: 'Collect fees via Paystack, Flutterwave, or Stripe right from invoices.',
    status: 'coming_soon',
  },
  {
    icon: MessageSquareText,
    name: 'SMS & WhatsApp',
    description: 'Broadcast announcements and fee reminders to parents via SMS or WhatsApp.',
    status: 'coming_soon',
  },
  {
    icon: GraduationCap,
    name: 'SIS Sync',
    description: 'Synchronize students, classes, and report cards with external SIS platforms.',
    status: 'coming_soon',
  },
  {
    icon: Video,
    name: 'Video Conferencing',
    description: 'Launch live lessons with Zoom or Meet links embedded in the timetable.',
    status: 'coming_soon',
  },
  {
    icon: ShieldCheck,
    name: 'Security & SSO',
    description: 'Sign in staff and parents with Google, Microsoft, or SAML single sign-on.',
    status: 'coming_soon',
  },
];

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  connected: { label: 'Connected', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/50' },
  available: { label: 'Configure', className: 'bg-primary/5 text-primary border-primary/15' },
  coming_soon: { label: 'Coming soon', className: 'bg-surface-container-low text-on-surface-variant/60 border-outline-variant/10' },
};

export default function Integrations() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const handleClick = (integration: Integration) => {
    if (integration.route) {
      navigate(integration.route);
      return;
    }
    addToast(`${integration.name} is coming soon.`, 'info');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Plug className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight">Integrations</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Connect School OS to the tools your school already uses. Only the email integration is live today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          const badge = STATUS_BADGE[integration.status];
          const comingSoon = integration.status === 'coming_soon';

          return (
            <button
              key={integration.name}
              onClick={() => handleClick(integration)}
              className="text-left bg-white rounded-3xl p-6 border border-outline-variant/10 shadow-sm hover:shadow-md hover:border-outline-variant/20 transition-all group flex flex-col gap-4 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-11 h-11 rounded-2xl bg-surface-container-low flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              <div className="space-y-1 flex-1">
                <h2 className="text-sm font-black text-on-surface flex items-center gap-1.5">
                  {integration.name}
                  {comingSoon && <Lock className="w-3 h-3 text-on-surface-variant/40" />}
                </h2>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">{integration.description}</p>
              </div>

              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary">
                {comingSoon ? 'Not available yet' : 'Open settings'}
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-surface-container-low/50 rounded-3xl p-6 border border-outline-variant/5 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Why connect integrations?</span>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Every connection is scoped to your school only. Credentials are encrypted and never shared with other
          tenants. We'll roll out payment gateways and SMS next — watch the changelog.
        </p>
      </div>
    </div>
  );
}
