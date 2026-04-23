# Bookamat Kostenstellen-Reporting

Ein kleines Werkzeug, das aus deinen **Bookamat**-Daten eine **E1a-Auswertung pro Kostenstelle** erzeugt — also genau das, was du als Einzelunternehmer:in mit mehreren Betrieben brauchst, und was Bookamat von Haus aus nicht anbietet.

---

## Für wen ist das?

Du führst in Österreich **mehrere Betriebe als eine Person** (z. B. eine Landwirtschaft und einen Gewerbebetrieb) und machst deine Buchhaltung in **Bookamat**.

Das Finanzamt verlangt in diesem Fall für **jeden Betrieb eine eigene E1a** (Einnahmen-Ausgaben-Rechnung als Anlage zur Einkommensteuererklärung). Bookamat kann die E1a zwar erzeugen — aber nur eine Gesamt-E1a über alle Betriebe hinweg. Eine Aufteilung nach **Kostenstelle** fehlt.

Genau das macht dieses Tool: Es holt deine Daten aus Bookamat, rechnet die E1a sauber **pro Kostenstelle** und zeigt sie dir als übersichtliche Webseite auf deinem eigenen Computer an.

---

## Was das Tool tut (und was nicht)

**Was es tut:**

- Lädt alle relevanten Daten (Buchungen, Anlagen, Kostenkonten, Kostenstellen) über die offizielle Bookamat-API.
- Rechnet für jede Kostenstelle eine eigene E1a (Betriebseinnahmen, Betriebsausgaben, AfA, Gewinn/Verlust).
- Zeigt dir die Reports in einer Webseite auf `http://localhost:3000` — nur für dich, lokal auf deinem Rechner.
- Erlaubt dir, Anlagen (die in Bookamat keine Kostenstelle haben) den Kostenstellen zuzuordnen.

**Was es nicht tut:**

- Es schreibt **nichts** zurück nach Bookamat. Der Zugriff ist ausschließlich lesend.
- Es schickt deine Daten **nirgendwohin**. Alles läuft lokal auf deinem Rechner.
- Es ersetzt weder Bookamat noch eine Steuerberatung — es rechnet nur eine bestehende E1a pro Betrieb auf.

---

## Voraussetzungen

Du brauchst zwei Dinge:

1. **Einen Bookamat-Account** mit bereits eingerichteten Kostenstellen und einem **API-Key** (in Bookamat unter Konto-Einstellungen → API zu erstellen).
2. **Bun** — das Programm, das dieses Tool ausführt (Ersatz für Node.js, deutlich einfacher zu installieren).

Die Installation von Bun beschreibe ich unten Schritt für Schritt — für Windows und macOS getrennt.

---

## Installation

### Schritt 1: Den Code als ZIP herunterladen

1. Öffne die Projektseite auf GitHub im Browser.
2. Klicke oben rechts auf den grünen Button **„Code"** → **„Download ZIP"**.
3. Entpacke die heruntergeladene ZIP-Datei an einen Ort deiner Wahl — zum Beispiel in deinen Dokumente-Ordner.
4. Der entpackte Ordner heißt üblicherweise `bookamat-kostenstellen-reporting-main`. Du kannst ihn auch umbenennen, z. B. in `bookamat-reporting` — das ist egal.

Merke dir, **wo** du den Ordner abgelegt hast — du brauchst den Pfad gleich.

### Schritt 2: Bun installieren

Bun ist die Laufzeit, in der unser Tool läuft.

