import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm Action',
  cancelText = 'Abort',
  isDestructive = false
}: ConfirmationModalProps) {
  const { t } = useTranslation('ui');
  if (!isOpen) return null;

  return (
    <Fragment>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-surface-container-lowest border border-outline-variant/20 shadow-2xl rounded-3xl overflow-hidden p-8 flex flex-col items-center text-center">
          
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-md border ${isDestructive ? 'bg-error-container border-error/20' : 'bg-primary-container border-primary/20'}`}>
            <span className={`material-symbols-outlined text-3xl ${isDestructive ? 'text-error' : 'text-primary'}`}>
              {isDestructive ? 'warning' : 'help_center'}
            </span>
          </div>
          
          <h2 className="text-2xl font-black text-on-surface tracking-tight mb-3">
            {title}
          </h2>
          
          <p className="text-on-surface-variant text-sm font-medium leading-relaxed px-4 mb-8">
            {message}
          </p>
          
          <div className="flex gap-4 w-full">
            <button 
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface-variant font-black text-[10px] uppercase tracking-widest hover:bg-surface-container-high transition-colors"
            >
              {t(cancelText)}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-3 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all ${
                isDestructive 
                  ? 'bg-error text-white hover:bg-error/90 shadow-error/20 hover:shadow-error/30' 
                  : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30'
              }`}
            >
              {t(confirmText)}
            </button>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
