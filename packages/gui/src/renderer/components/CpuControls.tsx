import type { Profile, HardwareLimits, HardwareInfo } from '../types';
import { Checkbox, RangeSlider, Dropdown } from './controls';

interface CpuControlsProps {
  cpu: Profile['cpu'];
  tunedProfile: string | null;
  hardwareLimits: HardwareLimits;
  hwInfo: HardwareInfo | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (cpu: Profile['cpu']) => void;
  onTunedProfileChange: (tunedProfile: string | null) => void;
}

const TUNED_PROFILES = [
  'balanced',
  'powersave',
  'throughput-performance',
  'accelerator-performance',
  'latency-performance',
];

const TUNED_OPTIONS = [
  { value: '__none__', label: "don't change" },
  ...TUNED_PROFILES.map((p) => ({ value: p, label: p })),
];

export function CpuControls({ cpu, tunedProfile, hardwareLimits, hwInfo, expanded, onToggleExpanded, onChange, onTunedProfileChange }: CpuControlsProps) {
  const clockEnabled = cpu.maxClockMhz !== null || cpu.minClockMhz !== null;
  const highVal = clockEnabled
    ? (cpu.maxClockMhz ?? hardwareLimits.maxCpuClockMhz)
    : hardwareLimits.minCpuClockMhz;
  const lowVal = clockEnabled
    ? (cpu.minClockMhz ?? hardwareLimits.minCpuClockMhz)
    : hardwareLimits.minCpuClockMhz;

  if (!expanded) {
    return (
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggleExpanded}>
        <span className="text-[12px] text-text-muted font-sans">// cpu</span>
        <span className="text-[14px] text-text-dim font-sans">&gt;</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-muted)' }}>
          // cpu
        </span>
        <span className="text-[12px] text-text-dim font-sans cursor-pointer" onClick={onToggleExpanded}>v</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              checked={clockEnabled}
              onChange={(v) => onChange({ minClockMhz: v ? hardwareLimits.minCpuClockMhz : null, maxClockMhz: v ? hardwareLimits.maxCpuClockMhz : null })}
            />
            <span style={{ fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)' }}>
              cpu_clock
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            {clockEnabled
              ? `${lowVal} — ${highVal} mhz`
              : '\u2014'}
          </span>
        </div>
        <RangeSlider
          low={lowVal}
          high={highVal}
          min={hardwareLimits.minCpuClockMhz}
          max={hardwareLimits.maxCpuClockMhz}
          step={100}
          disabled={!clockEnabled}
          onChange={(lo, hi) => onChange({ minClockMhz: lo, maxClockMhz: hi })}
        />
      </div>

      {/* System performance profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
        <span style={{ fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)' }}>
          performance_profile
        </span>
        <Dropdown
          options={TUNED_OPTIONS}
          value={tunedProfile ?? '__none__'}
          onChange={(v) => onTunedProfileChange(v === '__none__' ? null : v)}
        />
      </div>
    </div>
  );
}
