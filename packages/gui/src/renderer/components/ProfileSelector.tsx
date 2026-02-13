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
  onThemeToggle: () => void;
}

export function ProfileSelector({ profiles, activeProfile, defaultProfile, currentName, onSelect, onNew, onDelete, onThemeToggle }: ProfileSelectorProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const canDelete = currentName !== defaultProfile && profiles.length > 1;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-text-muted font-sans">// profile</span>
      <div className="flex gap-2 items-center">
        <select
          className="flex-1 h-[40px] bg-transparent border border-border rounded-theme px-3 text-[13px] text-text-primary font-sans appearance-none cursor-pointer outline-none"
          value={currentName}
          onChange={(e) => onSelect(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name} className="bg-bg-primary text-text-primary">
              {p.name}{p.name === activeProfile ? ' (active)' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={onNew}
          className="w-[40px] h-[40px] flex-shrink-0 bg-transparent border border-border rounded-theme flex items-center justify-center text-text-muted text-[16px] font-sans hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer"
          title="New profile"
        >+</button>
        <button
          onClick={onThemeToggle}
          className="w-[40px] h-[40px] flex-shrink-0 bg-transparent border border-border rounded-theme flex items-center justify-center text-text-muted text-[16px] font-sans hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer"
          title="Change theme"
        >&#x25D0;</button>
      </div>
      {canDelete && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-[12px] text-text-dim hover:text-danger font-sans cursor-pointer bg-transparent border-none p-0 text-left"
        >
          delete profile
        </button>
      )}
      {showConfirm && (
        <div className="flex gap-2 items-center">
          <span className="text-[12px] text-danger font-sans">delete &quot;{currentName}&quot;?</span>
          <button
            onClick={() => { onDelete(currentName); setShowConfirm(false); }}
            className="text-[12px] bg-danger text-text-primary px-2 py-0.5 rounded-theme cursor-pointer border-none font-sans"
          >yes</button>
          <button
            onClick={() => setShowConfirm(false)}
            className="text-[12px] bg-transparent border border-border text-text-muted px-2 py-0.5 rounded-theme cursor-pointer font-sans"
          >no</button>
        </div>
      )}
    </div>
  );
}
