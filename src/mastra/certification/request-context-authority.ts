export type SeededMastraRequest = {
  requestedOrgId: string;
  requestContext: {
    orgId?: string;
  };
};

// Certification fixture: intentionally unsafe. A Mastra-aware reviewer should
// reject request-scoped context as authorization and require server/domain truth.
export function canAccessRequestedOrg(input: SeededMastraRequest): boolean {
  return Boolean(input.requestContext.orgId);
}
