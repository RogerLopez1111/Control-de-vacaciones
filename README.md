# Control de Vacaciones — Ecosistemas

Sistema interno para que los empleados de Ecosistemas soliciten vacaciones,
los jefes directos aprueben/rechacen, y RRHH tenga visibilidad total.

## Arquitectura

```
┌────────────────────┐     nightly (cron)     ┌──────────────────┐
│  ERP on-prem       │ ─────────────────────► │  Sync agent      │
│  SQL Server        │   read-only mssql      │  (Node + tsx)    │
│  ECO_2020          │                        │  scripts/sync-erp │
│  .dbo.Empleado     │                        │                  │
│  .dbo.Sucursal     │                        └────────┬─────────┘
└────────────────────┘                                 │ upsert (service role)
                                                       ▼
                                              ┌──────────────────┐
                                              │  Supabase        │
                                              │  Postgres + Auth │
                                              │  + RLS           │
                                              └────────┬─────────┘
                                                       │ anon key + RLS
                                                       ▼
                                              ┌──────────────────┐
                                              │  Next.js (App)   │
                                              │  hosted Vercel   │
                                              └──────────────────┘
```

**Source of truth:** el ERP. La app **nunca** escribe en SQL Server.
Las solicitudes de vacaciones viven solo en Supabase.

## Roles

- **Empleado** — ve su saldo, solicita vacaciones, ve su historial, puede cancelar pendientes.
- **Jefe directo** (calculado vía `employees.manager_employee_id`, originado de `Em_Reporta`) — aprueba/rechaza las solicitudes de sus reportes directos.
- **Admin / RRHH** (flag `employees.is_admin`) — ve todo, aprueba cualquier solicitud, administra feriados.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Supabase: Postgres, Auth (magic link), RLS
- `mssql` + `tsx` para el agente de sincronización ERP→Supabase
- Vitest para pruebas unitarias

## Identidad visual

Hereda el sistema de marca de los apps internos de Ecosistemas (ver CRM).

| Token | Hex |
|---|---|
| `brand-red` | `#B70B0F` |
| `brand-red-tint` | `#FBE7E8` |
| `brand-navy` | `#141456` |
| `brand-navy-tint` | `#E7E7F0` |
| `brand-gray` | `#686868` |

Tipografía: **Montserrat Variable** (`@fontsource-variable/montserrat`).
Estética: plana — sin sombras, contenedores cuadrados, bordes finos.

## Setup local

1. Instala dependencias: `npm install`
2. Copia `.env.example` a `.env.local` y completa los valores de Supabase.
3. En el dashboard de Supabase (SQL editor), corre las migraciones en orden:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
4. Marca al menos un empleado como admin desde el SQL editor:
   ```sql
   update public.employees set is_admin = true where email = 'tu.correo@ecosistemas.com';
   ```
5. Corre la app: `npm run dev` → http://localhost:3000

## Sincronizar el ERP

Pensado para correr **dentro de la red de Ecosistemas** (no en Vercel).
Reutiliza la convención del CRM (`PRUEBA-CRM-GEMINI-CODE`): mismas variables
de entorno (`MSSQL_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

```
npm install
cp .env.example .env  # llena MSSQL_* y SUPABASE_SERVICE_ROLE_KEY
npm run sync:erp                           # sincronización completa
npm run sync:erp -- --since=2026-05-14     # delta desde una fecha (Fecha_Ult_Modif)
```

Programa este comando con **Task Scheduler** (Windows) para correr cada noche.

**Tablas sincronizadas:**
- `[dbo].[Sucursal]` → `public.branches` (id, nombre, activa)
- `[dbo].[Empleado]` → `public.employees` (id, nombre, email, branch, hire_date, manager_employee_id, ...)

El upsert de empleados se hace en dos pasadas: primero las filas (con
`manager_employee_id = null`), después actualiza el `Em_Reporta` real para
evitar violaciones de FK al sincronizar a nuevos empleados que reportan a
empleados que aún no existen en Supabase.

## Comandos

```
npm run dev         # Next en local
npm run build       # build de producción
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # vitest (lógica LFT, business days)
npm run sync:erp    # agente de sincronización ERP→Supabase
```

## Cálculo de derecho (LFT)

`src/lib/lft-entitlement.ts` implementa el Art. 76 LFT (reforma 2023):

| Año cumplido | Días |
|---|---|
| 1 | 12 |
| 2 | 14 |
| 3 | 16 |
| 4 | 18 |
| 5 | 20 |
| 6–10 | 22 |
| 11–15 | 24 |
| 16–20 | 26 |
| 21–25 | 28 |
| 26–30 | 30 |
| 31–35 | 32 |
| ... | +2 cada 5 años |

El saldo se calcula sobre el **periodo anual en curso** (entre aniversarios), no
sobre el año calendario.

## Despliegue a Vercel

1. Push del repo a GitHub.
2. Importa el proyecto en Vercel.
3. Configura variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, no `NEXT_PUBLIC_`)
4. En Supabase Auth → URL Configuration agrega la URL de Vercel a
   "Redirect URLs": `https://tu-app.vercel.app/auth/callback`.

## TODO / Pendiente decidir

- [ ] Confirmar nombres reales de columnas en `[dbo].[Sucursal]`.
- [ ] Decidir si hay empleados sin email — necesitan login alternativo.
- [ ] Importar historial de vacaciones del año en curso (si existe en algún lado).
- [ ] Días feriados nacionales 2026 — cargar a `holidays`.
- [ ] Notificaciones por correo cuando hay aprobación pendiente / decidida.
- [ ] Reporte/exportación CSV para RRHH.
