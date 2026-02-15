import { useState, useEffect, useCallback, useRef, type MouseEvent, type ReactNode } from 'react';

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
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative',
        width: '100%',
        padding: '5px 8px',
        boxSizing: 'border-box',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 6,
          background: 'var(--slider-track)',
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
    </div>
  );
}

interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  displayValue?: string;
  width?: number | string;
  popoverWidth?: number | string;
  popoverAlign?: 'left' | 'right';
  trigger?: ReactNode;
  footer?: ReactNode;
}

export function Dropdown({ options, value, onChange, displayValue, width, popoverWidth, popoverAlign = 'left', trigger, footer }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div style={{ position: 'relative', width: width ?? '100%' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          height: 40,
          background: open ? 'var(--bg-tertiary)' : 'transparent',
          border: open ? '1px solid var(--accent)' : '1px solid var(--border)',
          borderRadius: 'var(--border-radius)',
          paddingLeft: trigger ? 0 : 12,
          paddingRight: trigger ? 0 : 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: trigger ? 'center' : 'space-between',
          cursor: 'pointer',
          fontFamily: 'var(--font)',
          fontSize: 13,
          color: 'var(--text-primary)',
        }}
      >
        {trigger ?? (
          <>
            <span>{displayValue ?? selected?.label ?? value}</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>
              {open ? '\u25B4' : '\u25BE'}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: '100%',
            ...(popoverAlign === 'right' ? { right: 0 } : { left: 0 }),
            marginTop: 4,
            width: popoverWidth ?? '100%',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxShadow: '0 4px 16px #00000060',
            zIndex: 100,
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 'var(--border-radius)',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? 'var(--accent-on)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 500 : 'normal',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 13,
                }}
              >
                <span>{opt.label}</span>
                {(isSelected || opt.badge) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {opt.badge && (
                      <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{opt.badge}</span>
                    )}
                    {isSelected && <span style={{ fontWeight: 700 }}>&#x2713;</span>}
                  </span>
                )}
              </button>
            );
          })}
          {footer && (
            <>
              <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />
              {footer}
            </>
          )}
        </div>
      )}
    </div>
  );
}
