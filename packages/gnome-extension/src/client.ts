import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const SOCKET_PATH = '/run/fmwk-pwr/fmwk-pwr.sock';
const MAX_RECONNECT_DELAY = 30;
const INITIAL_RECONNECT_DELAY = 2;

export interface HardwareInfo {
  stapmLimit: number;
  slowLimit: number;
  fastLimit: number;
  gpuClockMhz: number | null;
  gpuClockLimitMhz: number | null;
  tcpuTemp: number | null;
  cpuPower: number | null;
  gpuPower: number | null;
  socketPower: number | null;
  tunedProfile: string;
}

export interface StatusResult {
  activeProfile: string;
  activatedBy: 'manual' | 'auto' | 'startup';
  hwInfo: HardwareInfo | null;
}

export interface Profile {
  name: string;
  description?: string;
  power: {
    stapmLimit: number | null;
    slowLimit: number | null;
    fastLimit: number | null;
  };
  gpu: { clockMhz: number | null; perfLevel: 'auto' | 'high' | null };
  tunedProfile: string | null;
  match: { enabled: boolean; processPatterns: string[]; priority: number; revertProfile: string | null };
}

interface PendingRequest {
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface IpcResponse {
  id: string;
  result?: unknown;
  error?: { code: string; message: string };
}

export class FmwkPwrClient {
  onStatusChanged: ((status: StatusResult) => void) | null = null;
  onProfilesChanged: ((profiles: Profile[]) => void) | null = null;
  onConnectionChanged: ((connected: boolean) => void) | null = null;
  onError: ((error: Error) => void) | null = null;

  private _connection: Gio.SocketConnection | null = null;
  private _dataInput: Gio.DataInputStream | null = null;
  private _dataOutput: Gio.DataOutputStream | null = null;
  private _cancellable: Gio.Cancellable | null = null;
  private _pendingRequests = new Map<string, PendingRequest>();
  private _requestCounter = 0;
  private _reconnectTimerId: number | null = null;
  private _reconnectDelay = INITIAL_RECONNECT_DELAY;
  private _intentionalDisconnect = false;

  get connected(): boolean {
    return this._connection !== null;
  }

  connect(): void {
    this._intentionalDisconnect = false;
    this._doConnect();
  }

  disconnect(): void {
    this._intentionalDisconnect = true;
    this._clearReconnectTimer();
    this._closeConnection();
  }

  getStatus(): void {
    this._sendRequest('status.get', {})
      .then((result) => {
        this.onStatusChanged?.(result as StatusResult);
      })
      .catch((err) => {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
      });
  }

  listProfiles(): void {
    this._sendRequest('profile.list', {})
      .then((result) => {
        const data = result as { profiles: Profile[] };
        this.onProfilesChanged?.(data.profiles);
      })
      .catch((err) => {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
      });
  }

  applyProfile(name: string): void {
    this._sendRequest('profile.apply', { name })
      .then((result) => {
        const data = result as { profile: Profile; hwInfo: HardwareInfo };
        this.onStatusChanged?.({
          activeProfile: data.profile.name,
          activatedBy: 'manual',
          hwInfo: data.hwInfo,
        });
      })
      .catch((err) => {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
      });
  }

  private _doConnect(): void {
    try {
      const client = Gio.SocketClient.new();
      const address = Gio.UnixSocketAddress.new(SOCKET_PATH);
      const connection = client.connect(address, null);

      this._connection = connection;
      this._cancellable = Gio.Cancellable.new();

      const inputStream = connection.get_input_stream();
      this._dataInput = Gio.DataInputStream.new(inputStream);
      this._dataInput.set_newline_type(Gio.DataStreamNewlineType.LF);

      const outputStream = connection.get_output_stream();
      this._dataOutput = Gio.DataOutputStream.new(outputStream);

      this._reconnectDelay = INITIAL_RECONNECT_DELAY;
      this.onConnectionChanged?.(true);
      this._readNextLine();
    } catch (err) {
      this.onError?.(
        err instanceof Error ? err : new Error(String(err)),
      );
      this._scheduleReconnect();
    }
  }

  private _readNextLine(): void {
    const input = this._dataInput;
    const cancellable = this._cancellable;
    if (!input || !cancellable || cancellable.is_cancelled()) return;

    input.read_line_async(
      GLib.PRIORITY_DEFAULT,
      cancellable,
      (source: Gio.DataInputStream, result: Gio.AsyncResult) => {
        try {
          const [line] = source.read_line_finish_utf8(result);
          if (line === null) {
            this._handleDisconnect();
            return;
          }
          this._handleLine(line);
          this._readNextLine();
        } catch {
          this._handleDisconnect();
        }
      },
    );
  }

  private _handleLine(line: string): void {
    let response: IpcResponse;
    try {
      response = JSON.parse(line) as IpcResponse;
    } catch {
      return;
    }

    const pending = this._pendingRequests.get(response.id);
    if (!pending) return;
    this._pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(
        new Error(`${response.error.code}: ${response.error.message}`),
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private _sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this._dataOutput || !this._connection) {
        reject(new Error('Not connected'));
        return;
      }

      const id = `ext-${++this._requestCounter}`;
      const message = JSON.stringify({ id, method, params }) + '\n';

      try {
        this._dataOutput.put_string(message, null);
        this._dataOutput.flush(null);
        this._pendingRequests.set(id, { method, resolve, reject });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        this._handleDisconnect();
      }
    });
  }

  private _handleDisconnect(): void {
    this._closeConnection();
    this.onConnectionChanged?.(false);

    if (!this._intentionalDisconnect) {
      this._scheduleReconnect();
    }
  }

  private _closeConnection(): void {
    if (this._cancellable) {
      this._cancellable.cancel();
      this._cancellable = null;
    }

    if (this._connection) {
      try {
        this._connection.close(null);
      } catch {
        // already closed
      }
      this._connection = null;
    }

    this._dataInput = null;
    this._dataOutput = null;

    // Reject all pending requests
    for (const [, pending] of this._pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    this._pendingRequests.clear();
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimerId !== null) return;

    this._reconnectTimerId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      this._reconnectDelay,
      () => {
        this._reconnectTimerId = null;
        this._doConnect();
        return false;
      },
    );

    this._reconnectDelay = Math.min(
      this._reconnectDelay * 2,
      MAX_RECONNECT_DELAY,
    );
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimerId !== null) {
      GLib.source_remove(this._reconnectTimerId);
      this._reconnectTimerId = null;
    }
  }
}
