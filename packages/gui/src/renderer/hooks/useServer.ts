import { useState, useEffect, useCallback } from 'react';
import type { Profile, HardwareInfo, HardwareLimits, ConnectionState } from '../types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const { profiles } = await window.fmwkPwr.listProfiles();
      setProfiles(profiles);
    } catch (e) { console.error('Failed to fetch profiles:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { profiles, loading, refetch };
}

export function useStatus(pollIntervalMs = 1500) {
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [activatedBy, setActivatedBy] = useState<"manual" | "auto" | "startup">("startup");
  const [hwInfo, setHwInfo] = useState<HardwareInfo | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const status = await window.fmwkPwr.getStatus();
        if (!active) return;
        setActiveProfile(status.activeProfile);
        setActivatedBy(status.activatedBy);
        setHwInfo(status.hwInfo);
      } catch (e) { console.error('Status poll failed:', e); }
    };
    poll();
    const id = setInterval(poll, pollIntervalMs);
    return () => { active = false; clearInterval(id); };
  }, [pollIntervalMs]);

  return { activeProfile, activatedBy, hwInfo };
}

export function useConfig() {
  const [hardwareLimits, setHardwareLimits] = useState<HardwareLimits | null>(null);
  const [defaultProfile, setDefaultProfile] = useState<string>('');
  const [firstTimeSetup, setFirstTimeSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetchConfig = useCallback(async () => {
    try {
      const { config } = await window.fmwkPwr.getConfig();
      setHardwareLimits(config.hardwareLimits);
      setDefaultProfile(config.defaultProfile);
      setFirstTimeSetup(config.firstTimeSetup);
    } catch (e) { console.error('Failed to fetch config:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetchConfig(); }, [refetchConfig]);

  return { hardwareLimits, defaultProfile, firstTimeSetup, refetchConfig, loading };
}

export function useConnection() {
  const [state, setState] = useState<ConnectionState>('connecting');

  useEffect(() => {
    window.fmwkPwr.getConnectionState().then(setState).catch(() => {});
    const unsub = window.fmwkPwr.onConnectionStateChange(setState);
    return unsub;
  }, []);

  return state;
}
