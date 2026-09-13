-- anon and authenticated also inherit EXECUTE from PUBLIC, so the previous
-- revoke alone does not close the function.
revoke execute on function public.rls_auto_enable() from public;
