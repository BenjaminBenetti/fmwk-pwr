import type { Profile, HardwareLimits } from '../types';

interface PowerControlsProps {
  power: Profile['power'];
  hardwareLimits: HardwareLimits;
  onChange: (power: Profile['power']) => void;
}

function PowerSlider({ label, value, min, max, onChange }: {
  label: string; value: number | null; min: number; max: number;
  onChange: (value: number | null) => void;
}) {
  const enabled = value !== null;
  const displayVal = enabled ? (value / 1000).toFixed(0) : '\u2014';
  const sliderVal = enabled ? value : min;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked ? min : null)}
            className="accent-blue-500" />
          {label}
        </label>
        <span className="text-sm font-mono w-12 text-right">{enabled ? `${displayVal}W` : '\u2014'}</span>
      </div>
      <input type="range" min={min} max={max} step={1000} value={sliderVal}
        disabled={!enabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500 disabled:opacity-30" />
    </div>
  );
}

export function PowerControls({ power, hardwareLimits, onChange }: PowerControlsProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs text-gray-400 uppercase tracking-wide">Power Limits</h2>
      <PowerSlider label="STAPM" value={power.stapmLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxStapmMw}
        onChange={(v) => onChange({ ...power, stapmLimit: v })} />
      <PowerSlider label="Slow PPT" value={power.slowLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxSlowMw}
        onChange={(v) => onChange({ ...power, slowLimit: v })} />
      <PowerSlider label="Fast PPT" value={power.fastLimit} min={hardwareLimits.minPowerMw} max={hardwareLimits.maxFastMw}
        onChange={(v) => onChange({ ...power, fastLimit: v })} />
    </div>
  );
}
