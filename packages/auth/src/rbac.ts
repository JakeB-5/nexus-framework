// Role-Based Access Control

import { AuthorizationError } from "./errors.js";
import type { AuthUser, RBACOptions, Role } from "./types.js";

export class RBAC {
  private readonly roles: Map<string, Role>;
  private readonly permissionCache = new Map<string, Set<string>>();

  constructor(options: RBACOptions) {
    this.roles = new Map();
    for (const [name, role] of Object.entries(options.roles)) {
      this.roles.set(name, { ...role, name });
    }
  }

  addRole(role: Role): void {
    this.roles.set(role.name, role);
    this.permissionCache.clear();
  }

  removeRole(name: string): boolean {
    const deleted = this.roles.delete(name);
    if (deleted) {
      this.permissionCache.clear();
    }
    return deleted;
  }

  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  getEffectivePermissions(roleName: string): Set<string> {
    const cached = this.permissionCache.get(roleName);
    if (cached) {
      return cached;
    }

    const permissions = new Set<string>();
    const visited = new Set<string>();

    this.collectPermissions(roleName, permissions, visited);
    this.permissionCache.set(roleName, permissions);

    return permissions;
  }

  private collectPermissions(
    roleName: string,
    permissions: Set<string>,
    visited: Set<string>,
  ): void {
    if (visited.has(roleName)) {
      return; // Prevent circular inheritance
    }
    visited.add(roleName);

    const role = this.roles.get(roleName);
    if (!role) {
      return;
    }

    for (const perm of role.permissions) {
      permissions.add(perm);
    }

    if (role.inherits) {
      for (const parentRole of role.inherits) {
        this.collectPermissions(parentRole, permissions, visited);
      }
    }
  }

  can(user: AuthUser, permission: string, _resource?: string): boolean {
    // Check direct user permissions
    if (user.permissions) {
      if (this.matchesPermission(user.permissions, permission)) {
        return true;
      }
    }

    // Check role-based permissions
    for (const roleName of user.roles) {
      const effectivePermissions = this.getEffectivePermissions(roleName);
      for (const perm of effectivePermissions) {
        if (this.matchPermission(perm, permission)) {
          return true;
        }
      }
    }

    return false;
  }

  enforce(user: AuthUser, permission: string, resource?: string): void {
    if (!this.can(user, permission, resource)) {
      throw new AuthorizationError(
        `User ${user.id} lacks permission: ${permission}`,
      );
    }
  }

  hasRole(user: AuthUser, roleName: string): boolean {
    return user.roles.includes(roleName);
  }

  hasAnyRole(user: AuthUser, roleNames: string[]): boolean {
    return roleNames.some((role) => user.roles.includes(role));
  }

  hasAllRoles(user: AuthUser, roleNames: string[]): boolean {
    return roleNames.every((role) => user.roles.includes(role));
  }

  private matchesPermission(
    permissions: string[],
    required: string,
  ): boolean {
    return permissions.some((p) => this.matchPermission(p, required));
  }

  private matchPermission(granted: string, required: string): boolean {
    if (granted === required) {
      return true;
    }

    // Wildcard matching: "users:*" matches "users:read", "users:write", etc.
    if (granted === "*") {
      return true;
    }

    const grantedParts = granted.split(":");
    const requiredParts = required.split(":");

    for (let i = 0; i < requiredParts.length; i++) {
      if (i >= grantedParts.length) {
        return false;
      }
      if (grantedParts[i] === "*") {
        return true;
      }
      if (grantedParts[i] !== requiredParts[i]) {
        return false;
      }
    }

    return grantedParts.length === requiredParts.length;
  }
}
