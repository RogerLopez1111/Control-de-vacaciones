-- ============================================================================
-- Migration 003: only the admin (RRHH) can approve/reject vacation requests.
-- Drops the manager-approval policy. Managers can still SEE their direct
-- reports' requests, just can't approve them.
-- ============================================================================
drop policy if exists vacation_requests_update_manager on public.vacation_requests;
