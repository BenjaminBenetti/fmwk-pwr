import type { Profile, HardwareLimits, HardwareInfo } from '../types';
import { Checkbox, CustomSlider, Dropdown } from './controls';

interface CpuControlsProps {
  cpu: Profile['cpu'];
  tunedProfile: string | null;
  hardwareLimits: HardwareLimits;
  hwInfo: HardwareInfo | null;
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

export function CpuControls({ cpu, tunedProfile, hardwareLimits, hwInfo, onChange, onTunedProfileChange }: CpuControlsProps) {
  const clockEnabled = cpu.maxClockMhz !== null;
  const clockVal = clockEnabled
    ? cpu.maxClockMhz!
    : hardwareLimits.maxCpuClockMhz;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-muted)' }}>
        // cpu
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              checked={clockEnabled}
              onChange={(v) => onChange({ maxClockMhz: v ? hardwareLimits.maxCpuClockMhz : null })}
            />
            <span style={{ fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)' }}>
              max_clock
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            {clockEnabled
              ? `${clockVal} mhz / ${hardwareLimits.maxCpuClockMhz} mhz`
              : '\u2014'}
          </span>
        </div>
        <CustomSlider
          value={clockVal}
          min={hardwareLimits.minCpuClockMhz}
          max={hardwareLimits.maxCpuClockMhz}
          step={100}
          disabled={!clockEnabled}
          onChange={(v) => onChange({ maxClockMhz: v })}
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
