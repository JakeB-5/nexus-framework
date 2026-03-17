// @nexus/http - HttpServer class
import { createServer, type Server } from "node:http";
import { HttpError, InternalServerError } from "./errors.js";
import { MiddlewarePipeline } from "./middleware.js";
import { NexusRequest } from "./request.js";
import { NexusResponse } from "./response.js";
import type {
  ErrorMiddlewareFunction,
  HttpServerOptions,
  MiddlewareEntry,
  MiddlewareFunction,
  NexusRequestInterface,
  NexusResponseInterface,
} from "./types.js";

export class HttpServer {
  private _server: Server | undefined;
  private readonly _options: Required<HttpServerOptions>;
  private readonly _pipeline: MiddlewarePipeline;
  private _requestHandler:
    | ((req: NexusRequestInterface, res: NexusResponseInterface) => void | Promise<void>)
    | undefined;
  private _listening = false;

  constructor(options?: HttpServerOptions) {
    this._options = {
      port: options?.port ?? 3000,
      host: options?.host ?? "0.0.0.0",
      keepAliveTimeout: options?.keepAliveTimeout ?? 5000,
      requestTimeout: options?.requestTimeout ?? 30000,
      maxHeaderSize: options?.maxHeaderSize ?? 16384,
      trustProxy: options?.trustProxy ?? false,
    };
    this._pipeline = new MiddlewarePipeline();
  }

  use(...middlewares: MiddlewareEntry[]): this {
    this._pipeline.use(...middlewares);
    return this;
  }

  onRequest(
    handler: (req: NexusRequestInterface, res: NexusResponseInterface) => void | Promise<void>,
  ): this {
    this._requestHandler = handler;
    return this;
  }

  async listen(port?: number, host?: string): Promise<{ port: number; host: string }> {
    const listenPort = port ?? this._options.port;
    const listenHost = host ?? this._options.host;

    this._server = createServer(
      { maxHeaderSize: this._options.maxHeaderSize },
      (rawReq, rawRes) => {
        const req = new NexusRequest(rawReq, this._options.trustProxy);
        const res = new NexusResponse(rawRes);
        void this._handleRequest(req, res);
      },
    );

    this._server.keepAliveTimeout = this._options.keepAliveTimeout;
    this._server.requestTimeout = this._options.requestTimeout;

    return new Promise((resolve, reject) => {
      const server = this._server!;

      server.on("error", (err) => {
        if (!this._listening) {
          reject(err);
        }
      });

      server.listen(listenPort, listenHost, () => {
        this._listening = true;
        const addr = server.address();
        const actualPort = typeof addr === "object" && addr !== null ? addr.port : listenPort;
        resolve({ port: actualPort, host: listenHost });
      });
    });
  }

  async close(): Promise<void> {
    if (!this._server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this._server!.close((err) => {
        this._listening = false;
        this._server = undefined;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  get listening(): boolean {
    return this._listening;
  }

  get server(): Server | undefined {
    return this._server;
  }

  get pipeline(): MiddlewarePipeline {
    return this._pipeline;
  }

  private async _handleRequest(
    req: NexusRequestInterface,
    res: NexusResponseInterface,
  ): Promise<void> {
    try {
      // Execute middleware pipeline
      await this._pipeline.execute(req, res);

      // If response not sent yet, invoke request handler
      if (!res.headersSent && this._requestHandler) {
        await this._requestHandler(req, res);
      }

      // If still no response, send 404
      if (!res.headersSent) {
        res.status(404).json({ error: "Not Found", statusCode: 404 });
      }
    } catch (err) {
      this._handleError(err, res);
    }
  }

  private _handleError(err: unknown, res: NexusResponseInterface): void {
    if (res.headersSent) {
      return;
    }

    if (err instanceof HttpError) {
      res.status(err.statusCode).json(err.toJSON());
      return;
    }

    const internalError = new InternalServerError(
      err instanceof Error ? err.message : "Unknown error",
    );
    res.status(500).json(internalError.toJSON());
  }
}

// Built-in middleware factories
export function bodyParser(): MiddlewareFunction {
  return async (req, _res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      // Pre-parse body so it's available synchronously later
      await req.body();
    }
    next();
  };
}

export function cookieParser(): MiddlewareFunction {
  return (req, _res, next) => {
    // Access cookies to trigger lazy parsing
    void req.cookies;
    next();
  };
}

export function errorHandler(): ErrorMiddlewareFunction {
  return (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json(error.toJSON());
    } else {
      res.status(500).json({
        error: "InternalServerError",
        message: "Internal Server Error",
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  };
}