**Windows** (PowerShell öffnen: Windows-Taste → „PowerShell" eingeben → Enter):

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS** (Terminal öffnen: Cmd + Leertaste → „Terminal"):

```sh
curl -fsSL https://bun.sh/install | bash
```

Nach der Installation einmal das Terminal/PowerShell schließen und neu öffnen, damit Bun gefunden wird. Mit `bun --version` kannst du prüfen, ob alles geklappt hat.

### Schritt 3: In den Projektordner wechseln

Öffne Terminal (macOS) bzw. PowerShell (Windows) und wechsle in den entpackten Ordner aus Schritt 1. Zum Beispiel, wenn du ihn in „Dokumente" abgelegt hast:

**Windows (PowerShell):**

```powershell
cd $HOME\Documents\bookamat-kostenstellen-reporting-main
```

**macOS (Terminal):**

```sh
cd ~/Documents/bookamat-kostenstellen-reporting-main
```

Tipp: Du kannst im Datei-Explorer (Windows) bzw. Finder (macOS) auch den Ordner direkt per Rechtsklick im Terminal öffnen — dann musst du den Pfad nicht tippen.

### Schritt 4: Abhängigkeiten installieren

```sh
bun install
```

Das lädt einmalig alle benötigten Hilfsbibliotheken herunter.

---

## Benutzung

### App starten

```sh
bun run dev
```

Dann im Browser öffnen: [http://localhost:3000](http://localhost:3000)

### Im Browser

1. Oben auf der Seite erscheint eine Maske für **Land** (`at`), **Jahr**, **Benutzername** und **API-Key**. Den API-Key bekommst du in Bookamat unter **Konto-Einstellungen → API**.
2. Klick auf **„Snapshot abrufen"** — das holt alle Buchungen und Anlagen des gewählten Jahres aus Bookamat und legt sie lokal im Ordner `snapshots/` ab (z. B. `snapshots/at-2025.json`). Je nach Datenmenge dauert das ein paar Sekunden bis wenige Minuten.
3. Danach siehst du eine E1a **pro Kostenstelle**. Anlagen sind zu Beginn „nicht zugeordnet" (weil Bookamat Anlagen keinen Kostenstellen zuweist). Per Dropdown kannst du jede Anlage einer Kostenstelle zuordnen — die Zuordnung wird lokal gespeichert.
4. Beim nächsten Start reicht **„Vorhandenen Snapshot laden"**, solange sich in Bookamat nichts geändert hat. Gab es Änderungen → wieder „Snapshot abrufen".

### App beenden

`Strg + C` (Windows) bzw. `Cmd + C` (macOS) in der Konsole, in der `bun run dev` läuft.

---

## Wie die Berechnung funktioniert (Kurzfassung)

Für wen es genauer wissen will:

- **Betriebseinnahmen und -ausgaben** werden aus den Buchungen gezogen. Jede Buchung hat ein Kostenkonto, und jedes Kostenkonto ist im Bookamat-Kontenplan einer oder mehreren **E1a-Kennzahlen** zugeordnet. Pro Buchung wird der Betrag auf alle zugeordneten Kennzahlen summiert.
- **Abschreibungen (AfA)** kommen aus dem Anlagenverzeichnis. Pro Anlage wird genau der Abschreibungsbetrag des Berichtsjahrs in **eine einzige** Kennzahl eingerechnet — je nach Zustand der Anlage: 9130 (lineare AfA/GWG), 9134 (degressive AfA) oder 9210 (Restbuchwert bei Abgang).
- **Gewinn/Verlust** = Summe Einnahmen − Summe Ausgaben.
- **Betriebsergebnis** = Gewinn/Verlust − Freibeträge (Freibeträge sind immer 0, weil sie in Bookamat nicht gepflegt werden).

Alle Beträge werden intern in Cent gerechnet, um Rundungsfehler zu vermeiden.

---

## Datenschutz

- Alles läuft **lokal auf deinem Rechner**. Deine Buchhaltungsdaten verlassen diesen Rechner nicht.
- Der einzige Internet-Verkehr geht direkt zur Bookamat-API, um die Daten abzuholen.
- Der Web-Server unter `http://localhost:3000` ist **nur von deinem Computer aus erreichbar**, nicht aus dem Internet.
- Die Snapshot-Dateien in `snapshots/` und deine `.env` enthalten sensible Daten — teile diese Dateien nicht und checke sie nicht in öffentliche Git-Repositories ein (beides ist in `.gitignore` bereits ausgeschlossen).

---

## Optional: Zugangsdaten vorausfüllen (nur für Profis)

Wenn du die Felder **Land**, **Jahr**, **Benutzername** und **API-Key** nicht bei jedem Start neu eintippen willst, kannst du sie einmalig in einer Datei namens `.env` hinterlegen. Das ist **nicht nötig** — die App funktioniert vollständig ohne `.env`, du gibst die Daten einfach im Browser ein.

Falls du es trotzdem willst:

1. Kopiere die Datei `.env.example` im Projektordner und benenne die Kopie in `.env` um.
2. Öffne `.env` in einem Texteditor und trage deine Werte ein:
   ```
   BOOKAMAT_USERNAME=deine-email@example.com
   BOOKAMAT_API_KEY=dein-api-key-aus-bookamat
   BOOKAMAT_COUNTRY=at
   BOOKAMAT_YEAR=2025
   ```
3. Speichern.

Die `.env` wird aktuell **nur** vom Kommandozeilen-Befehl `bun run snapshot` verwendet (eine Alternative zum „Snapshot abrufen"-Button im Browser). Die Web-App selbst liest `.env` nicht — dort gibst du die Daten immer im Formular ein.

⚠️ Die `.env` enthält deinen API-Key im Klartext. Teile diese Datei nicht und lade sie nirgendwo hoch.

---

## Hilfe & Probleme

- **„bun: command not found"** — Terminal/PowerShell einmal schließen und neu öffnen.
- **„401 Unauthorized" beim Snapshot** — Benutzername und API-Key im Formular prüfen (groß-/kleinschreibung, keine Leerzeichen am Ende).
- **Zahlen passen nicht zur Bookamat-E1a** — im Browser einen frischen Snapshot abrufen und die Seite neu laden.
- **Port 3000 bereits belegt** — andere Anwendung schließen, die den Port nutzt.

Für alles Weitere: Issue im Repository aufmachen.
