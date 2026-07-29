import type { ActiveSession } from '../../hooks/useAuthLogin';

interface DeviceLimitDialogProps {
  activeSessions: ActiveSession[];
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeviceLimitDialog({ activeSessions, isLoading, onConfirm, onCancel }: DeviceLimitDialogProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 sm:px-10 rounded-3xl shadow-xl border border-outline-variant/20">
          <div className="text-center mb-6">
            <span className="material-symbols-outlined text-5xl text-amber-500">devices</span>
            <h3 className="text-xl font-bold text-on-surface mt-3">Too Many Active Sessions</h3>
            <p className="text-sm text-on-surface-variant mt-2">
              You are already logged in on {activeSessions.length} device(s).
              Maximum allowed is 2. Confirm to disconnect existing devices and continue.
            </p>
          </div>
          <div className="space-y-3 mb-6">
            {activeSessions.map((s) => (
              <div key={s.id} className="p-4 bg-surface rounded-xl border border-outline-variant/30 flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant mt-0.5">devices_other</span>
                <div className="text-sm">
                  <p className="font-semibold text-on-surface">{s.device_name}</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">IP: {s.ip_address}</p>
                  <p className="text-on-surface-variant text-xs">Last active: {new Date(s.last_active).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-error text-white rounded-xl text-sm font-bold hover:bg-error/90 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                'Disconnect & Login'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}