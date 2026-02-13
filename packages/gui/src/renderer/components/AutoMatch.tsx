import { useState } from 'react';
import type { Profile } from '../types';

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs text-gray-400 uppercase tracking-wide">Auto-Match</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={match.enabled}
            onChange={(e) => onChange({ ...match, enabled: e.target.checked })}
            className="accent-blue-500" />
          <span className={match.enabled ? 'text-gray-100' : 'text-gray-500'}>Enabled</span>
        </label>
      </div>

      <div className={match.enabled ? '' : 'opacity-40 pointer-events-none'}>
        <div className="space-y-1">
          {match.processPatterns.map((pat, i) => (
            <div key={i} className="flex gap-1 items-center">
              <code className="flex-1 bg-gray-800 px-2 py-0.5 rounded text-xs font-mono truncate">{pat}</code>
              <button onClick={() => removePattern(i)} className="text-gray-500 hover:text-red-400 text-xs px-1">&times;</button>
            </div>
          ))}
          <div className="flex gap-1">
            <input type="text" value={newPattern} onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPattern()}
              placeholder="regex pattern..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs font-mono" />
            <button onClick={addPattern} className="bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-xs">+</button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-400">Priority</label>
          <input type="number" value={match.priority}
            onChange={(e) => onChange({ ...match, priority: Number(e.target.value) })}
            className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-center" />
        </div>
      </div>
    </div>
  );
}
