import { sql } from "drizzle-orm";
import { boolean, date, index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { STATUSES } from "~/domain/status";

export const statusEnum = pgEnum("application_status", STATUSES);

const timestamps = {
  erstellt: timestamp("erstellt", { withTimezone: true }).notNull().defaultNow(),
  aktualisiert: timestamp("aktualisiert", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Bewerbungen – Feldnamen bewusst wie im alten Tracker (deutsch, camelCase). */
export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    firma: text("firma").notNull(),
    stelle: text("stelle").notNull().default(""),
    link: text("link"),
    ort: text("ort"),
    status: statusEnum("status").notNull().default("Interessant"),
    vorherStatus: statusEnum("vorher_status"),
    grund: text("grund"),
    beworbenAm: date("beworben_am", { mode: "string" }),
    faelligAm: date("faellig_am", { mode: "string" }),
    naechster: text("naechster"),
    cv: text("cv"),
    gehalt: text("gehalt"),
    kontakt: text("kontakt"),
    quelle: text("quelle"),
    remoteRegel: text("remote_regel"),
    einschaetzung: text("einschaetzung"),
    notizen: text("notizen"),
    ...timestamps,
  },
  (t) => [
    index("applications_status_idx").on(t.status),
    // Duplikat-Erkennung für Vorschläge: gleiche Firma + Stelle (case-insensitiv)
    index("applications_firma_stelle_idx").on(sql`lower(${t.firma})`, sql`lower(${t.stelle})`),
  ],
);

export type ApplicationRow = typeof applications.$inferSelect;
export type NewApplicationRow = typeof applications.$inferInsert;

/**
 * Persönliche API-Tokens für den MCP-Server (Übergangslösung bis OAuth).
 * Gespeichert wird nur der SHA-256-Hash; der Klartext wird einmalig angezeigt.
 */
export const apiTokens = pgTable("api_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  erstellt: timestamp("erstellt", { withTimezone: true }).notNull().defaultNow(),
  zuletztGenutzt: timestamp("zuletzt_genutzt", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// better-auth (Tabellen-/Feldnamen wie von better-auth erwartet)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  githubLogin: text("github_login"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
