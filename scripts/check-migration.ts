import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const checks = [
    { label: "004 (employees.password_changed_at)", q: () => s.from("employees").select("password_changed_at").limit(1) },
  ];
  let ok = true;
  for (const c of checks) {
    const { error } = await c.q();
    if (error) { console.log(`✗ ${c.label}: ${error.message}`); ok = false; }
    else console.log(`✓ ${c.label}`);
  }
  process.exit(ok ? 0 : 1);
}
main();
