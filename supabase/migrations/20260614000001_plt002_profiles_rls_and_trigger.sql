-- PLT-002: profiles row on signup + own-row RLS for read/insert/update

-- Fix auth trigger (empty search_path broke default user_role cast)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now()
  where profiles.email is distinct from excluded.email;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed: %', sqlerrm;
    return new;
end;
$$;

drop policy if exists "authenticated_users_can_view_own_profile" on public.profiles;
create policy "authenticated_users_can_view_own_profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "authenticated_users_can_insert_own_profile" on public.profiles;
create policy "authenticated_users_can_insert_own_profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "authenticated_users_can_update_own_profile" on public.profiles;
create policy "authenticated_users_can_update_own_profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
