declare module "sockjs-client" {
  export default class SockJS {
    constructor(url: string);
    close(): void;
    send(data: string): void;
    addEventListener(event: string, callback: (event: Event) => void): void;
    removeEventListener(event: string, callback: (event: Event) => void): void;
  }
}
