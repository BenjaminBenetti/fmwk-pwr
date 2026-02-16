import { useState, useEffect, useRef } from 'react';
import type { HardwareInfo, HardwareLimits } from '../types';
import { MiniBarChart } from './MiniBarChart';

const MAX_BARS = 40;

interface SensorReadoutProps {
  hwInfo: HardwareInfo | null;
  hardwareLimits: HardwareLimits;
}

export function formatPower(mw: number | null): string {
  if (mw === null) return '\u2014';
  return (mw / 1000).toFixed(1);
}

interface SensorRowProps {
  label: string;
  value: string;
  isNull: boolean;
  history: number[];
  maxValue: number;
}

function SensorRow({ label, value, isNull, history, maxValue }: SensorRowProps) {
  return (
    <>
      <span style={{ fontSize: 13, fontFamily: 'var(--font)', color: 'var(--text-primary)' }}>{label}</span>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <MiniBarChart history={history} maxValue={maxValue} maxBars={MAX_BARS} style={{ width: '100%', height: 20, margin: '0 8px' }} />
      </div>
      <span style={{ fontSize: 13, fontFamily: 'var(--font)', color: isNull ? 'var(--text-muted)' : 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </>
  );
}

export type SensorKey = 'socketPower' | 'cpuPower' | 'gpuPower' | 'apu_temp' | 'cpu_clock' | 'cpu_usage' | 'gpu_clock' | 'gpu_usage';

export function pushHistory(map: Record<SensorKey, number[]>, key: SensorKey, val: number | null) {
  if (val === null) return;
  const arr = map[key];
  if (arr.length >= MAX_BARS) arr.shift();
  arr.push(val);
}

export function emptyHistories(): Record<SensorKey, number[]> {
  return {
    socketPower: [], cpuPower: [], gpuPower: [],
    apu_temp: [], cpu_clock: [], cpu_usage: [],
    gpu_clock: [], gpu_usage: [],
  };
}

export function SensorReadout({ hwInfo, hardwareLimits }: SensorReadoutProps) {
  const [expanded, setExpanded] = useState(false);
  const histRef = useRef<Record<SensorKey, number[]>>(emptyHistories());
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!hwInfo) return;
    const h = histRef.current;
    pushHistory(h, 'socketPower', hwInfo.socketPower);
    pushHistory(h, 'cpuPower', hwInfo.cpuPower);
    pushHistory(h, 'gpuPower', hwInfo.gpuPower);
    pushHistory(h, 'apu_temp', hwInfo.tcpuTemp);
    pushHistory(h, 'cpu_clock', hwInfo.cpuClockMhz);
    pushHistory(h, 'cpu_usage', hwInfo.cpuUsagePercent);
    pushHistory(h, 'gpu_clock', hwInfo.gpuClockMhz);
    pushHistory(h, 'gpu_usage', hwInfo.gpuUsagePercent);
    forceRender((n) => n + 1);
  }, [hwInfo]);

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

  const h = histRef.current;

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
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 72px', columnGap: 4, rowGap: 6, alignItems: 'center' }}>
          <SensorRow label="socket" value={`${formatPower(hwInfo.socketPower)} w`} isNull={hwInfo.socketPower === null} history={h.socketPower} maxValue={hardwareLimits.maxFastMw} />
          <SensorRow label="cpu" value={`${formatPower(hwInfo.cpuPower)} w`} isNull={hwInfo.cpuPower === null} history={h.cpuPower} maxValue={hardwareLimits.maxFastMw} />
          <SensorRow label="gpu" value={`${formatPower(hwInfo.gpuPower)} w`} isNull={hwInfo.gpuPower === null} history={h.gpuPower} maxValue={hardwareLimits.maxFastMw} />
          <SensorRow label="apu_temp" value={hwInfo.tcpuTemp !== null ? `${hwInfo.tcpuTemp.toFixed(0)}\u00B0c` : '\u2014'} isNull={hwInfo.tcpuTemp === null} history={h.apu_temp} maxValue={100} />
          <SensorRow label="cpu_clock" value={hwInfo.cpuClockMhz !== null ? `${hwInfo.cpuClockMhz} mhz` : '\u2014'} isNull={hwInfo.cpuClockMhz === null} history={h.cpu_clock} maxValue={hardwareLimits.maxCpuClockMhz} />
          <SensorRow label="cpu_usage" value={hwInfo.cpuUsagePercent !== null ? `${hwInfo.cpuUsagePercent.toFixed(0)}%` : '\u2014'} isNull={hwInfo.cpuUsagePercent === null} history={h.cpu_usage} maxValue={100} />
          <SensorRow label="gpu_clock" value={hwInfo.gpuClockMhz !== null ? `${hwInfo.gpuClockMhz} mhz` : '\u2014'} isNull={hwInfo.gpuClockMhz === null} history={h.gpu_clock} maxValue={hardwareLimits.maxGpuClockMhz} />
          <SensorRow label="gpu_usage" value={hwInfo.gpuUsagePercent !== null ? `${hwInfo.gpuUsagePercent.toFixed(0)}%` : '\u2014'} isNull={hwInfo.gpuUsagePercent === null} history={h.gpu_usage} maxValue={100} />
        </div>
      )}
    </div>
  );
}
