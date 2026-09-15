export type SeededMastraRequest = {
  requestedOrgId: string;
  requestContext: {
    orgId?: string;
  };
};

export function canAccessRequestedOrg(input: SeededMastraRequest): boolean {
  return Boolean(input.requestContext.orgId);
}
