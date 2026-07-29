import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

interface CurrentClass {
  id: string;
  name: string;
  subject: string;
  room: string;
  endsInMinutes: number;
  startTime: string;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  classroom?: string;
  class_details?: { name: string };
  subject_details?: { name: string };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

function getSmartInterval(nowMinutes: number, todaySlots: TimeSlot[]): number {
  const firstSlot = todaySlots[0];
  const lastSlot = todaySlots[todaySlots.length - 1];
  const firstStart = timeToMinutes(firstSlot.start_time);
  const lastEnd = timeToMinutes(lastSlot.end_time);

  // Before first class of the day
  if (nowMinutes < firstStart) {
    const minsUntilFirst = firstStart - nowMinutes;
    if (minsUntilFirst <= 15) return 30_000;      // 30s - class about to start
    if (minsUntilFirst <= 30) return 60_000;      // 1 min
    if (minsUntilFirst <= 60) return 120_000;     // 2 min
    return 300_000;                                // 5 min - far from class
  }

  // After last class of the day
  if (nowMinutes >= lastEnd) {
    return 0; // No more classes today, stop polling
  }

  // Between classes - check proximity to next upcoming slot
  const nextSlot = todaySlots.find(s => timeToMinutes(s.start_time) > nowMinutes);
  if (nextSlot) {
    const nextStart = timeToMinutes(nextSlot.start_time);
    const minsUntilNext = nextStart - nowMinutes;
    if (minsUntilNext <= 5) return 30_000;
    if (minsUntilNext <= 15) return 60_000;
    if (minsUntilNext <= 30) return 120_000;
    return 300_000;
  }

  // Currently in class
  return 60_000;
}

function computeClassData(slot: TimeSlot, now: Date): CurrentClass {
  const [eh, em] = slot.end_time.split(':').map(Number);
  const endTime = new Date(now);
  endTime.setHours(eh, em, 0, 0);
  const diffMs = endTime.getTime() - now.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));

  return {
    id: slot.id,
    name: slot.class_details?.name || 'Class',
    subject: slot.subject_details?.name || 'Subject',
    room: slot.classroom || '',
    endsInMinutes: diffMins,
    startTime: slot.start_time,
  };
}

export function useCurrentClass() {
  const [currentClass, setCurrentClass] = useState<CurrentClass | null>(null);
  const [nextClass, setNextClass] = useState<CurrentClass | null>(null);
  const [loading, setLoading] = useState(true);
  const slotsRef = useRef<TimeSlot[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evaluate = useCallback(() => {
    const slots = slotsRef.current;
    if (slots.length === 0) {
      setCurrentClass(null);
      setNextClass(null);
      setLoading(false);
      return;
    }

    const now = new Date();
    const day = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const currentTime = minutesToTimeStr(nowMinutes);

    const todaySlots = slots
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (todaySlots.length === 0) {
      setCurrentClass(null);
      setNextClass(null);
      setLoading(false);
      return;
    }

    // Find active slot (in progress)
    const activeSlot = todaySlots.find(
      (s) => s.start_time <= currentTime && s.end_time > currentTime
    );

    if (activeSlot) {
      setCurrentClass(computeClassData(activeSlot, now));
    } else {
      setCurrentClass(null);
    }

    // Find next upcoming slot
    const upNext = todaySlots.find((s) => s.start_time > currentTime);
    if (upNext) {
      setNextClass({
        id: upNext.id,
        name: upNext.class_details?.name || 'Class',
        subject: upNext.subject_details?.name || 'Subject',
        room: upNext.classroom || '',
        endsInMinutes: 0,
        startTime: upNext.start_time,
      });
    } else {
      setNextClass(null);
    }

    setLoading(false);

    // Schedule next poll
    const interval = getSmartInterval(nowMinutes, todaySlots);
    if (interval > 0) {
      timerRef.current = setTimeout(() => {
        evaluate();
      }, interval);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchAndStart = async () => {
      try {
        const response = await api.get('/timetable/time-slots/');
        if (cancelled) return;
        slotsRef.current = response.data.results || response.data || [];
      } catch (error) {
        console.error('Failed to fetch timetable:', error);
      } finally {
        if (!cancelled) evaluate();
      }
    };

    fetchAndStart();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [evaluate]);

  return { currentClass, nextClass, loading };
}
