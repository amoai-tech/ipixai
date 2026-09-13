export type TenantAccessInput = {
  requestedOrgId?: string;
  sessionOrgId?: string;
};

export function canAccessTenant(input: TenantAccessInput): boolean {
  return Boolean(input.requestedOrgId);
}
