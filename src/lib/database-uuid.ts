/**
 * Canonical PostgreSQL UUID text accepted by iPix durable IDs.
 *
 * PostgreSQL's `uuid` type is not limited to UUIDv4-generated values, and
 * production contains legacy/synthetic canonical UUIDs such as the Acme seed
 * org. Authorization is enforced separately by membership/ownership checks.
 */
const DATABASE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDatabaseUuid(value: unknown): value is string {
  return typeof value === "string" && DATABASE_UUID.test(value);
}
