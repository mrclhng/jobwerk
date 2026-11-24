# Projekt-Brief: Jobwerk

**Jobwerk** – das Werkzeug für die Jobsuche: Bewerbungs-Board mit GitHub-Login und eigenem MCP-Server.
Repo: https://github.com/mrclhng/jobwerk

Ein persönliches Bewerbungs-Board (Kanban) als Full-Stack-Web-App mit GitHub-Login und eigenem
MCP-Server, über den Claude Vorschläge eintragen und Bewerbungen aktualisieren kann.
Zugleich Portfolio-Projekt: Es soll zeigen, dass ich modernes TypeScript/React, saubere Architektur,
Tests, CI/CD und KI-Integration (MCP) beherrsche.

## Hintergrund
- Bisher gibt es den Tracker als claude.ai-Artifact mit eingebauter Datenbank
  (https://claude.ai/artifact/KUw1i2neiNhapXCvNb9kwc). Er hat sich bewährt; die neue App ersetzt ihn.
- Eine tägliche Claude-Routine sucht passende Stellen und legt sie als Status "Vorschlag" an.
  Diese Routine soll später den MCP-Server dieser App nutzen.
- Ich (Marcel) komme aus Java/Spring Boot + Angular und will gezielt TypeScript/React-Erfahrung zeigen.

## Ziele
1. Kanban-Board im Browser, nur für mich (Login mit GitHub, Allowlist auf meinen GitHub-Account).
2. MCP-Server (Remote, Streamable HTTP), den ich in claude.ai als eigenen Connector verbinde.
3. Saubere, öffentlich vorzeigbare Codebasis: README mit Architektur-Skizze, Tests, CI, Deploy.

## Vorschlag Tech-Stack (bewusst nah an Stellen, auf die ich mich bewerbe)
- TypeScript durchgehend, Node 22
- Web: React Router 7 (Framework-Modus) oder Next.js (App Router) – Entscheidung in der ersten Session
- UI: React + Tailwind, Drag & Drop mit dnd-kit (auch mit Tastatur/Touch)
- DB: PostgreSQL (Neon serverless) + Drizzle ORM, Migrationen mit drizzle-kit
- Auth: GitHub OAuth (Auth.js oder better-auth), Zugriff nur für eine Allowlist von GitHub-Logins
- MCP: offizielles TypeScript-SDK (`@modelcontextprotocol/sdk`), Streamable HTTP, abgesichert per OAuth
  (GitHub als Identity Provider) – als Zwischenschritt notfalls ein persönliches API-Token
- Tests: Vitest (Unit), Playwright (E2E für Board-Flows)
- CI/CD: GitHub Actions (Lint, Typecheck, Tests), Deploy auf Vercel
- Hosting-Kosten: im kostenlosen Rahmen von Vercel/Neon

## Datenmodell (aus dem bestehenden Tracker übernommen)
Tabelle `applications`:
| Feld | Typ | Bedeutung |
|---|---|---|
| id | text (slug) | z. B. `virtual7-senior-java-gkv` |
| firma, stelle, link, ort | text | Basisdaten der Stelle |
| status | enum | `Vorschlag`, `Interessant`, `Beworben`, `Interview`, `Angebot`, Archiv: `Absage`, `Verworfen`, `Zurückgezogen`, `Stelle geschlossen` |
| vorherStatus | text | Status vor dem Archivieren (für "Zurückholen") |
| grund | text | Ablehnungsgrund bei "Verworfen" (Präferenz-Signal für die Suche) |
| beworbenAm, faelligAm | date | Bewerbungsdatum, Nachfass-Termin |
| naechster | text | nächster Schritt |
| cv | text | verwendete Lebenslauf-Version |
| gehalt | text | genannte Gehaltsvorstellung / Spanne |
| kontakt | text | Ansprechpartner |
| quelle | text | z. B. Indeed, JobGPT |
| remoteRegel | text | Zitat der Remote-Regel aus der Anzeige |
| einschaetzung | text | kurze Passungs-Einschätzung von Claude |
| notizen | text | freie Notizen |
| erstellt, aktualisiert | timestamptz | |

Optional später: Tabelle `events` (Status-Historie) für eine Timeline pro Bewerbung.

## Features Board (MVP)
- Spalten: Vorschlag → Interessant → Beworben → Interview → Angebot; horizontal scrollbar (nicht umbrechen)
- Karten per Drag & Drop und per Pfeil-Buttons verschieben
- Beim Wechsel nach "Beworben": Datum = heute, Nachfassen in 14 Tagen (falls leer)
- "Passt nicht" auf Vorschlägen mit optionalem Grund → Archiv (Verworfen)
- "Absage" auf allen anderen Karten → Archiv; "Zurückholen" aus dem Archiv
- Rückgängig-Toast nach jeder Statusänderung
- Karte bearbeiten / neue Karte anlegen
- "Nachfassen fällig" hervorheben (Termin erreicht oder > 14 Tage beworben ohne Termin)
- Light/Dark Mode, mobil nutzbar

## MCP-Tools (erste Version)
- `list_applications(status?)` – Liste, optional gefiltert
- `get_application(id)`
- `add_suggestion({firma, stelle, link, ort, quelle, remoteRegel, einschaetzung, gehalt?})` – legt Status "Vorschlag" an, verhindert Duplikate (gleicher Link oder gleiche Firma+Stelle)
- `update_application(id, patch)` – Felder ändern
- `move_application(id, status, grund?)` – Status wechseln mit denselben Regeln wie im Board
- `list_rejection_reasons()` – Gründe verworfener Vorschläge (für bessere Vorschläge)

## Datenübernahme
`seed-bewerbungen.json` enthält den aktuellen Stand (15 Einträge) aus dem alten Tracker.
Ein Seed-Skript importiert die Datei einmalig. **Achtung:** Die Datei enthält Namen, E-Mails und
Telefonnummern von Ansprechpartnern → NICHT ins öffentliche Repo committen (in `.gitignore`),
sondern lokal bzw. per sicherem Weg importieren.

## Vorgehen (Vorschlag für die erste Session)
1. Stack final festlegen (React Router 7 vs. Next.js), Projekt aufsetzen, CI (Lint/Typecheck/Test)
2. DB-Schema + Migration + Seed
3. GitHub-Login mit Allowlist
4. Board mit Drag & Drop
5. MCP-Server mit den Tools oben, lokal testen (MCP Inspector), dann als claude.ai-Connector verbinden
6. Deploy auf Vercel, README mit Screenshots und Architektur-Diagramm

## Offene Entscheidungen
- Framework: React Router 7 (passt zu steueragenten) oder Next.js (verbreiteter)
- MCP-Auth: direkt OAuth über GitHub oder zuerst API-Token
- Repo öffentlich (Portfolio) – dann Seed-Daten strikt außen vor lassen
