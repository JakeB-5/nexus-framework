// @nexus/http - NexusRequest wrapping IncomingMessage
import type { IncomingMessage } from "node:http";
import { parseBody } from "./body-parser.js";
import { parseCookies } from "./cookie.js";
import type { HttpMethod, NexusRequestInterface } from "./types.js";

export class NexusRequest implements NexusRequestInterface {
  public readonly raw: IncomingMessage;
  public readonly method: HttpMethod;
  public readonly url: string;
  public readonly path: string;
  public readonly query: URLSearchParams;
  public readonly headers: Record<string, string | string[] | undefined>;
  public params: Record<string, string> = {};

  private _cookies: Record<string, string> | undefined;
  private _body: unknown | undefined;
  private _bodyParsed = false;
  private readonly _trustProxy: boolean;

  constructor(raw: IncomingMessage, trustProxy = false) {
    this.raw = raw;
    this._trustProxy = trustProxy;
    this.method = (raw.method?.toUpperCase() ?? "GET") as HttpMethod;
    this.url = raw.url ?? "/";
    this.headers = raw.headers as Record<string, string | string[] | undefined>;

    // Parse URL
    const questionIdx = this.url.indexOf("?");
    if (questionIdx === -1) {
      this.path = this.url;
      this.query = new URLSearchParams();
    } else {
      this.path = this.url.slice(0, questionIdx);
      this.query = new URLSearchParams(this.url.slice(questionIdx + 1));
    }
  }

  get ip(): string {
    if (this._trustProxy) {
      const forwarded = this.get("x-forwarded-for");
      if (forwarded) {
        const first = forwarded.split(",")[0];
        if (first) {
          return first.trim();
        }
      }
    }
    return this.raw.socket.remoteAddress ?? "127.0.0.1";
  }

  get cookies(): Record<string, string> {
    if (!this._cookies) {
      const cookieHeader = this.get("cookie");
      this._cookies = parseCookies(cookieHeader);
    }
    return this._cookies;
  }

  get(header: string): string | undefined {
    const value = this.headers[header.toLowerCase()];
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value;
  }

  async body(): Promise<unknown> {
    if (!this._bodyParsed) {
      this._body = await parseBody(this.raw);
      this._bodyParsed = true;
    }
    return this._body;
  }
}
