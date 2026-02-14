import type { Profile, HardwareLimits, HardwareInfo } from '../types';
import { Checkbox, CustomSlider } from './controls';

interface PowerControlsProps {
  power: Profile['power'];
  hardwareLimits: HardwareLimits;
  hwInfo: HardwareInfo | null;
  onChange: (power: Profile['power']) => void;
}

function PowerSlider({ label, value, min, max, currentHwValue, onChange }: {
  label: string; value: number | null; min: number; max: number;
  currentHwValue: number | null;
  onChange: (value: number | null) => void;
}) {
  const enabled = value !== null;
  const maxDisplay = `${(max / 1000).toFixed(0)} w`;

  let displayText: string;
  let sliderVal: number;

  if (enabled) {
    displayText = `${(value / 1000).toFixed(0)} w / ${maxDisplay}`;
    sliderVal = value;
  } else if (currentHwValue !== null) {
    displayText = `${(currentHwValue / 1000).toFixed(0)} w / ${maxDisplay}`;
    sliderVal = currentHwValue;
  } else {
    displayText = '\u2014';
    sliderVal = min;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox checked={enabled} onChange={(v) => onChange(v ? min : null)} />
          <span style={{ fontFamily: 'var(--font)', fontSize: 13, color: 'var(--text-primary)' }}>
            {label}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
          {displayText}
        </span>
      </div>
      <CustomSlider
        value={sliderVal}
        min={min}
        max={max}
        step={1000}
        disabled={!enabled}
        onChange={(v) => onChange(v)}
      />
    </div>
  );
}

export function PowerControls({ power, hardwareLimits, hwInfo, onChange }: PowerControlsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-muted)' }}>
        // power_limits
      </span>
      <PowerSlider label="stapm" value={power.stapmLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxStapmMw}
        currentHwValue={hwInfo?.stapmLimit ?? null}
        onChange={(v) => onChange({ ...power, stapmLimit: v })} />
      <PowerSlider label="slow_ppt" value={power.slowLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxSlowMw}
        currentHwValue={hwInfo?.slowLimit ?? null}
        onChange={(v) => onChange({ ...power, slowLimit: v })} />
      <PowerSlider label="fast_ppt" value={power.fastLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxFastMw}
        currentHwValue={hwInfo?.fastLimit ?? null}
        onChange={(v) => onChange({ ...power, fastLimit: v })} />
    </div>
  );
}
