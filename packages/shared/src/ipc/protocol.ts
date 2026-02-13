/** A JSON-RPC-style request sent from the client to the server over the Unix socket. */
export interface Request {
  /** Unique request identifier used to correlate responses. */
  id: string;
  /** IPC method name (e.g. "profile.get", "status.get"). */
  method: string;
  /** Optional method parameters as key-value pairs. */
  params?: Record<string, unknown>;
}

/** A successful response returned by the server. */
export interface Response {
  /** Request identifier this response corresponds to. */
  id: string;
  /** Method-specific result payload, absent on error. */
  result?: unknown;
}

/** An error response returned by the server when a request fails. */
export interface ErrorResponse {
  /** Request identifier this error corresponds to. */
  id: string;
  /** Structured error details. */
  error: {
    /** Machine-readable error code from the {@link ErrorCode} enum. */
    code: string;
    /** Human-readable description of the failure. */
    message: string;
  };
}
