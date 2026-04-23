/*
 * Frontend for the Kostenstellen-Reporting UI.
 *
 * Flow:
 *   1. Credentials form (stored in localStorage) → POST /api/snapshot.
 *   2. On success: GET /api/reports and render tabs (Gesamt | cost-centres |
 *      Unassigned? | Anlagen-Zuordnung).
 *   3. Changes in the Anlagen mapping PUT /api/mapping, then re-fetch reports.
 *
 * Credentials are never sent to Bookamat directly from the browser — they
 * pass through our Hono server which does the actual HTTP call.
 */

const STORAGE_KEY = "bookamat-credentials-v1";
const state = {
  view: null, // ReportsView from /api/reports
  activeTabKey: null, // "combined" | "cc:<id>" | "unassigned" | "anlagen"
};

const euroFormatter = new Intl.NumberFormat("de-AT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value) {
  return euroFormatter.format(value);
}

function signClass(value) {
  if (value > 0.005) return "positive";
  if (value < -0.005) return "negative";
  return "";
}

// ---------------------------------------------------------------------------
// Credentials form
// ---------------------------------------------------------------------------

function loadCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCredentials(credentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

function readCredentialsFromForm() {
  const form = document.getElementById("credentials-form");
  const data = new FormData(form);
  return {
    country: String(data.get("country") ?? "").trim().toLowerCase(),
    year: parseInt(String(data.get("year") ?? ""), 10),
    username: String(data.get("username") ?? "").trim(),
    apiKey: String(data.get("apiKey") ?? ""),
  };
}

function populateForm(credentials) {
  if (credentials === null) return;
  const fields = {
    "cred-country": credentials.country,
    "cred-year": credentials.year,
    "cred-username": credentials.username,
    "cred-apikey": credentials.apiKey,
  };
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el !== null && value !== undefined && value !== null) {
      el.value = value;
    }
  }
}

function setStatus(message, variant) {
  const el = document.getElementById("credentials-status");
  el.textContent = message;
  el.className = "status" + (variant ? ` ${variant}` : "");
}

async function handleSnapshotFetch(event) {
  event.preventDefault();
  const credentials = readCredentialsFromForm();
  if (
    credentials.country.length === 0 ||
    !Number.isInteger(credentials.year) ||
    credentials.username.length === 0 ||
    credentials.apiKey.length === 0
  ) {
    setStatus("Bitte alle Felder ausfüllen.", "error");
    return;
  }

  saveCredentials(credentials);
  setSubmitting(true);
  setStatus("Snapshot wird von Bookamat geladen …");

  try {
    const response = await fetch("/api/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? `HTTP ${response.status}`);
    }
    setStatus(
      `Snapshot gespeichert: ${data.counts.bookings} Buchungen, ` +
        `${data.counts.inventories} Anlagen.`,
      "success",
    );
    await loadReports(credentials.country, credentials.year);
  } catch (err) {
    setStatus(`Fehler: ${err.message}`, "error");
  } finally {
    setSubmitting(false);
  }
}

async function handleLoadLatest() {
  const credentials = readCredentialsFromForm();
  if (
    credentials.country.length === 0 ||
    !Number.isInteger(credentials.year)
  ) {
    setStatus("Bitte Land und Jahr ausfüllen.", "error");
    return;
  }
  setStatus("Vorhandenen Snapshot wird geladen …");
  try {
    await loadReports(credentials.country, credentials.year);
    setStatus("", "");
  } catch (err) {
    setStatus(`Fehler: ${err.message}`, "error");
  }
}

function setSubmitting(submitting) {
  document
    .querySelectorAll("#credentials-form button")
    .forEach((btn) => (btn.disabled = submitting));
}

// ---------------------------------------------------------------------------
// Reports load + render
// ---------------------------------------------------------------------------

