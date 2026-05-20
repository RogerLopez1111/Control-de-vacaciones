"use client";

import { useEffect } from "react";

/**
 * Si la URL trae ?autoprint=1, dispara window.print() en cuanto el documento
 * (incluyendo la imagen del logo) terminó de cargar. Permite que el flujo
 * "Aprobar → ya está lista la hoja para imprimir" sea de un solo clic.
 */
export function AutoPrintTrigger() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoprint") !== "1") return;

    const trigger = () => {
      // Pequeño delay para que el navegador termine de pintar antes del diálogo
      setTimeout(() => window.print(), 100);
    };

    if (document.readyState === "complete") trigger();
    else window.addEventListener("load", trigger, { once: true });

    return () => window.removeEventListener("load", trigger);
  }, []);
  return null;
}
