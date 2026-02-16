import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { FmwkPwrClient } from './client.js';
import type { StatusResult, Profile } from './client.js';
import { FmwkPwrIndicator } from './indicator.js';

export default class FmwkPwrExtension extends Extension {
  private _client: FmwkPwrClient | null = null;
  private _indicator: InstanceType<typeof FmwkPwrIndicator> | null = null;
  private _pollTimerId: number | null = null;

  private _cachedProfiles: Profile[] = [];
  private _cachedActiveProfile = '';

  enable(): void {
    this._client = new FmwkPwrClient();
    this._indicator = new FmwkPwrIndicator(this._client);

    this._client.onStatusChanged = (status: StatusResult) => {
      const profileChanged = this._cachedActiveProfile !== status.activeProfile;
      this._cachedActiveProfile = status.activeProfile;
      this._indicator?.updateStatus(status);
      if (profileChanged && this._cachedProfiles.length > 0) {
        this._indicator?.updateProfiles(this._cachedProfiles, status.activeProfile);
      }
    };

    this._client.onProfilesChanged = (profiles: Profile[]) => {
      this._cachedProfiles = profiles;
      this._indicator?.updateProfiles(profiles, this._cachedActiveProfile);
    };

    this._client.onConnectionChanged = (connected: boolean) => {
      this._indicator?.setConnected(connected);
      if (connected) {
        this._client?.getStatus();
        this._client?.listProfiles();
      }
    };

    this._client.onError = (error: Error) => {
      log(`[fmwk-pwr] ${error.message}`);
    };

    Main.panel.addToStatusArea('fmwk-pwr', this._indicator);

    this._client.connect();

    this._pollTimerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      3,
      () => {
        this._client?.getStatus();
        this._client?.listProfiles();
        return true;
      },
    );
  }

  disable(): void {
    if (this._pollTimerId !== null) {
      GLib.source_remove(this._pollTimerId);
      this._pollTimerId = null;
    }

    if (this._client !== null) {
      this._client.disconnect();
      this._client = null;
    }

    if (this._indicator !== null) {
      this._indicator.destroy();
      this._indicator = null;
    }

    this._cachedProfiles = [];
    this._cachedActiveProfile = '';
  }
}
