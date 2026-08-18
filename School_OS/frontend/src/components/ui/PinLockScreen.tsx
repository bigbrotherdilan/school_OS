import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { api } from '../../services/api';

interface PinLockScreenProps {
  onUnlock: () => void;
  schoolName?: string;
}

export default function PinLockScreen({ onUnlock, schoolName: schoolNameProp }: PinLockScreenProps) {
  const navigate = useNavigate();
  const { logout, tenants } = useAuthStore();
  const { activeTenantId } = useTenantStore();
  const activeTenant = tenants?.find(t => t.id === activeTenantId);

  const resolvedSchoolName = schoolNameProp || activeTenant?.school_name || 'School OS';
  const initials = resolvedSchoolName
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SOS';

  const [pin, setPin] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, 5));
    setTimeout(() => {
      inputRefs.current[clamped]?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    focusInput(0);
  }, [focusInput]);

  const submitPin = useCallback(async (pinString: string) => {
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/pin/verify/', { pin: pinString });
      onUnlock();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Incorrect PIN. Please try again.';
      setError(detail);
      setPin(['', '', '', '', '', '']);
      focusInput(0);
    } finally {
      setIsLoading(false);
    }
  }, [onUnlock, focusInput]);

  const handleChange = useCallback((index: number, value: string) => {
    if (isLoading) return;

    const digit = value.replace(/\D/g, '').slice(-1);
    if (!digit) return;

    setPin(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (index < 5) {
      focusInput(index + 1);
    } else {
      const newPin = [...pin.slice(0, index), digit];
      if (newPin.every(d => d !== '')) {
        submitPin(newPin.join(''));
      }
    }
  }, [isLoading, pin, focusInput, submitPin]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLoading) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (pin[index]) {
        setPin(prev => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        setPin(prev => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusInput(index + 1);
    }
  }, [isLoading, pin, focusInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isLoading) return;

    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '');
    setPin(next);

    const firstEmpty = next.findIndex(d => d === '');
    const focusIdx = firstEmpty === -1 ? 5 : firstEmpty;
    focusInput(focusIdx);

    if (next.every(d => d !== '')) {
      submitPin(next.join(''));
    }
  }, [isLoading, focusInput, submitPin]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 animate-in fade-in duration-300">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl shadow-black/40">

          {/* Logo / Initials */}
          <div className="flex justify-center mb-6">
            {activeTenant?.logo_url ? (
              <img
                src={activeTenant.logo_url}
                alt={resolvedSchoolName}
                className="w-16 h-16 rounded-2xl object-contain bg-white/10 p-2 shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-white font-black text-xl tracking-tight">{initials}</span>
              </div>
            )}
          </div>

          {/* Welcome */}
          <h1 className="text-center text-xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-center text-sm text-slate-400 mb-8">Enter your PIN to continue</p>

          {/* PIN Inputs */}
          <div className="flex justify-center gap-2.5 mb-6">
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={isLoading}
                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 bg-slate-700/50 text-white transition-all duration-200 outline-none ${
                  digit
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-600/50 focus:border-indigo-400'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-text'} ${error ? 'border-red-500/60' : ''}`}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Error */}
          <div className="h-6 flex items-center justify-center mb-2">
            {error && (
              <p className="text-red-400 text-xs font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </p>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mb-2">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Verifying...
            </div>
          )}

          {/* Use Password Instead */}
          <div className="text-center mt-4">
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium disabled:opacity-40"
            >
              Use password instead
            </button>
          </div>
        </div>

        {/* Branding */}
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-slate-600 mt-6 select-none">
          School OS
        </p>
      </div>
    </div>
  );
}
