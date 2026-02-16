import type { Profile, HardwareLimits, HardwareInfo } from '../types';
import { Checkbox, CustomSlider } from './controls';

interface GpuControlsProps {
  gpu: Profile['gpu'];
  hardwareLimits: HardwareLimits;
  hwInfo: HardwareInfo | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (gpu: Profile['gpu']) => void;
}

type PerfMode = 'auto' | 'manual' | 'max';

function getPerfMode(gpu: Profile['gpu']): PerfMode {
  if (gpu.clockMhz !== null) return 'manual';
  if (gpu.perfLevel === 'high') return 'max';
  return 'auto';
}

const perfOptions: { label: string; mode: PerfMode }[] = [
  { label: 'auto', mode: 'auto' },
  { label: 'manual', mode: 'manual' },
  { label: 'max', mode: 'max' },
];

export function GpuControls({ gpu, hardwareLimits, hwInfo, expanded, onToggleExpanded, onChange }: GpuControlsProps) {
  const mode = getPerfMode(gpu);
  const clockEnabled = mode === 'manual';
  const gpuClockLimit = hwInfo?.gpuClockLimitMhz ?? null;
  const clockVal = clockEnabled
    ? (gpu.clockMhz ?? hardwareLimits.minGpuClockMhz)
    : (gpuClockLimit ?? hardwareLimits.minGpuClockMhz);

  const handleModeChange = (newMode: PerfMode) => {
    switch (newMode) {
      case 'auto':
        onChange({ clockMhz: null, perfLevel: 'auto' });
        break;
      case 'manual':
        onChange({ clockMhz: hardwareLimits.minGpuClockMhz, perfLevel: null });
        break;
      case 'max':
        onChange({ clockMhz: null, perfLevel: 'high' });
        break;
    }
  };

  if (!expanded) {
    return (
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggleExpanded}>
        <span className="text-[12px] text-text-muted font-sans">// gpu</span>
        <span className="text-[14px] text-text-dim font-sans">&gt;</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-muted)' }}>
          // gpu
        </span>
        <span className="text-[12px] text-text-dim font-sans cursor-pointer" onClick={onToggleExpanded}>v</span>
      </div>

      {/* Clock slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox checked={clockEnabled} onChange={(v) => handleModeChange(v ? 'manual' : 'auto')} />
            <span style={{ fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)' }}>
              max_clock
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            {clockEnabled || gpuClockLimit !== null
              ? `${clockVal} mhz / ${hardwareLimits.maxGpuClockMhz} mhz`
              : '\u2014'}
          </span>
        </div>
        <CustomSlider
          value={clockVal}
          min={hardwareLimits.minGpuClockMhz}
          max={hardwareLimits.maxGpuClockMhz}
          step={100}
          disabled={!clockEnabled}
          onChange={(v) => onChange({ ...gpu, clockMhz: v })}
        />
      </div>

      {/* Perf level toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
        <span style={{ fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)' }}>
          perf_level
        </span>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 0 }}>
          {perfOptions.map(({ label, mode: m }) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 'var(--border-radius)',
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-on)' : 'var(--text-dim)',
                  fontFamily: 'var(--font)',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
