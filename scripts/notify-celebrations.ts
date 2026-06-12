/**
 * notify-celebrations.ts
 * Envía correos de felicitación a empleados que cumplen años de servicio
 * (aniversario laboral) o de vida (cumpleaños) hoy.
 *
 * Ejecutar diariamente tras el sync:
 *   npm run notify:celebrations
 *
 * Requiere las mismas env vars de SMTP que el resto de notificaciones:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (opcional)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  sendAnniversaryNotification,
  sendBirthdayNotification,
} from "../src/lib/email/notifier.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Employee {
  id: number;
  nombre: string;
  apellido_paterno: string | null;
  email: string | null;
  hire_date: string;
  birth_date: string | null;
}

async function main() {
  const now = new Date();
  const todayMM = now.getMonth() + 1;
  const todayDD = now.getDate();
  const todayYear = now.getFullYear();

  console.log(`\n── Celebraciones ${now.toLocaleDateString("es-MX")} ──`);

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, nombre, apellido_paterno, email, hire_date, birth_date")
    .is("termination_date", null);

  if (error) {
    console.error("✗ Error al obtener empleados:", error.message);
    process.exit(1);
  }

  const list = (employees ?? []) as Employee[];
  let anniversaries = 0;
  let birthdays = 0;

  for (const emp of list) {
    const fullName = `${emp.nombre} ${emp.apellido_paterno ?? ""}`.trim();
    const email = emp.email?.toLowerCase().trim() || null;

    // — Aniversario laboral —
    if (emp.hire_date) {
      const [hireYear, hireMM, hireDD] = emp.hire_date.split("-").map(Number);
      if (hireMM === todayMM && hireDD === todayDD) {
        const years = todayYear - hireYear;
        if (years >= 1) {
          console.log(`  Aniversario: ${fullName} (${years} año${years === 1 ? "" : "s"})`);
          if (email) {
            await sendAnniversaryNotification({ to: email, employeeName: fullName, years });
            anniversaries++;
          } else {
            console.warn(`    ↳ sin email, omitido`);
          }
        }
      }
    }

    // — Cumpleaños —
    if (emp.birth_date) {
      const [, birthMM, birthDD] = emp.birth_date.split("-").map(Number);
      if (birthMM === todayMM && birthDD === todayDD) {
        console.log(`  Cumpleaños: ${fullName}`);
        if (email) {
          await sendBirthdayNotification({ to: email, employeeName: fullName });
          birthdays++;
        } else {
          console.warn(`    ↳ sin email, omitido`);
        }
      }
    }
  }

  console.log(`✓ Aniversarios enviados: ${anniversaries}`);
  console.log(`✓ Cumpleaños enviados:   ${birthdays}`);
  if (anniversaries + birthdays === 0) {
    console.log("  (ninguna celebración hoy)");
  }
  console.log("── done ──\n");
}

main().catch((err) => {
  console.error("notify-celebrations failed:", err);
  process.exit(1);
});
