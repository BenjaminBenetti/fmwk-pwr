import { useMemo } from 'react';
import type { Profile } from '../types';
import { Dropdown } from './controls';

const THEME_LABELS: Record<string, string> = {
  default: 'Default',
  industrial: 'Industrial',
  swiss: 'Swiss',
  'warm-retro': 'Warm Retro',
  'nord-aurora': 'Nord Aurora',
  'neon-flux': 'Neon Flux',
  'catppuccin-mocha': 'Catppuccin Mocha',
  'tokyo-night': 'Tokyo Night',
  'nord-snow': 'Nord Snow',
  'catppuccin-latte': 'Catppuccin Latte',
  'solarized-light': 'Solarized Light',
  paper: 'Paper',
  monokai: 'Monokai',
};

const THEME_OPTIONS = Object.entries(THEME_LABELS).map(([key, label]) => ({ value: key, label }));

interface ProfileSelectorProps {
  profiles: Profile[];
  activeProfile: string | null;
  defaultProfile: string;
  currentName: string;
  onSelect: (name: string) => void;
  onNew: () => void;
  onDelete: (name: string) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
}

export function ProfileSelector({ profiles, activeProfile, currentName, onSelect, onNew, onDelete, theme, onThemeChange }: ProfileSelectorProps) {
  const canDelete = profiles.length > 1;
  const isActive = currentName === activeProfile;

  const profileOptions = useMemo(() =>
    profiles.map((p) => ({
      value: p.name,
      label: p.name,
      badge: p.name === activeProfile ? 'active' : undefined,
    })),
    [profiles, activeProfile],
  );

  const newProfileFooter = (
    <button
      onClick={onNew}
      style={{
        height: 36,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 'var(--border-radius)',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        color: 'var(--text-dim)',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font)',
      }}
    >
      <span style={{ fontSize: 14 }}>+</span>
      <span style={{ fontSize: 12 }}>new profile</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>// profile</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Profile dropdown */}
        <Dropdown
          options={profileOptions}
          value={currentName}
          onChange={onSelect}
          displayValue={currentName + (isActive ? ' (active)' : '')}
          popoverWidth={260}
          footer={newProfileFooter}
        />

        {/* Delete profile button */}
        <button
          onClick={() => canDelete && onDelete(currentName)}
          disabled={!canDelete}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canDelete ? 'pointer' : 'not-allowed',
            opacity: canDelete ? 1 : 0.4,
          }}
          title={canDelete ? 'Delete profile' : 'Cannot delete the last profile'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>

        {/* Theme dropdown */}
        <Dropdown
          options={THEME_OPTIONS}
          value={theme}
          onChange={onThemeChange}
          width={40}
          popoverWidth={172}
          popoverAlign="right"
          trigger={
            <span style={{ fontSize: 16, color: 'var(--text-muted)' }} title="Change theme">&#x25D0;</span>
          }
        />
      </div>
    </div>
  );
}
