-- ============================================================================
-- Migration 021: eliminar políticas RLS huérfanas de Rutas sobre employees.
--
-- La feature Rutas fue desmontada en producción (se borró la tabla
-- public.rutas_perfiles), pero quedaron vivas estas dos políticas creadas en
-- la migración 014. Ambas llaman a public.auth_rol_rutas(), que lee
-- rutas_perfiles → error 42P01 ("relation public.rutas_perfiles does not
-- exist").
--
-- Como las políticas permissivas se combinan con OR y Postgres las evalúa
-- sobre CADA fila candidata del scan, cualquier SELECT sobre employees hecho
-- por un empleado NO admin disparaba ese error y abortaba toda la consulta.
-- Resultado: el dashboard devolvía employees = null y mostraba
-- "Tu correo no está vinculado a un empleado". Los admins no lo veían porque
-- auth_is_admin() cortocircuita en true antes de llegar a la política rota.
--
-- Estas políticas eran puramente aditivas (visibilidad extra para supervisores
-- de Rutas); al no existir Rutas, se eliminan sin pérdida de funcionalidad.
-- ============================================================================

drop policy if exists employees_select_rutas_super_suc on public.employees;
drop policy if exists employees_select_rutas_super_gen on public.employees;
