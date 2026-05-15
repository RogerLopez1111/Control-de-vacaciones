-- ============================================================================
-- Migration 006: función segura para cambiar el rol de admin de un empleado.
--
-- Solo admins pueden llamarla. Un admin no puede quitarse su propio rol
-- (evita auto-bloqueo). Se hace via SECURITY DEFINER para que la única
-- forma de modificar `employees.is_admin` desde la app sea esta función,
-- en vez de exponer un UPDATE general sobre la tabla `employees`.
-- ============================================================================
create or replace function public.set_employee_admin(
  target_employee_id integer,
  new_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id integer;
begin
  if not public.auth_is_admin() then
    raise exception 'Solo un administrador puede cambiar roles.' using errcode = '42501';
  end if;

  caller_id := public.auth_employee_id();
  if caller_id = target_employee_id and new_is_admin = false then
    raise exception 'No puedes quitarte tu propio rol de administrador.' using errcode = '42501';
  end if;

  update public.employees
     set is_admin = new_is_admin
   where id = target_employee_id;

  if not found then
    raise exception 'Empleado no encontrado: %', target_employee_id using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_employee_admin(integer, boolean) from public;
grant execute on function public.set_employee_admin(integer, boolean) to authenticated;
