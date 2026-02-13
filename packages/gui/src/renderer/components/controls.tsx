import { useCallback, useRef, type MouseEvent } from 'react';

export function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 18,
        height: 18,
        borderRadius: 'var(--border-radius)',
        border: '1px solid var(--border)',
        background: checked ? 'var(--accent)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {checked && (
        <span style={{ color: 'var(--accent-on)', fontWeight: 700, fontSize: 12, lineHeight: 1 }}>
          ✓
        </span>
      )}
    </div>
  );
}

export function CustomSlider({ value, min, max, step, disabled, onChange }: {
  value: number; min: number; max: number; step: number; disabled: boolean;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const clampToStep = useCallback((raw: number) => {
    const clamped = Math.max(min, Math.min(max, raw));
    return Math.round(clamped / step) * step;
  }, [min, max, step]);

  const fraction = (value - min) / (max - min);

  const calcValue = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampToStep(min + ratio * (max - min));
  }, [min, max, value, clampToStep]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    const newVal = calcValue(e.clientX);
    onChange(newVal);

    const handleMouseMove = (ev: globalThis.MouseEvent) => {
      onChange(calcValue(ev.clientX));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [disabled, calcValue, onChange]);

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative',
        width: '100%',
        height: 6,
        background: 'var(--slider-track)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {/* Fill bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${fraction * 100}%`,
          height: 6,
          background: 'var(--slider-gradient)',
          pointerEvents: 'none',
        }}
      />
      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          top: -5,
          left: `${fraction * 100}%`,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--slider-thumb)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
