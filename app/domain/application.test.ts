import { describe, expect, it } from "vitest";
import {
  applicationFieldsSchema,
  applicationPatchSchema,
  normalizeLink,
  slugify,
  suggestionSchema,
} from "./application";

describe("slugify", () => {
  it("baut sprechende IDs mit transkribierten Umlauten", () => {
    expect(slugify("Grüße & Söhne Straßenbau", "Softwareentwickler (m/w/d)")).toBe(
      "gruesse-soehne-strassenbau-softwareentwickler-m-w-d",
    );
  });
  it("liefert einen Fallback für leere Eingaben", () => {
    expect(slugify("  ", "!!")).toBe("bewerbung");
  });
  it("begrenzt die Länge ohne Bindestrich am Ende", () => {
    const slug = slugify("a".repeat(79), "b");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("normalizeLink", () => {
  it("ignoriert Tracking-Parameter, www, Groß-/Kleinschreibung und Slash am Ende", () => {
    expect(normalizeLink("https://www.Example.com/jobs/123/?utm_source=x#top")).toBe("example.com/jobs/123");
    expect(normalizeLink("http://example.com/jobs/123")).toBe("example.com/jobs/123");
  });
  it("gibt null für leere Links zurück", () => {
    expect(normalizeLink("")).toBeNull();
    expect(normalizeLink(null)).toBeNull();
  });
});

describe("applicationFieldsSchema", () => {
  it("wandelt leere Strings in null und setzt Defaults", () => {
    const parsed = applicationFieldsSchema.parse({ firma: " ACME ", ort: "", beworbenAm: "" });
    expect(parsed).toMatchObject({
      firma: "ACME",
      stelle: "",
      ort: null,
      beworbenAm: null,
      status: "Interessant",
    });
  });
  it("lehnt ungültige Daten und Links ab", () => {
    expect(applicationFieldsSchema.safeParse({ firma: "x", beworbenAm: "2026-02-30" }).success).toBe(false);
    expect(applicationFieldsSchema.safeParse({ firma: "x", link: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(applicationFieldsSchema.safeParse({ firma: "" }).success).toBe(false);
  });
});

describe("applicationPatchSchema", () => {
  it("erlaubt Teil-Updates, aber keinen Statuswechsel und keine unbekannten Felder", () => {
    expect(applicationPatchSchema.parse({ notizen: "Hallo" })).toEqual({ notizen: "Hallo" });
    expect(applicationPatchSchema.safeParse({ status: "Angebot" }).success).toBe(false);
    expect(applicationPatchSchema.safeParse({ foo: 1 }).success).toBe(false);
  });
});

describe("suggestionSchema", () => {
  it("verlangt Firma und Stelle", () => {
    expect(suggestionSchema.safeParse({ firma: "ACME" }).success).toBe(false);
    expect(suggestionSchema.parse({ firma: "ACME", stelle: "Dev", quelle: "Indeed" })).toMatchObject({
      quelle: "Indeed",
      link: null,
    });
  });
});
