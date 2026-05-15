/**
 * Wipes branches + employees in Supabase so a fresh sync can repopulate cleanly.
 * Vacation requests must be empty (will fail otherwise via FK).
 *
 *   npx tsx scripts/reset-erp-data.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  // Break self-FK first: clear manager_employee_id on every row.
  const { error: e0 } = await supa.from("employees").update({ manager_employee_id: null }).gt("id", -1);
  if (e0) console.error("✗ clearing manager_employee_id:", e0.message);
  else console.log("✓ cleared manager_employee_id on all employees");

  const { error: e1, count: empCount } = await supa.from("employees").delete({ count: "exact" }).gt("id", -1);
  if (e1) { console.error("✗ delete employees:", e1.message); return; }
  console.log(`✓ deleted employees: ${empCount}`);

  const { error: e2, count: brCount } = await supa.from("branches").delete({ count: "exact" }).gt("id", -1);
  if (e2) { console.error("✗ delete branches:", e2.message); return; }
  console.log(`✓ deleted branches: ${brCount}`);
}

main().catch(console.error);
