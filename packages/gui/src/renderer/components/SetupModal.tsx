import { useState, useEffect } from 'react';
import type { Preset, HardwareLimits } from '@fmwk-pwr/shared';

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

const CUSTOM_OPTION = 'custom';

interface CustomFormValues {
  minPowerMw: string;
  maxStapmMw: string;
  maxSlowMw: string;
  maxFastMw: string;
  minGpuClockMhz: string;
  maxGpuClockMhz: string;
}

const DEFAULT_FORM: CustomFormValues = {
  minPowerMw: '',
  maxStapmMw: '',
  maxSlowMw: '',
  maxFastMw: '',
  minGpuClockMhz: '',
  maxGpuClockMhz: '',
};

const PLACEHOLDERS: Record<keyof CustomFormValues, string> = {
  minPowerMw: '15000',
  maxStapmMw: '132000',
  maxSlowMw: '154000',
  maxFastMw: '170000',
  minGpuClockMhz: '200',
  maxGpuClockMhz: '3000',
};

export function SetupModal({ onComplete }: SetupModalProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [formValues, setFormValues] = useState<CustomFormValues>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    window.fmwkPwr.listPresets().then(({ presets }) => {
      setPresets(presets);
      if (presets.length > 0) setSelected(presets[0].name);
      setLoading(false);
    });
  }, []);

  const handleConfirmPreset = async () => {
    if (!selected) return;

    if (selected === CUSTOM_OPTION) {
      setStep(2);
      return;
    }

    setConfirming(true);
    try {
      await window.fmwkPwr.loadPreset(selected);
      onComplete();
    } catch (e) {
      console.error('Failed to load preset:', e);
      setConfirming(false);
    }
  };

  const handleConfirmCustom = async () => {
    setFormError(null);

    const parsed = {
      minPowerMw: parseInt(formValues.minPowerMw, 10),
      maxStapmMw: parseInt(formValues.maxStapmMw, 10),
      maxSlowMw: parseInt(formValues.maxSlowMw, 10),
      maxFastMw: parseInt(formValues.maxFastMw, 10),
      minGpuClockMhz: parseInt(formValues.minGpuClockMhz, 10),
      maxGpuClockMhz: parseInt(formValues.maxGpuClockMhz, 10),
    };

    const allValid = Object.values(parsed).every((v) => Number.isFinite(v) && v > 0);
    if (!allValid) {
      setFormError('all values must be positive numbers');
      return;
    }

    setConfirming(true);
    try {
      await window.fmwkPwr.updateConfig({
        hardwareLimits: parsed as HardwareLimits,
        firstTimeSetup: false,
      });
      onComplete();
    } catch (e) {
      console.error('Failed to save custom limits:', e);
      setConfirming(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setConfirming(false);
    setFormError(null);
  };

  const updateField = (field: keyof CustomFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const inputStyle = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--border-radius)',
    height: 36,
    padding: '0 10px',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    color: 'var(--text-primary)',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  };

  const labelStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--text-dim)',
  };

  // Step 2: Custom entry form
  if (step === 2) {
    const fields: { key: keyof CustomFormValues; label: string }[] = [
      { key: 'minPowerMw', label: 'min_power (mW)' },
      { key: 'maxStapmMw', label: 'max_sustained_power (mW)' },
      { key: 'maxSlowMw', label: 'max_boost_power (mW)' },
      { key: 'maxFastMw', label: 'max_burst_power (mW)' },
    ];

    const gpuFields: { key: keyof CustomFormValues; label: string }[] = [
      { key: 'minGpuClockMhz', label: 'min_gpu_clock (MHz)' },
      { key: 'maxGpuClockMhz', label: 'max_gpu_clock (MHz)' },
    ];

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
            {'// hardware_setup > custom'}
          </span>

          <span
            style={{
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: 'var(--font)',
              lineHeight: 1.5,
            }}
          >
            enter the hardware limits for your system. values are in milliwatts (mW) for power and megahertz (MHz) for clock speed.
          </span>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: 11,
                fontFamily: 'var(--font)',
              }}
            >
              {'// power_limits'}
            </span>

            {fields.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="number"
                  value={formValues[key]}
                  placeholder={PLACEHOLDERS[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}

            <div
              style={{
                height: 1,
                background: 'var(--border)',
              }}
            />

            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: 11,
                fontFamily: 'var(--font)',
              }}
            >
              {'// gpu_clock'}
            </span>

            {gpuFields.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="number"
                  value={formValues[key]}
                  placeholder={PLACEHOLDERS[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {formError && (
            <span
              style={{
                color: 'var(--error, #ff4444)',
                fontSize: 11,
                fontFamily: 'var(--font)',
              }}
            >
              {formError}
            </span>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={handleBack}
              disabled={confirming}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--border-radius)',
                height: 40,
                padding: '0 16px',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font)',
                cursor: confirming ? 'default' : 'pointer',
              }}
            >
              back
            </button>
            <button
              type="button"
              onClick={handleConfirmCustom}
              disabled={confirming}
              style={{
                flex: 1,
                height: 40,
                background: confirming ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: confirming ? 'var(--text-dim)' : 'var(--accent-on)',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font)',
                borderRadius: 'var(--border-radius)',
                border: 'none',
                cursor: confirming ? 'default' : 'pointer',
              }}
            >
              {confirming ? 'loading...' : 'confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Preset selection (with custom option)
  const isCustomSelected = selected === CUSTOM_OPTION;

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
            <>
              {presets.map((preset) => {
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
              })}

              {/* Custom option */}
              <button
                type="button"
                onClick={() => setSelected(CUSTOM_OPTION)}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: isCustomSelected
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
                  custom
                </span>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    fontFamily: 'var(--font)',
                  }}
                >
                  manually enter hardware limits for your system
                </span>
                <span
                  style={{
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  for unsupported or unknown hardware
                </span>
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirmPreset}
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
