-- ============================================================================
-- Migration 014: Rutas — visibilidad de empleados para supervisores
--
-- Los supervisor_sucursal y supervisor_general de Rutas necesitan ver el
-- nombre del dueño de cada plan (vendedor/conductor) para autorizar y para
-- asignar recursos. Sin estas políticas el join contra public.employees
-- regresa null porque el RLS base de Vacaciones solo deja ver self / direct
-- reports / admin.
--
-- Son políticas adicionales (OR con las existentes) — no quitan visibilidad
-- a nadie.
-- ============================================================================

create policy employees_select_rutas_super_suc on public.employees
  for select to authenticated using (
    public.auth_rol_rutas() = 'supervisor_sucursal'
    and branch_id = public.auth_branch_id()
  );

create policy employees_select_rutas_super_gen on public.employees
  for select to authenticated using (
    public.auth_rol_rutas() = 'supervisor_general'
  );
