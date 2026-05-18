-- ============================================================================
-- Migration 010: correo de notificaciones independiente del ERP.
--
-- El campo `email` viene sincronizado del ERP (Em_Email) y suele ser un
-- correo personal del empleado. Para notificaciones del sistema (solicitudes
-- pendientes, aprobaciones, etc.) queremos usar un correo corporativo que
-- RRHH controla, no el personal que vive en el ERP.
--
-- `notification_email` es NULL por default → en ese caso usamos `email` como
-- fallback. Solo admin puede editar este campo vía la RPC.
-- ============================================================================
alter table public.employees
  add column notification_email text;

create or replace function public.set_employee_notification_email(
  target_employee_id integer,
  new_email text  -- pasar null para limpiar
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_is_admin() then
    raise exception 'Solo un administrador puede cambiar correos de notificación.' using errcode = '42501';
  end if;

  if new_email is not null and new_email <> '' then
    if position('@' in new_email) = 0 then
      raise exception 'Correo inválido: %', new_email using errcode = '22023';
    end if;
    update public.employees set notification_email = lower(trim(new_email)) where id = target_employee_id;
  else
    update public.employees set notification_email = null where id = target_employee_id;
  end if;

  if not found then
    raise exception 'Empleado no encontrado: %', target_employee_id using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_employee_notification_email(integer, text) from public;
grant execute on function public.set_employee_notification_email(integer, text) to authenticated;
