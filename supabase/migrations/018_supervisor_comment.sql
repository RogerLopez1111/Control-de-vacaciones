-- ============================================================================
-- Migration 018: comentario del supervisor/watcher en solicitudes pendientes.
-- El watcher de un área puede dejar un comentario en solicitudes pendientes
-- de empleados de esa área para que el aprobador tome una decisión informada.
-- ============================================================================

alter table public.vacation_requests
  add column if not exists supervisor_comment             text,
  add column if not exists supervisor_comment_by_employee_id
    integer references public.employees(id);
