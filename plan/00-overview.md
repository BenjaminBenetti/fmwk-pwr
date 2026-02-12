# Framework Power (fmwk-pwr) - Project Overview

## Mission
Automate power limit tuning, GPU clock management, and system power profile
selection on the Framework Desktop (AMD APU) to optimize CPU/GPU power split
per workload, with automatic profile switching based on running processes.

## Core Problems Solved
1. **Power limit tuning** - The default STAPM/slow/fast limits leave performance
   on the table. Users want higher sustained and boost power.
2. **CPU/GPU power split** - The default GPU clocks starve the CPU. Lowering GPU
   clocks by a few hundred MHz frees GHz of CPU headroom for CPU-bound games.
3. **System power profile** - Different workloads benefit from different tuned-adm
   profiles (e.g. `accelerator-performance` for gaming, `balanced` for desktop).
   Switching these manually per-app is tedious.
4. **Manual switching is tedious** - Users shouldn't have to run shell commands
   every time they launch a game. Profiles + process matching automates all three
   of the above.

## Three Components

### 1. Server (`fmwk-pwr-server`)
- Runs as root via systemd (needs root for SMU access and sysfs writes)
- Listens on a Unix domain socket for client commands
- **Hardware strategy pattern** — detects hardware on boot, loads the
  appropriate strategy. All hw interaction goes through the strategy interface.
  Currently implements: Strix Halo (Framework Desktop).
- Manages profiles, applies settings via strategy, monitors running processes
- Periodically scans process list and auto-switches profiles on regex match

### 2. GUI (`fmwk-pwr-gui`)
- Electron app for profile management
- Create/edit/delete profiles (power limits + GPU clock + tuned-adm profile + process regex)
- Manual profile switching
- Real-time display of current hardware state (fetched from server)
- Communicates with server over the Unix socket

### 3. GNOME Top Bar Extension (`fmwk-pwr-indicator`)
- Shows the currently active power profile name/icon in the top bar
- Click to see quick profile switcher dropdown
- Communicates with server over the Unix socket

## Hardware Control Methods

| Control          | Tool/Interface                                         | Requires |
|------------------|--------------------------------------------------------|----------|
| STAPM limit      | `libryzenadj` FFI: `set_stapm_limit()`                | root     |
| Slow PPT limit   | `libryzenadj` FFI: `set_slow_limit()`                 | root     |
| Fast PPT limit   | `libryzenadj` FFI: `set_fast_limit()`                 | root     |
| Read power limits| `libryzenadj` FFI: `get_*_limit()` getters            | root     |
| Read sensors     | HWMON/sysfs (temp, power draw, GPU clock)              | root     |
| GPU clock        | sysfs: `/sys/class/drm/card1/device/pp_od_clk_voltage`| root     |
| GPU perf level   | sysfs: `.../power_dpm_force_performance_level`         | root     |
| Power profile    | `tuned-adm profile <name>`                             | root     |

## Technology Stack
- **Runtime**: Bun
- **Language**: TypeScript (strict)
- **SMU Control**: libryzenadj via `bun:ffi` (direct shared library binding)
- **Server**: Bun native Unix socket server
- **GUI**: Electron + Bun bundler
- **GNOME Extension**: GJS (TypeScript compiled to GJS-compatible JS)
- **IPC**: JSON-over-Unix-socket protocol
- **Config**: JSON files in `/etc/fmwk-pwr/`
- **Process**: systemd service unit
