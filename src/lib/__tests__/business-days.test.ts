import { describe, it, expect } from "vitest";
import { countBusinessDays } from "../business-days";

describe("countBusinessDays", () => {
  it("una semana completa (lun-vie) = 5 días", () => {
    // 2026-05-11 (lun) — 2026-05-15 (vie)
    expect(countBusinessDays(new Date(2026, 4, 11), new Date(2026, 4, 15))).toBe(5);
  });

  it("incluye fin de semana → solo cuenta hábiles", () => {
    // 2026-05-11 (lun) — 2026-05-17 (dom) = 5
    expect(countBusinessDays(new Date(2026, 4, 11), new Date(2026, 4, 17))).toBe(5);
  });

  it("solo fin de semana = 0", () => {
    expect(countBusinessDays(new Date(2026, 4, 16), new Date(2026, 4, 17))).toBe(0);
  });

  it("excluye feriados", () => {
    // semana del 11 al 15, excluye martes 12 como feriado
    const holidays = new Set(["2026-05-12"]);
    expect(countBusinessDays(new Date(2026, 4, 11), new Date(2026, 4, 15), holidays)).toBe(4);
  });

  it("end < start = 0", () => {
    expect(countBusinessDays(new Date(2026, 4, 15), new Date(2026, 4, 11))).toBe(0);
  });

  it("un solo día hábil", () => {
    expect(countBusinessDays(new Date(2026, 4, 15), new Date(2026, 4, 15))).toBe(1);
  });
});
