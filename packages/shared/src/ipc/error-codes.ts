// =====================================
// Error Codes
// =====================================

/**
 * Machine-readable error codes returned in ErrorResponse messages.
 * Shared between server and clients to ensure consistent error handling.
 */
export const ErrorCode = {
  /** Incoming message was not valid JSON */
  ParseError: "PARSE_ERROR",
  /** Message was valid JSON but not a valid Request (missing id or method) */
  InvalidRequest: "INVALID_REQUEST",
  /** Required parameters were missing or had invalid types */
  InvalidParams: "INVALID_PARAMS",
  /** The requested method does not exist */
  MethodNotFound: "METHOD_NOT_FOUND",
  /** An unexpected error occurred while processing the request */
  InternalError: "INTERNAL_ERROR",
  /** The specified profile does not exist */
  ProfileNotFound: "PROFILE_NOT_FOUND",
  /** Profile data failed validation (bad values, invalid regex, etc.) */
  ValidationError: "VALIDATION_ERROR",
  /** Cannot delete the currently active profile */
  CannotDeleteActive: "CANNOT_DELETE_ACTIVE",
  /** Cannot delete the last remaining profile */
  CannotDeleteLast: "CANNOT_DELETE_LAST",
  /** An error occurred while applying a profile to hardware */
  ApplyError: "APPLY_ERROR",
} as const;

/** Union type of all valid error code strings */
export type ErrorCodeName = (typeof ErrorCode)[keyof typeof ErrorCode];
