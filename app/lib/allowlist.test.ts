import { describe, expect, it } from "vitest";
import { isAllowedLogin, parseAllowlist } from "./allowlist";

describe("allowlist", () => {
  it("parst kommagetrennte Logins case-insensitiv", () => {
    const list = parseAllowlist(" Alice, bob ,,");
    expect([...list]).toEqual(["alice", "bob"]);
    expect(isAllowedLogin("ALICE", list)).toBe(true);
    expect(isAllowedLogin("carol", list)).toBe(false);
  });

  it("lässt bei leerer Allowlist niemanden rein", () => {
    const list = parseAllowlist(undefined);
    expect(isAllowedLogin("alice", list)).toBe(false);
    expect(isAllowedLogin("", parseAllowlist(","))).toBe(false);
    expect(isAllowedLogin(undefined, parseAllowlist("alice"))).toBe(false);
  });
});
