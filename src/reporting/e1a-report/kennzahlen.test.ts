/*
 * Structural tests for the static KENNZAHLEN table.
 *
 * These are cheap invariants the table must hold for the report code to keep
 * working — unique codes, no empty labels, and the sections the report code
 * iterates over actually exist in the table.
 */

import { describe, it, expect } from "bun:test";
import { KENNZAHLEN, type KennzahlSection } from "./kennzahlen.ts";

function setup() {
  const byCode = new Map(KENNZAHLEN.map((kz) => [kz.code, kz]));
  const bySection = new Map<KennzahlSection, string[]>();
  for (const kz of KENNZAHLEN) {
    const list = bySection.get(kz.section) ?? [];
    list.push(kz.code);
    bySection.set(kz.section, list);
  }
  return { given: { KENNZAHLEN }, then: { byCode, bySection } };
}

describe("KENNZAHLEN", () => {
  it("has unique kennzahl codes", () => {
    const { given, then } = setup();
    expect(then.byCode.size).toBe(given.KENNZAHLEN.length);
  });

  it("has a non-empty label for every entry", () => {
    const { given } = setup();
    for (const kz of given.KENNZAHLEN) {
      expect(kz.label.length).toBeGreaterThan(0);
    }
  });

  it("has betriebseinnahmen, betriebsausgaben and freibetraege sections", () => {
    const { then } = setup();
    expect(then.bySection.get("betriebseinnahmen")?.length ?? 0).toBeGreaterThan(0);
    expect(then.bySection.get("betriebsausgaben")?.length ?? 0).toBeGreaterThan(0);
    expect(then.bySection.get("freibetraege")?.length ?? 0).toBeGreaterThan(0);
  });

  it("contains the codes the report builder picks for Anlagen (9130, 9134, 9210)", () => {
    const { then } = setup();
    expect(then.byCode.has("9130")).toBe(true);
    expect(then.byCode.has("9134")).toBe(true);
    expect(then.byCode.has("9210")).toBe(true);
  });
});
