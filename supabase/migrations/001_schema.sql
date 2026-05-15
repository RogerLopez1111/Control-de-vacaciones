-- ============================================================================
-- Control de Vacaciones — Ecosistemas
-- Schema migration 001: tables, indexes, triggers
-- ============================================================================

-- Sucursales: mirror of [ECO_2020].[dbo].[Sucursal]. Synced from ERP.
create table public.branches (
  id          integer primary key,           -- matches Sc_Cve_Sucursal
  nombre      text not null,
  activa      boolean not null default true,
  synced_at   timestamptz not null default now()
);

-- Empleados: cached mirror of [ECO_2020].[dbo].[Empleado]. Synced from ERP.
-- ERP is source of truth — do not edit these fields manually in the app.
create table public.employees (
  id                    integer primary key,         -- matches Em_Cve_Empleado
  auth_user_id          uuid unique,                 -- Supabase Auth uid, backfilled on first login
  codigo_alterno        text,
  nombre                text not null,
  apellido_paterno      text,
  apellido_materno      text,
  email                 text,                        -- Em_Email (login identity); citext-ish: store lowercase
  branch_id             integer references public.branches(id),
  manager_employee_id   integer references public.employees(id),  -- Em_Reporta (jefe directo)
  hire_date             date not null,               -- Em_Fecha_Ingreso, drives LFT entitlement
  termination_date      date,                        -- Em_Fecha_Baja: when set, employee is inactive
  departamento_id       integer,
  puesto_id             integer,
  is_admin              boolean not null default false,  -- HR/RRHH flag; NOT synced from ERP, set manually
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index employees_email_idx        on public.employees (lower(email));
create index employees_manager_idx      on public.employees (manager_employee_id);
create index employees_branch_idx       on public.employees (branch_id);
create index employees_auth_user_idx    on public.employees (auth_user_id);

-- Solicitudes de vacaciones — owned by this app, NOT in the ERP.
create type public.vacation_status as enum ('pendiente', 'aprobada', 'rechazada', 'cancelada');

create table public.vacation_requests (
  id                       uuid primary key default gen_random_uuid(),
  employee_id              integer not null references public.employees(id),
  start_date               date not null,
  end_date                 date not null,
  business_days            integer not null check (business_days > 0),
  status                   public.vacation_status not null default 'pendiente',
  employee_comment         text,
  decided_by_employee_id   integer references public.employees(id),
  decided_at               timestamptz,
  decision_comment         text,
  requested_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint date_range_valid check (end_date >= start_date)
);

create index vacation_requests_employee_idx on public.vacation_requests (employee_id);
create index vacation_requests_status_idx   on public.vacation_requests (status);
create index vacation_requests_dates_idx    on public.vacation_requests (start_date, end_date);

-- Días feriados (para excluir de business_days). Editable por admin.
create table public.holidays (
  date         date primary key,
  descripcion  text not null
);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_updated_at         before update on public.employees         for each row execute function public.set_updated_at();
create trigger vacation_requests_updated_at before update on public.vacation_requests for each row execute function public.set_updated_at();

-- Backfill auth_user_id when an employee logs in for the first time (matched by email).
-- Called from a trigger on auth.users.
create or replace function public.link_auth_user_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.employees
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and auth_user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user_to_employee();
