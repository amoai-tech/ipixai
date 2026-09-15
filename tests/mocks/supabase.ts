/**
 * Shared Supabase read-surface mock for the IPI-1081 · PLAN-001 suites
 * (tests/plan-001.test.ts and tests/plan-001-planner-runtime.test.ts).
 *
 * Both suites must exercise the real Planner against the exact same read
 * contract, so the mocked client lives here once instead of being copied:
 *
 * - `from(...).select/eq/in/order/limit(...)` resolves table-specific rows,
 *   covering both the trusted-reference reader and the normal channel-spec path.
 * - `insert/update/upsert/delete/rpc` are recorded in `mutatingCalls` so the
 *   zero-write assertion can prove the planning path never writes.
 * - `available: false` models "no Supabase session", and `error` models a
 *   failed read — both must fail closed to a reference gap, never to
 *   invented data.
 * The filters are chain-compatible no-ops because each test already supplies
 * only the rows that should match. This keeps the fake small while preventing
 * an accidental missing query method from forcing production fallback logic.
 */

export type SupabaseMockError = { message: string } | null;

/** Every mutating/RPC call the code under test makes, in order. */
export const supabaseMock = {
  available: true,
  rows: [] as unknown[],
  tables: {} as Record<string, unknown[]>,
  error: null as SupabaseMockError,
  mutatingCalls: [] as string[],
};

/** Restore the mock to its clean default between tests. */
export function resetSupabaseMock(): void {
  supabaseMock.available = true;
  supabaseMock.rows = [];
  supabaseMock.tables = {};
  supabaseMock.error = null;
  supabaseMock.mutatingCalls = [];
}

/**
 * The `createClient()` implementation to hand to `vi.mock`. Kept in this
 * module (and pulled in with a dynamic import from the test files) so the
 * hoisted `vi.mock` factory never closes over a test-file binding.
 */
export function supabaseMockModule() {
  return {
    createClient: async () => {
      if (!supabaseMock.available) return null;
      return {
        from: (table: string) => {
          const tableRows = table === "shot_type_references_view"
            ? supabaseMock.rows
            : (supabaseMock.tables[table] ?? []);
          const result = {
            data: supabaseMock.error ? null : tableRows,
            error: supabaseMock.error,
          };
          const chain = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            order: () => chain,
            limit: () => chain,
            insert: (...args: unknown[]) => {
              void args;
              supabaseMock.mutatingCalls.push("insert");
              return chain;
            },
            update: (...args: unknown[]) => {
              void args;
              supabaseMock.mutatingCalls.push("update");
              return chain;
            },
            upsert: (...args: unknown[]) => {
              void args;
              supabaseMock.mutatingCalls.push("upsert");
              return chain;
            },
            delete: (...args: unknown[]) => {
              void args;
              supabaseMock.mutatingCalls.push("delete");
              return chain;
            },
            then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
          };
          return chain;
        },
        rpc: (...args: unknown[]) => {
          void args;
          supabaseMock.mutatingCalls.push("rpc");
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}
