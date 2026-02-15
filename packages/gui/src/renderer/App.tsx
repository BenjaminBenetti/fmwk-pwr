import { useState, useEffect, useCallback, useRef } from 'react';
import { useProfiles, useStatus, useConfig, useConnection } from './hooks/useServer';
import { ProfileSelector } from './components/ProfileSelector';
import { PowerControls } from './components/PowerControls';
import { CpuControls } from './components/CpuControls';
import { GpuControls } from './components/GpuControls';
import { SensorReadout } from './components/SensorReadout';
import { AutoMatch } from './components/AutoMatch';
import { SetupModal } from './components/SetupModal';
import { NewProfileModal } from './components/NewProfileModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import type { Profile } from './types';

const DEFAULT_PROFILE: Profile = {
  name: 'new-profile',
  power: { stapmLimit: null, slowLimit: null, fastLimit: null },
  cpu: { maxClockMhz: null },
  gpu: { clockMhz: null, perfLevel: null },
  tunedProfile: null,
  match: { enabled: false, processPatterns: [], priority: 0, revertProfile: null },
};

function Titlebar() {
  return (
    <div
      className="flex items-center justify-between h-[40px] -m-3 mb-0 px-3 bg-accent border-b border-border rounded-t-[12px]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[11px] font-mono text-accent-on tracking-wider">fmwk-pwr</span>
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          tabIndex={-1}
          onClick={() => window.fmwkPwr.windowMinimize()}
          className="w-[32px] h-[32px] flex items-center justify-center bg-transparent border-none text-accent-on hover:text-accent-on hover:bg-black/20 cursor-pointer text-[14px]"
        >&#x2013;</button>
        <button
          tabIndex={-1}
          onClick={() => window.fmwkPwr.windowClose()}
          className="w-[32px] h-[32px] flex items-center justify-center bg-transparent border-none text-accent-on hover:text-accent-on hover:bg-black/20 cursor-pointer text-[14px]"
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
  const [applying, setApplying] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Tracks the profile state currently applied to hardware (for Apply button)
  const appliedSnapshot = useRef<Profile | null>(null);
  // Tracks what's already saved to server (to skip redundant auto-saves)
  const lastSavedJson = useRef<string>('');
  // Debounce timer for auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      const clone = structuredClone(target);
      setEditProfile(clone);
      appliedSnapshot.current = structuredClone(clone);
      lastSavedJson.current = JSON.stringify(clone);
    }
  }, [activeProfile, profiles]);

  // Auto-save on change (debounced)
  useEffect(() => {
    if (!editProfile) return;
    const json = JSON.stringify(editProfile);
    if (json === lastSavedJson.current) return;

    const timer = setTimeout(async () => {
      try {
        await window.fmwkPwr.updateProfile(editProfile.name, editProfile);
        lastSavedJson.current = json;
        await refetchProfiles();
      } catch (e) { console.error('Auto-save failed:', e); }
    }, 500);
    saveTimerRef.current = timer;

    return () => clearTimeout(timer);
  }, [editProfile, refetchProfiles]);

  const needsApply = (() => {
    if (!editProfile) return false;
    if (editProfile.name !== activeProfile) return true;
    if (!appliedSnapshot.current) return true;
    return JSON.stringify(editProfile) !== JSON.stringify(appliedSnapshot.current);
  })();

  const handleSelectProfile = useCallback(async (name: string) => {
    const target = profiles.find((p) => p.name === name);
    if (target) {
      const clone = structuredClone(target);
      setEditProfile(clone);
      lastSavedJson.current = JSON.stringify(clone);
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
      const clone = structuredClone(profile);
      setEditProfile(clone);
      lastSavedJson.current = JSON.stringify(clone);
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
        const clone = structuredClone(next);
        setEditProfile(clone);
        lastSavedJson.current = JSON.stringify(clone);
      }
    } catch (e) { console.error('Failed to delete profile:', e); }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, refetchProfiles, activeProfile, editProfile?.name]);

  const handleApply = useCallback(async () => {
    if (!editProfile) return;
    setApplying(true);
    try {
      // Cancel pending auto-save and flush latest state before applying
      clearTimeout(saveTimerRef.current);
      await window.fmwkPwr.updateProfile(editProfile.name, editProfile);
      lastSavedJson.current = JSON.stringify(editProfile);
      await window.fmwkPwr.applyProfile(editProfile.name);
      appliedSnapshot.current = structuredClone(editProfile);
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
    }, 100);
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
          <CpuControls
            cpu={editProfile.cpu}
            tunedProfile={editProfile.tunedProfile}
            hardwareLimits={hardwareLimits}
            hwInfo={hwInfo}
            onChange={(cpu) => setEditProfile({ ...editProfile, cpu })}
            onTunedProfileChange={(tunedProfile) => setEditProfile({ ...editProfile, tunedProfile })}
          />

          <Divider />
          <GpuControls
            gpu={editProfile.gpu}
            hardwareLimits={hardwareLimits}
            hwInfo={hwInfo}
            onChange={(gpu) => setEditProfile({ ...editProfile, gpu })}
          />

          <Divider />
          <SensorReadout hwInfo={hwInfo} />

          <Divider />
          <AutoMatch
            match={editProfile.match}
            profiles={profiles}
            currentProfileName={editProfile.name}
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
