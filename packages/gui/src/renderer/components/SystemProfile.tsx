import { Dropdown } from './controls';

interface SystemProfileProps {
  tunedProfile: string | null;
  onChange: (tunedProfile: string | null) => void;
}

const TUNED_PROFILES = [
  'balanced',
  'powersave',
  'throughput-performance',
  'accelerator-performance',
  'latency-performance',
];

const OPTIONS = [
  { value: '__none__', label: "don't change" },
  ...TUNED_PROFILES.map((p) => ({ value: p, label: p })),
];

export function SystemProfile({ tunedProfile, onChange }: SystemProfileProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-text-muted font-sans">// system_performance_profile</span>
      <Dropdown
        options={OPTIONS}
        value={tunedProfile ?? '__none__'}
        onChange={(v) => onChange(v === '__none__' ? null : v)}
      />
    </div>
  );
}
