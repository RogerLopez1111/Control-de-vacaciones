import { describe, it, expect } from "vitest";
import { countBusinessDays } from "../business-days";

describe("countBusinessDays (inclusivo, robusto a zona horaria)", () => {
  it("una semana completa (lun-vie) = 5 días", () => {
    // 2026-05-11 (lun) — 2026-05-15 (vie)
    expect(countBusinessDays("2026-05-11", "2026-05-15")).toBe(5);
  });

  it("incluye fin de semana → solo cuenta hábiles", () => {
    // 2026-05-11 (lun) — 2026-05-17 (dom) = 5
    expect(countBusinessDays("2026-05-11", "2026-05-17")).toBe(5);
  });

  it("dos semanas hábiles continuas (lun a vie siguiente) = 10", () => {
    // 2026-06-01 (lun) — 2026-06-12 (vie)
    expect(countBusinessDays("2026-06-01", "2026-06-12")).toBe(10);
  });

  it("solo fin de semana = 0", () => {
    expect(countBusinessDays("2026-05-16", "2026-05-17")).toBe(0);
  });

  it("excluye feriados", () => {
    const holidays = new Set(["2026-05-12"]);
    expect(countBusinessDays("2026-05-11", "2026-05-15", holidays)).toBe(4);
  });

  it("end < start = 0", () => {
    expect(countBusinessDays("2026-05-15", "2026-05-11")).toBe(0);
  });

  it("un solo día hábil (mismo día) = 1", () => {
    expect(countBusinessDays("2026-05-15", "2026-05-15")).toBe(1);
  });

  it("un solo día = domingo → 0", () => {
    expect(countBusinessDays("2026-05-17", "2026-05-17")).toBe(0);
  });
});