async function loadReports(country, year) {
  const response = await fetch(
    `/api/reports?country=${encodeURIComponent(country)}&year=${year}`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  state.view = data;
  if (state.activeTabKey === null) {
    state.activeTabKey = "combined";
  }
  renderSnapshotInfo();
  renderTabs();
  renderActiveTab();
  document.getElementById("report-section").classList.remove("hidden");
}

function renderSnapshotInfo() {
  const info = document.getElementById("snapshot-info");
  const { country, year, fetched_at } = state.view;
  const dt = new Date(fetched_at);
  const dtString = dt.toLocaleString("de-AT");
  info.textContent = `Snapshot ${country.toUpperCase()} ${year} · ${dtString}`;
  info.classList.remove("hidden");
}

function renderTabs() {
  const tabsEl = document.getElementById("tabs");
  tabsEl.innerHTML = "";
  const tabs = [];
  tabs.push({ key: "combined", label: "Gesamt" });
  for (const report of state.view.perCostCentre) {
    tabs.push({
      key: `cc:${report.costcentre.id}`,
      label: report.costcentre.name,
    });
  }
  if (state.view.unassigned !== null) {
    tabs.push({ key: "unassigned", label: "Ohne Kostenstelle" });
  }
  tabs.push({ key: "anlagen", label: "Anlagen-Zuordnung" });

  for (const tab of tabs) {
    const btn = document.createElement("button");
    btn.className = "tab-button";
    btn.type = "button";
    btn.textContent = tab.label;
    btn.dataset.tabKey = tab.key;
    btn.dataset.active = tab.key === state.activeTabKey ? "true" : "false";
    btn.addEventListener("click", () => {
      state.activeTabKey = tab.key;
      renderTabs();
      renderActiveTab();
    });
    tabsEl.appendChild(btn);
  }
}

function renderActiveTab() {
  const content = document.getElementById("tab-content");
  content.innerHTML = "";
  const key = state.activeTabKey;
  if (key === "combined") {
    content.appendChild(
      renderReport(state.view.combined, {
        title: "Gesamter E1a-Report",
        description:
          "Alle Buchungen und Anlagen. Diese Zahlen sollten mit dem E1a-Report aus Bookamat übereinstimmen.",
      }),
    );
    return;
  }
  if (key === "unassigned") {
    content.appendChild(renderUnassigned());
    return;
  }
  if (key === "anlagen") {
    content.appendChild(renderAnlagenMapping());
    return;
  }
  if (key.startsWith("cc:")) {
    const id = parseInt(key.slice(3), 10);
    const report = state.view.perCostCentre.find(
      (r) => r.costcentre.id === id,
    );
    if (report === undefined) {
      content.textContent = "Kostenstelle nicht gefunden.";
      return;
    }
    content.appendChild(renderCostCentreTab(report));
    return;
  }
}

function renderCostCentreTab(report) {
  const wrapper = document.createElement("div");

  const unmapped = state.view.anlagen.filter(
    (a) => a.costcentre_id === null,
  ).length;
  const total = state.view.anlagen.length;
  if (unmapped > 0) {
    const banner = document.createElement("div");
    banner.className = "banner";
    banner.innerHTML =
      `Anlagen-Zuordnung noch unvollständig: <strong>${unmapped}</strong> ` +
      `von ${total} Anlagen sind keiner Kostenstelle zugeordnet. ` +
      `Solange nur die Buchungsseite fließt in diese Kostenstelle ein.`;
    wrapper.appendChild(banner);
  }

  wrapper.appendChild(
    renderReport(report, {
      title: `E1a-Report · ${report.costcentre.name}`,
      description:
        "Isolierter Report für diese Kostenstelle. Enthält nur die dieser Kostenstelle zugeordneten Anlagen.",
    }),
  );

  return wrapper;
}

function renderUnassigned() {
  const wrapper = document.createElement("div");
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.textContent =
    "Buchungen ohne Kostenstelle in Bookamat und noch nicht zugeordnete Anlagen.";
  wrapper.appendChild(banner);
  wrapper.appendChild(
    renderReport(state.view.unassigned, {
      title: "Ohne Kostenstelle",
      description: "Catch-all-Bucket für nicht zugeordnete Einträge.",
    }),
  );
  return wrapper;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderReport(report, opts) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = opts.title;
  card.appendChild(title);

  if (opts.description) {
    const desc = document.createElement("p");
    desc.className = "card-description";
    desc.textContent = opts.description;
    card.appendChild(desc);
  }

  card.appendChild(
    renderSection(
      "Betriebseinnahmen",
      report.betriebseinnahmen,
      "Summe Betriebseinnahmen",
    ),
  );
  card.appendChild(
    renderSection(
      "Betriebsausgaben",
      report.betriebsausgaben,
      "Summe Betriebsausgaben",
    ),
  );
  card.appendChild(
    renderSection(
      "Freibeträge",
      report.freibetraege,
      "Summe Freibeträge",
    ),
  );
  card.appendChild(renderResultBlock(report));

  return card;
}

function renderSection(title, section, sumLabel) {
  const wrapper = document.createElement("section");
  wrapper.className = "report-section";

  const heading = document.createElement("h3");
  heading.textContent = title;
  heading.style.marginBottom = "0.5rem";
  wrapper.appendChild(heading);

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:4rem">KZ</th>
        <th>Bezeichnung</th>
        <th class="counts">Buchungen</th>
        <th class="counts">Anlagen</th>
        <th class="num">BA Betrag</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  for (const row of section.rows) {
    const tr = document.createElement("tr");
    const isZero = row.amount === 0 && row.bookings_count === 0 && row.inventory_count === 0;
    if (isZero) tr.className = "quiet";
    tr.innerHTML = `
      <td class="kennzahl">${row.kennzahl}</td>
      <td>${escapeHtml(row.label)}</td>
      <td class="counts">${row.bookings_count}</td>
      <td class="counts">${row.inventory_count}</td>
      <td class="num">${formatAmount(row.amount)}</td>
    `;
    tbody.appendChild(tr);
  }

  const sumTr = document.createElement("tr");
  sumTr.className = "sum-row";
  sumTr.innerHTML = `
    <td></td>
    <td>${sumLabel}</td>
    <td></td>
    <td></td>
    <td class="num">${formatAmount(section.sum)}</td>
  `;
  tbody.appendChild(sumTr);
  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

function renderResultBlock(report) {
  const wrapper = document.createElement("section");
  wrapper.className = "report-section";

  const heading = document.createElement("h3");
  heading.textContent = "Ergebnis";
  heading.style.marginBottom = "0.5rem";
  wrapper.appendChild(heading);

  const rows = [
    { label: "Betriebseinnahmen", value: report.betriebseinnahmen.sum },
    { label: "Betriebsausgaben", value: -report.betriebsausgaben.sum },
    {
      label:
        report.gewinn_verlust >= 0
          ? "Gewinn vor Freibeträgen"
          : "Verlust vor Freibeträgen",
      value: report.gewinn_verlust,
    },
    { label: "Freibeträge", value: -report.freibetraege.sum },
  ];
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "result-row";
    div.innerHTML = `
      <span>${escapeHtml(row.label)}</span>
      <span class="amount ${signClass(row.value)}">${formatAmount(row.value)}</span>
    `;
    wrapper.appendChild(div);
  }
  const total = document.createElement("div");
  total.className = "result-row total";
  total.innerHTML = `
    <span>Steuerlicher ${report.betriebsergebnis >= 0 ? "Gewinn" : "Verlust"}</span>
    <span class="amount ${signClass(report.betriebsergebnis)}">${formatAmount(report.betriebsergebnis)}</span>
  `;
  wrapper.appendChild(total);

  return wrapper;
}

// ---------------------------------------------------------------------------
// Anlagen mapping UI
// ---------------------------------------------------------------------------

function renderAnlagenMapping() {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Anlagen-Zuordnung";
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "card-description";
  desc.textContent =
    "Bookamat speichert keine Kostenstelle auf Anlagen. Ordne hier jede Anlage einer Kostenstelle zu. Änderungen werden automatisch gespeichert.";
  card.appendChild(desc);

  const { anlagen, costCentres } = state.view;

  const infoBanner = document.createElement("div");
  infoBanner.className = "info-banner";
  const unmapped = anlagen.filter((a) => a.costcentre_id === null).length;
  infoBanner.innerHTML = `
    <span><strong>${anlagen.length}</strong> Anlagen insgesamt</span>
    <span><strong>${anlagen.length - unmapped}</strong> zugeordnet</span>
    <span><strong>${unmapped}</strong> offen</span>
  `;
  card.appendChild(infoBanner);

  const table = document.createElement("table");
  table.className = "anlagen-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Anlage</th>
        <th>Konto</th>
        <th>Angeschafft</th>
        <th class="num">Anschaffung netto</th>
        <th class="num">AfA ${state.view.year}</th>
        <th style="width: 16rem">Kostenstelle</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");

  for (const anlage of anlagen) {
    const tr = document.createElement("tr");
    const disposed =
      anlage.date_disposal !== null
        ? ` (abgegangen ${anlage.date_disposal})`
        : "";
    tr.innerHTML = `
      <td class="title">${escapeHtml(anlage.title)}${escapeHtml(disposed)}</td>
      <td class="muted">${escapeHtml(anlage.costaccount_name)}</td>
      <td class="muted">${escapeHtml(anlage.date_purchase)}</td>
      <td class="num muted">${formatAmount(parseFloat(anlage.amount_after_tax))}</td>
      <td class="num muted">${formatAmount(parseFloat(anlage.depreciation_this_year))}</td>
    `;
    const selectCell = document.createElement("td");
    const select = document.createElement("select");
    const unassignedOption = document.createElement("option");
    unassignedOption.value = "";
    unassignedOption.textContent = "— Nicht zugeordnet —";
    select.appendChild(unassignedOption);
    for (const centre of costCentres) {
      const opt = document.createElement("option");
      opt.value = String(centre.id);
      opt.textContent = centre.name;
      select.appendChild(opt);
    }
    select.value =
      anlage.costcentre_id === null ? "" : String(anlage.costcentre_id);
    select.addEventListener("change", async () => {
      const raw = select.value;
      const newCostCentreId = raw === "" ? null : parseInt(raw, 10);
      anlage.costcentre_id = newCostCentreId;
      await persistMapping();
    });
    selectCell.appendChild(select);
    tr.appendChild(selectCell);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  card.appendChild(table);

  return card;
}

async function persistMapping() {
  const mapping = {};
  for (const anlage of state.view.anlagen) {
    if (anlage.costcentre_id !== null) {
      mapping[String(anlage.id)] = anlage.costcentre_id;
    }
  }
  const response = await fetch("/api/mapping", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      country: state.view.country,
      year: state.view.year,
      mapping,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    alert(`Fehler beim Speichern: ${data.error ?? response.status}`);
    return;
  }
  // Refresh reports so per-cost-centre tabs pick up the new Anlagen split.
  await loadReports(state.view.country, state.view.year);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  populateForm(loadCredentials());
  document
    .getElementById("credentials-form")
    .addEventListener("submit", handleSnapshotFetch);
  document
    .getElementById("load-latest-btn")
    .addEventListener("click", handleLoadLatest);

  // Default year to current year if empty.
  const yearInput = document.getElementById("cred-year");
  if (yearInput.value === "") {
    yearInput.value = String(new Date().getFullYear());
  }
});
