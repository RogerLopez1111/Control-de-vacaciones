-- ============================================================================
-- Migration 013: Rutas de Envíos
--
-- Tablas para planificación semanal de rutas con cálculo de combustible.
-- Comparte employees + branches con el módulo de Vacaciones.
--
-- Roles propios de Rutas (rutas_perfiles.rol):
--   vendedor / conductor → crean y envían planes semanales
--   supervisor_sucursal  → autoriza/rechaza planes de su sucursal (1 por branch)
--   supervisor_general   → ve autorizados de todas las sucursales y marca recursos
--
-- Flujo de un plan:
--   borrador → pendiente_autorizacion → autorizado → recursos_asignados
--   pendiente_autorizacion → rechazado → borrador  (rama para corregir)
--
-- Asignación inicial de perfiles: manual desde el dashboard de Supabase por un
-- usuario con is_admin (mismo flag que Vacaciones). UI de admin pendiente.
-- ============================================================================

-- ---- Enums ------------------------------------------------------------------

create type public.rol_rutas as enum (
  'vendedor',
  'conductor',
  'supervisor_sucursal',
  'supervisor_general'
);

create type public.estado_plan_ruta as enum (
  'borrador',
  'pendiente_autorizacion',
  'autorizado',
  'recursos_asignados',
  'rechazado'
);

-- ---- Tabla: perfiles de Rutas (extiende employees con datos del app) --------

create table public.rutas_perfiles (
  employee_id          integer primary key references public.employees(id) on delete cascade,
  rol                  public.rol_rutas not null,
  consumo_l_per_100km  numeric(5,2),
  created_at           timestamptz not null default now()
);

create index rutas_perfiles_rol_idx on public.rutas_perfiles (rol);

-- ---- Tabla: planes semanales ------------------------------------------------

create table public.rutas_planes (
  id                       uuid primary key default gen_random_uuid(),
  owner_employee_id        integer not null references public.employees(id) on delete restrict,
  branch_id                integer not null references public.branches(id),
  semana_inicio            date not null,
  estado                   public.estado_plan_ruta not null default 'borrador',
  precio_gasolina          numeric(8,2),
  autorizado_por           integer references public.employees(id),
  autorizado_at            timestamptz,
  rechazado_por            integer references public.employees(id),
  rechazado_at             timestamptz,
  motivo_rechazo           text,
  recursos_asignados_por   integer references public.employees(id),
  recursos_asignados_at    timestamptz,
  notas                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (owner_employee_id, semana_inicio)
);

create index rutas_planes_owner_idx  on public.rutas_planes (owner_employee_id);
create index rutas_planes_branch_idx on public.rutas_planes (branch_id);
create index rutas_planes_estado_idx on public.rutas_planes (estado);

-- ---- Tabla: entregas --------------------------------------------------------

create table public.rutas_entregas (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references public.rutas_planes(id) on delete cascade,
  orden            integer not null,
  origen_address   text,
  origen_lat       double precision not null,
  origen_lng       double precision not null,
  destino_address  text,
  destino_lat      double precision not null,
  destino_lng      double precision not null,
  distancia_m      integer,
  duracion_s       integer,
  created_at       timestamptz not null default now(),
  unique (plan_id, orden)
);

create index rutas_entregas_plan_idx on public.rutas_entregas (plan_id);

-- Reusa set_updated_at de la migración 001
create trigger rutas_planes_updated_at
  before update on public.rutas_planes
  for each row execute function public.set_updated_at();

-- ---- Helpers ----------------------------------------------------------------

create or replace function public.auth_rol_rutas()
returns public.rol_rutas
language sql stable security definer set search_path = public as $$
  select rp.rol
    from public.rutas_perfiles rp
    join public.employees e on e.id = rp.employee_id
   where e.auth_user_id = auth.uid()
   limit 1
$$;

create or replace function public.auth_branch_id()
returns integer
language sql stable security definer set search_path = public as $$
  select branch_id
    from public.employees
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---- Trigger: transiciones de estado de rutas_planes ------------------------

create or replace function public.check_plan_ruta_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  emp_id     integer            := public.auth_employee_id();
  rol_actual public.rol_rutas   := public.auth_rol_rutas();
begin
  if old.estado = new.estado then
    return new;
  end if;

  -- Dueño envía borrador -> pendiente
  if old.estado = 'borrador' and new.estado = 'pendiente_autorizacion' then
    if new.owner_employee_id <> emp_id then
      raise exception 'Solo el dueño puede enviar el plan';
    end if;
    return new;
  end if;

  -- Supervisor de sucursal autoriza
  if old.estado = 'pendiente_autorizacion' and new.estado = 'autorizado' then
    if rol_actual is distinct from 'supervisor_sucursal' then
      raise exception 'Solo el supervisor de sucursal puede autorizar';
    end if;
    new.autorizado_por := emp_id;
    new.autorizado_at  := now();
    return new;
  end if;

  -- Supervisor de sucursal rechaza
  if old.estado = 'pendiente_autorizacion' and new.estado = 'rechazado' then
    if rol_actual is distinct from 'supervisor_sucursal' then
      raise exception 'Solo el supervisor de sucursal puede rechazar';
    end if;
    new.rechazado_por := emp_id;
    new.rechazado_at  := now();
    return new;
  end if;

  -- Dueño regresa rechazado -> borrador para corregir
  if old.estado = 'rechazado' and new.estado = 'borrador' then
    if old.owner_employee_id <> emp_id then
      raise exception 'Solo el dueño puede regresar el plan a borrador';
    end if;
    new.rechazado_por    := null;
    new.rechazado_at     := null;
    new.motivo_rechazo   := null;
    return new;
  end if;

  -- Supervisor general asigna recursos
  if old.estado = 'autorizado' and new.estado = 'recursos_asignados' then
    if rol_actual is distinct from 'supervisor_general' then
      raise exception 'Solo el supervisor general puede asignar recursos';
    end if;
    new.recursos_asignados_por := emp_id;
    new.recursos_asignados_at  := now();
    return new;
  end if;

  raise exception 'Transición de estado no válida: % -> %', old.estado, new.estado;
