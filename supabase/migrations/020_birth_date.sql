-- ============================================================================
-- Migration 020: fecha de nacimiento en empleados.
-- Permite enviar felicitaciones automáticas de cumpleaños.
-- Nullable — se rellena desde el ERP (Em_Fecha_Nacimiento) vía sync.
-- ============================================================================

alter table public.employees
  add column if not exists birth_date date;
