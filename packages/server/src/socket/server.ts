import { unlinkSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import type { Socket } from "bun";
import { ErrorCode, type Request, type Response, type ErrorResponse } from "@fmwk-pwr/shared";

// =====================================
// Types
// =====================================

/** Async function that processes a parsed IPC request and returns a response or error. */
export type MessageHandler = (
  request: Request,
) => Promise<Response | ErrorResponse>;

/** Per-connection state attached to each client socket. */
interface SocketData {
  /** Accumulates incomplete incoming data until a full newline-delimited message is received. */
  buffer: string;
}

// =====================================
// Socket Server
// =====================================

/**
 * Unix domain socket server that accepts newline-delimited JSON messages.
 * Manages client connections, message framing, and request/response dispatch.
 */
export class SocketServer {
  private connections = new Set<Socket<SocketData>>();
  private server: ReturnType<typeof Bun.listen<SocketData>> | null = null;
  private handler: MessageHandler;
  private socketPath: string;

  /**
   * Creates a new SocketServer instance.
   * @param socketPath - Absolute path for the Unix domain socket (e.g. /run/fmwk-pwr/fmwk-pwr.sock)
   * @param handler - Async function that processes parsed requests and returns responses
   */
  constructor(socketPath: string, handler: MessageHandler) {
    this.socketPath = socketPath;
    this.handler = handler;
  }

  // =====================================
  // Lifecycle
  // =====================================

  /**
   * Starts listening on the Unix domain socket.
   * Creates the socket directory if it does not exist and removes any stale socket file.
   */
  start(): void {
    const socketDir = dirname(this.socketPath);
    if (!existsSync(socketDir)) {
      mkdirSync(socketDir, { recursive: true });
    }

    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }

    this.server = Bun.listen<SocketData>({
      unix: this.socketPath,
      socket: {
        open: (socket) => {
          socket.data = { buffer: "" };
          this.connections.add(socket);
          console.log(
            `[socket] Client connected (${this.connections.size} total)`,
          );
        },
        data: (socket, data) => {
          this.handleData(socket, data);
        },
        close: (socket) => {
          this.connections.delete(socket);
          console.log(
            `[socket] Client disconnected (${this.connections.size} total)`,
          );
        },
        error: (_socket, error) => {
          console.error("[socket] Socket error:", error.message);
        },
      },
    });

    // Allow non-root clients (GUI, GNOME extension) to connect
    chmodSync(this.socketPath, 0o666);

    console.log(`[socket] Listening on ${this.socketPath}`);
  }

  /**
   * Gracefully stops the server: closes all client connections, stops
   * the listener, and removes the socket file from disk.
   */
  stop(): void {
    for (const socket of this.connections) {
      socket.end();
    }
    this.connections.clear();

    this.server?.stop();
    this.server = null;

    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }

    console.log("[socket] Server stopped");
  }

  // =====================================
  // Message Framing
  // =====================================

  /**
   * Accumulates incoming data into a per-socket buffer and extracts
   * complete newline-delimited messages for processing.
   * @param socket - The client socket that sent the data
   * @param data - Raw bytes received from the socket
   */
  private handleData(socket: Socket<SocketData>, data: Buffer | Uint8Array): void {
    socket.data.buffer += Buffer.from(data).toString("utf-8");

    const lines = socket.data.buffer.split("\n");
    // Keep the last incomplete line in the buffer
    socket.data.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.processMessage(socket, trimmed);
    }
  }

  // =====================================
  // Message Processing
  // =====================================

  /**
   * Parses a single JSON message, validates its structure, dispatches it
   * to the handler, and writes the response back to the client.
   * @param socket - The client socket to respond to
   * @param raw - Raw JSON string (one complete message)
   */
  private async processMessage(
    socket: Socket<SocketData>,
    raw: string,
  ): Promise<void> {
    let request: Request;
    try {
      request = JSON.parse(raw);
    } catch {
      const error: ErrorResponse = {
        id: "",
        error: { code: ErrorCode.ParseError, message: "Invalid JSON" },
      };
      this.send(socket, error);
      return;
    }

    if (!request.id || !request.method) {
      const error: ErrorResponse = {
        id: request.id ?? "",
        error: {
          code: ErrorCode.InvalidRequest,
          message: "Request must have id and method fields",
        },
      };
      this.send(socket, error);
      return;
    }

    try {
      const response = await this.handler(request);
      this.send(socket, response);
    } catch (err) {
      const error: ErrorResponse = {
        id: request.id,
        error: {
          code: ErrorCode.InternalError,
          message: err instanceof Error ? err.message : "Unknown error",
        },
      };
      this.send(socket, error);
    }
  }

  /**
   * Serializes a response as newline-delimited JSON and writes it to a single client.
   * @param socket - The client socket to write to
   * @param message - The response or error to send
   */
  private send(
    socket: Socket<SocketData>,
    message: Response | ErrorResponse,
  ): void {
    socket.write(JSON.stringify(message) + "\n");
  }

  /**
   * Serializes a response as newline-delimited JSON and writes it to all connected clients.
   * Used for push notifications like hardware info updates.
   * @param message - The response or error to broadcast
   */
  broadcast(message: Response | ErrorResponse): void {
    const data = JSON.stringify(message) + "\n";
    for (const socket of this.connections) {
      socket.write(data);
    }
  }
}
