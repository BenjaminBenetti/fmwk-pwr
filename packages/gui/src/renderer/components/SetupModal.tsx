import { useState, useEffect } from 'react';
import type { Preset } from '@fmwk-pwr/shared';

interface SetupModalProps {
  onComplete: () => void;
}

function formatLimits(p: Preset): string {
  const minW = p.hardwareLimits.minPowerMw / 1000;
  const maxW = Math.max(
    p.hardwareLimits.maxStapmMw,
    p.hardwareLimits.maxSlowMw,
    p.hardwareLimits.maxFastMw,
  ) / 1000;
  const minGpu = p.hardwareLimits.minGpuClockMhz;
  const maxGpu = p.hardwareLimits.maxGpuClockMhz;
  return `${minW}w \u2013 ${maxW}w  \u00b7  gpu ${minGpu} \u2013 ${maxGpu} mhz`;
}

export function SetupModal({ onComplete }: SetupModalProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    window.fmwkPwr.listPresets().then(({ presets }) => {
      setPresets(presets);
      if (presets.length > 0) setSelected(presets[0].name);
      setLoading(false);
    });
  }, []);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      await window.fmwkPwr.loadPreset(selected);
      onComplete();
    } catch (e) {
      console.error('Failed to load preset:', e);
      setConfirming(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000000B0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--border-radius)',
          padding: 20,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontSize: 14,
            fontFamily: 'var(--font)',
          }}
        >
          // hardware_setup
        </span>

        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            fontFamily: 'var(--font)',
            lineHeight: 1.5,
          }}
        >
          select the hardware preset that best matches your system
        </span>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%',
          }}
        >
          {loading ? (
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: 12,
                fontFamily: 'var(--font)',
              }}
            >
              loading presets...
            </span>
          ) : (
            presets.map((preset) => {
              const isSelected = selected === preset.name;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setSelected(preset.name)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: isSelected
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border)',
                    borderRadius: 'var(--border-radius)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontFamily: 'var(--font)',
                    }}
                  >
                    {preset.name}
                  </span>
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      fontFamily: 'var(--font)',
                    }}
                  >
                    {preset.description}
                  </span>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: 0.5,
                    }}
                  >
                    {formatLimits(preset)}
                  </span>
                  {isSelected && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          color: 'var(--accent)',
                          fontSize: 9,
                          fontWeight: 700,
                          fontFamily: 'var(--font)',
                        }}
                      >
                        selected
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || confirming}
          style={{
            width: '100%',
            height: 40,
            background: selected && !confirming ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: selected && !confirming ? 'var(--accent-on)' : 'var(--text-dim)',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font)',
            borderRadius: 'var(--border-radius)',
            border: 'none',
            cursor: selected && !confirming ? 'pointer' : 'default',
          }}
        >
          {confirming ? 'loading...' : 'confirm'}
        </button>
      </div>
    </div>
  );
}
