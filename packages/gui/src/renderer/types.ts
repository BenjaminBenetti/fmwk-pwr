import type {
  Profile,
  HardwareInfo,
  ServerConfig,
  HardwareLimits,
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

export interface FmwkPwrApi {
  listProfiles(): Promise<ProfileListResult>;
  getProfile(name: string): Promise<ProfileGetResult>;
  createProfile(profile: Profile): Promise<ProfileCreateResult>;
  updateProfile(name: string, profile: Profile): Promise<ProfileUpdateResult>;
  deleteProfile(name: string): Promise<ProfileDeleteResult>;
  applyProfile(name: string): Promise<ProfileApplyResult>;
  getStatus(): Promise<StatusGetResult>;
  getConfig(): Promise<ConfigGetResult>;
  updateConfig(config: Partial<ServerConfig>): Promise<ConfigUpdateResult>;
  listPresets(): Promise<PresetListResult>;
  loadPreset(name: string): Promise<PresetLoadResult>;
  getConnectionState(): Promise<ConnectionState>;
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void;
  windowClose(): void;
  windowMinimize(): void;
  windowSetSize(width: number, height: number): void;
}

declare global {
  interface Window {
    fmwkPwr: FmwkPwrApi;
  }
}

export type { Profile, HardwareInfo, ServerConfig, HardwareLimits };
