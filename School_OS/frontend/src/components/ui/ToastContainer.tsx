import { useToastStore } from '../../stores/toastStore';
import { ShieldAlert, ShieldCheck, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md transform transition-all duration-300 animate-in slide-in-from-right-8 ${
              isSuccess 
                ? 'bg-secondary/10 border-secondary/20 text-on-surface' 
                : isError
                  ? 'bg-error-container/90 border-error/20 text-on-error-container'
                  : 'bg-surface-container-highest border-outline-variant/30 text-on-surface'
            }`}
             style={{ minWidth: '320px' }}
          >
            {isSuccess && <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />}
            {isError && <ShieldAlert className="w-5 h-5 text-error shrink-0" />}
            {!isSuccess && !isError && <Info className="w-5 h-5 text-primary shrink-0" />}
            
            <span className="text-sm font-bold tracking-tight pr-6">{toast.message}</span>
            
            <button
              onClick={() => removeToast(toast.id)}
              className={`absolute right-4 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity ${isError ? 'text-error' : 'text-on-surface-variant'}`}
            >
               <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
