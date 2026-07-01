## Toolbox-module — plan

### 1. Database (migratie)

Vier nieuwe tabellen in `public`:

- **`toolboxes`** — bibliotheek van onderwerpen
  - `title`, `description`, `category`, `content` (rich text/markdown), `status` (draft/published/archived), `created_by`, `current_version`
- **`toolbox_versions`** — versiebeheer per toolbox
  - `toolbox_id`, `version_number`, `content`, `change_notes`, `created_by`, `published_at`
- **`toolbox_sessions`** — geplande/gegeven sessies
  - `toolbox_id`, `version_id`, `scheduled_at`, `given_at`, `location`, `given_by` (employee), `notes`, `status` (planned/in_progress/completed), `signing_token` (random string voor QR-link)
- **`toolbox_signatures`** — handtekeningen per deelnemer
  - `session_id`, `employee_id`, `signature_data` (base64 PNG), `signed_at`, `sign_method` (kiosk/qr/login), `signed_by_user_id` (nullable, bij login-modus)

RLS:
- Toolboxes/versies: iedereen geauthenticeerd kan lezen; HSE/Manager/Admin kan bewerken.
- Sessies: iedereen kan lezen; HSE/Manager/Admin plant.
- Signatures: leesbaar door authenticated; insert via publieke server-fn met geldig `signing_token` (voor QR) of via authenticated user (kiosk/login).

### 2. AI-toolbox-generator

Server function `generateToolbox` via Lovable AI Gateway (`google/gemini-3-flash-preview`):
- Input: prompt (bv. "werken op hoogte in petrochemie") + optionele categorie
- Output: gestructureerde toolbox met titel, doel, gevaren, preventiemaatregelen, checklist, discussievragen
- Gebruiker kan resultaat bewerken vóór opslaan als nieuwe toolbox of nieuwe versie

### 3. Sessie-flow met 3 aftekenmodi

Één publieke route `/toolbox/sign/$token` + één authenticated route `/toolboxen/sessies/$id`:

- **Kiosk-modus** (op tablet): sessie-detailpagina toont deelnemers-lijst, klik op naam → signature-pad opent → opslaan → volgende. Tablet blijft ingelogd bij HSE-verantwoordelijke.
- **QR-modus**: op sessiepagina staat QR-code met `/toolbox/sign/$token`. Publieke pagina toont toolbox-inhoud, deelnemer kiest eigen naam uit lijst van uitgenodigden, tekent, klaar.
- **Login-modus**: ingelogde arbeider ziet openstaande sessies op dashboard → klikt → tekent zelf.

Elke handtekening is uniek per (session_id, employee_id) — je kunt in elke modus tekenen zolang je nog niet getekend hebt.

### 4. UI-schermen (sidebar-groep "Toolboxen")

- **`/toolboxen`** — bibliotheek: kaart-grid van toolboxen, filter op categorie/status, knoppen "Nieuwe toolbox" + "Genereer met AI"
- **`/toolboxen/$id`** — detail: huidige versie tonen, versiegeschiedenis, "Nieuwe versie", "Sessie plannen"
- **`/toolboxen/nieuw`** en **`/toolboxen/ai`** — aanmaakformulieren
- **`/toolboxen/sessies`** — lijst van sessies (gepland/gegeven), filter op datum/toolbox
- **`/toolboxen/sessies/$id`** — sessie-detail: toolbox-inhoud, deelnemerslijst met status per persoon, QR-code, "Kiosk-modus starten", PDF-export
- **`/toolbox/sign/$token`** — publieke aftekenpagina (buiten `_authenticated`)

### 5. TSA-PDF-export

Aanwezigheidslijst met dezelfde TSA-branding als MOS/STOP:
- Rode header-band + logo, titel = toolbox-onderwerp
- Meta: datum, locatie, gever, versienummer
- Toolbox-inhoud (samengevat)
- Tabel met deelnemers: naam, functie, handtekening (ingebedde PNG), tijdstip
- Footer met paginanummer + generatiedatum

### 6. Technische details

- Signature-pad: `react-signature-canvas` package (touch/mouse, PNG-export)
- QR-code: `qrcode.react` package
- AI-generatie via `createServerFn` in `src/lib/toolbox-ai.functions.ts`, gebruikt bestaande AI Gateway
- Publieke aftekenroute gebruikt server-fn zonder auth-middleware maar valideert `signing_token` en checkt of employee tot uitgenodigden hoort
- Alle mutaties (behalve publieke aftekenen) beveiligd via `requireSupabaseAuth` + rol-check
- Sidebar krijgt nieuwe sectie "Toolboxen" met sub-items Bibliotheek, Sessies

### 7. Volgorde van uitrollen

1. Migratie + RLS
2. Bibliotheek + handmatig aanmaken/versiebeheer
3. AI-generator
4. Sessies plannen + kiosk-modus + login-modus
5. Publieke QR-flow
6. TSA-PDF-export
