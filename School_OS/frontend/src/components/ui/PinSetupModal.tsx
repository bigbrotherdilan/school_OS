import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPinIsSet: boolean;
}

type Step = 'current' | 'new' | 'confirm';

export default function PinSetupModal({
  isOpen,
  onClose,
  onSuccess,
  currentPinIsSet,
}: PinSetupModalProps) {
  const [step, setStep] = useState<Step>(currentPinIsSet ? 'current' : 'new');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newDigits, setNewDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const currentRef = useRef<(HTMLInputElement | null)[]>([]);
  const newRef = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRef = useRef<(HTMLInputElement | null)[]>([]);

  const getRefs = () => {
    if (step === 'current') return currentRef;
    if (step === 'new') return newRef;
    return confirmRef;
  };

  const getDigits = () => {
    if (step === 'current') return digits;
    if (step === 'new') return newDigits;
    return confirmDigits;
  };

  const setDigitsForStep = (d: string[]) => {
    if (step === 'current') setDigits(d);
    else if (step === 'new') setNewDigits(d);
    else setConfirmDigits(d);
  };

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
      setDigits(['', '', '', '', '', '']);
      setNewDigits(['', '', '', '', '', '']);
      setConfirmDigits(['', '', '', '', '', '']);
      setStep(currentPinIsSet ? 'current' : 'new');
      setError('');
      setIsSubmitting(false);
      setTimeout(() => {
        const refs = currentPinIsSet ? currentRef : newRef;
        refs.current[0]?.focus();
      }, 50);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentPinIsSet]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const refs = getRefs();
        refs.current[0]?.focus();
      }, 50);
    }
  }, [step, isOpen]);

  const submitNewPin = useCallback(async (currentPin: string, newPin: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/auth/pin/set/', { current_pin: currentPin, new_pin: newPin });
      onSuccess();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to set PIN. Please try again.';
      setError(detail);
      setNewDigits(['', '', '', '', '', '']);
      setConfirmDigits(['', '', '', '', '', '']);
      setStep('new');
      setTimeout(() => newRef.current[0]?.focus(), 50);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSuccess]);

  const handleConfirmComplete = useCallback(async (confirmPin: string) => {
    const newPin = newDigits.join('');
    if (confirmPin !== newPin) {
      setError('PINs do not match. Please try again.');
      setConfirmDigits(['', '', '', '', '', '']);
      setTimeout(() => confirmRef.current[0]?.focus(), 50);
      return;
    }
    const currentPin = currentPinIsSet ? digits.join('') : '';
    await submitNewPin(currentPin, newPin);
  }, [newDigits, digits, currentPinIsSet, submitNewPin]);

  const handleChange = (index: number, value: string) => {
    if (isSubmitting) return;
    if (!/^\d*$/.test(value)) return;

    const refs = getRefs();
    const currentDigits = getDigits();
    const setForStep = setDigitsForStep;

    const newD = [...currentDigits];
    const single = value.slice(-1);
    newD[index] = single;
    setForStep(newD);
    setError('');

    if (single && index < 5) {
      refs.current[index + 1]?.focus();
    }

    if (newD.every(d => d !== '')) {
      const pin = newD.join('');
      if (step === 'current') {
        setStep('new');
      } else if (step === 'new') {
        setStep('confirm');
      } else {
        handleConfirmComplete(pin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (isSubmitting) return;
    const refs = getRefs();
    const currentDigits = getDigits();
    const setForStep = setDigitsForStep;

    if (e.key === 'Backspace' && !currentDigits[index] && index > 0) {
      const newD = [...currentDigits];
      newD[index - 1] = '';
      setForStep(newD);
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isSubmitting) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const refs = getRefs();
    const currentDigits = getDigits();
    const setForStep = setDigitsForStep;

    const newD = [...currentDigits];
    for (let i = 0; i < 6; i++) {
      newD[i] = pasted[i] || '';
    }
    setForStep(newD);

    const nextEmpty = newD.findIndex(d => d === '');
    const focusIdx = nextEmpty === -1 ? 5 : nextEmpty;
    refs.current[focusIdx]?.focus();

    if (newD.every(d => d !== '')) {
      const pin = newD.join('');
      if (step === 'current') {
        setStep('new');
      } else if (step === 'new') {
        setStep('confirm');
      } else {
        handleConfirmComplete(pin);
      }
    }
  };

  const stepConfig = {
    current: { title: 'Current PIN', subtitle: 'Enter your current PIN to continue', icon: 'lock', refs: currentRef },
    new: { title: 'New PIN', subtitle: 'Enter a new 6-digit PIN', icon: 'pin', refs: newRef },
    confirm: { title: 'Confirm PIN', subtitle: 'Re-enter your new PIN to confirm', icon: 'check_circle', refs: confirmRef },
  };

  const cfg = stepConfig[step];
  const currentDigits = getDigits();
  const isComplete = currentDigits.every(d => d !== '');

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`bg-surface-container-lowest border border-outline-variant/20 shadow-2xl rounded-3xl w-full max-w-sm p-8 flex flex-col items-center text-center transition-all duration-200 ${
            isAnimating
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 rounded-full bg-primary-container border border-primary/20 flex items-center justify-center mb-6 shadow-md">
            <span className="material-symbols-outlined text-3xl text-primary">
              {cfg.icon}
            </span>
          </div>

          <h2 className="text-2xl font-black text-on-surface tracking-tight mb-2">
            {cfg.title}
          </h2>

          <p className="text-on-surface-variant text-sm font-medium leading-relaxed px-2 mb-8">
            {cfg.subtitle}
          </p>

          <div className="flex gap-3 mb-4">
            {currentDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { cfg.refs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={isSubmitting}
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

          <div className="h-6 mb-2">
            {error && (
              <p className="text-error text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface-variant font-black text-[10px] uppercase tracking-widest hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {step !== 'current' && (
              <button
                onClick={() => {
                  if (!isComplete || isSubmitting) return;
                  const pin = currentDigits.join('');
                  if (step === 'new') {
                    setStep('confirm');
                  } else {
                    handleConfirmComplete(pin);
                  }
                }}
                disabled={!isComplete || isSubmitting}
                className="flex-1 py-3 px-6 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                ) : step === 'new' ? (
                  'Next'
                ) : (
                  'Set PIN'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
