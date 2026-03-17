// @nexus/testing - Type definitions

export interface TestAppOptions {
  providers?: Array<ProviderOverride | { provide: unknown; useValue?: unknown; useClass?: new (...args: unknown[]) => unknown; useFactory?: (...args: unknown[]) => unknown }>;
}

export interface ProviderOverride {
  provide: unknown;
  useValue?: unknown;
  useClass?: new (...args: unknown[]) => unknown;
  useFactory?: (...args: unknown[]) => unknown;
}

export interface MockOptions {
  methods?: string[];
  deep?: boolean;
}

export interface FixtureOptions<T = unknown> {
  name: string;
  setup: () => T | Promise<T>;
  teardown?: (data: T) => void | Promise<void>;
}

export interface FactoryDefinition<T = unknown> {
  name: string;
  defaults: T | (() => T);
  sequence?: number;
}

export interface TestClientOptions {
  baseUrl?: string;
}

export interface TestRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
}

export interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  text: string;
}

export interface MatcherResult {
  pass: boolean;
  message: string;
}
