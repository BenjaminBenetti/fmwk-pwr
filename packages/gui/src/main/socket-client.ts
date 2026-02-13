import net from 'node:net';
import crypto from 'node:crypto';
import type { MethodMap, MethodName, Request, Response, ErrorResponse } from '@fmwk-pwr/shared';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export class SocketClient {
  private socket: net.Socket | null = null;
  private buffer = '';
  private pending = new Map<string, PendingRequest>();
  private state: ConnectionState = 'disconnected';
  private listeners = new Set<(state: ConnectionState) => void>();
  private socketPath: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private destroyed = false;

  constructor(socketPath = '/run/fmwk-pwr/fmwk-pwr.sock') {
    this.socketPath = socketPath;
  }

  connect(): void {
    if (this.destroyed) return;
    if (this.state === 'connected' || this.state === 'connecting') return;

    this.setState('connecting');

    const socket = net.createConnection({ path: this.socketPath });

    socket.on('connect', () => {
      this.buffer = '';
      this.reconnectDelay = 1000;
      this.setState('connected');
    });

    socket.on('data', (data: Buffer) => this.handleData(data));

    socket.on('error', () => {
      // Error will be followed by 'close', reconnect handled there
    });

    socket.on('close', () => {
      this.socket = null;
      this.setState('disconnected');
      this.scheduleReconnect();
    });

    this.socket = socket;
  }

  async request<M extends MethodName>(
    method: M,
    params: MethodMap[M]['params'],
  ): Promise<MethodMap[M]['result']> {
    if (this.state !== 'connected' || !this.socket) {
      throw new Error('Not connected to server');
    }

    const id = crypto.randomUUID();
    const req: Request = { id, method, params: params as Record<string, unknown> };

    return new Promise<MethodMap[M]['result']>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.send(req);
    });
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  destroy(): void {
    this.destroyed = true;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Client destroyed'));
      this.pending.delete(id);
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.setState('disconnected');
    this.listeners.clear();
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    const lines = this.buffer.split('\n');
    // Keep the last (possibly incomplete) chunk in the buffer
    this.buffer = lines.pop()!;

    for (const line of lines) {
      if (line.length > 0) {
        this.handleMessage(line);
      }
    }
  }

  private handleMessage(raw: string): void {
    let msg: Response | ErrorResponse;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const entry = this.pending.get(msg.id);
    if (!entry) return;

    this.pending.delete(msg.id);
    clearTimeout(entry.timer);

    if ('error' in msg) {
      entry.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
    } else {
      entry.resolve(msg.result);
    }
  }

  private send(request: Request): void {
    this.socket?.write(JSON.stringify(request) + '\n');
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectTimer !== null) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
