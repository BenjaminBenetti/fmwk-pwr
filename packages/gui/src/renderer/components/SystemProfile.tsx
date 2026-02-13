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

export function SystemProfile({ tunedProfile, onChange }: SystemProfileProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-text-muted font-sans">// system_performance_profile</span>
      <select
        className="w-full h-[40px] bg-transparent border border-border rounded-theme px-3 text-[13px] text-text-primary font-sans appearance-none cursor-pointer outline-none"
        value={tunedProfile ?? '__none__'}
        onChange={(e) => onChange(e.target.value === '__none__' ? null : e.target.value)}
      >
        <option value="__none__" className="bg-bg-primary text-text-primary">don't change</option>
        {TUNED_PROFILES.map((p) => (
          <option key={p} value={p} className="bg-bg-primary text-text-primary">{p}</option>
        ))}
      </select>
    </div>
  );
}
