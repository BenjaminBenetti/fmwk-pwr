import { useState } from 'react';
import type { Profile } from '../types';
import { Checkbox } from './controls';

interface AutoMatchProps {
  match: Profile['match'];
  onChange: (match: Profile['match']) => void;
}

export function AutoMatch({ match, onChange }: AutoMatchProps) {
  const [newPattern, setNewPattern] = useState('');

  const addPattern = () => {
    const trimmed = newPattern.trim();
    if (!trimmed) return;
    onChange({ ...match, processPatterns: [...match.processPatterns, trimmed] });
    setNewPattern('');
  };

  const removePattern = (index: number) => {
    onChange({ ...match, processPatterns: match.processPatterns.filter((_, i) => i !== index) });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-muted font-sans">// auto_match</span>
        <div className="flex items-center gap-2">
          <Checkbox checked={match.enabled} onChange={(v) => onChange({ ...match, enabled: v })} />
          <span className={`text-[13px] font-sans ${match.enabled ? 'text-text-primary' : 'text-text-dim'}`}>enabled</span>
        </div>
      </div>

      <div className={match.enabled ? '' : 'opacity-40 pointer-events-none'}>
        <div className="flex flex-col gap-1">
          {match.processPatterns.map((pat, i) => (
            <div key={i} className="flex gap-1 items-center">
              <code className="flex-1 bg-bg-tertiary px-2 py-0.5 rounded-theme text-[12px] font-mono truncate text-text-primary">{pat}</code>
              <button onClick={() => removePattern(i)} className="text-text-dim hover:text-danger text-[12px] px-1 bg-transparent border-none cursor-pointer">&times;</button>
            </div>
          ))}
          <div className="flex gap-1">
            <input type="text" value={newPattern} onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPattern()}
              placeholder="regex pattern..."
              className="flex-1 bg-transparent border border-border rounded-theme px-2 py-0.5 text-[12px] font-mono text-text-primary outline-none" />
            <button onClick={addPattern} className="bg-transparent border border-border hover:border-text-muted px-2 py-0.5 rounded-theme text-[12px] text-text-muted cursor-pointer">+</button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-[12px] text-text-muted font-sans">priority</span>
          <input type="number" value={match.priority}
            onChange={(e) => onChange({ ...match, priority: Number(e.target.value) })}
            className="w-16 bg-transparent border border-border rounded-theme px-2 py-0.5 text-[13px] text-text-primary text-center font-mono outline-none" />
        </div>
      </div>
    </div>
  );
}
