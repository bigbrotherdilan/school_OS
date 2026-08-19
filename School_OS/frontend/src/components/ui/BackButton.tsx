import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation('ui');
  const { pathname } = useLocation();
  const target = to ?? (pathname.split('/').slice(0, -1).join('/') || '/admin');

  return (
    <button
      onClick={() => navigate(target)}
      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
    >
      <span className="material-symbols-outlined text-lg">arrow_back</span>
      {t('Back')}
    </button>
  );
}
