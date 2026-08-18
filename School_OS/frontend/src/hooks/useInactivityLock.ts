import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useInactivityLock() {
  const [isLocked, setIsLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useAuthStore(s => s.token);
  const pinIsSet = useAuthStore(s => s.pinIsSet);
  const isPinVerificationValid = useAuthStore(s => s.isPinVerificationValid);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!token || !pinIsSet) return;
    if (isPinVerificationValid()) return;

    timerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, INACTIVITY_TIMEOUT);
  }, [token, pinIsSet, isPinVerificationValid]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!token || !pinIsSet) {
      setIsLocked(false);
      return;
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetTimer();

    events.forEach(e => document.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => document.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [token, pinIsSet, resetTimer]);

  return { isLocked, unlock, resetTimer };
}
