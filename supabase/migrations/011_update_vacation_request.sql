-- ============================================================================
-- Migration 011: el empleado puede modificar sus propias solicitudes futuras.
--
-- Reglas:
--   - solo solicitudes propias
--   - start_date original > hoy (no vencida, no en curso)
--   - estatus actual: pendiente o aprobada
--   - nueva start_date > hoy
--   - end_date >= start_date, business_days > 0
--   - si era aprobada, vuelve a pendiente y se limpia la decisión
--
-- Implementado vía SECURITY DEFINER para limitar exactamente qué columnas
-- se pueden cambiar — RLS por sí solo no puede restringir a columnas.
-- ============================================================================
create or replace function public.update_vacation_request(
  request_id            uuid,
  new_start_date        date,
  new_end_date          date,
  new_business_days     integer,
  new_employee_comment  text
)
returns table (was_approved boolean)
language plpgsql security definer set search_path = public as $$
declare
  caller_emp_id integer;
  req           record;
begin
  caller_emp_id := public.auth_employee_id();
  if caller_emp_id is null then
    raise exception 'No autenticado.' using errcode = '42501';
  end if;

  select * into req from public.vacation_requests where id = request_id for update;
  if not found then
    raise exception 'Solicitud no encontrada.' using errcode = 'P0002';
  end if;
  if req.employee_id <> caller_emp_id then
    raise exception 'No puedes modificar una solicitud de otro empleado.' using errcode = '42501';
  end if;
  if req.start_date <= current_date then
    raise exception 'No puedes modificar una solicitud vencida o en curso.' using errcode = '22023';
  end if;
  if req.status not in ('pendiente', 'aprobada') then
    raise exception 'No puedes modificar una solicitud rechazada o cancelada.' using errcode = '22023';
  end if;
  if new_start_date <= current_date then
    raise exception 'La nueva fecha de inicio debe ser posterior a hoy.' using errcode = '22023';
  end if;
  if new_end_date < new_start_date then
    raise exception 'La fecha final debe ser mayor o igual a la inicial.' using errcode = '22023';
  end if;
  if new_business_days <= 0 then
    raise exception 'La solicitud debe tener al menos un día hábil.' using errcode = '22023';
  end if;

  update public.vacation_requests set
    start_date             = new_start_date,
    end_date               = new_end_date,
    business_days          = new_business_days,
    employee_comment       = new_employee_comment,
    status                 = 'pendiente',
    decided_at             = null,
    decided_by_employee_id = null,
    decision_comment       = null
  where id = request_id;

  return query select (req.status = 'aprobada');
end;
$$;

revoke all on function public.update_vacation_request(uuid, date, date, integer, text) from public;
grant execute on function public.update_vacation_request(uuid, date, date, integer, text) to authenticated;
