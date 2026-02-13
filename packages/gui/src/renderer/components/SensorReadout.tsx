import type { HardwareInfo } from '../types';

interface SensorReadoutProps {
  hwInfo: HardwareInfo | null;
}

function formatPower(mw: number | null): string {
  if (mw === null) return '\u2014';
  return (mw / 1000).toFixed(1);
}

export function SensorReadout({ hwInfo }: SensorReadoutProps) {
  if (!hwInfo) {
    return (
      <div className="space-y-2">
        <h2 className="text-xs text-gray-400 uppercase tracking-wide">Sensors</h2>
        <p className="text-xs text-gray-500">No data</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs text-gray-400 uppercase tracking-wide">Sensors</h2>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm font-mono">
        <span className="text-gray-400">Socket</span>
        <span className="text-right">{formatPower(hwInfo.socketPower)} W</span>
        <span className="text-gray-400">CPU</span>
        <span className="text-right">{formatPower(hwInfo.cpuPower)} W</span>
        <span className="text-gray-400">GPU</span>
        <span className="text-right">{formatPower(hwInfo.gpuPower)} W</span>
        <span className="text-gray-400">CPU Temp</span>
        <span className="text-right">{hwInfo.tcpuTemp !== null ? `${hwInfo.tcpuTemp.toFixed(0)}\u00B0C` : '\u2014'}</span>
        <span className="text-gray-400">GPU Clock</span>
        <span className="text-right">{hwInfo.gpuClockMhz !== null ? `${hwInfo.gpuClockMhz} MHz` : '\u2014'}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs font-mono text-gray-500 mt-1">
        <span>STAPM</span>
        <span className="text-right">{formatPower(hwInfo.stapmLimit)} W</span>
        <span>Slow PPT</span>
        <span className="text-right">{formatPower(hwInfo.slowLimit)} W</span>
        <span>Fast PPT</span>
        <span className="text-right">{formatPower(hwInfo.fastLimit)} W</span>
        <span>TuneD</span>
        <span className="text-right">{hwInfo.tunedProfile}</span>
      </div>
    </div>
  );
}
