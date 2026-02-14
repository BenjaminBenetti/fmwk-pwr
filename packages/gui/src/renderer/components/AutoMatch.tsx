import { useState, useRef } from 'react';
import type { Profile } from '../types';
import { Checkbox } from './controls';

interface AutoMatchProps {
  match: Profile['match'];
  onChange: (match: Profile['match']) => void;
}

export function AutoMatch({ match, onChange }: AutoMatchProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  const pattern = match.processPatterns[0] ?? '';

  const setPattern = (value: string) => {
    const trimmed = value.trim();
    onChange({
      ...match,
      processPatterns: trimmed ? [trimmed] : [],
    });
  };

  if (!expanded) {
    return (
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <span className="text-[12px] text-text-muted font-sans">// auto_match</span>
        <span className="text-[14px] text-text-dim font-sans">&gt;</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-muted font-sans">// auto_match</span>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-sans ${match.enabled ? 'text-text-primary' : 'text-text-dim'}`}>enabled</span>
          <Checkbox checked={match.enabled} onChange={(v) => onChange({ ...match, enabled: v })} />
          <span
            className="text-[12px] text-text-dim font-sans cursor-pointer"
            onClick={() => setExpanded(false)}
          >v</span>
        </div>
      </div>

      {/* Fields */}
      <div className={match.enabled ? '' : 'opacity-40 pointer-events-none'}>
        {/* Pattern */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-text-primary font-sans">pattern</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="regex pattern..."
            style={{ fontFamily: 'var(--font-mono)' }}
            className="w-full bg-transparent border border-border rounded-theme h-[40px] px-3 text-[12px] text-text-primary outline-none"
          />
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1 mt-2">
          <div className="flex items-center gap-1.5 relative">
            <span className="text-[12px] text-text-primary font-sans">priority</span>
            <div
              ref={infoRef}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="cursor-help"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showTooltip ? 'var(--accent)' : 'var(--text-dim)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            {showTooltip && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 6,
                  width: 260,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--border-radius)',
                  padding: 10,
                  zIndex: 50,
                  boxShadow: '0 4px 16px #00000060',
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                  Determines rule precedence when multiple patterns match the same process. Lower values = higher priority.
                </span>
              </div>
            )}
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={match.priority}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^\d+$/.test(v)) {
                onChange({ ...match, priority: v === '' ? 0 : Number(v) });
              }
            }}
            style={{ fontFamily: 'var(--font-mono)' }}
            className="w-20 bg-transparent border border-border rounded-theme h-[40px] px-3 text-[12px] text-text-primary outline-none"
          />
        </div>
      </div>
    </div>
  );
}
