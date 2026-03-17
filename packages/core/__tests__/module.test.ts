import { describe, it, expect } from "vitest";
import {
  Container,
  Module,
  Injectable,
  ModuleLoader,
  NexusApplication,
  CircularDependencyError,
  InvalidModuleError,
  setModuleMetadata,
  setInjectableMetadata,
  Scope,
  type OnInit,
  type OnReady,
  type OnDestroy,
} from "../src/index.js";

describe("ModuleLoader", () => {
  it("should load a simple module with providers", async () => {
    @Injectable()
    class UserService {
      getUser() {
        return { name: "test" };
      }
    }

    @Module({
      providers: [UserService],
      exports: [UserService],
    })
    class UserModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);
    await loader.loadModule(UserModule);

    const service = container.resolve(UserService);
    expect(service.getUser()).toEqual({ name: "test" });
  });

  it("should resolve module dependency order", async () => {
    @Module({})
    class DatabaseModule {}

    @Module({ imports: [DatabaseModule] })
    class UserModule {}

    @Module({ imports: [UserModule, DatabaseModule] })
    class AppModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);
    await loader.loadModule(AppModule);

    const order = loader.getModuleOrder();
    const dbIdx = order.indexOf(DatabaseModule);
    const userIdx = order.indexOf(UserModule);
    const appIdx = order.indexOf(AppModule);

    expect(dbIdx).toBeLessThan(userIdx);
    expect(userIdx).toBeLessThan(appIdx);
  });

  it("should detect circular module dependencies", async () => {
    class ModuleA {}
    class ModuleB {}

    setModuleMetadata(ModuleA, { imports: [ModuleB] });
    setInjectableMetadata(ModuleA, { scope: Scope.Singleton });
    setModuleMetadata(ModuleB, { imports: [ModuleA] });
    setInjectableMetadata(ModuleB, { scope: Scope.Singleton });

    const container = new Container();
    const loader = new ModuleLoader(container);

    await expect(loader.loadModule(ModuleA)).rejects.toThrow(
      CircularDependencyError,
    );
  });

  it("should throw for class without @Module decorator", async () => {
    class NotAModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);

    await expect(loader.loadModule(NotAModule)).rejects.toThrow(
      InvalidModuleError,
    );
  });

  it("should handle dynamic modules", async () => {
    @Module({})
    class ConfigModule {}

    class ConfigService {
      constructor(public config: Record<string, unknown>) {}
    }
    setInjectableMetadata(ConfigService, { scope: Scope.Singleton });

    const container = new Container();
    container.registerValue("CONFIG", { port: 3000 });

    const loader = new ModuleLoader(container);
    await loader.loadModule({
      module: ConfigModule,
      providers: [
        {
          provide: ConfigService,
          useFactory: (cfg: unknown) =>
            new ConfigService(cfg as Record<string, unknown>),
          inject: ["CONFIG"],
        },
      ],
      exports: [ConfigService],
    });

    const svc = container.resolve(ConfigService);
    expect(svc.config).toEqual({ port: 3000 });
  });

  it("should load nested module imports", async () => {
    @Module({})
    class CoreModule {}

    @Module({ imports: [CoreModule] })
    class MiddleModule {}

    @Module({ imports: [MiddleModule] })
    class TopModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);
    await loader.loadModule(TopModule);

    const order = loader.getModuleOrder();
    expect(order).toHaveLength(3);
    expect(order[0]).toBe(CoreModule);
    expect(order[2]).toBe(TopModule);
  });

  it("should handle module with value providers", async () => {
    @Module({
      providers: [
        { provide: "DB_URL", useValue: "postgres://localhost" },
      ],
      exports: ["DB_URL"],
    })
    class DatabaseModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);
    await loader.loadModule(DatabaseModule);

    expect(container.resolve("DB_URL")).toBe("postgres://localhost");
  });

  it("should handle empty module", async () => {
    @Module({})
    class EmptyModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);
    await loader.loadModule(EmptyModule);

    const order = loader.getModuleOrder();
    expect(order).toHaveLength(1);
    expect(order[0]).toBe(EmptyModule);
  });

  it("should not duplicate modules when imported multiple times", async () => {
    @Module({})
    class SharedModule {}

    @Module({ imports: [SharedModule] })
    class ModA {}

    @Module({ imports: [SharedModule] })
    class ModB {}

    @Module({ imports: [ModA, ModB] })
    class AppModule {}

    const container = new Container();
    const loader = new ModuleLoader(container);
    await loader.loadModule(AppModule);

    const order = loader.getModuleOrder();
    const sharedCount = order.filter((m) => m === SharedModule).length;
    expect(sharedCount).toBe(1);
  });
});

describe("NexusApplication", () => {
  it("should create an application from root module", async () => {
    @Module({})
    class AppModule {}

    const app = await NexusApplication.create(AppModule, {
      handleSignals: false,
    });
    expect(app).toBeDefined();
    expect(app.getContainer()).toBeInstanceOf(Container);
  });

  it("should start and stop the application", async () => {
    @Module({})
    class AppModule {}

    const app = await NexusApplication.create(AppModule, {
      handleSignals: false,
    });
    await app.start();
    expect(app.isRunning()).toBe(true);

    await app.stop();
    expect(app.isRunning()).toBe(false);
  });

  it("should run lifecycle hooks on providers", async () => {
    const order: string[] = [];

    @Injectable()
    class TestService implements OnInit, OnReady, OnDestroy {
      onInit() {
        order.push("init");
      }
      onReady() {
        order.push("ready");
      }
      onDestroy() {
        order.push("destroy");
      }
    }

    @Module({ providers: [TestService] })
    class AppModule {}

    const app = await NexusApplication.create(AppModule, {
      handleSignals: false,
    });
    await app.start();
    expect(order).toEqual(["init", "ready"]);

    await app.stop();
    expect(order).toEqual(["init", "ready", "destroy"]);
  });

  it("should resolve providers from the application", async () => {
    @Injectable()
    class Greeter {
      greet(name: string) {
        return `Hello, ${name}!`;
      }
    }

    @Module({ providers: [Greeter] })
    class AppModule {}

    const app = await NexusApplication.create(AppModule, {
      handleSignals: false,
    });
    const greeter = app.resolve(Greeter);
    expect(greeter.greet("World")).toBe("Hello, World!");
    await app.stop();
  });

  it("should not start twice", async () => {
    @Module({})
    class AppModule {}

    const app = await NexusApplication.create(AppModule, {
      handleSignals: false,
    });
    await app.start();
    await app.start();
    expect(app.isRunning()).toBe(true);
    await app.stop();
  });

  it("should not stop if not running", async () => {
    @Module({})
    class AppModule {}

    const app = await NexusApplication.create(AppModule, {
      handleSignals: false,
    });
    await app.stop();
    expect(app.isRunning()).toBe(false);
  });
});
