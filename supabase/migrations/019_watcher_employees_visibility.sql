-- ============================================================================
-- Migration 019: los watchers pueden ver a los empleados de sus áreas.
--
-- La política employees_select solo cubría: yo mismo, subordinados directos,
-- admin. Los watchers necesitan ver a los empleados de su área para que la
-- consulta embebida employee:employees!... en /aprobaciones resuelva
-- correctamente y los datos de la tarjeta no lleguen nulos.
-- ============================================================================

drop policy if exists employees_select on public.employees;

create policy employees_select on public.employees
  for select to authenticated using (
    -- propio
    id = public.auth_employee_id()
    -- subordinados directos
    or manager_employee_id = public.auth_employee_id()
    -- empleados de áreas que el caller observa
    or id in (
      select e2.id
        from public.employees e2
        join public.areas a on a.id = e2.area_id
       where a.watcher_employee_id = public.auth_employee_id()
    )
    -- admin
    or public.auth_is_admin()
  );
