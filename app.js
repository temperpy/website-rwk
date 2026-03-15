"use strict";

// ── State ─────────────────────────────────────────────────────────────────────
let data = {};          // folder_structure.json
let activeItem = null;  // aktuell ausgewähltes .team-item

// ── DOM-Referenzen ────────────────────────────────────────────────────────────
const sidebarEl  = document.getElementById("sidebar");
const overlayEl  = document.getElementById("overlay");
const toggleBtn  = document.getElementById("sidebar-toggle");
const searchEl   = document.getElementById("search");
const contentEl  = document.getElementById("content");
const lightboxEl = document.getElementById("lightbox");
const lightImgEl = document.getElementById("lightbox-img");

// ── Sidebar Toggle (Mobile) ───────────────────────────────────────────────────
toggleBtn.addEventListener("click", () => {
  const open = sidebarEl.classList.toggle("open");
  overlayEl.classList.toggle("open", open);
});

overlayEl.addEventListener("click", closeSidebar);

document.getElementById("topbar-title").addEventListener("click", () => {
  // Aktive Markierung entfernen
  if (activeItem) { activeItem.classList.remove("active"); activeItem = null; }
  // Alle Saisonen einklappen
  document.querySelectorAll(".season-node").forEach(n => n.open = false);
  // Suche leeren
  searchEl.value = "";
  filterTree("");
  // Willkommensansicht
  history.replaceState(null, "", window.location.pathname);
  contentEl.innerHTML = `
    <div id="welcome">
      <div id="welcome-icon">&#127919;</div>
      <h2>Willkommen</h2>
      <p>Wähle links eine Mannschaft aus, um die Ergebnisdiagramme anzuzeigen.</p>
    </div>`;
});

function closeSidebar() {
  sidebarEl.classList.remove("open");
  overlayEl.classList.remove("open");
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(src, alt) {
  lightImgEl.src  = src;
  lightImgEl.alt  = alt;
  lightboxEl.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightboxEl.classList.remove("open");
  lightImgEl.src = "";
  document.body.style.overflow = "";
}

document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
lightboxEl.addEventListener("click", (e) => { if (e.target === lightboxEl) closeLightbox(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** "RWK_2024-2025" → "2024/25" */
function formatSeason(s) {
  const m = s.match(/(\d{4})-(\d{4})/);
  return m ? `${m[1]}/${m[2].slice(2)}` : s.replace(/_/g, " ");
}

/** Ordnernamen lesbarer machen: Unterstriche → Leerzeichen */
function readable(s) { return s.replace(/_/g, " "); }

/**
 * Extrahiert den Schützennamen aus einem Dateinamen.
 * "Tell_Hollenbach_1_Müller_Hans.svg" + team="Tell_Hollenbach_1" → "Müller Hans"
 */
function extractShooterName(teamFolder, filename) {
  const prefix = teamFolder + "_";
  if (filename.startsWith(prefix)) {
    return filename.slice(prefix.length, -4).replace(/_/g, " ");
  }
  return filename.replace(/\.svg$/i, "").replace(/_/g, " ");
}

/**
 * Sortierrang für Klassen (niedriger = weiter oben).
 * Reihenfolge: Gauoberliga A → Gauoberliga B → Gauliga → A-F Klasse
 */
function classRank(name) {
  const n = name.replace(/_/g, " ").toLowerCase();
  const num = (s) => { const m = s.match(/(\d+)/g); return m ? parseInt(m[m.length - 1]) : 0; };

  if (n.startsWith("gauoberliga a")) return [0, 0, num(n)];
  if (n.startsWith("gauoberliga b")) return [0, 1, num(n)];
  if (n.startsWith("gauoberliga"))   return [0, 2, num(n)];
  if (n.startsWith("gauliga"))       return [1, 0, num(n)];

  const letter = n.match(/^([a-f])[\s_]klasse/);
  if (letter) return [2, letter[1].charCodeAt(0) - 97, num(n)];

  return [99, 0, num(n)]; // Unbekannte Klassen ans Ende
}

function sortClasses(classNames) {
  return [...classNames].sort((a, b) => {
    const ra = classRank(a), rb = classRank(b);
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return ra[i] - rb[i];
    }
    return 0;
  });
}

// ── Navigationsbaum aufbauen ──────────────────────────────────────────────────
function buildTree(structure) {
  const treeEl = document.getElementById("nav-tree");
  treeEl.innerHTML = "";

  for (const season of Object.keys(structure).sort().reverse()) {
    const classes = structure[season];
    const seasonNode = document.createElement("details");
    seasonNode.className = "season-node";
    seasonNode.dataset.season = season;

    const seasonSum = document.createElement("summary");
    seasonSum.textContent = formatSeason(season);
    seasonNode.appendChild(seasonSum);

    for (const cls of sortClasses(Object.keys(classes))) {
      const teams = classes[cls];
      const classNode = document.createElement("details");
      classNode.className = "class-node";
      classNode.dataset.class = cls;

      const classSum = document.createElement("summary");
      classSum.textContent = readable(cls);
      classNode.appendChild(classSum);

      const ul = document.createElement("ul");
      ul.className = "team-list";

      for (const team of Object.keys(teams).sort()) {
        const li = document.createElement("li");
        li.className = "team-item";
        li.dataset.season = season;
        li.dataset.class  = cls;
        li.dataset.team   = team;

        const nameSpan = document.createElement("span");
        nameSpan.className = "team-name";
        nameSpan.textContent = readable(team);
        li.appendChild(nameSpan);

        const hintSpan = document.createElement("span");
        hintSpan.className = "shooter-hint";
        li.appendChild(hintSpan);

        li.addEventListener("click", () => {
          selectTeam(season, cls, team, li);
          closeSidebar();
        });
        ul.appendChild(li);
      }

      classNode.appendChild(ul);
      seasonNode.appendChild(classNode);
    }

    treeEl.appendChild(seasonNode);
  }
}

// ── Team auswählen & Diagramme anzeigen ──────────────────────────────────────
function selectTeam(season, cls, team, itemEl) {
  // Aktive Markierung
  if (activeItem) activeItem.classList.remove("active");
  activeItem = itemEl;
  itemEl.classList.add("active");

  // URL-Hash aktualisieren (ermöglicht Teilen des Links)
  window.location.hash = encodeURIComponent(`${season}/${cls}/${team}`);

  const files    = data[season][cls][team];
  const basePath = `Diagramme/${season}/${cls}/${team}/`;

  const teamFile    = files.find(f => f.toLowerCase().includes("_team.svg")) || null;
  const shooterFiles = files
    .filter(f => !f.toLowerCase().includes("_team.svg"))
    .sort();

  let html = `
    <nav class="breadcrumb">
      <span>${formatSeason(season)}</span>
      <span class="sep">›</span>
      <span>${readable(cls)}</span>
      <span class="sep">›</span>
      <span>${readable(team)}</span>
    </nav>
    <h2 class="team-heading">${readable(team)}</h2>
  `;

  if (teamFile) {
    html += `
      <div class="team-chart-wrap">
        <img src="${basePath}${teamFile}" alt="${readable(team)} – Teamdiagramm" loading="lazy">
      </div>
    `;
  }

  if (shooterFiles.length > 0) {
    html += `<h3 class="section-heading">Schützen (${shooterFiles.length})</h3>`;
    html += `<div class="shooter-grid">`;
    for (const f of shooterFiles) {
      const shooterName = extractShooterName(team, f);
      html += `
        <div class="shooter-card">
          <div class="shooter-card-name">${shooterName}</div>
          <img src="${basePath}${f}" alt="${shooterName}" loading="lazy">
        </div>`;
    }
    html += `</div>`;
  }

  contentEl.innerHTML = html;
  contentEl.scrollTo({ top: 0, behavior: "smooth" });

  // Lightbox-Klick auf alle Bilder
  contentEl.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.src, img.alt));
  });
}

