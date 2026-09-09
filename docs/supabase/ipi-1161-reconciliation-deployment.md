# IPI-1161 schema reconciliation deployment and recovery

This runbook covers `20260909124501_reconcile_public_schema_with_live.sql`. The normal production path is the reviewed Supabase GitHub Integration after merge; do not manually run `db push --linked`, `migration repair`, or `db reset --linked`.

## Compatibility and preflight

Deploy application compatibility before the migration. The current application already satisfies that order: `src/` has no use of singular `public.event_schedule` or `call_times.schedule_item_id`, its shared clients use the generated `Database` contract, and `src/lib/shoot/channel-specs.ts` treats both image-spec identifiers as required lookup keys.

The migration then checks every data-sensitive prerequisite before DDL:

- `image_specs.platform_id` and `image_specs.image_type_id` contain no nulls;
- `public.event_schedule` is either absent or empty;
- `drop table ... restrict` finds no unexpected external dependent object after the one known legacy foreign key is removed.

All statements run in one explicit transaction. A failed preflight, constraint change, or dependency check rolls the transaction back. Do not bypass a failing guard. Capture the target's read-only catalog and row counts, determine ownership of the unexpected state, and use a separate reviewed reconciliation migration.

```mermaid
flowchart TD
    A[Compatible application deployed] --> B[Migration preflight]
    B --> C{Null image-spec IDs?}
    C -- Yes --> X[Abort with no schema change]
    C -- No --> D{Singular schedule has rows?}
    D -- Yes --> X
    D -- No --> E[Apply constraints and remove legacy FK]
    E --> F{External table dependency?}
    F -- Yes --> X
    F -- No --> G[Commit]
```

No backup is needed for the singular schedule table on the allowed path because only an absent or empty table can be dropped. If a target contains rows, the migration makes no changes; preserve/export those rows and reconcile them with the owning schedule model before retrying.

## Deployment verification

After the integration reports success, verify the exact deployed migration and read the catalog without mutating production:

```sql
select to_regclass('public.event_schedule') as retired_table;

select is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'image_specs'
  and column_name in ('platform_id', 'image_type_id')
order by column_name;

select conname
from pg_constraint
where conrelid = 'public.call_times'::regclass
  and conname = 'call_times_schedule_item_id_fkey';

select to_regclass('public.event_schedules') as active_plural_table;
select to_regclass('shoot.shoots') as private_shoot_table;
```

Expected results are: singular table `null`, both columns `NO`, removed constraint zero rows, and both the plural schedule and private shoot tables present. Then run the exact-main fresh replay and `npm run supabase:types:check`; regeneration must leave `src/lib/supabase/database.types.ts` unchanged.

## Failure and forward recovery

Rollback triggers are a failed migration/integration, an unexpected application error involving schedule or image-spec reads, or any mismatch in the verification queries above.

- If deployment fails before commit, PostgreSQL rolls back the migration transaction. Investigate the guard/error and retry only through a reviewed replacement migration.
- If a post-commit application regression requires nullable image-spec identifiers, ship a reviewed forward migration with:

  ```sql
  alter table public.image_specs
    alter column platform_id drop not null,
    alter column image_type_id drop not null;
  ```

- If the legacy foreign key must be restored, first restore `public.event_schedule` and its RLS policies/indexes from `supabase/migrations/20250125000010_create_scheduling_availability.sql` in a new reviewed forward migration. Then validate existing pointers without blocking the table rewrite:

  ```sql
  alter table public.call_times
    add constraint call_times_schedule_item_id_fkey
    foreign key (schedule_item_id)
    references public.event_schedule(id)
    on delete cascade
    not valid;

  alter table public.call_times
    validate constraint call_times_schedule_item_id_fkey;
  ```

  Validation failure means existing pointers do not have matching restored schedule rows. Stop and reconcile those rows; do not delete or null them automatically.

```mermaid
flowchart LR
    F[Failure signal] --> Q{Migration committed?}
    Q -- No --> R[Automatic transaction rollback]
    Q -- Yes --> N[Reviewed forward recovery migration]
    N --> V[Catalog and application verification]
    V --> Z{Recovered?}
    Z -- No --> S[Contain and investigate; no destructive retry]
    Z -- Yes --> M[Resume deployment monitoring]
```

This recovery is forward-only. Do not rewrite the applied migration or restore the retired table/FK through ad hoc production SQL.
