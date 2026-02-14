import { useState, useEffect, useRef } from 'react';
import type { Profile } from '../types';

const THEME_LABELS: Record<string, string> = {
  default: 'Default',
  industrial: 'Industrial',
  swiss: 'Swiss',
  'warm-retro': 'Warm Retro',
};

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

export function ProfileSelector({ profiles, activeProfile, currentName, onSelect, onNew, theme, onThemeChange }: ProfileSelectorProps) {
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [showThemePopover, setShowThemePopover] = useState(false);
  const profilePopoverRef = useRef<HTMLDivElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const themePopoverRef = useRef<HTMLDivElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);

  // Click-outside handler for profile dropdown
  useEffect(() => {
    if (!showProfilePopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        profilePopoverRef.current && !profilePopoverRef.current.contains(e.target as Node) &&
        profileBtnRef.current && !profileBtnRef.current.contains(e.target as Node)
      ) {
        setShowProfilePopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfilePopover]);

  // Click-outside handler for theme popover
  useEffect(() => {
    if (!showThemePopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        themePopoverRef.current && !themePopoverRef.current.contains(e.target as Node) &&
        themeBtnRef.current && !themeBtnRef.current.contains(e.target as Node)
      ) {
        setShowThemePopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemePopover]);

  const isActive = currentName === activeProfile;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>// profile</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
        {/* Profile dropdown button */}
        <button
          ref={profileBtnRef}
          onClick={() => setShowProfilePopover((v) => !v)}
          style={{
            flex: 1,
            height: 40,
            background: showProfilePopover ? 'var(--bg-tertiary)' : 'transparent',
            border: showProfilePopover ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            paddingLeft: 12,
            paddingRight: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          <span>{currentName}{isActive ? ' (active)' : ''}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>{showProfilePopover ? '\u25B4' : '\u25BE'}</span>
        </button>

        {/* Profile dropdown popover */}
        {showProfilePopover && (
          <div
            ref={profilePopoverRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 260,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              boxShadow: '0 4px 16px #00000060',
              zIndex: 100,
            }}
          >
            {profiles.map((p) => {
              const isSelected = p.name === currentName;
              const isServerActive = p.name === activeProfile;
              return (
                <button
                  key={p.name}
                  onClick={() => { onSelect(p.name); setShowProfilePopover(false); }}
                  style={{
                    height: 36,
                    paddingLeft: 12,
                    paddingRight: 12,
                    borderRadius: 'var(--border-radius)',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? 'var(--accent-on)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 500 : 'normal',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    fontSize: 13,
                  }}
                >
                  <span>{p.name}</span>
                  {isServerActive && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>active</span>
                      <span style={{ fontWeight: 700, color: isSelected ? 'var(--accent-on)' : 'var(--accent)' }}>&#x2713;</span>
                    </span>
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />

            {/* New profile action */}
            <button
              onClick={() => { onNew(); setShowProfilePopover(false); }}
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
          </div>
        )}

        {/* New profile button */}
        <button
          onClick={onNew}
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
            color: 'var(--text-muted)',
            fontSize: 16,
            fontFamily: 'var(--font)',
            cursor: 'pointer',
          }}
          title="New profile"
        >+</button>

        {/* Theme button + popover */}
        <div style={{ position: 'relative' }}>
          <button
            ref={themeBtnRef}
            onClick={() => setShowThemePopover((v) => !v)}
            className="w-[40px] h-[40px] flex-shrink-0 flex items-center justify-center text-text-muted text-[16px] font-sans hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer"
            style={{
              background: showThemePopover ? 'var(--bg-tertiary)' : 'transparent',
              border: showThemePopover ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
            }}
            title="Change theme"
          >&#x25D0;</button>
          {showThemePopover && (
            <div
              ref={themePopoverRef}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                width: 172,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--border-radius)',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: '0 4px 16px #00000060',
                zIndex: 100,
              }}
            >
              {Object.entries(THEME_LABELS).map(([key, label]) => {
                const isThemeActive = key === theme;
                return (
                  <button
                    key={key}
                    onClick={() => { onThemeChange(key); setShowThemePopover(false); }}
                    style={{
                      height: 36,
                      paddingLeft: 12,
                      paddingRight: 12,
                      borderRadius: 'var(--border-radius)',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isThemeActive ? 'var(--accent)' : 'transparent',
                      color: isThemeActive ? 'var(--accent-on)' : 'var(--text-primary)',
                      fontWeight: isThemeActive ? 500 : 'normal',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    <span>{label}</span>
                    {isThemeActive && <span>&#x2713;</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
