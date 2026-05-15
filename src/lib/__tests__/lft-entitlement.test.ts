import { describe, it, expect } from "vitest";
import {
  lftDaysForYear,
  yearsOfServiceAt,
  currentYearOfService,
  entitlementForCurrentYear,
  lastAnniversary,
} from "../lft-entitlement";

describe("lftDaysForYear (tabla del Art. 76 LFT, reforma 2023)", () => {
  it("años 1-5", () => {
    expect(lftDaysForYear(1)).toBe(12);
    expect(lftDaysForYear(2)).toBe(14);
    expect(lftDaysForYear(3)).toBe(16);
    expect(lftDaysForYear(4)).toBe(18);
    expect(lftDaysForYear(5)).toBe(20);
  });

  it("año 6-10 = 22", () => {
    expect(lftDaysForYear(6)).toBe(22);
    expect(lftDaysForYear(10)).toBe(22);
  });

  it("año 11-15 = 24", () => {
    expect(lftDaysForYear(11)).toBe(24);
    expect(lftDaysForYear(15)).toBe(24);
  });

  it("año 16-20 = 26", () => {
    expect(lftDaysForYear(16)).toBe(26);
    expect(lftDaysForYear(20)).toBe(26);
  });

  it("año 21-25 = 28, 26-30 = 30, 31-35 = 32", () => {
    expect(lftDaysForYear(21)).toBe(28);
    expect(lftDaysForYear(25)).toBe(28);
    expect(lftDaysForYear(26)).toBe(30);
    expect(lftDaysForYear(30)).toBe(30);
    expect(lftDaysForYear(31)).toBe(32);
    expect(lftDaysForYear(35)).toBe(32);
  });

  it("año 0 (o negativo) = 0", () => {
    expect(lftDaysForYear(0)).toBe(0);
    expect(lftDaysForYear(-1)).toBe(0);
  });
});

describe("yearsOfServiceAt", () => {
  it("antes del primer aniversario = 0", () => {
    expect(yearsOfServiceAt(new Date(2025, 0, 1), new Date(2025, 5, 1))).toBe(0);
  });
  it("exactamente un año = 1", () => {
    expect(yearsOfServiceAt(new Date(2024, 4, 15), new Date(2025, 4, 15))).toBe(1);
  });
  it("un día antes del aniversario = año anterior", () => {
    expect(yearsOfServiceAt(new Date(2020, 4, 15), new Date(2026, 4, 14))).toBe(5);
  });
  it("varios años cumplidos", () => {
    expect(yearsOfServiceAt(new Date(2015, 0, 1), new Date(2026, 5, 1))).toBe(11);
  });
});

describe("currentYearOfService", () => {
  it("ingresa hoy → año 1 en curso", () => {
    const hire = new Date(2026, 4, 15);
    expect(currentYearOfService(hire, hire)).toBe(1);
  });
  it("cumplió 2 aniversarios → cursa el 3ro", () => {
    expect(currentYearOfService(new Date(2024, 4, 15), new Date(2026, 4, 15))).toBe(3);
  });
});

describe("entitlementForCurrentYear", () => {
  it("empleado con 0 años cumplidos (año 1 en curso) → 12 días", () => {
    expect(entitlementForCurrentYear(new Date(2026, 0, 1), new Date(2026, 4, 15))).toBe(12);
  });
  it("empleado con 5 años cumplidos (año 6 en curso) → 22 días", () => {
    expect(entitlementForCurrentYear(new Date(2021, 0, 1), new Date(2026, 4, 15))).toBe(22);
  });
});

describe("lastAnniversary", () => {
  it("devuelve el aniversario del año actual si ya pasó", () => {
    const a = lastAnniversary(new Date(2020, 2, 10), new Date(2026, 4, 15));
    expect(a.getFullYear()).toBe(2026);
    expect(a.getMonth()).toBe(2);
    expect(a.getDate()).toBe(10);
  });
  it("devuelve el aniversario del año previo si aún no llega", () => {
    const a = lastAnniversary(new Date(2020, 8, 1), new Date(2026, 4, 15));
    expect(a.getFullYear()).toBe(2025);
    expect(a.getMonth()).toBe(8);
  });
});
