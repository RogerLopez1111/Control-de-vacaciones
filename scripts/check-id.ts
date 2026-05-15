import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const id = Number(process.argv[2]);
  const { data, error } = await s
    .from("employees")
    .select("id, codigo_alterno, nombre, apellido_paterno, apellido_materno, email, branch_id, hire_date, termination_date")
    .eq("id", id);
  if (error) console.error(error);
  else if (!data?.length) console.log(`Sin empleado con id=${id}`);
  else console.log(data);
}
main();
