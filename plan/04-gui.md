# Electron GUI Development Plan

## Technology Choices
- **Electron** with Bun as the build/runtime for main process
- **React** for renderer UI (lightweight, good Electron ecosystem)
- **Tailwind CSS** for styling (fast iteration)
- **Manual packaging** — Bun bundles the code, we assemble the Electron
  app directory ourselves. No Electron Forge/Builder/Packager wrappers.
- Communication: Electron main process connects to server Unix socket,
  bridges to renderer via contextBridge/IPC

## Window Design

Small, narrow, vertically-stacked window. Think a compact panel — not a
full-size app window. One unified view, no separate pages or tabs for
dashboard vs editor. Live state and controls are intermixed.

```
┌──────────────────────────────┐
│  Profile: gaming-balanced  ▼ │  ← dropdown to switch / manage profiles
├──────────────────────────────┤
│  STAPM Limit                 │
│  [====|============] 132 W   │  ← slider + live readout
│                              │
│  Slow PPT Limit              │
│  [======|==========] 154 W   │
│                              │
│  Fast PPT Limit              │
│  [not set         ]   —      │  ← "don't change" state
├──────────────────────────────┤
│  GPU Clock                   │
│  [==========|======] 2700 MHz│
│                              │
│  GPU Perf Level   [Auto | High]  ← only when clock not set
├──────────────────────────────┤
│  System Profile              │
│  [ accelerator-performance ▼]│  ← tuned-adm dropdown
├──────────────────────────────┤
│  Power         Socket  CPU GPU│
│  (mW)          98400  62100 —│  ← live sensor readout
│  CPU Temp           72°C     │
│  GPU Clock         2700 MHz  │
├──────────────────────────────┤
│  Auto-Match  [on/off]        │
│  Patterns: steam.*game       │
│            gamescope         │
│  Priority: 10                │
├──────────────────────────────┤
│          [ Apply ]           │
└──────────────────────────────┘
```

Key ideas:
- The whole window IS the profile editor + live monitor in one
- Top section: profile selector dropdown (switch, create new, delete)
- Middle sections: sliders/inputs that show AND control the profile values
- Sensor readout section: live values from the server (read-only)
- Bottom: auto-match config + save controls
- Changing a slider updates the profile in memory; "Apply" persists and applies it
- Switching profiles via dropdown loads that profile's values into the controls

## Phase 1: Skeleton

### 1.1 Project Setup
- Electron + Bun + TypeScript setup
- Main process, preload script, renderer process
- Hot reload for development
- Share types with server via workspace/symlink
- Window config: narrow fixed-width, resizable height, no menu bar

### 1.2 Socket Client
- Main process: connect to `/run/fmwk-pwr/fmwk-pwr.sock`
- Reconnection logic (server restarts, socket not yet available)
- Bridge socket messages to renderer via `ipcMain`/`ipcRenderer`
- Typed API in preload: `window.fmwkPwr.getStatus()`, etc.

## Phase 2: Main View

### 2.1 Profile Selector
- Dropdown at the top showing active profile name
- Switch profiles (sends `profile.apply` to server)
- "New Profile" / "Delete" / "Duplicate" actions in dropdown

### 2.2 Power Controls
- STAPM / Slow PPT / Fast PPT sliders with number inputs
- Display in W (convert from mW internally)
- Each slider has a "don't change" toggle (sets null)
- Values loaded from the selected profile

### 2.3 GPU Controls
- GPU clock slider + number input (MHz)
- When clock is set: perf level hidden (implicitly manual)
- When clock is null: show Auto / High toggle
- "Don't change" toggle

### 2.4 System Profile
- Dropdown of available tuned-adm profiles (fetched from server)
- "Don't change" option

### 2.5 Live Sensor Readout
- Read-only section showing real-time values from server
- Socket power, CPU power, GPU power (mW)
- CPU temp
- Current GPU clock
- Auto-refresh via `status.subscribe`

### 2.6 Auto-Match Section
- Enable/disable toggle
- Editable list of regex patterns
- Priority number input

### 2.7 Apply Button
- "Apply" — saves the profile AND applies changes to hardware in one action
- Visual indicator when values are modified but not yet applied

## Phase 3: Settings & Polish

### 3.1 Settings (accessible via gear icon or similar)
- GPU sysfs path (with auto-detect button)
- Process watcher interval
- Default profile selection (required — always one active)
- Server connection status

### 3.2 System Tray
- Minimize to tray option
- Tray icon shows current profile
- Right-click: quick profile switch menu

### 3.3 Packaging
- Manual Electron packaging:
  1. `bun build` main process, preload, and renderer
  2. Copy bundled output into Electron's `resources/app/`
  3. Package into RPM for Fedora (electron binary + app resources)
- Desktop entry file (`fmwk-pwr.desktop`)
- Icon
