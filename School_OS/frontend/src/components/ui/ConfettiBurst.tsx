import { useEffect, useState } from 'react';

interface ConfettiBurstProps {
  active: boolean;
  duration?: number;
  onComplete?: () => void;
}

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#FFC107', '#00BCD4'];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function ConfettiBurst({ active, duration = 1500, onComplete }: ConfettiBurstProps) {
  const [dots, setDots] = useState<{ id: number; x: number; color: string; delay: number; size: number; drift: number }[]>([]);

  useEffect(() => {
    if (!active) {
      setDots([]);
      return;
    }

    const particles = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: randomBetween(10, 90),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: randomBetween(0, 300),
      size: randomBetween(6, 12),
      drift: randomBetween(-30, 30),
    }));
    setDots(particles);

    const timer = setTimeout(() => {
      setDots([]);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [active, duration, onComplete]);

  if (dots.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: '-10px',
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            backgroundColor: dot.color,
            animation: `confetti-fall ${duration}ms ease-out ${dot.delay}ms forwards`,
            '--drift': `${dot.drift}px`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
