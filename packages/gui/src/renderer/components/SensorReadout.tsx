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
  if (!hwInfo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-muted)' }}>// sensors</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font)', color: 'var(--text-dim)' }}>no data</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-muted)' }}>// sensors</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SensorRow label="socket" value={`${formatPower(hwInfo.socketPower)} w`} isNull={hwInfo.socketPower === null} />
        <SensorRow label="cpu" value={`${formatPower(hwInfo.cpuPower)} w`} isNull={hwInfo.cpuPower === null} />
        <SensorRow label="gpu" value={`${formatPower(hwInfo.gpuPower)} w`} isNull={hwInfo.gpuPower === null} />
        <SensorRow label="socket_pwr" value={hwInfo.tcpuTemp !== null ? `${hwInfo.tcpuTemp.toFixed(0)}\u00B0c` : '\u2014'} isNull={hwInfo.tcpuTemp === null} />
        <SensorRow label="gpu_clock" value={hwInfo.gpuClockMhz !== null ? `${hwInfo.gpuClockMhz} mhz` : '\u2014'} isNull={hwInfo.gpuClockMhz === null} />
      </div>
    </div>
  );
}
