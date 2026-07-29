import ChangePasswordCard from '../../components/ui/ChangePasswordCard';

export default function BursarSettings() {
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account preferences</p>
      </header>

      <ChangePasswordCard />
    </div>
  );
}
