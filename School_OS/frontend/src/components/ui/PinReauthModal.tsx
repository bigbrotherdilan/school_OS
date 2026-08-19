import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface PinReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
  subtitle?: string;
}

export default function PinReauthModal({
  isOpen,
  onClose,
  onVerified,
  title = 'Verify Your PIN',
  subtitle = 'Enter your 6-digit PIN to continue',
}: PinReauthModalProps) {
  const { t } = useTranslation('ui');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
      setDigits(['', '', '', '', '', '']);
      setError('');
      setIsVerifying(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const verifyPin = useCallback(async (pin: string) => {
    setIsVerifying(true);
    setError('');
    try {
      await api.post('/auth/pin/verify/', { pin });
      onVerified();
      onClose();
    } catch (err: any) {
      const detail = err.response?.data?.detail || t('Incorrect PIN. Please try again.');
      setError(detail);
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setIsVerifying(false);
    }
  }, [onVerified, onClose]);

  const handleChange = (index: number, value: string) => {
    if (isVerifying) return;
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    const single = value.slice(-1);
    newDigits[index] = single;
    setDigits(newDigits);
    setError('');

    if (single && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every(d => d !== '')) {
      verifyPin(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (isVerifying) return;
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isVerifying) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);

    const nextEmpty = newDigits.findIndex(d => d === '');
    const focusIdx = nextEmpty === -1 ? 5 : nextEmpty;
    inputRefs.current[focusIdx]?.focus();

    if (newDigits.every(d => d !== '')) {
      verifyPin(newDigits.join(''));
    }
  };

  const pin = digits.join('');
  const isComplete = pin.length === 6;

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`bg-surface-container-lowest border border-outline-variant/20 shadow-2xl rounded-3xl w-full max-w-sm p-8 flex flex-col items-center text-center transition-all duration-200 ${
            isAnimating
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Shield Icon */}
          <div className="w-16 h-16 rounded-full bg-primary-container border border-primary/20 flex items-center justify-center mb-6 shadow-md">
            <span className="material-symbols-outlined text-3xl text-primary">
              shield
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-black text-on-surface tracking-tight mb-2">
            {t(title)}
          </h2>

          {/* Subtitle */}
          <p className="text-on-surface-variant text-sm font-medium leading-relaxed px-2 mb-8">
            {t(subtitle)}
          </p>

          {/* PIN Input */}
          <div className="flex gap-3 mb-4">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={isVerifying}
                className={`w-12 h-14 text-center text-xl font-black bg-surface-container-highest border-2 rounded-xl transition-all duration-150 outline-none shadow-inner
                  ${error
                    ? 'border-error focus:border-error focus:ring-4 focus:ring-error/20'
                    : digit
                      ? 'border-primary bg-primary/5 focus:border-primary focus:ring-4 focus:ring-primary/20'
                      : 'border-transparent focus:border-primary focus:ring-4 focus:ring-primary/20'
                  }
                  disabled:opacity-50`}
              />
            ))}
          </div>

          {/* Error Message */}
          <div className="h-6 mb-2">
            {error && (
              <p className="text-error text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onClose}
              disabled={isVerifying}
              className="flex-1 py-3 px-6 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface-variant font-black text-[10px] uppercase tracking-widest hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              {t('Cancel')}
            </button>
            <button
              onClick={() => verifyPin(pin)}
              disabled={!isComplete || isVerifying}
              className="flex-1 py-3 px-6 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isVerifying ? (
                <span className="material-symbols-outlined animate-spin text-lg">sync</span>
              ) : (
                t('Verify')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