end;
$$;

create trigger rutas_planes_state_transition
  before update of estado on public.rutas_planes
  for each row execute function public.check_plan_ruta_transition();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.rutas_perfiles enable row level security;
alter table public.rutas_planes   enable row level security;
alter table public.rutas_entregas enable row level security;

-- ---- rutas_perfiles ---------------------------------------------------------
-- Self ve su perfil; supervisor_sucursal ve su sucursal; supervisor_general ve
-- todos; is_admin (de Vacaciones) escribe/lee todo.

create policy rutas_perfiles_select_self on public.rutas_perfiles
  for select to authenticated using (
    employee_id = public.auth_employee_id()
  );

create policy rutas_perfiles_select_super_suc on public.rutas_perfiles
  for select to authenticated using (
    public.auth_rol_rutas() = 'supervisor_sucursal'
    and exists (
      select 1 from public.employees e
       where e.id = rutas_perfiles.employee_id
         and e.branch_id = public.auth_branch_id()
    )
  );

create policy rutas_perfiles_select_super_gen on public.rutas_perfiles
  for select to authenticated using (
    public.auth_rol_rutas() = 'supervisor_general'
  );

create policy rutas_perfiles_admin_write on public.rutas_perfiles
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());

-- ---- rutas_planes -----------------------------------------------------------

-- SELECT
create policy rutas_planes_select_owner on public.rutas_planes
  for select to authenticated using (
    owner_employee_id = public.auth_employee_id()
  );

create policy rutas_planes_select_super_suc on public.rutas_planes
  for select to authenticated using (
    public.auth_rol_rutas() = 'supervisor_sucursal'
    and branch_id = public.auth_branch_id()
    and estado <> 'borrador'
  );

create policy rutas_planes_select_super_gen on public.rutas_planes
  for select to authenticated using (
    public.auth_rol_rutas() = 'supervisor_general'
    and estado in ('autorizado', 'recursos_asignados')
  );

-- INSERT: vendedor/conductor crea para sí, en su sucursal, como borrador
create policy rutas_planes_insert_owner on public.rutas_planes
  for insert to authenticated with check (
    owner_employee_id = public.auth_employee_id()
    and branch_id     = public.auth_branch_id()
    and estado        = 'borrador'
    and public.auth_rol_rutas() in ('vendedor', 'conductor')
  );

-- UPDATE
create policy rutas_planes_update_owner on public.rutas_planes
  for update to authenticated
  using (
    owner_employee_id = public.auth_employee_id()
    and estado in ('borrador', 'rechazado')
  )
  with check (
    owner_employee_id = public.auth_employee_id()
  );

create policy rutas_planes_update_super_suc on public.rutas_planes
  for update to authenticated
  using (
    public.auth_rol_rutas() = 'supervisor_sucursal'
    and branch_id = public.auth_branch_id()
    and estado = 'pendiente_autorizacion'
  )
  with check (
    public.auth_rol_rutas() = 'supervisor_sucursal'
    and branch_id = public.auth_branch_id()
  );

create policy rutas_planes_update_super_gen on public.rutas_planes
  for update to authenticated
  using (
    public.auth_rol_rutas() = 'supervisor_general'
    and estado = 'autorizado'
  )
  with check (
    public.auth_rol_rutas() = 'supervisor_general'
  );

-- DELETE: dueño borra su borrador
create policy rutas_planes_delete_owner on public.rutas_planes
  for delete to authenticated using (
    owner_employee_id = public.auth_employee_id()
    and estado = 'borrador'
  );

-- ---- rutas_entregas (heredan permisos del plan) -----------------------------

create policy rutas_entregas_select_owner on public.rutas_entregas
  for select to authenticated using (
    exists (
      select 1 from public.rutas_planes p
       where p.id = rutas_entregas.plan_id
         and p.owner_employee_id = public.auth_employee_id()
    )
  );

create policy rutas_entregas_modify_owner on public.rutas_entregas
  for all to authenticated
  using (
    exists (
      select 1 from public.rutas_planes p
       where p.id = rutas_entregas.plan_id
         and p.owner_employee_id = public.auth_employee_id()
         and p.estado in ('borrador', 'rechazado')
    )
  )
  with check (
    exists (
      select 1 from public.rutas_planes p
       where p.id = rutas_entregas.plan_id
         and p.owner_employee_id = public.auth_employee_id()
         and p.estado in ('borrador', 'rechazado')
    )
  );

create policy rutas_entregas_select_super_suc on public.rutas_entregas
  for select to authenticated using (
    exists (
      select 1 from public.rutas_planes p
       where p.id = rutas_entregas.plan_id
         and public.auth_rol_rutas() = 'supervisor_sucursal'
         and p.branch_id = public.auth_branch_id()
         and p.estado <> 'borrador'
    )
  );

create policy rutas_entregas_select_super_gen on public.rutas_entregas
  for select to authenticated using (
    exists (
      select 1 from public.rutas_planes p
       where p.id = rutas_entregas.plan_id
         and public.auth_rol_rutas() = 'supervisor_general'
         and p.estado in ('autorizado', 'recursos_asignados')
    )
  );
