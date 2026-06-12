-- ============================================================================
-- Migration 019: los watchers pueden ver a los empleados de sus áreas.
--
-- La política employees_select solo cubría: yo mismo, subordinados directos,
-- admin. Los watchers necesitan ver a los empleados de su área para que la
-- consulta embebida employee:employees!... en /aprobaciones resuelva
-- correctamente y los datos de la tarjeta no lleguen nulos.
--
-- IMPORTANTE: la cláusula de watcher usa una función security definer para
-- evitar recursión infinita (la política references public.employees dentro
-- de una política en public.employees).
-- ============================================================================

-- Función auxiliar: IDs de empleados en las áreas que el caller observa.
-- security definer → bypassa RLS al consultar employees/areas internamente.
create or replace function public.auth_watcher_employee_ids()
returns setof integer language sql stable security definer set search_path = public as $$
  select e.id
    from public.employees e
    join public.areas a on a.id = e.area_id
   where a.watcher_employee_id = (
     select id from public.employees where auth_user_id = auth.uid() limit 1
   )
$$;

drop policy if exists employees_select on public.employees;

create policy employees_select on public.employees
  for select to authenticated using (
    -- propio
    id = public.auth_employee_id()
    -- subordinados directos
    or manager_employee_id = public.auth_employee_id()
    -- empleados de áreas que el caller observa
    or id in (select public.auth_watcher_employee_ids())
    -- admin
    or public.auth_is_admin()
  );
