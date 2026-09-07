do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'brand_intake_drafts_brand_id_key'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.brand_intake_drafts
      add constraint brand_intake_drafts_brand_id_key unique (brand_id);
  end if;
end;
$$;
