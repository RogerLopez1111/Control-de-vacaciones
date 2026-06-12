/**
 * SQL Server client for ERP (ECO_2020) — server-side only.
 *
 * Conventions inherited from the Ecosistemas CRM project:
 *   - env vars: MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD
 *   - local SQL Server: trustServerCertificate=true, encrypt=false
 *   - lazy singleton ConnectionPool (max=10)
 *   - filter Es_Cve_Estado = 'AC' for "activo"
 */
import sql from "mssql";

const config: sql.config = {
  server: process.env.MSSQL_SERVER ?? "",
  database: process.env.MSSQL_DATABASE ?? "",
  user: process.env.MSSQL_USER ?? "",
  password: process.env.MSSQL_PASSWORD ?? "",
  port: Number(process.env.MSSQL_PORT ?? 1433),
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false",
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    if (!config.server || !config.database) {
      throw new Error("Missing env vars: MSSQL_SERVER and MSSQL_DATABASE are required.");
    }
    pool = await new sql.ConnectionPool(config).connect();
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool?.connected) await pool.close();
  pool = null;
}

// ---------------------------------------------------------------------------
// Sucursal
// ---------------------------------------------------------------------------
export interface ErpSucursal {
  Sc_Cve_Sucursal: number;
  Sc_Descripcion: string;
  Es_Cve_Estado: string | null;
}

export async function getSucursalesRaw(): Promise<ErpSucursal[]> {
  const p = await getPool();
  const r = await p.request().query<ErpSucursal>(`
    SELECT Sc_Cve_Sucursal, Sc_Descripcion, Es_Cve_Estado
    FROM Sucursal
    WHERE LTRIM(RTRIM(Es_Cve_Estado)) = 'AC'
    ORDER BY Sc_Descripcion
  `);
  return r.recordset;
}

// ---------------------------------------------------------------------------
// Empleado
// ---------------------------------------------------------------------------
export interface ErpEmpleado {
  Em_Cve_Empleado: number;
  Em_Codigo_Alterno: string | null;
  Em_Nombre: string;
  Em_Apellido_Paterno: string | null;
  Em_Apellido_Materno: string | null;
  Em_Email: string | null;
  Em_Email_2: string | null;
  Sc_Cve_Sucursal: number | null;
  Em_Reporta: number | null;
  Em_Fecha_Ingreso: Date | null;
  Em_Fecha_Baja: Date | null;
  Em_Fecha_Nacimiento: Date | null;
  De_Cve_Departamento_Empleado: number | null;
  Pe_Cve_Puesto_Empleado: number | null;
  Es_Cve_Estado: string | null;
  Fecha_Ult_Modif: Date | null;
}

export async function getEmpleadosRaw(since?: string): Promise<ErpEmpleado[]> {
  const p = await getPool();
  const req = p.request();
  const baseCols = `
    Em_Cve_Empleado, Em_Codigo_Alterno, Em_Nombre, Em_Apellido_Paterno, Em_Apellido_Materno,
    Em_Email, Em_Email_2, Sc_Cve_Sucursal, Em_Reporta, Em_Fecha_Ingreso, Em_Fecha_Baja,
    Em_Fecha_Nacimiento,
    De_Cve_Departamento_Empleado, Pe_Cve_Puesto_Empleado, Es_Cve_Estado, Fecha_Ult_Modif
  `;
  // Filtros:
  //  1) Es_Cve_Estado = 'AC' — solo empleados activos.
  //  2) Excluir comisionistas (departamento 9 ó puesto 26). Los comisionistas
  //     no son empleados con derechos LFT — son figuras asimiladas a salarios
  //     y no devengan vacaciones en este sistema.
  const filters = `
    LTRIM(RTRIM(Es_Cve_Estado)) = 'AC'
    AND NOT (De_Cve_Departamento_Empleado = 9 OR Pe_Cve_Puesto_Empleado = 26)
  `;
  if (since) {
    req.input("since", sql.DateTime, new Date(since));
    const r = await req.query<ErpEmpleado>(
      `SELECT ${baseCols} FROM Empleado WHERE ${filters} AND Fecha_Ult_Modif >= @since`
    );
    return r.recordset;
  }
  const r = await req.query<ErpEmpleado>(`SELECT ${baseCols} FROM Empleado WHERE ${filters}`);
  return r.recordset;
}

// ---------------------------------------------------------------------------
// Row normalization — same pattern as the CRM project:
//   Date  → ISO string
//   string→ trimmed (char/nchar columns are space-padded)
// ---------------------------------------------------------------------------
// Loose typing on purpose — raw ERP rows come through as record-like objects
// regardless of how the SQL query was typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeErpRow(row: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "string") out[k] = v.trim();
    else out[k] = v;
  }
  return out;
}
