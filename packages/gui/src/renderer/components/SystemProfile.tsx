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
    <div className="space-y-2">
      <h2 className="text-xs text-gray-400 uppercase tracking-wide">System Profile</h2>
      <select
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm"
        value={tunedProfile ?? '__none__'}
        onChange={(e) => onChange(e.target.value === '__none__' ? null : e.target.value)}
      >
        <option value="__none__">Don't change</option>
        {TUNED_PROFILES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}
