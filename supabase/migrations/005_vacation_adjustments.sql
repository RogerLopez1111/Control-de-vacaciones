-- ============================================================================
-- Migration 005: ajustes manuales al saldo de vacaciones (RRHH).
-- Cada ajuste vive dentro del periodo anual del empleado (entre aniversarios).
-- Puede ser positivo (bono, días extra) o negativo (deducción, días tomados
-- fuera del sistema).
-- ============================================================================
create table public.vacation_adjustments (
  id                       uuid primary key default gen_random_uuid(),
  employee_id              integer not null references public.employees(id),
  -- Inicio del periodo anual al que aplica el ajuste (aniversario o fecha de
  -- ingreso del empleado). Determina contra qué saldo se cuenta.
  period_start             date not null,
  delta_days               integer not null check (delta_days <> 0),
  reason                   text not null,
  adjusted_by_employee_id  integer not null references public.employees(id),
  adjusted_at              timestamptz not null default now()
);

create index vacation_adjustments_employee_idx on public.vacation_adjustments (employee_id, period_start);

alter table public.vacation_adjustments enable row level security;

-- SELECT: el propio empleado ve sus ajustes; el admin ve todo.
create policy vacation_adjustments_select on public.vacation_adjustments
  for select to authenticated using (
    employee_id = public.auth_employee_id()
    or public.auth_is_admin()
  );

-- INSERT/UPDATE/DELETE: solo admin.
create policy vacation_adjustments_admin_write on public.vacation_adjustments
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
