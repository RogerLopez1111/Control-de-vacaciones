import { TestEmailForm } from "./test-email-form";

export default function DiagnosticosPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-navy">Diagnósticos</h1>
      <p className="text-sm text-brand-gray">
        Herramientas para verificar configuración y conectividad.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">SMTP / correo</h2>
        <TestEmailForm />
      </section>
    </main>
  );
}
