-- Saved locations for Rutas: branch origins and repeat client destinations
create table public.rutas_puntos (
  id          uuid primary key default gen_random_uuid(),
  branch_id   integer not null references public.branches(id) on delete cascade,
  nombre      text not null,
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  tipo        text not null default 'cliente',
  created_at  timestamptz not null default now(),
  constraint  tipo_check check (tipo in ('sucursal', 'cliente'))
);

alter table public.rutas_puntos enable row level security;

-- Anyone with a Rutas profile in the same branch can read puntos for their branch
create policy "rutas_puntos_select" on public.rutas_puntos
  for select using (
    auth_is_admin()
    or branch_id = auth_branch_id()
  );

-- Supervisors and admins can insert puntos for their branch
create policy "rutas_puntos_insert" on public.rutas_puntos
  for insert with check (
    auth_is_admin()
    or (
      auth_rol_rutas() in ('supervisor_sucursal', 'supervisor_general')
      and branch_id = auth_branch_id()
    )
  );

-- Supervisors and admins can update puntos for their branch
create policy "rutas_puntos_update" on public.rutas_puntos
  for update using (
    auth_is_admin()
    or (
      auth_rol_rutas() in ('supervisor_sucursal', 'supervisor_general')
      and branch_id = auth_branch_id()
    )
  );

-- Supervisors and admins can delete puntos for their branch
create policy "rutas_puntos_delete" on public.rutas_puntos
  for delete using (
    auth_is_admin()
    or (
      auth_rol_rutas() in ('supervisor_sucursal', 'supervisor_general')
      and branch_id = auth_branch_id()
    )
  );
