export const ADMIN_ROLES = ["admin", "developer"] as const;
export const MANAGER_ROLES = ["manager", ...ADMIN_ROLES] as const;

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

export function isManagerRole(role: string | null | undefined): boolean {
  return MANAGER_ROLES.includes(role as (typeof MANAGER_ROLES)[number]);
}
