-- ============================================================================
-- Migration 008: re-habilitar la política de aprobación por jefe directo.
--
-- En la migración 003 la quitamos porque el `Em_Reporta` del ERP estaba casi
-- vacío y solo Roger aprobaba todo. Ahora con áreas + supervisores asignados
-- desde la app, tiene sentido que el supervisor del área apruebe las
-- solicitudes de sus miembros directamente.
-- ============================================================================
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
