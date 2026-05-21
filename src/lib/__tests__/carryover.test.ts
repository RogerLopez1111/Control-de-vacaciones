import { describe, it, expect } from "vitest";
import { computeCarryoverPlan } from "../saldo";
import { isWithinPostAnniversaryWindow, CARRYOVER_WINDOW_DAYS } from "../carryover";

describe("computeCarryoverPlan", () => {
  it("empleado sin aniversarios cumplidos → plan vacío", () => {
    const hire = new Date(2026, 0, 1);
    const asOf = new Date(2026, 5, 1);
    expect(computeCarryoverPlan(hire, asOf, [], [])).toEqual([]);
  });

  it("primer año cerrado sin solicitudes → arrastre = 0 (no se persiste)", () => {
    // hire 2024-03-01, asOf 2025-04-01 → 1 año cumplido.
    // El año 1 tiene entitlement = 0, ningún taken, ningún ajuste → remaining 0.
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2025, 3, 1);
    const plan = computeCarryoverPlan(hire, asOf, [], []);
    expect(plan).toEqual([
      {
        period_start: "2025-03-01",
        delta_days: 0,
        source_period_start: "2024-03-01",
        source_period_end: "2025-03-01",
      },
    ]);
  });

  it("segundo año cumplido sin tomar nada → arrastra los 12 días LFT", () => {
    // hire 2024-03-01, asOf 2026-04-01 → 2 años cumplidos.
    // Año 1 (2024-03 → 2025-03): entitlement 0, taken 0 → carryover 0.
    // Año 2 (2025-03 → 2026-03): entitlement 12, taken 0, carryover_in 0 → carryover 12.
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 3, 1);
    const plan = computeCarryoverPlan(hire, asOf, [], []);
    expect(plan).toHaveLength(2);
    expect(plan[0].delta_days).toBe(0);
    expect(plan[1]).toEqual({
      period_start: "2026-03-01",
      delta_days: 12,
      source_period_start: "2025-03-01",
      source_period_end: "2026-03-01",
    });
  });

  it("acumula sobrantes a lo largo de varios periodos", () => {
    // hire 2023-03-01, asOf 2026-05-01 → 3 años cumplidos.
    // Año 1 (entitlement 0)  → carry 0.
    // Año 2 (entitlement 12) → carry 12.
    // Año 3 (entitlement 14, +12 acumulado) → carry 26.
    const hire = new Date(2023, 2, 1);
    const asOf = new Date(2026, 4, 1);
    const plan = computeCarryoverPlan(hire, asOf, [], []);
    expect(plan.map((p) => p.delta_days)).toEqual([0, 12, 26]);
  });

  it("resta días tomados (aprobados y pendientes) en el periodo de origen", () => {
    // hire 2024-03-01, asOf 2026-04-01.
    // En el año 2 (2025-03 → 2026-03) toma 5 aprobados + 2 pendientes = 7 días.
    // entitlement 12 → remaining 12 − 7 = 5.
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 3, 1);
    const plan = computeCarryoverPlan(
      hire,
      asOf,
      [
        { start_date: "2025-04-01", end_date: "2025-04-07", business_days: 5, status: "aprobada" },
        { start_date: "2025-06-15", end_date: "2025-06-16", business_days: 2, status: "pendiente" },
        { start_date: "2025-07-10", end_date: "2025-07-12", business_days: 3, status: "rechazada" },
        { start_date: "2025-08-10", end_date: "2025-08-11", business_days: 2, status: "cancelada" },
      ],
      [],
    );
    expect(plan[1].delta_days).toBe(5);
  });

  it("incluye ajustes manuales del periodo de origen", () => {
    // hire 2024-03-01, asOf 2026-04-01.
    // Año 2: entitlement 12 + ajuste +3 − 0 tomados = 15.
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 3, 1);
    const plan = computeCarryoverPlan(
      hire,
      asOf,
      [],
      [{ period_start: "2025-03-01", delta_days: 3 }],
    );
    expect(plan[1].delta_days).toBe(15);
  });

  it("solicitudes fuera del periodo de origen no afectan", () => {
    // Una solicitud cuyo start_date cae en otro periodo no debe descontar.
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 3, 1);
    const plan = computeCarryoverPlan(
      hire,
      asOf,
      [
        // start en periodo en curso (año 3), no en año 2:
        { start_date: "2026-03-15", end_date: "2026-03-18", business_days: 4, status: "aprobada" },
      ],
      [],
    );
    expect(plan[1].delta_days).toBe(12);
  });

  it("solicitud cuya start_date == aniversario cuenta en el periodo nuevo", () => {
    // start_date = 2025-03-01 cae en el inicio del año 2 (no en año 1).
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 3, 1);
    const plan = computeCarryoverPlan(
      hire,
      asOf,
      [{ start_date: "2025-03-01", end_date: "2025-03-05", business_days: 5, status: "aprobada" }],
      [],
    );
    expect(plan[0].delta_days).toBe(0); // año 1 intacto
    expect(plan[1].delta_days).toBe(7);  // año 2: 12 − 5
  });

  it("puede producir arrastre negativo si se aprobó de más", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 3, 1);
    const plan = computeCarryoverPlan(
      hire,
      asOf,
      [{ start_date: "2025-04-01", end_date: "2025-04-30", business_days: 20, status: "aprobada" }],
      [],
    );
    // Año 2: 12 − 20 = −8.
    expect(plan[1].delta_days).toBe(-8);
  });
});

describe("isWithinPostAnniversaryWindow", () => {
  it("empleado en su primer año (sin aniversario cumplido) → false", () => {
    const hire = new Date(2026, 0, 15);
    const asOf = new Date(2026, 5, 1);
    expect(isWithinPostAnniversaryWindow(hire, asOf)).toBe(false);
  });

  it("justo el día del aniversario → true", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 2, 1); // 2do aniversario
    expect(isWithinPostAnniversaryWindow(hire, asOf)).toBe(true);
  });

  it("dentro de la ventana (1 día después) → true", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 2, 2);
    expect(isWithinPostAnniversaryWindow(hire, asOf)).toBe(true);
  });

  it("último día de la ventana → true", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2024, 2, 1);
    asOf.setDate(asOf.getDate() + 365 + CARRYOVER_WINDOW_DAYS);
    expect(isWithinPostAnniversaryWindow(hire, asOf)).toBe(true);
  });

  it("un día después de cerrar la ventana → false", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2024, 2, 1);
    asOf.setDate(asOf.getDate() + 365 + CARRYOVER_WINDOW_DAYS + 1);
    expect(isWithinPostAnniversaryWindow(hire, asOf)).toBe(false);
  });

  it("muy lejos del aniversario (mitad del año) → false", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2025, 8, 1); // ~6 meses tras el 1er aniv
    expect(isWithinPostAnniversaryWindow(hire, asOf)).toBe(false);
  });

  it("ventana personalizable", () => {
    const hire = new Date(2024, 2, 1);
    const asOf = new Date(2026, 2, 8); // 7 días tras aniversario
    expect(isWithinPostAnniversaryWindow(hire, asOf, 5)).toBe(false);
    expect(isWithinPostAnniversaryWindow(hire, asOf, 10)).toBe(true);
  });
});
