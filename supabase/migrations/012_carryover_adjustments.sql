-- ============================================================================
-- Migration 012: arrastre de saldo entre periodos.
-- Los días no usados de un periodo anual se conservan automáticamente y
-- se reflejan como una fila kind='carryover' en vacation_adjustments.
-- ============================================================================

-- 1. Columna `kind` para distinguir ajustes manuales (RRHH) de los
--    automáticos de arrastre. Default = 'manual' para no romper filas viejas.
alter table public.vacation_adjustments
  add column kind text not null default 'manual'
  check (kind in ('manual', 'carryover'));

-- 2. `adjusted_by_employee_id` debe poder ser NULL para filas generadas
--    automáticamente (no hay humano que las cree). Para filas manuales sigue
--    siendo obligatorio (lo aseguramos con un check condicional).
alter table public.vacation_adjustments
  alter column adjusted_by_employee_id drop not null;

alter table public.vacation_adjustments
  add constraint vacation_adjustments_manual_has_author
  check (kind = 'carryover' or adjusted_by_employee_id is not null);

-- 3. Las filas de arrastre permiten delta_days = 0 (un periodo cerrado sin
--    sobrante igual se registra para dejar constancia de que se procesó).
--    El check original prohibía delta_days = 0; lo localizamos por nombre
--    autogenerado y lo reemplazamos por uno condicional.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.vacation_adjustments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%delta_days <> 0%';
  if cname is not null then
    execute format('alter table public.vacation_adjustments drop constraint %I', cname);
  end if;
end $$;

alter table public.vacation_adjustments
  add constraint vacation_adjustments_delta_days_nonzero
  check (kind = 'carryover' or delta_days <> 0);

-- 4. Idempotencia: a lo más una fila de arrastre por (empleado, periodo).
create unique index vacation_adjustments_carryover_unique
  on public.vacation_adjustments (employee_id, period_start)
  where kind = 'carryover';
