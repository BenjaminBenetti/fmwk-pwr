import { useState, useEffect, useCallback, useRef } from 'react';
import { useProfiles, useStatus, useConfig, useConnection } from './hooks/useServer';
import { ProfileSelector } from './components/ProfileSelector';
import { PowerControls } from './components/PowerControls';
import { GpuControls } from './components/GpuControls';
import { SystemProfile } from './components/SystemProfile';
import { SensorReadout } from './components/SensorReadout';
import { AutoMatch } from './components/AutoMatch';
import { SetupModal } from './components/SetupModal';
import { NewProfileModal } from './components/NewProfileModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import type { Profile } from './types';

const DEFAULT_PROFILE: Profile = {
  name: 'new-profile',
  power: { stapmLimit: null, slowLimit: null, fastLimit: null },
  gpu: { clockMhz: null, perfLevel: null },
  tunedProfile: null,
  match: { enabled: false, processPatterns: [], priority: 0 },
};

function Titlebar() {
  return (
    <div
      className="flex items-center justify-between h-[32px] -m-3 mb-0 px-3 bg-bg-secondary border-b border-border rounded-t-[12px]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[11px] font-mono text-text-muted tracking-wider">fmwk-pwr</span>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => window.fmwkPwr.windowMinimize()}
          className="w-[32px] h-[32px] flex items-center justify-center bg-transparent border-none text-text-dim hover:text-text-primary hover:bg-bg-tertiary cursor-pointer text-[14px]"
        >&#x2013;</button>
        <button
          onClick={() => window.fmwkPwr.windowClose()}
          className="w-[32px] h-[32px] flex items-center justify-center bg-transparent border-none text-text-dim hover:text-danger hover:bg-bg-tertiary cursor-pointer text-[14px]"
        >&#x2715;</button>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-full h-px bg-border" />;
}

export function App() {
  const { profiles, loading: profilesLoading, refetch: refetchProfiles } = useProfiles();
  const { activeProfile, hwInfo } = useStatus(1500);
  const { hardwareLimits, defaultProfile, firstTimeSetup, theme, updateTheme, refetchConfig, loading: configLoading } = useConfig();
  const connectionState = useConnection();

  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [applying, setApplying] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Auto-load active profile only when the server's activeProfile changes
  // (initial load or auto-match switch), not when the profiles list updates
  const prevActiveProfile = useRef<string | null>(null);
  useEffect(() => {
    if (!activeProfile || profiles.length === 0) return;
    if (activeProfile === prevActiveProfile.current) return;
    prevActiveProfile.current = activeProfile;
    const target = profiles.find((p) => p.name === activeProfile);
    if (target) {
      setEditProfile(structuredClone(target));
      setOriginalProfile(structuredClone(target));
    }
  }, [activeProfile, profiles]);

  const isDirty = editProfile !== null && originalProfile !== null &&
    JSON.stringify(editProfile) !== JSON.stringify(originalProfile);
  const isNotActive = editProfile !== null && editProfile.name !== activeProfile;
  const needsApply = isDirty || isNotActive;

  const handleSelectProfile = useCallback(async (name: string) => {
    const target = profiles.find((p) => p.name === name);
    if (target) {
      setEditProfile(structuredClone(target));
      setOriginalProfile(structuredClone(target));
    }
  }, [profiles]);

  const handleNewProfile = useCallback(() => {
    setShowNewProfile(true);
  }, []);

  const handleCreateProfile = useCallback(async (name: string, copyFrom: string | null) => {
    try {
      const source = copyFrom ? profiles.find((p) => p.name === copyFrom) : null;
      const base = source ? structuredClone(source) : { ...DEFAULT_PROFILE };
      const { profile } = await window.fmwkPwr.createProfile({ ...base, name });
      await refetchProfiles();
      setEditProfile(structuredClone(profile));
      setOriginalProfile(structuredClone(profile));
      setShowNewProfile(false);
    } catch (e) { console.error('Failed to create profile:', e); }
  }, [profiles, refetchProfiles]);

  const handleRequestDelete = useCallback((name: string) => {
    setDeleteTarget(name);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await window.fmwkPwr.deleteProfile(deleteTarget);
      const { profiles: updated } = await window.fmwkPwr.listProfiles();
      await refetchProfiles();
      // If we deleted the profile we were editing, switch to another one
      if (editProfile?.name === deleteTarget && updated.length > 0) {
        const next = updated.find((p) => p.name === activeProfile) ?? updated[0];
        setEditProfile(structuredClone(next));
        setOriginalProfile(structuredClone(next));
      }
    } catch (e) { console.error('Failed to delete profile:', e); }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, refetchProfiles, activeProfile, editProfile?.name]);

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

  // Auto-resize window to fit content
  const rootRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const tid = setTimeout(() => {
      const height = el.scrollHeight;
      if (height !== lastHeight.current) {
        lastHeight.current = height;
        window.fmwkPwr.windowSetSize(380, height);
      }
    }, 25);
    return () => clearTimeout(tid);
  });

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
    <div ref={rootRef} className="p-3 flex flex-col gap-3 text-[13px] select-none bg-bg-primary font-sans">
      {firstTimeSetup && <SetupModal onComplete={refetchConfig} />}
      {showNewProfile && (
        <NewProfileModal
          profiles={profiles}
          onCancel={() => setShowNewProfile(false)}
          onCreate={handleCreateProfile}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          profileName={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
      <Titlebar />

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
        onDelete={handleRequestDelete}
        theme={theme}
        onThemeChange={updateTheme}
      />

      {editProfile && (
        <>
          <Divider />
          <PowerControls
            power={editProfile.power}
            hardwareLimits={hardwareLimits}
            hwInfo={hwInfo}
            onChange={(power) => setEditProfile({ ...editProfile, power })}
          />

          <Divider />
          <GpuControls
            gpu={editProfile.gpu}
            hardwareLimits={hardwareLimits}
            hwInfo={hwInfo}
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
            disabled={!needsApply && !applying}
            className={`w-full h-[40px] rounded-theme text-[12px] tracking-[0.5px] font-sans cursor-pointer transition-colors ${
              needsApply || applying
                ? 'bg-accent text-accent-on border-none'
                : 'bg-transparent border border-border text-text-dim'
            }`}
          >
            {applying ? 'applying...' : needsApply ? 'apply' : 'applied'}
          </button>
        </>
      )}
    </div>
  );
}
