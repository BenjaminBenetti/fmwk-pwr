import { useState, useMemo } from 'react';
import type { Profile } from '../types';
import { Dropdown } from './controls';

interface NewProfileModalProps {
  profiles: Profile[];
  onCancel: () => void;
  onCreate: (name: string, copyFrom: string | null) => void;
}

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

export function NewProfileModal({ profiles, onCancel, onCreate }: NewProfileModalProps) {
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState<string>('none');

  const copyFromOptions = useMemo(() => [
    { value: 'none', label: 'none' },
    ...profiles.map((p) => ({ value: p.name, label: p.name })),
  ], [profiles]);

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

        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            fontFamily: 'var(--font)',
            lineHeight: 1.5,
          }}
        >
          enter a name for the new profile
        </span>

        {/* Name input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              color: 'var(--text-primary)',
              fontSize: 12,
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
              height: 40,
              background: 'transparent',
              border: trimmed && !nameValid
                ? '1px solid var(--danger)'
                : '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              padding: '0 12px',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
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
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font)',
            }}
          >
            copy settings from
          </label>
          <Dropdown
            options={copyFromOptions}
            value={copyFrom}
            onChange={setCopyFrom}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-dim)',
              fontSize: 12,
              letterSpacing: 0.5,
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
              height: 40,
              background: canCreate ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: canCreate ? 'var(--accent-on)' : 'var(--text-dim)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
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
