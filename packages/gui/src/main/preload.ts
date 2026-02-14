import { contextBridge, ipcRenderer } from 'electron';
import type {
  Profile,
  ServerConfig,
  ProfileListResult,
  ProfileGetResult,
  ProfileCreateResult,
  ProfileUpdateResult,
  ProfileDeleteResult,
  ProfileApplyResult,
  StatusGetResult,
  ConfigGetResult,
  ConfigUpdateResult,
  PresetListResult,
  PresetLoadResult,
} from '@fmwk-pwr/shared';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const api = {
  // Profile methods
  listProfiles: (): Promise<ProfileListResult> =>
    ipcRenderer.invoke('profile:list'),
  getProfile: (name: string): Promise<ProfileGetResult> =>
    ipcRenderer.invoke('profile:get', name),
  createProfile: (profile: Profile): Promise<ProfileCreateResult> =>
    ipcRenderer.invoke('profile:create', profile),
  updateProfile: (name: string, profile: Profile): Promise<ProfileUpdateResult> =>
    ipcRenderer.invoke('profile:update', name, profile),
  deleteProfile: (name: string): Promise<ProfileDeleteResult> =>
    ipcRenderer.invoke('profile:delete', name),
  applyProfile: (name: string): Promise<ProfileApplyResult> =>
    ipcRenderer.invoke('profile:apply', name),

  // Status
  getStatus: (): Promise<StatusGetResult> =>
    ipcRenderer.invoke('status:get'),

  // Config
  getConfig: (): Promise<ConfigGetResult> =>
    ipcRenderer.invoke('config:get'),
  updateConfig: (config: Partial<ServerConfig>): Promise<ConfigUpdateResult> =>
    ipcRenderer.invoke('config:update', config),

  // Presets
  listPresets: (): Promise<PresetListResult> =>
    ipcRenderer.invoke('preset:list'),
  loadPreset: (name: string): Promise<PresetLoadResult> =>
    ipcRenderer.invoke('preset:load', name),

  // Connection
  getConnectionState: (): Promise<ConnectionState> =>
    ipcRenderer.invoke('connection:state'),
  onConnectionStateChange: (callback: (state: ConnectionState) => void): (() => void) => {
    const handler = (_event: unknown, state: ConnectionState) => callback(state);
    ipcRenderer.on('connection:state-changed', handler);
    return () => { ipcRenderer.removeListener('connection:state-changed', handler); };
  },

  // Window controls
  windowClose: (): void => { ipcRenderer.send('window:close'); },
  windowMinimize: (): void => { ipcRenderer.send('window:minimize'); },
};

contextBridge.exposeInMainWorld('fmwkPwr', api);

export type FmwkPwrApi = typeof api;
