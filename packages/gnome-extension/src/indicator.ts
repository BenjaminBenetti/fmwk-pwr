import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import type { FmwkPwrClient, StatusResult, Profile } from './client.js';

interface StatusItems {
  limits: St.Label;
  cpuClock: St.Label;
  gpuClock: St.Label;
  socketPower: St.Label;
  cpuPower: St.Label;
  gpuPower: St.Label;
  temp: St.Label;
}

export const FmwkPwrIndicator = GObject.registerClass(
class FmwkPwrIndicator extends PanelMenu.Button {
  private _client: FmwkPwrClient;
  private _label: St.Label;
  private _statusItems!: StatusItems;
  private _profileSection: PopupMenu.PopupBaseMenuItem[] = [];

  constructor(client: FmwkPwrClient) {
    super(0.0, 'fmwk-pwr', false);
    this._client = client;

    this._label = new St.Label({
      text: 'fpwr',
      y_align: 2, // Clutter.ActorAlign.CENTER
    });
    this.add_child(this._label);

    this._buildMenu();
  }

  private _addStatusItem(label: St.Label): void {
    const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: 'fmwk-pwr-status-item' });
    item.add_child(label);
    this.menu.addMenuItem(item);
  }

  private _createStatusItems(texts: Record<keyof StatusItems, string>): StatusItems {
    return {
      limits: new St.Label({ text: texts.limits }),
      cpuClock: new St.Label({ text: texts.cpuClock }),
      gpuClock: new St.Label({ text: texts.gpuClock }),
      socketPower: new St.Label({ text: texts.socketPower }),
      cpuPower: new St.Label({ text: texts.cpuPower }),
      gpuPower: new St.Label({ text: texts.gpuPower }),
      temp: new St.Label({ text: texts.temp }),
    };
  }

  private _addAllStatusItems(): void {
    this._addStatusItem(this._statusItems.limits);
    this._addStatusItem(this._statusItems.cpuClock);
    this._addStatusItem(this._statusItems.gpuClock);
    this._addStatusItem(this._statusItems.socketPower);
    this._addStatusItem(this._statusItems.cpuPower);
    this._addStatusItem(this._statusItems.gpuPower);
    this._addStatusItem(this._statusItems.temp);
  }

  private static readonly DEFAULT_TEXTS: Record<keyof StatusItems, string> = {
    limits: 'Limits: --',
    cpuClock: 'CPU Clock: --',
    gpuClock: 'GPU Clock: --',
    socketPower: 'Power: --',
    cpuPower: 'CPU Power: --',
    gpuPower: 'GPU Power: --',
    temp: 'Temp: --',
  };

  private _buildMenu(): void {
    this._statusItems = this._createStatusItems(FmwkPwrIndicator.DEFAULT_TEXTS);
    this._addAllStatusItems();

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
    this._label.set_text(`fpwr: ${status.activeProfile}`);

    const hw = status.hwInfo;
    if (hw === null) {
      for (const key of Object.keys(FmwkPwrIndicator.DEFAULT_TEXTS) as (keyof StatusItems)[]) {
        this._statusItems[key].set_text(FmwkPwrIndicator.DEFAULT_TEXTS[key]);
      }
      return;
    }

    const stapm = Math.round(hw.stapmLimit / 1000);
    const slow = Math.round(hw.slowLimit / 1000);
    const fast = Math.round(hw.fastLimit / 1000);
    this._statusItems.limits.set_text(`Limits: ${stapm}W / ${slow}W / ${fast}W`);

    this._statusItems.cpuClock.set_text(
      hw.cpuClockMhz !== null ? `CPU Clock: ${hw.cpuClockMhz} MHz` : 'CPU Clock: --'
    );

    this._statusItems.gpuClock.set_text(
      hw.gpuClockMhz !== null ? `GPU Clock: ${hw.gpuClockMhz} MHz` : 'GPU Clock: auto'
    );

    if (hw.socketPower !== null) {
      this._statusItems.socketPower.set_text(`Power: ${(hw.socketPower / 1000).toFixed(1)}W`);
    } else {
      this._statusItems.socketPower.set_text('Power: --');
    }

    this._statusItems.cpuPower.set_text(
      hw.cpuPower !== null ? `CPU Power: ${(hw.cpuPower / 1000).toFixed(1)}W` : 'CPU Power: --'
    );

    this._statusItems.gpuPower.set_text(
      hw.gpuPower !== null ? `GPU Power: ${(hw.gpuPower / 1000).toFixed(1)}W` : 'GPU Power: --'
    );

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
    const savedTexts = {} as Record<keyof StatusItems, string>;
    for (const key of Object.keys(this._statusItems) as (keyof StatusItems)[]) {
      savedTexts[key] = this._statusItems[key].text ?? FmwkPwrIndicator.DEFAULT_TEXTS[key];
    }

    // Clear everything
    this.menu.removeAll();
    this._profileSection = [];

    // Rebuild status section
    this._statusItems = this._createStatusItems(savedTexts);
    this._addAllStatusItems();

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
      this._label.set_text('fpwr (off)');
    }
    // When connected, the label will be updated by updateStatus
  }
});
