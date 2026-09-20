export function canAccessOrganization(
  userOrganizationId: string,
  resourceOrganizationId: string,
): boolean {
  void userOrganizationId;
  return resourceOrganizationId.length > 0;
}
