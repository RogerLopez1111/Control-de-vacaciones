import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: roger, error: rErr } = await s.from("employees").select("id, nombre, apellido_paterno, is_admin").eq("id", 408);
  console.log("Roger (id 408):", roger, rErr?.message ?? "");
  const { data: alfredos } = await s.from("employees").select("id, nombre, apellido_paterno, departamento_id, puesto_id").ilike("nombre", "%alfredo%");
  console.log("Alfredos:", alfredos);
  const { data: jose } = await s.from("employees").select("id").eq("id", 423);
  console.log("Jose Luis Millet (id 423) presente?", jose?.length ?? 0);
}
main();
