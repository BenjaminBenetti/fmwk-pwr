import { ipcMain, type BrowserWindow } from 'electron';
import type { SocketClient } from './socket-client.js';
import { Methods } from '@fmwk-pwr/shared';
import type { Profile, ServerConfig } from '@fmwk-pwr/shared';

export function registerIpcHandlers(client: SocketClient): void {
  // Profile methods
  ipcMain.handle('profile:list', () =>
    client.request(Methods.ProfileList, {}));
  ipcMain.handle('profile:get', (_e, name: string) =>
    client.request(Methods.ProfileGet, { name }));
  ipcMain.handle('profile:create', (_e, profile: Profile) =>
    client.request(Methods.ProfileCreate, { profile }));
  ipcMain.handle('profile:update', (_e, name: string, profile: Profile) =>
    client.request(Methods.ProfileUpdate, { name, profile }));
  ipcMain.handle('profile:delete', (_e, name: string) =>
    client.request(Methods.ProfileDelete, { name }));
  ipcMain.handle('profile:apply', (_e, name: string) =>
    client.request(Methods.ProfileApply, { name }));

  // Status
  ipcMain.handle('status:get', () =>
    client.request(Methods.StatusGet, {}));

  // Config
  ipcMain.handle('config:get', () =>
    client.request(Methods.ConfigGet, {}));
  ipcMain.handle('config:update', (_e, config: Partial<ServerConfig>) =>
    client.request(Methods.ConfigUpdate, { config }));

  // Presets
  ipcMain.handle('preset:list', () =>
    client.request(Methods.PresetList, {}));
  ipcMain.handle('preset:load', (_e, name: string) =>
    client.request(Methods.PresetLoad, { name }));

  // Connection state
  ipcMain.handle('connection:state', () =>
    client.getState());
}

export function setupConnectionForwarding(
  client: SocketClient,
  getWindow: () => BrowserWindow | null,
): () => void {
  return client.onStateChange((state) => {
    getWindow()?.webContents.send('connection:state-changed', state);
  });
}
