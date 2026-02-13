import type { ServerConfig } from "../server-config.js";

// =====================================
// Params
// =====================================

/** Parameters for config.get -- no input required. */
export interface ConfigGetParams {}

/** Parameters for config.update. */
export interface ConfigUpdateParams {
  /** Partial server configuration -- only provided fields are updated. */
  config: Partial<ServerConfig>;
}

// =====================================
// Results
// =====================================

/** Result of config.get. */
export interface ConfigGetResult {
  /** The full current server configuration. */
  config: ServerConfig;
}

/** Result of config.update. */
export interface ConfigUpdateResult {
  /** The full server configuration after applying changes. */
  config: ServerConfig;
}
