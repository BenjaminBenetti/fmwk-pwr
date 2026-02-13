import { dlopen, FFIType } from "bun:ffi";

const LIB_PATH = "/usr/lib/fmwk-pwr/libryzenadj.so";

// =====================================
// FFI Symbols
// =====================================

/**
 * Native symbol definitions for libryzenadj.so.
 *
 * These map 1:1 to the C API exported by libryzenadj. The library
 * communicates with the AMD SMU (System Management Unit) to read
 * and write power limits for Ryzen processors.
 *
 * - Setter functions accept values in mW and return 0 on success.
 * - Getter functions return values in W (float) after a table refresh.
 */
const symbols = {
  init_ryzenadj: { returns: FFIType.ptr, args: [] },
  cleanup_ryzenadj: { returns: FFIType.void, args: [FFIType.ptr] },
  init_table: { returns: FFIType.i32, args: [FFIType.ptr] },
  refresh_table: { returns: FFIType.i32, args: [FFIType.ptr] },
  set_stapm_limit: { returns: FFIType.i32, args: [FFIType.ptr, FFIType.u32] },
  set_fast_limit: { returns: FFIType.i32, args: [FFIType.ptr, FFIType.u32] },
  set_slow_limit: { returns: FFIType.i32, args: [FFIType.ptr, FFIType.u32] },
  get_stapm_limit: { returns: FFIType.f32, args: [FFIType.ptr] },
  get_fast_limit: { returns: FFIType.f32, args: [FFIType.ptr] },
  get_slow_limit: { returns: FFIType.f32, args: [FFIType.ptr] },
} as const;

/** Typed handle returned by dlopen for the libryzenadj shared library. */
type Lib = ReturnType<typeof dlopen<typeof symbols>>;

// =====================================
// Lifecycle
// =====================================

/**
 * Wrapper around libryzenadj for reading and writing AMD SMU power limits.
 *
 * Opens the shared library via Bun FFI, initializes a ryzenadj handle and
 * its internal SMU PM table. All power limit values are exchanged in mW
 * (the native library uses mW for setters but W for getters, so getters
 * are converted to mW internally).
 *
 * Must call {@link destroy} on shutdown to free the native handle.
 */
export class RyzenAdj {
  private readonly lib: Lib;
  private readonly handle: NonNullable<ReturnType<Lib["symbols"]["init_ryzenadj"]>>;

  /**
   * Open libryzenadj.so and initialize the SMU handle and PM table.
   * @throws If the library cannot be loaded, the handle is null, or the PM table init fails
   */
  constructor() {
    this.lib = dlopen(LIB_PATH, symbols);

    const h = this.lib.symbols.init_ryzenadj();
    if (h === null) {
      throw new Error("Failed to initialize ryzenadj (init_ryzenadj returned null)");
    }
    this.handle = h;

    const tableResult = this.lib.symbols.init_table(this.handle);
    if (tableResult !== 0) {
      this.lib.symbols.cleanup_ryzenadj(this.handle);
      this.lib.close();
      throw new Error(`Failed to initialize ryzenadj table (error code: ${tableResult})`);
    }
  }

  // =====================================
  // Setters
  // =====================================

  /**
   * Set the STAPM (Skin Temperature Aware Power Management) limit via SMU.
   * @param mW - Power limit in milliwatts
   * @throws If the SMU command fails (non-zero return code)
   */
  setStapmLimit(mW: number): void {
    const result = this.lib.symbols.set_stapm_limit(this.handle, mW);
    if (result !== 0) {
      throw new Error(`Failed to set STAPM limit (error code: ${result})`);
    }
  }

  /**
   * Set the slow PPT (Package Power Tracking) limit via SMU.
   * @param mW - Power limit in milliwatts
   * @throws If the SMU command fails (non-zero return code)
   */
  setSlowLimit(mW: number): void {
    const result = this.lib.symbols.set_slow_limit(this.handle, mW);
    if (result !== 0) {
      throw new Error(`Failed to set slow limit (error code: ${result})`);
    }
  }

  /**
   * Set the fast PPT (Package Power Tracking) limit via SMU.
   * @param mW - Power limit in milliwatts
   * @throws If the SMU command fails (non-zero return code)
   */
  setFastLimit(mW: number): void {
    const result = this.lib.symbols.set_fast_limit(this.handle, mW);
    if (result !== 0) {
      throw new Error(`Failed to set fast limit (error code: ${result})`);
    }
  }

  // =====================================
  // Getters
  // =====================================

  /**
   * Refresh the SMU PM table so subsequent getter calls return fresh data.
   * @throws If the table refresh fails (non-zero return code)
   */
  refreshTable(): void {
    const result = this.lib.symbols.refresh_table(this.handle);
    if (result !== 0) {
      throw new Error(`Failed to refresh ryzenadj table (error code: ${result})`);
    }
  }

  /**
   * Read all three power limits after a single PM table refresh.
   * The native getters return watts (float); values are converted to mW (integer).
   * @returns Current STAPM, slow PPT, and fast PPT limits in mW
   */
  getLimits(): { stapm: number; slow: number; fast: number } {
    this.refreshTable();
    return {
      stapm: Math.round(this.lib.symbols.get_stapm_limit(this.handle) * 1000),
      slow: Math.round(this.lib.symbols.get_slow_limit(this.handle) * 1000),
      fast: Math.round(this.lib.symbols.get_fast_limit(this.handle) * 1000),
    };
  }

  /**
   * Free the native ryzenadj handle and close the shared library.
   */
  destroy(): void {
    this.lib.symbols.cleanup_ryzenadj(this.handle);
    this.lib.close();
  }
}
