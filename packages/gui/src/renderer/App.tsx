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

export function App() {
  const { profiles, loading: profilesLoading, refetch: refetchProfiles } = useProfiles();
  const { activeProfile, hwInfo } = useStatus(1500);
  const { hardwareLimits, defaultProfile, loading: configLoading } = useConfig();
  const connectionState = useConnection();

  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [applying, setApplying] = useState(false);

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
      // Load active profile after deletion
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
      <div className="p-4 flex items-center justify-center h-screen">
        <p className="text-gray-400 text-sm">
          {connectionState === 'disconnected' ? 'Connecting to server...' : 'Loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 text-sm select-none">
      {/* Connection banner */}
      {connectionState !== 'connected' && (
        <div className={`px-3 py-1.5 rounded text-xs ${
          connectionState === 'connecting' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {connectionState === 'connecting' ? 'Connecting to server...' : 'Disconnected from server'}
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
      />

      {editProfile && (
        <>
          <div className="border-t border-gray-700" />
          <PowerControls
            power={editProfile.power}
            hardwareLimits={hardwareLimits}
            onChange={(power) => setEditProfile({ ...editProfile, power })}
          />

          <div className="border-t border-gray-700" />
          <GpuControls
            gpu={editProfile.gpu}
            hardwareLimits={hardwareLimits}
            onChange={(gpu) => setEditProfile({ ...editProfile, gpu })}
          />

          <div className="border-t border-gray-700" />
          <SystemProfile
            tunedProfile={editProfile.tunedProfile}
            onChange={(tunedProfile) => setEditProfile({ ...editProfile, tunedProfile })}
          />

          <div className="border-t border-gray-700" />
          <SensorReadout hwInfo={hwInfo} />

          <div className="border-t border-gray-700" />
          <AutoMatch
            match={editProfile.match}
            onChange={(match) => setEditProfile({ ...editProfile, match })}
          />

          <div className="border-t border-gray-700 pt-3">
            <button
              onClick={handleApply}
              disabled={!isDirty || applying}
              className={`w-full py-2 rounded font-medium text-sm ${
                isDirty && !applying
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {applying ? 'Applying...' : isDirty ? 'Apply' : 'Applied'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
