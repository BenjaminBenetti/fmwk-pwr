import type { Profile, HardwareLimits, HardwareInfo } from '../types';
import { Checkbox, CustomSlider } from './controls';

interface PowerControlsProps {
  power: Profile['power'];
  hardwareLimits: HardwareLimits;
  hwInfo: HardwareInfo | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (power: Profile['power']) => void;
}

function InfoIcon({ text }: { text: string }) {
  return (
    <span
      className="info-icon-wrapper"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--text-muted)', color: 'var(--text-muted)',
          fontSize: 9, fontFamily: 'var(--font)', cursor: 'help', userSelect: 'none',
        }}
      >i</span>
      <span className="info-tooltip">{text}</span>
    </span>
  );
}

function PowerSlider({ label, info, value, min, max, currentHwValue, onChange }: {
  label: string; info: string; value: number | null; min: number; max: number;
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
          <InfoIcon text={info} />
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

export function PowerControls({ power, hardwareLimits, hwInfo, expanded, onToggleExpanded, onChange }: PowerControlsProps) {
  if (!expanded) {
    return (
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggleExpanded}>
        <span className="text-[12px] text-text-muted font-sans">// power_limits</span>
        <span className="text-[14px] text-text-dim font-sans">&gt;</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-muted)' }}>
          // power_limits
        </span>
        <span className="text-[12px] text-text-dim font-sans cursor-pointer" onClick={onToggleExpanded}>v</span>
      </div>
      <PowerSlider label="sustained_power" value={power.stapmLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxStapmMw}
        info="Long-term average power limit (STAPM). The APU will throttle to stay at or below this wattage over time. This is the steady-state power budget for sustained workloads."
        currentHwValue={hwInfo?.stapmLimit ?? null}
        onChange={(v) => onChange({ ...power, stapmLimit: v })} />
      <PowerSlider label="boost_power" value={power.slowLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxSlowMw}
        info="Medium-term boost power limit (Slow PPT). The APU can draw up to this wattage for several minutes before falling back to the sustained limit."
        currentHwValue={hwInfo?.slowLimit ?? null}
        onChange={(v) => onChange({ ...power, slowLimit: v })} />
      <PowerSlider label="max_burst_power" value={power.fastLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxFastMw}
        info="Short-term peak power limit (Fast PPT). The maximum wattage the APU can draw for brief spikes lasting milliseconds to seconds. Allows full turbo performance for short bursts."
        currentHwValue={hwInfo?.fastLimit ?? null}
        onChange={(v) => onChange({ ...power, fastLimit: v })} />
    </div>
  );
}
