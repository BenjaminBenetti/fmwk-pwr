import { useState, useEffect, useCallback } from 'react';
import type { Profile, HardwareInfo, HardwareLimits, CollapsedSections, ConnectionState } from '../types';

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
  const [theme, setTheme] = useState<string>('default');
  const [compact, setCompact] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSections>({ power: false, cpu: false, gpu: false, sensors: true, autoMatch: true });
  const [loading, setLoading] = useState(true);

  const refetchConfig = useCallback(async () => {
    try {
      const { config } = await window.fmwkPwr.getConfig();
      setHardwareLimits(config.hardwareLimits);
      setDefaultProfile(config.defaultProfile);
      setFirstTimeSetup(config.firstTimeSetup);
      setTheme(config.user?.theme ?? 'default');
      setCompact(config.user?.compact ?? false);
      setCollapsedSections(config.user?.collapsedSections ?? { power: false, cpu: false, gpu: false, sensors: true, autoMatch: true });
    } catch (e) { console.error('Failed to fetch config:', e); }
    finally { setLoading(false); }
  }, []);

  const updateTheme = useCallback(async (newTheme: string) => {
    setTheme(newTheme);
    try {
      await window.fmwkPwr.updateConfig({ user: { theme: newTheme } });
    } catch (e) { console.error('Failed to persist theme:', e); }
  }, []);

  const updateCompact = useCallback(async (value: boolean) => {
    setCompact(value);
    try {
      await window.fmwkPwr.updateConfig({ user: { compact: value } });
    } catch (e) { console.error('Failed to persist compact:', e); }
  }, []);

  const updateCollapsedSections = useCallback(async (value: Partial<CollapsedSections>) => {
    setCollapsedSections(prev => ({ ...prev, ...value }));
    try {
      await window.fmwkPwr.updateConfig({ user: { collapsedSections: value as CollapsedSections } });
    } catch (e) { console.error('Failed to persist collapsedSections:', e); }
  }, []);

  useEffect(() => { refetchConfig(); }, [refetchConfig]);

  return { hardwareLimits, defaultProfile, firstTimeSetup, theme, updateTheme, compact, updateCompact, collapsedSections, updateCollapsedSections, refetchConfig, loading };
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
