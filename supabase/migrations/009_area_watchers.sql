-- ============================================================================
-- Migration 009: "Observadores" (watchers) por área.
--
-- Un área puede tener un empleado adicional que VE las solicitudes de sus
-- miembros y recibe la notificación por correo, pero NO puede aprobar.
-- Pensado para casos como "Jefas administrativas" donde el Jefe de Cobranza
-- necesita visibilidad sin tener autoridad de aprobación.
--
-- También crea la sub-área "Jefas administrativas" bajo Administración.
-- ============================================================================

alter table public.areas
  add column watcher_employee_id integer references public.employees(id);

-- Seed: sub-área "Jefas administrativas" bajo Administración
insert into public.areas (nombre, parent_area_id, display_order)
select 'Jefas administrativas', id, 10
  from public.areas where nombre = 'Administración';

-- Reemplaza la política SELECT de vacation_requests para incluir el caso watcher.
drop policy if exists vacation_requests_select on public.vacation_requests;

create policy vacation_requests_select on public.vacation_requests
  for select to authenticated using (
    -- propia
    employee_id = public.auth_employee_id()
    -- subordinados directos
    or employee_id in (
      select id from public.employees where manager_employee_id = public.auth_employee_id()
    )
    -- empleados de áreas que el caller observa
    or employee_id in (
      select e.id
        from public.employees e
        join public.areas a on a.id = e.area_id
       where a.watcher_employee_id = public.auth_employee_id()
    )
    -- admin
    or public.auth_is_admin()
  );
