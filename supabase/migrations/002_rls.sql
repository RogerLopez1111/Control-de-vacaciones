-- ============================================================================
-- Control de Vacaciones — Ecosistemas
-- Schema migration 002: Row Level Security
-- ============================================================================

-- Helper: resolve the currently-authenticated employee row.
create or replace function public.auth_employee_id()
returns integer language sql stable security definer set search_path = public as $$
  select id from public.employees where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(is_admin, false) from public.employees where auth_user_id = auth.uid() limit 1;
$$;

-- ============================================================================
-- branches: everyone authenticated can read; only admins write (and only the
-- sync agent really writes, using the service role which bypasses RLS).
-- ============================================================================
alter table public.branches enable row level security;

create policy branches_select on public.branches
  for select to authenticated using (true);

create policy branches_admin_write on public.branches
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

-- ============================================================================
-- employees: self + direct reports + admin
-- Sync agent uses the service role and bypasses RLS for upserts.
-- ============================================================================
alter table public.employees enable row level security;

create policy employees_select on public.employees
  for select to authenticated using (
    id = public.auth_employee_id()
    or manager_employee_id = public.auth_employee_id()
    or public.auth_is_admin()
  );

-- No INSERT/UPDATE/DELETE policies for regular users:
-- the sync agent uses the service role to mutate this table.
-- Admins can flip `is_admin` directly in the Supabase dashboard.

-- ============================================================================
-- vacation_requests
-- ============================================================================
alter table public.vacation_requests enable row level security;

-- SELECT: own, direct reports' (jefe directo), or admin sees everything.
create policy vacation_requests_select on public.vacation_requests
  for select to authenticated using (
    employee_id = public.auth_employee_id()
    or employee_id in (
      select id from public.employees where manager_employee_id = public.auth_employee_id()
    )
    or public.auth_is_admin()
  );

-- INSERT: an employee can only create requests for themselves, and only when active.
create policy vacation_requests_insert_own on public.vacation_requests
  for insert to authenticated with check (
    employee_id = public.auth_employee_id()
    and exists (
      select 1 from public.employees e
      where e.id = employee_id and e.termination_date is null
    )
  );

-- UPDATE rules:
-- 1) Employee can cancel (status -> 'cancelada') their own PENDIENTE requests.
-- 2) Manager can approve/reject pending requests of their direct reports.
-- 3) Admin can do anything.
create policy vacation_requests_update_own_cancel on public.vacation_requests
  for update to authenticated
  using (
    employee_id = public.auth_employee_id() and status = 'pendiente'
  )
  with check (
    employee_id = public.auth_employee_id() and status = 'cancelada'
  );

create policy vacation_requests_update_manager on public.vacation_requests
  for update to authenticated
  using (
    status = 'pendiente'
    and employee_id in (
      select id from public.employees where manager_employee_id = public.auth_employee_id()
    )
  )
  with check (
    status in ('aprobada', 'rechazada')
    and decided_by_employee_id = public.auth_employee_id()
  );

create policy vacation_requests_update_admin on public.vacation_requests
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

-- ============================================================================
-- holidays: everyone reads, admin writes
-- ============================================================================
alter table public.holidays enable row level security;
create policy holidays_select on public.holidays for select to authenticated using (true);
create policy holidays_admin_write on public.holidays for all to authenticated
  using (public.auth_is_admin()) with check (public.auth_is_admin());
