import { describe, it, expect } from "vitest";
import { RBAC } from "../src/rbac.js";
import { AuthorizationError } from "../src/errors.js";
import type { AuthUser } from "../src/types.js";

function createRBAC(): RBAC {
  return new RBAC({
    roles: {
      viewer: {
        name: "viewer",
        permissions: ["posts:read", "comments:read"],
      },
      editor: {
        name: "editor",
        permissions: ["posts:write", "comments:write"],
        inherits: ["viewer"],
      },
      admin: {
        name: "admin",
        permissions: ["users:*", "settings:*"],
        inherits: ["editor"],
      },
      superadmin: {
        name: "superadmin",
        permissions: ["*"],
      },
    },
  });
}

describe("RBAC", () => {
  it("should check direct permission", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["viewer"] };
    expect(rbac.can(user, "posts:read")).toBe(true);
    expect(rbac.can(user, "posts:write")).toBe(false);
  });

  it("should check inherited permissions", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["editor"] };
    expect(rbac.can(user, "posts:read")).toBe(true);
    expect(rbac.can(user, "posts:write")).toBe(true);
    expect(rbac.can(user, "comments:read")).toBe(true);
  });

  it("should check deep inheritance (admin inherits editor inherits viewer)", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["admin"] };
    expect(rbac.can(user, "posts:read")).toBe(true);
    expect(rbac.can(user, "posts:write")).toBe(true);
    expect(rbac.can(user, "users:create")).toBe(true);
    expect(rbac.can(user, "users:delete")).toBe(true);
  });

  it("should support wildcard permissions (resource:*)", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["admin"] };
    expect(rbac.can(user, "users:read")).toBe(true);
    expect(rbac.can(user, "users:write")).toBe(true);
    expect(rbac.can(user, "users:delete")).toBe(true);
  });

  it("should support global wildcard (*)", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["superadmin"] };
    expect(rbac.can(user, "anything:here")).toBe(true);
    expect(rbac.can(user, "foo:bar:baz")).toBe(true);
  });

  it("should check user-level permissions", () => {
    const rbac = createRBAC();
    const user: AuthUser = {
      id: "u1",
      roles: ["viewer"],
      permissions: ["special:action"],
    };
    expect(rbac.can(user, "special:action")).toBe(true);
  });

  it("should return false for unknown role", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["unknown"] };
    expect(rbac.can(user, "posts:read")).toBe(false);
  });

  it("should enforce and throw AuthorizationError", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["viewer"] };
    expect(() => rbac.enforce(user, "posts:write")).toThrow(AuthorizationError);
  });

  it("should enforce and pass for valid permission", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["editor"] };
    expect(() => rbac.enforce(user, "posts:write")).not.toThrow();
  });

  it("should check hasRole", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["editor", "viewer"] };
    expect(rbac.hasRole(user, "editor")).toBe(true);
    expect(rbac.hasRole(user, "admin")).toBe(false);
  });

  it("should check hasAnyRole", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["viewer"] };
    expect(rbac.hasAnyRole(user, ["editor", "viewer"])).toBe(true);
    expect(rbac.hasAnyRole(user, ["admin", "editor"])).toBe(false);
  });

  it("should check hasAllRoles", () => {
    const rbac = createRBAC();
    const user: AuthUser = { id: "u1", roles: ["editor", "viewer"] };
    expect(rbac.hasAllRoles(user, ["editor", "viewer"])).toBe(true);
    expect(rbac.hasAllRoles(user, ["editor", "admin"])).toBe(false);
  });

  it("should add and remove roles dynamically", () => {
    const rbac = createRBAC();
    rbac.addRole({ name: "moderator", permissions: ["posts:moderate"] });
    const user: AuthUser = { id: "u1", roles: ["moderator"] };
    expect(rbac.can(user, "posts:moderate")).toBe(true);

    rbac.removeRole("moderator");
    expect(rbac.can(user, "posts:moderate")).toBe(false);
  });

  it("should get role definition", () => {
    const rbac = createRBAC();
    const role = rbac.getRole("editor");
    expect(role).toBeDefined();
    expect(role!.permissions).toContain("posts:write");
    expect(role!.inherits).toContain("viewer");
  });

  it("should list all roles", () => {
    const rbac = createRBAC();
    const roles = rbac.getRoles();
    expect(roles).toHaveLength(4);
  });

  it("should get effective permissions for role", () => {
    const rbac = createRBAC();
    const perms = rbac.getEffectivePermissions("editor");
    expect(perms.has("posts:write")).toBe(true);
    expect(perms.has("posts:read")).toBe(true); // inherited
    expect(perms.has("comments:read")).toBe(true); // inherited
  });

  it("should handle circular inheritance gracefully", () => {
    const rbac = new RBAC({
      roles: {
        a: { name: "a", permissions: ["x"], inherits: ["b"] },
        b: { name: "b", permissions: ["y"], inherits: ["a"] },
      },
    });
    const user: AuthUser = { id: "u1", roles: ["a"] };
    expect(rbac.can(user, "x")).toBe(true);
    expect(rbac.can(user, "y")).toBe(true);
  });

  it("should use permission cache on second call", () => {
    const rbac = createRBAC();
    // First call populates cache
    const perms1 = rbac.getEffectivePermissions("admin");
    // Second call should hit cache
    const perms2 = rbac.getEffectivePermissions("admin");
    expect(perms1).toBe(perms2); // same reference
  });
});
