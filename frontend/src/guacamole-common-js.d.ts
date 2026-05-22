declare module "guacamole-common-js" {
  const Guacamole: {
    Client: new (tunnel: unknown) => {
      connect(query?: string): void;
      disconnect(): void;
      getDisplay(): {
        getElement(): HTMLElement;
        getWidth(): number;
        getHeight(): number;
        getScale(): number;
        scale(value: number): void;
      };
      sendMouseState(state: unknown): void;
      sendKeyEvent(pressed: number, keysym: number): void;
      sendSize(w: number, h: number): void;
      onstatechange?: (state: number) => void;
      onerror?: (error: { message?: string; code?: number }) => void;
      onclipboard?: (stream: unknown, mimetype: string) => void;
      onname?: (name: string) => void;
    };
    WebSocketTunnel: new (url: string) => unknown;
    Mouse: new (el: HTMLElement) => {
      onmousedown?: (state: unknown) => void;
      onmouseup?: (state: unknown) => void;
      onmousemove?: (state: unknown) => void;
    };
    Keyboard: new (el: Document | HTMLElement) => {
      onkeydown?: (keysym: number) => boolean | void;
      onkeyup?: (keysym: number) => boolean | void;
    };
  };
  export default Guacamole;
  export = Guacamole;
}
