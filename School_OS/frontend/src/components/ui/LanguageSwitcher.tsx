import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';

  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-black uppercase tracking-widest">
      <button
        type="button"
        onClick={() => i18n.changeLanguage('en')}
        title="English"
        className={`px-2 py-1 rounded-md transition-colors ${
          current === 'en' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('fr')}
        title="Français"
        className={`px-2 py-1 rounded-md transition-colors ${
          current === 'fr' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        FR
      </button>
    </div>
  );
}