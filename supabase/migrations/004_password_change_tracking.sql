-- ============================================================================
-- Migration 004: track when each employee changed their password.
-- NULL = still using the default (ecosistemas + año de ingreso).
-- The login flow forces a password change before granting access when this is NULL.
-- ============================================================================
alter table public.employees
  add column password_changed_at timestamptz;
