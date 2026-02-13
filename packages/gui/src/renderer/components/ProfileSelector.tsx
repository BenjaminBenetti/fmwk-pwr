import { useState } from 'react';
import type { Profile } from '../types';

interface ProfileSelectorProps {
  profiles: Profile[];
  activeProfile: string | null;
  defaultProfile: string;
  currentName: string;
  onSelect: (name: string) => void;
  onNew: () => void;
  onDelete: (name: string) => void;
}

export function ProfileSelector({ profiles, activeProfile, defaultProfile, currentName, onSelect, onNew, onDelete }: ProfileSelectorProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const canDelete = currentName !== defaultProfile && profiles.length > 1;

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400 uppercase tracking-wide">Profile</label>
      <div className="flex gap-2">
        <select
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm"
          value={currentName}
          onChange={(e) => onSelect(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}{p.name === activeProfile ? ' (active)' : ''}
            </option>
          ))}
        </select>
        <button onClick={onNew} className="bg-gray-700 hover:bg-gray-600 px-2 py-1.5 rounded text-sm" title="New profile">+</button>
        {canDelete && !showConfirm && (
          <button onClick={() => setShowConfirm(true)} className="bg-gray-700 hover:bg-red-700 px-2 py-1.5 rounded text-sm" title="Delete profile">&times;</button>
        )}
      </div>
      {showConfirm && (
        <div className="flex gap-2 items-center text-xs">
          <span className="text-red-400">Delete &quot;{currentName}&quot;?</span>
          <button onClick={() => { onDelete(currentName); setShowConfirm(false); }} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded">Yes</button>
          <button onClick={() => setShowConfirm(false)} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">No</button>
        </div>
      )}
    </div>
  );
}
