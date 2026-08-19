import { useTranslation } from 'react-i18next';
import ChangePasswordCard from '../../components/ui/ChangePasswordCard';

export default function BursarSettings() {
  const { t } = useTranslation('parent');
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{t('Settings')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('Manage your account preferences')}</p>
      </header>

      <ChangePasswordCard />
    </div>
  );
}
