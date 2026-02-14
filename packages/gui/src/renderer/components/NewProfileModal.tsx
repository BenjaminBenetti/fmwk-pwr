import { useState } from 'react';
import type { Profile } from '../types';

interface NewProfileModalProps {
  profiles: Profile[];
  onCancel: () => void;
  onCreate: (name: string, copyFrom: string | null) => void;
}

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

export function NewProfileModal({ profiles, onCancel, onCreate }: NewProfileModalProps) {
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState<string>('none');

  const trimmed = name.trim();
  const nameValid = NAME_RE.test(trimmed);
  const nameTaken = profiles.some((p) => p.name === trimmed);
  const canCreate = nameValid && !nameTaken;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate(trimmed, copyFrom === 'none' ? null : copyFrom);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) handleCreate();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000000B0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--border-radius)',
          padding: 20,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onKeyDown={handleKeyDown}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontSize: 14,
            fontFamily: 'var(--font)',
          }}
        >
          // new_profile
        </span>

        {/* Name input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              fontFamily: 'var(--font)',
            }}
          >
            name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="my-profile"
            style={{
              height: 36,
              background: 'var(--bg-tertiary)',
              border: trimmed && !nameValid
                ? '1px solid var(--danger)'
                : '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              padding: '0 10px',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          {trimmed && !nameValid && (
            <span
              style={{
                color: 'var(--danger)',
                fontSize: 10,
                fontFamily: 'var(--font)',
              }}
            >
              letters, numbers, and hyphens only (must start with letter/number)
            </span>
          )}
          {nameTaken && (
            <span
              style={{
                color: 'var(--danger)',
                fontSize: 10,
                fontFamily: 'var(--font)',
              }}
            >
              a profile with this name already exists
            </span>
          )}
        </div>

        {/* Copy from dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              fontFamily: 'var(--font)',
            }}
          >
            copy settings from
          </label>
          <select
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
            style={{
              height: 36,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              padding: '0 10px',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font)',
              outline: 'none',
              appearance: 'none',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <option value="none" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              none
            </option>
            {profiles.map((p) => (
              <option
                key={p.name}
                value={p.name}
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 36,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: 'var(--font)',
              cursor: 'pointer',
            }}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            style={{
              flex: 1,
              height: 36,
              background: canCreate ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: canCreate ? 'var(--accent-on)' : 'var(--text-dim)',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              cursor: canCreate ? 'pointer' : 'default',
            }}
          >
            create
          </button>
        </div>
      </div>
    </div>
  );
}
