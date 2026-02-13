import type { Profile, HardwareLimits } from '../types';

interface GpuControlsProps {
  gpu: Profile['gpu'];
  hardwareLimits: HardwareLimits;
  onChange: (gpu: Profile['gpu']) => void;
}

export function GpuControls({ gpu, hardwareLimits, onChange }: GpuControlsProps) {
  const clockEnabled = gpu.clockMhz !== null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs text-gray-400 uppercase tracking-wide">GPU</h2>

      {/* GPU Clock */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clockEnabled}
              onChange={(e) => onChange({
                clockMhz: e.target.checked ? hardwareLimits.minGpuClockMhz : null,
                perfLevel: e.target.checked ? null : gpu.perfLevel,
              })}
              className="accent-blue-500" />
            Clock
          </label>
          <span className="text-sm font-mono w-20 text-right">
            {clockEnabled ? `${gpu.clockMhz} MHz` : '\u2014'}
          </span>
        </div>
        <input type="range" min={hardwareLimits.minGpuClockMhz} max={hardwareLimits.maxGpuClockMhz} step={100}
          value={gpu.clockMhz ?? hardwareLimits.minGpuClockMhz}
          disabled={!clockEnabled}
          onChange={(e) => onChange({ ...gpu, clockMhz: Number(e.target.value) })}
          className="w-full accent-blue-500 disabled:opacity-30" />
      </div>

      {/* Perf Level -- only shown when clock is null */}
      {!clockEnabled && (
        <div className="space-y-1">
          <label className="text-sm text-gray-300">Perf Level</label>
          <div className="flex gap-1">
            {(['auto', 'high', null] as const).map((level) => (
              <button key={String(level)}
                onClick={() => onChange({ ...gpu, perfLevel: level })}
                className={`px-3 py-1 rounded text-xs ${
                  gpu.perfLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}>
                {level === null ? 'Off' : level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
