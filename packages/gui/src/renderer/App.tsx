import { useState, useEffect, useCallback } from 'react';
import { useProfiles, useStatus, useConfig, useConnection } from './hooks/useServer';
import { ProfileSelector } from './components/ProfileSelector';
import { PowerControls } from './components/PowerControls';
import { GpuControls } from './components/GpuControls';
import { SystemProfile } from './components/SystemProfile';
import { SensorReadout } from './components/SensorReadout';
import { AutoMatch } from './components/AutoMatch';
import type { Profile } from './types';

const DEFAULT_PROFILE: Profile = {
  name: 'new-profile',
  power: { stapmLimit: null, slowLimit: null, fastLimit: null },
  gpu: { clockMhz: null, perfLevel: null },
  tunedProfile: null,
  match: { enabled: false, processPatterns: [], priority: 0 },
};

const THEMES = ['default', 'industrial', 'swiss', 'warm-retro'] as const;

function Divider() {
  return <div className="w-full h-px bg-border" />;
}

export function App() {
  const { profiles, loading: profilesLoading, refetch: refetchProfiles } = useProfiles();
  const { activeProfile, hwInfo } = useStatus(1500);
  const { hardwareLimits, defaultProfile, loading: configLoading } = useConfig();
  const connectionState = useConnection();

  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [applying, setApplying] = useState(false);
  const [theme, setTheme] = useState('default');

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleThemeToggle = useCallback(() => {
    setTheme((prev) => {
      const idx = THEMES.indexOf(prev as typeof THEMES[number]);
      return THEMES[(idx + 1) % THEMES.length];
    });
  }, []);

  // Load active profile into editor when it changes or profiles load
  useEffect(() => {
    if (!activeProfile || profiles.length === 0) return;
    const target = profiles.find((p) => p.name === activeProfile);
    if (target && (!editProfile || editProfile.name !== activeProfile)) {
      setEditProfile(structuredClone(target));
      setOriginalProfile(structuredClone(target));
    }
  }, [activeProfile, profiles]);

  const isDirty = editProfile !== null && originalProfile !== null &&
    JSON.stringify(editProfile) !== JSON.stringify(originalProfile);

  const handleSelectProfile = useCallback(async (name: string) => {
    const target = profiles.find((p) => p.name === name);
    if (target) {
      setEditProfile(structuredClone(target));
      setOriginalProfile(structuredClone(target));
    }
  }, [profiles]);

  const handleNewProfile = useCallback(async () => {
    const name = prompt('Profile name:');
    if (!name || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(name)) return;
    try {
      const { profile } = await window.fmwkPwr.createProfile({ ...DEFAULT_PROFILE, name });
      await refetchProfiles();
      setEditProfile(structuredClone(profile));
      setOriginalProfile(structuredClone(profile));
    } catch (e) { console.error('Failed to create profile:', e); }
  }, [refetchProfiles]);

  const handleDeleteProfile = useCallback(async (name: string) => {
    try {
      await window.fmwkPwr.deleteProfile(name);
      await refetchProfiles();
      if (activeProfile && activeProfile !== name) {
        handleSelectProfile(activeProfile);
      }
    } catch (e) { console.error('Failed to delete profile:', e); }
  }, [refetchProfiles, activeProfile, handleSelectProfile]);

  const handleApply = useCallback(async () => {
    if (!editProfile) return;
    setApplying(true);
    try {
      await window.fmwkPwr.updateProfile(editProfile.name, editProfile);
      await window.fmwkPwr.applyProfile(editProfile.name);
      setOriginalProfile(structuredClone(editProfile));
      await refetchProfiles();
    } catch (e) { console.error('Failed to apply:', e); }
    finally { setApplying(false); }
  }, [editProfile, refetchProfiles]);

  if (profilesLoading || configLoading || !hardwareLimits) {
    return (
      <div className="p-3 flex items-center justify-center h-screen bg-bg-primary">
        <p className="text-text-muted text-[13px] font-sans">
          {connectionState === 'disconnected' ? 'connecting to server...' : 'loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3 text-[13px] select-none bg-bg-primary min-h-screen font-sans">
      {connectionState !== 'connected' && (
        <div className={`px-3 py-1.5 rounded-theme text-[12px] font-sans border ${
          connectionState === 'connecting'
            ? 'border-warning text-warning'
            : 'border-danger text-danger'
        }`}>
          {connectionState === 'connecting' ? 'connecting to server...' : 'disconnected from server'}
        </div>
      )}

      <ProfileSelector
        profiles={profiles}
        activeProfile={activeProfile}
        defaultProfile={defaultProfile}
        currentName={editProfile?.name ?? ''}
        onSelect={handleSelectProfile}
        onNew={handleNewProfile}
        onDelete={handleDeleteProfile}
        onThemeToggle={handleThemeToggle}
      />

      {editProfile && (
        <>
          <Divider />
          <PowerControls
            power={editProfile.power}
            hardwareLimits={hardwareLimits}
            onChange={(power) => setEditProfile({ ...editProfile, power })}
          />

          <Divider />
          <GpuControls
            gpu={editProfile.gpu}
            hardwareLimits={hardwareLimits}
            onChange={(gpu) => setEditProfile({ ...editProfile, gpu })}
          />

          <Divider />
          <SystemProfile
            tunedProfile={editProfile.tunedProfile}
            onChange={(tunedProfile) => setEditProfile({ ...editProfile, tunedProfile })}
          />

          <Divider />
          <SensorReadout hwInfo={hwInfo} />

          <Divider />
          <AutoMatch
            match={editProfile.match}
            onChange={(match) => setEditProfile({ ...editProfile, match })}
          />

          <Divider />
          <button
            onClick={handleApply}
            disabled={!isDirty && !applying}
            className={`w-full h-[40px] rounded-theme text-[12px] tracking-[0.5px] font-sans cursor-pointer transition-colors ${
              isDirty || applying
                ? 'bg-accent text-accent-on border-none'
                : 'bg-transparent border border-border text-text-dim'
            }`}
          >
            {applying ? 'applying...' : isDirty ? 'apply' : 'applied'}
          </button>
        </>
      )}
    </div>
  );
}
