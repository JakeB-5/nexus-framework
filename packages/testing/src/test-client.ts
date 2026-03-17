// @nexus/testing - HTTP test client

import type { TestRequest, TestResponse } from "./types.js";

type RequestHandler = (req: TestRequest) => Promise<TestResponse> | TestResponse;

/**
 * HTTP test client for testing route handlers
 */
export class TestClient {
  private handler: RequestHandler;
  private defaultHeaders: Record<string, string> = {};

  constructor(handler: RequestHandler) {
    this.handler = handler;
  }

  /**
   * Set a default header for all requests
   */
  setDefaultHeader(name: string, value: string): this {
    this.defaultHeaders[name.toLowerCase()] = value;
    return this;
  }

  /**
   * Create a GET request builder
   */
  get(path: string): RequestBuilder {
    return new RequestBuilder(this.handler, "GET", path, this.defaultHeaders);
  }

  /**
   * Create a POST request builder
   */
  post(path: string): RequestBuilder {
    return new RequestBuilder(this.handler, "POST", path, this.defaultHeaders);
  }

  /**
   * Create a PUT request builder
   */
  put(path: string): RequestBuilder {
    return new RequestBuilder(this.handler, "PUT", path, this.defaultHeaders);
  }

  /**
   * Create a DELETE request builder
   */
  delete(path: string): RequestBuilder {
    return new RequestBuilder(this.handler, "DELETE", path, this.defaultHeaders);
  }

  /**
   * Create a PATCH request builder
   */
  patch(path: string): RequestBuilder {
    return new RequestBuilder(this.handler, "PATCH", path, this.defaultHeaders);
  }
}

/**
 * Chainable request builder with assertions
 */
export class RequestBuilder {
  private handler: RequestHandler;
  private request: TestRequest;
  private expectedStatus?: number;
  private expectedHeaders: Array<{ name: string; value?: string }> = [];

  constructor(handler: RequestHandler, method: string, path: string, defaultHeaders: Record<string, string>) {
    this.handler = handler;
    this.request = {
      method,
      path,
      headers: { ...defaultHeaders },
      query: {},
    };
  }

  /**
   * Set a request header
   */
  set(name: string, value: string): this {
    this.request.headers[name.toLowerCase()] = value;
    return this;
  }

  /**
   * Set the request body
   */
  send(body: unknown): this {
    this.request.body = body;
    if (!this.request.headers["content-type"]) {
      this.request.headers["content-type"] = "application/json";
    }
    return this;
  }

  /**
   * Set query parameters
   */
  query(params: Record<string, string>): this {
    this.request.query = { ...this.request.query, ...params };
    return this;
  }

  /**
   * Set Bearer auth token
   */
  auth(token: string): this {
    this.request.headers["authorization"] = `Bearer ${token}`;
    return this;
  }

  /**
   * Assert expected status code
   */
  expect(status: number): this;
  expect(header: string, value: string): this;
  expect(statusOrHeader: number | string, value?: string): this {
    if (typeof statusOrHeader === "number") {
      this.expectedStatus = statusOrHeader;
    } else {
      this.expectedHeaders.push({ name: statusOrHeader.toLowerCase(), value });
    }
    return this;
  }

  /**
   * Execute the request and return response with JSON body
   */
  async expectJson<T = unknown>(): Promise<T> {
    const response = await this.execute();
    return JSON.parse(response.text) as T;
  }

  /**
   * Execute the request and return response text
   */
  async expectText(): Promise<string> {
    const response = await this.execute();
    return response.text;
  }

  /**
   * Execute the request
   */
  async execute(): Promise<TestResponse> {
    const response = await this.handler(this.request);

    if (this.expectedStatus !== undefined && response.status !== this.expectedStatus) {
      throw new Error(
        `Expected status ${this.expectedStatus}, got ${response.status}`,
      );
    }

    for (const { name, value } of this.expectedHeaders) {
      const actual = response.headers[name];
      if (actual === undefined) {
        throw new Error(`Expected header "${name}" to be present`);
      }
      if (value !== undefined && actual !== value) {
        throw new Error(
          `Expected header "${name}" to be "${value}", got "${actual}"`,
        );
      }
    }

    return response;
  }
}

/**
 * Create a test client from a request handler
 */
export function createTestClient(handler: RequestHandler): TestClient {
  return new TestClient(handler);
}
