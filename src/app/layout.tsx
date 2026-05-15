import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Vacaciones — Ecosistemas",
  description: "Sistema interno de solicitud y aprobación de vacaciones",
  icons: {
    icon: "https://cdn.shopify.com/s/files/1/0771/6975/4358/files/logo-footer_fc28a06e-0691-4e47-83e3-d3888c3202bb.png?v=1759271820",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
