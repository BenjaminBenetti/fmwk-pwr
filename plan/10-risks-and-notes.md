# Risks, Gotchas & Open Questions

## Hardware Risks

### libryzenadj + Framework EC Conflict
Per the Framework community, the EC (embedded controller) may override
STAPM values on some Framework models. The FW16 reportedly locks STAPM
via the EC. Need to test on the Framework Desktop specifically.

**Mitigation**: On first run, call `set_stapm_limit()` then
`refresh_table()` + `get_stapm_limit()` to verify it took. If it
doesn't stick, warn the user that STAPM control may be locked by
firmware. The slow/fast limits may still work.

### GPU Clock Write Failures
GPU clock control via `pp_od_clk_voltage` may fail silently on some
configurations. Older docs reference `amdgpu.ppfeaturemask` but this
is not required on current Strix Halo / Framework Desktop.

**Mitigation**: Server verifies GPU clock writes took effect by reading
back the value after applying. Warn the user if it doesn't stick.

### sysfs Path Detection
GPU may be `card0` or `card1` depending on system config.

**Mitigation**: Auto-detect by scanning `/sys/class/drm/card*/device/vendor`
for AMD vendor ID (0x1002). Fall back to config value.

## Software Risks

### Bun Maturity
Bun's Unix socket server API may have edge cases. The `Bun.serve` with
Unix sockets had issues historically (GitHub issue #8044).

**Mitigation**: Use `Bun.listen()` TCP-style socket API instead of
`Bun.serve()` HTTP-style. Fall back to raw `net` module if needed
(Bun supports most Node.js APIs).

### GNOME Extension API Stability
GNOME Shell breaks extension APIs between major versions.

**Mitigation**: Target current Fedora GNOME version. Use the `@girs`
type packages which track API versions. Keep extension simple to
minimize breakage surface.

### Electron + Bun
Electron ships its own Node.js. Bun is used for build tooling and
the main process may use Bun-specific APIs if we bundle with Bun.
Need to verify: can Electron's main process run under Bun, or do
we compile to standard Node.js?

**Decision needed**: Either:
1. Use Bun to bundle the main process code, run under Electron's Node
2. Use Bun as the Electron runtime (experimental, may not work)
3. Keep main process as standard Node.js TS, only use Bun for building

Option 1 is the safest bet.

### libryzenadj Build & Distribution
`libryzenadj.so` is bundled with the install at `/usr/lib/fmwk-pwr/libryzenadj.so`.
The server `dlopen()`s it from that fixed path (resolved relative to the server binary).

The install script builds ryzenadj from source (needs cmake + libpci-dev)
and copies the `.so` into the install directory. For proper distribution,
this moves into an RPM/COPR spec.

## Open Questions

1. **Framework Desktop APU model** - Which specific AMD APU? This
   affects valid power limit ranges and libryzenadj compatibility.

2. **Multi-user** - Will multiple users need access? Current design
   uses group permissions which supports this, but profile storage
   in /etc means all users share profiles.

3. **GPU clock reset** - When switching from manual back to auto,
   do we need to explicitly reset the clock? Or does setting
   `power_dpm_force_performance_level` back to `auto` handle it?
   Needs testing.

4. **SMU settings persistence** - Settings applied via libryzenadj
   don't survive sleep/hibernate. The server should re-apply the
   active profile on resume. Need to hook into systemd sleep targets.

5. **Polling vs Events for process watcher** - Polling /proc is simple
   but uses CPU. Could use `fanotify` or BPF for event-driven detection,
   but that's much more complex. Polling at 5s interval should be fine.

6. **libryzenadj thread safety** - Verify whether the `ryzen_access`
   handle is safe to use from Bun's event loop without mutex. Likely
   fine since we only call it from the main thread and calls are fast.
