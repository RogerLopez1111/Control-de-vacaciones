alter table public.rutas_planes
  add column if not exists precio_gasolina_autorizado numeric(8,2);
