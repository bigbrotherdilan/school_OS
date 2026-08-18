import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveState = 'saved' | 'saving' | 'unsaved';

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  saveState: SaveState;
  markDirty: () => void;
  triggerSave: () => void;
  clearPending: () => void;
  resetState: () => void;
}

export function useAutoSave(
  onSave: () => Promise<void>,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const { delay = 2000, enabled = true } = options;
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (saveState !== 'unsaved' || !enabled) return;

    timerRef.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        await onSaveRef.current();
        setSaveState('saved');
      } catch {
        setSaveState('unsaved');
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [saveState, enabled, delay]);

  const markDirty = useCallback(() => {
    setSaveState('unsaved');
  }, []);

  const triggerSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState('saving');
    try {
      await onSaveRef.current();
      setSaveState('saved');
    } catch (err) {
      setSaveState('unsaved');
      throw err;
    }
  }, []);

  const clearPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState('saved');
  }, []);

  return { saveState, markDirty, triggerSave, clearPending, resetState };
}
