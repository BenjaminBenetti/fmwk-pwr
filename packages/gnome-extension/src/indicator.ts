import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import type { FmwkPwrClient, StatusResult, Profile } from './client.js';

interface StatusItems {
  limits: St.Label;
  gpu: St.Label;
  power: St.Label;
  temp: St.Label;
}

export class FmwkPwrIndicator extends PanelMenu.Button {
  private _client: FmwkPwrClient;
  private _label: St.Label;
  private _statusItems!: StatusItems;
  private _profileSection: PopupMenu.PopupBaseMenuItem[] = [];

  constructor(client: FmwkPwrClient) {
    super(0.0, 'fmwk-pwr', false);
    this._client = client;

    this._label = new St.Label({
      text: 'fmwk-pwr',
      y_align: 2, // Clutter.ActorAlign.CENTER
    });
    this.add_child(this._label);

    this._buildMenu();
  }

  private _buildMenu(): void {
    // Status section — non-reactive items
    const limitsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    this._statusItems = {
      limits: new St.Label({ text: 'Limits: --' }),
      gpu: new St.Label({ text: 'GPU: --' }),
      power: new St.Label({ text: 'Power: --' }),
      temp: new St.Label({ text: 'Temp: --' }),
    };
    limitsItem.add_child(this._statusItems.limits);
    this.menu.addMenuItem(limitsItem);

    const gpuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    gpuItem.add_child(this._statusItems.gpu);
    this.menu.addMenuItem(gpuItem);

    const powerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    powerItem.add_child(this._statusItems.power);
    this.menu.addMenuItem(powerItem);

    const tempItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    tempItem.add_child(this._statusItems.temp);
    this.menu.addMenuItem(tempItem);

    // Separator before profiles
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Profile items will be inserted dynamically via updateProfiles

    // Separator after profiles
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Actions
    const openSettingsItem = new PopupMenu.PopupMenuItem('Open Settings');
    openSettingsItem.connect('activate', () => {
      // TODO: launch Electron GUI (fmwk-pwr-gui)
    });
    this.menu.addMenuItem(openSettingsItem);

    const refreshItem = new PopupMenu.PopupMenuItem('Refresh');
    refreshItem.connect('activate', () => {
      this._client.getStatus();
      this._client.listProfiles();
    });
    this.menu.addMenuItem(refreshItem);
  }

  updateStatus(status: StatusResult): void {
    this._label.set_text(status.activeProfile);

    const hw = status.hwInfo;
    if (hw === null) {
      this._statusItems.limits.set_text('Limits: --');
      this._statusItems.gpu.set_text('GPU: --');
      this._statusItems.power.set_text('Power: --');
      this._statusItems.temp.set_text('Temp: --');
      return;
    }

    const stapm = Math.round(hw.stapmLimit / 1000);
    const slow = Math.round(hw.slowLimit / 1000);
    const fast = Math.round(hw.fastLimit / 1000);
    this._statusItems.limits.set_text(`Limits: ${stapm}W / ${slow}W / ${fast}W`);

    if (hw.gpuClockMhz !== null) {
      this._statusItems.gpu.set_text(`GPU: ${hw.gpuClockMhz} MHz`);
    } else {
      this._statusItems.gpu.set_text('GPU: auto');
    }

    if (hw.socketPower !== null) {
      const watts = (hw.socketPower / 1000).toFixed(1);
      this._statusItems.power.set_text(`Power: ${watts}W`);
    } else {
      this._statusItems.power.set_text('Power: --');
    }

    if (hw.tcpuTemp !== null) {
      this._statusItems.temp.set_text(`Temp: ${Math.round(hw.tcpuTemp)}\u00B0C`);
    } else {
      this._statusItems.temp.set_text('Temp: --');
    }
  }

  updateProfiles(profiles: Profile[], activeProfileName: string): void {
    this._rebuildMenu(profiles, activeProfileName);
  }

  private _rebuildMenu(profiles: Profile[], activeProfileName: string): void {
    // Save current status text
    const limitsText = this._statusItems.limits.text;
    const gpuText = this._statusItems.gpu.text;
    const powerText = this._statusItems.power.text;
    const tempText = this._statusItems.temp.text;

    // Clear everything
    this.menu.removeAll();
    this._profileSection = [];

    // Rebuild status section
    const limitsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    this._statusItems = {
      limits: new St.Label({ text: limitsText }),
      gpu: new St.Label({ text: gpuText }),
      power: new St.Label({ text: powerText }),
      temp: new St.Label({ text: tempText }),
    };
    limitsItem.add_child(this._statusItems.limits);
    this.menu.addMenuItem(limitsItem);

    const gpuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    gpuItem.add_child(this._statusItems.gpu);
    this.menu.addMenuItem(gpuItem);

    const powerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    powerItem.add_child(this._statusItems.power);
    this.menu.addMenuItem(powerItem);

    const tempItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    tempItem.add_child(this._statusItems.temp);
    this.menu.addMenuItem(tempItem);

    // Separator before profiles
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Profile items
    for (const profile of profiles) {
      const item = new PopupMenu.PopupMenuItem(profile.name);
      if (profile.name === activeProfileName) {
        item.setOrnament(PopupMenu.Ornament.DOT);
      } else {
        item.setOrnament(PopupMenu.Ornament.NONE);
      }
      item.connect('activate', () => {
        this._client.applyProfile(profile.name);
      });
      this.menu.addMenuItem(item);
      this._profileSection.push(item);
    }

    // Separator after profiles
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Actions
    const openSettingsItem = new PopupMenu.PopupMenuItem('Open Settings');
    openSettingsItem.connect('activate', () => {
      // TODO: launch Electron GUI (fmwk-pwr-gui)
    });
    this.menu.addMenuItem(openSettingsItem);

    const refreshItem = new PopupMenu.PopupMenuItem('Refresh');
    refreshItem.connect('activate', () => {
      this._client.getStatus();
      this._client.listProfiles();
    });
    this.menu.addMenuItem(refreshItem);
  }

  setConnected(connected: boolean): void {
    if (!connected) {
      this._label.set_text('fmwk-pwr (off)');
    }
    // When connected, the label will be updated by updateStatus
  }
}
