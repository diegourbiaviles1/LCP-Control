-- Supabase may install this event trigger; browsers should never invoke it.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
 end if;
end $$;
-- Internal bookkeeping is deliberately inaccessible through browser roles.
create policy no_browser_access on private.import_sources to authenticated using(false) with check(false);
create policy no_browser_access on private.import_rows to authenticated using(false) with check(false);
create policy no_browser_access on private.document_counters to authenticated using(false) with check(false);
