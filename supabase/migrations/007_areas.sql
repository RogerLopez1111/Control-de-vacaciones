-- ============================================================================
-- Migration 007: Áreas y supervisión jerárquica.
--
-- Cada empleado pertenece a un área. Cada área tiene un supervisor (que es
-- otro empleado). El supervisor del área es quien aprueba las solicitudes
-- de vacaciones de los miembros de esa área.
--
-- Triggers automáticos sincronizan `employees.manager_employee_id` con el
-- supervisor del área del empleado, para que la política RLS de aprobación
-- por jefe siga apoyada en `manager_employee_id`.
-- ============================================================================

create table public.areas (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null unique,
  supervisor_employee_id   integer references public.employees(id),
  parent_area_id           uuid references public.areas(id),
  display_order            integer not null default 0,
  created_at               timestamptz not null default now()
);

alter table public.employees
  add column area_id uuid references public.areas(id);

create index employees_area_idx on public.employees (area_id);

-- ---- Seed: las 4 áreas iniciales --------------------------------------------
insert into public.areas (nombre, display_order) values
  ('Dirección',      0),
  ('Administración', 1),
  ('Comercial',      2),
  ('Logística',      3);

update public.areas
   set parent_area_id = (select id from public.areas where nombre = 'Dirección')
 where nombre in ('Administración', 'Comercial', 'Logística');

-- ---- Trigger: cambio de supervisor del área → propagar a manager_employee_id
create or replace function public.sync_area_members_manager()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.supervisor_employee_id is distinct from old.supervisor_employee_id then
    update public.employees
       set manager_employee_id = new.supervisor_employee_id
     where area_id = new.id
       and id <> coalesce(new.supervisor_employee_id, -1);  -- nadie es su propio jefe
  end if;
  return new;
end;
$$;

create trigger on_area_supervisor_change
  after update on public.areas
  for each row execute function public.sync_area_members_manager();

-- ---- Trigger: cambio de área del empleado → setear su manager_employee_id ---
create or replace function public.sync_employee_manager_from_area()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  super_id integer;
begin
  if new.area_id is distinct from old.area_id then
    if new.area_id is null then
      new.manager_employee_id := null;
    else
      select supervisor_employee_id into super_id from public.areas where id = new.area_id;
      new.manager_employee_id := case
        when super_id is null then null
        when super_id = new.id then null   -- nadie es su propio jefe
        else super_id
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_employee_area_change
  before update of area_id on public.employees
  for each row execute function public.sync_employee_manager_from_area();

-- ---- RLS sobre areas --------------------------------------------------------
alter table public.areas enable row level security;

create policy areas_select on public.areas
  for select to authenticated using (true);

create policy areas_admin_write on public.areas
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

-- ---- RPC: asignar empleado a un área (admin only) ---------------------------
create or replace function public.assign_employee_to_area(
  target_employee_id integer,
  target_area_id     uuid    -- pasar null para desasignar
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_is_admin() then
    raise exception 'Solo un administrador puede asignar áreas.' using errcode = '42501';
  end if;
  update public.employees set area_id = target_area_id where id = target_employee_id;
  if not found then
    raise exception 'Empleado no encontrado: %', target_employee_id using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.assign_employee_to_area(integer, uuid) from public;
grant execute on function public.assign_employee_to_area(integer, uuid) to authenticated;
