// GJS global functions
declare function log(message: string): void;
declare function logError(error: Error, message?: string): void;

declare module 'gi://GObject' {
  namespace GObject {
    function registerClass<T extends new (...args: any[]) => any>(
      klass: T,
    ): T;
    function registerClass<T extends new (...args: any[]) => any>(
      options: { GTypeName?: string },
      klass: T,
    ): T;
  }
  export default GObject;
}

declare module 'gi://GLib' {
  namespace GLib {
    const PRIORITY_DEFAULT: number;
    function timeout_add_seconds(
      priority: number,
      interval: number,
      callback: () => boolean,
    ): number;
    function timeout_add(
      priority: number,
      interval: number,
      callback: () => boolean,
    ): number;
    function source_remove(id: number): boolean;
  }
  export default GLib;
}

declare module 'gi://Gio' {
  namespace Gio {
    class Cancellable {
      static new(): Cancellable;
      cancel(): void;
      is_cancelled(): boolean;
    }
    class SocketClient {
      static new(): SocketClient;
      connect(
        connectable: SocketConnectable,
        cancellable: Cancellable | null,
      ): SocketConnection;
    }
    interface SocketConnectable {}
    class UnixSocketAddress implements SocketConnectable {
      static new(path: string): UnixSocketAddress;
    }
    class SocketConnection {
      get_input_stream(): InputStream;
      get_output_stream(): OutputStream;
      close(cancellable: Cancellable | null): boolean;
      is_connected(): boolean;
    }
    class InputStream {
      close(cancellable: Cancellable | null): boolean;
    }
    class OutputStream {
      write_all(
        data: Uint8Array,
        cancellable: Cancellable | null,
      ): [boolean, number];
      flush(cancellable: Cancellable | null): boolean;
    }
    class DataInputStream extends InputStream {
      static new(base: InputStream): DataInputStream;
      set_newline_type(type: DataStreamNewlineType): void;
      read_line_utf8(
        cancellable: Cancellable | null,
      ): [string | null, number];
      read_line_async(
        priority: number,
        cancellable: Cancellable | null,
        callback: (source: DataInputStream, result: AsyncResult) => void,
      ): void;
      read_line_finish_utf8(result: AsyncResult): [string | null, number];
    }
    class DataOutputStream extends OutputStream {
      static new(base: OutputStream): DataOutputStream;
      put_string(str: string, cancellable: Cancellable | null): boolean;
    }
    enum DataStreamNewlineType {
      LF = 1,
    }
    interface AsyncResult {}
  }
  export default Gio;
}

declare module 'gi://St' {
  namespace St {
    class Widget {
      style_class: string;
      destroy(): void;
      add_child(child: Widget): void;
      remove_child(child: Widget): void;
    }
    class Label extends Widget {
      constructor(params?: {
        text?: string;
        style_class?: string;
        y_align?: number;
      });
      text: string;
      set_text(text: string): void;
    }
    class Icon extends Widget {
      constructor(params?: { icon_name?: string; style_class?: string });
      icon_name: string;
    }
    class BoxLayout extends Widget {
      constructor(params?: { style_class?: string });
      add_child(child: Widget): void;
    }
    class Bin extends Widget {
      constructor(params?: { child?: Widget });
    }
  }
  export default St;
}

declare module 'gi://Clutter' {
  namespace Clutter {
    enum ActorAlign {
      CENTER = 2,
    }
    class Actor {
      destroy(): void;
    }
  }
  export default Clutter;
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export class Extension {
    readonly path: string;
    readonly uuid: string;
    readonly metadata: Record<string, unknown>;
    getSettings(): any;
    enable(): void;
    disable(): void;
  }
}

declare module 'resource:///org/gnome/shell/ui/main.js' {
  export const panel: {
    addToStatusArea(
      role: string,
      indicator: any,
      position?: number,
      box?: string,
    ): void;
  };
}

declare module 'resource:///org/gnome/shell/ui/panelMenu.js' {
  import St from 'gi://St';

  export class Button extends St.Widget {
    constructor(
      menuAlignment: number,
      nameText: string,
      dontCreateMenu?: boolean,
    );
    menu: import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenu;
    destroy(): void;
  }
}

declare module 'resource:///org/gnome/shell/ui/popupMenu.js' {
  import St from 'gi://St';
  import Clutter from 'gi://Clutter';

  export class PopupMenu {
    removeAll(): void;
    addMenuItem(
      item: PopupBaseMenuItem | PopupSeparatorMenuItem,
    ): void;
    box: St.BoxLayout;
  }

  export class PopupBaseMenuItem extends St.BoxLayout {
    constructor(params?: {
      reactive?: boolean;
      can_focus?: boolean;
      style_class?: string;
    });
    add_child(child: St.Widget): void;
    setOrnament(ornament: number): void;
    connect(signal: string, callback: (...args: any[]) => void): number;
    label: St.Label;
  }

  export class PopupMenuItem extends PopupBaseMenuItem {
    constructor(text: string, params?: object);
    label: St.Label;
    setOrnament(ornament: number): void;
  }

  export class PopupSeparatorMenuItem extends PopupBaseMenuItem {
    constructor(text?: string);
  }

  export const Ornament: {
    NONE: number;
    DOT: number;
    CHECK: number;
    HIDDEN: number;
  };
}
