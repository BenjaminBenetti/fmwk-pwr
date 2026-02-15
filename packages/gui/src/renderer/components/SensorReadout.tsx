import { useState } from 'react';
import type { HardwareInfo } from '../types';

interface SensorReadoutProps {
  hwInfo: HardwareInfo | null;
}

function formatPower(mw: number | null): string {
  if (mw === null) return '\u2014';
  return (mw / 1000).toFixed(1);
}

interface SensorRowProps {
  label: string;
  value: string;
  isNull: boolean;
}

function SensorRow({ label, value, isNull }: SensorRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontFamily: 'var(--font)', color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--font)', color: isNull ? 'var(--text-muted)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export function SensorReadout({ hwInfo }: SensorReadoutProps) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <span className="text-[12px] text-text-muted font-sans">// sensors</span>
        <span className="text-[14px] text-text-dim font-sans">&gt;</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-muted font-sans">// sensors</span>
        <span
          className="text-[12px] text-text-dim font-sans cursor-pointer"
          onClick={() => setExpanded(false)}
        >v</span>
      </div>
      {!hwInfo ? (
        <span style={{ fontSize: 13, fontFamily: 'var(--font)', color: 'var(--text-dim)' }}>no data</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SensorRow label="socket" value={`${formatPower(hwInfo.socketPower)} w`} isNull={hwInfo.socketPower === null} />
          <SensorRow label="cpu" value={`${formatPower(hwInfo.cpuPower)} w`} isNull={hwInfo.cpuPower === null} />
          <SensorRow label="gpu" value={`${formatPower(hwInfo.gpuPower)} w`} isNull={hwInfo.gpuPower === null} />
          <SensorRow label="apu_temp" value={hwInfo.tcpuTemp !== null ? `${hwInfo.tcpuTemp.toFixed(0)}\u00B0c` : '\u2014'} isNull={hwInfo.tcpuTemp === null} />
          <SensorRow label="gpu_clock" value={hwInfo.gpuClockMhz !== null ? `${hwInfo.gpuClockMhz} mhz` : '\u2014'} isNull={hwInfo.gpuClockMhz === null} />
        </div>
      )}
    </div>
  );
}