// ── Suche / Filter ────────────────────────────────────────────────────────────
function filterTree(query) {
  const q = query.trim().toLowerCase();
  const tree = document.getElementById("nav-tree");

  tree.querySelectorAll(".team-item").forEach(li => {
    const season = li.dataset.season;
    const cls    = li.dataset.class;
    const team   = li.dataset.team;
    const hint   = li.querySelector(".shooter-hint");

    // 1) Treffer auf Mannschaftsname
    const teamMatch = !q || readable(team).toLowerCase().includes(q);

    // 2) Treffer auf Schützennamen (nur wenn Mannschaft nicht schon trifft)
    let matchedShooter = "";
    if (!teamMatch && q) {
      const files = data[season]?.[cls]?.[team] || [];
      for (const f of files) {
        if (f.toLowerCase().includes("_team.svg")) continue;
        const name = extractShooterName(team, f);
        if (name.toLowerCase().includes(q)) {
          matchedShooter = name;
          break;
        }
      }
    }

    const visible = !q || teamMatch || matchedShooter;
    li.classList.toggle("hidden", !visible);
    if (hint) hint.textContent = matchedShooter ? `↳ ${matchedShooter}` : "";
  });

  // Klassen ausblenden, wenn alle Teams versteckt
  tree.querySelectorAll(".class-node").forEach(node => {
    const anyVisible = [...node.querySelectorAll(".team-item")]
      .some(li => !li.classList.contains("hidden"));
    node.classList.toggle("hidden", !anyVisible);
    if (q && anyVisible) node.open = true;
  });

  // Saisonen ausblenden, wenn alle Klassen versteckt
  tree.querySelectorAll(".season-node").forEach(node => {
    const anyVisible = [...node.querySelectorAll(".class-node")]
      .some(n => !n.classList.contains("hidden"));
    node.classList.toggle("hidden", !anyVisible);
    if (q && anyVisible) node.open = true;
  });
}

searchEl.addEventListener("input", () => filterTree(searchEl.value));

// Suche bei Escape leeren
searchEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchEl.value = "";
    filterTree("");
  }
});

// ── URL-Hash beim Laden auswerten ─────────────────────────────────────────────
function restoreFromHash() {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (!hash) return;
  const parts = hash.split("/");
  if (parts.length < 3) return;
  const [season, cls, ...teamParts] = parts;
  const team = teamParts.join("/");
  if (!data[season]?.[cls]?.[team]) return;

  // Zugehöriges li-Element finden und aktivieren
  const li = document.querySelector(
    `.team-item[data-season="${CSS.escape(season)}"][data-class="${CSS.escape(cls)}"][data-team="${CSS.escape(team)}"]`
  );
  if (li) {
    // Übergeordnete details öffnen
    li.closest(".class-node").open  = true;
    li.closest(".season-node").open = true;
    li.scrollIntoView({ block: "center" });
    selectTeam(season, cls, team, li);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
fetch("Diagramme/folder_structure.json")
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(json => {
    data = json;
    buildTree(json);
    restoreFromHash();
  })
  .catch(err => {
    contentEl.innerHTML = `
      <div id="welcome">
        <div id="welcome-icon">⚠️</div>
        <h2>Keine Daten gefunden</h2>
        <p>Bitte zuerst die Pipeline ausführen:<br>
           <code>python main.py</code></p>
        <p style="margin-top:8px;font-size:12px;color:#666">${err}</p>
      </div>`;
  });
