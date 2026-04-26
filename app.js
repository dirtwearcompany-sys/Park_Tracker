/* ===============================
   DIRT WEAR CO. — PARK TRACKER
   app.js
   =============================== */

// ---- STATE ----
let allSites = [];
let customSites = [];
let visited = new Set();
let svg, projection, dotsGroup, statesGroup;
let curType = "all", curState = "all", curSearch = "";
let statePaths = null;
let stateNameMap = {}; // fips id -> state name
let sitesByState = {}; // state abbr -> [sites]

const VISITED_KEY = "dirtwear_visited";
const CUSTOM_KEY = "dirtwear_custom";

// ---- COLORS ----
const CLAY = "#A03C18";
const CLAY_DARK = "#712B13";
const UNVISITED_FILL = "#B5D4F4";
const UNVISITED_STROKE = "#378ADD";
const CUSTOM_FILL = "#E8C547";
const CUSTOM_STROKE = "#B8952A";

// ---- INIT ----
window.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  loadData();
});

// ---- STORAGE ----
function loadFromStorage() {
  try {
    const v = localStorage.getItem(VISITED_KEY);
    if (v) visited = new Set(JSON.parse(v));
    const c = localStorage.getItem(CUSTOM_KEY);
    if (c) customSites = JSON.parse(c);
  } catch (e) {}
}

function saveToStorage() {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customSites));
  } catch (e) {}
}

// ---- NPS API FETCH ----
async function loadData() {
  const label = document.getElementById("loading-msg");
  try {
    label.textContent = "Connecting to NPS database...";
    const first = await fetch(
      "https://developer.nps.gov/api/v1/parks?limit=100&start=0&api_key=DEMO_KEY"
    );
    const firstData = await first.json();
    const total = parseInt(firstData.total);
    let pages = [...firstData.data];
    label.textContent = `Loading ${total} NPS sites... (${pages.length} of ${total})`;

    const fetches = [];
    for (let start = 100; start < total; start += 100) {
      fetches.push(
        fetch(
          `https://developer.nps.gov/api/v1/parks?limit=100&start=${start}&api_key=DEMO_KEY`
        ).then((r) => r.json())
      );
    }
    const results = await Promise.all(fetches);
    results.forEach((r) => (pages = pages.concat(r.data)));

    allSites = pages
      .filter((p) => p.latitude && p.longitude && parseFloat(p.latitude) !== 0)
      .map((p) => ({
        id: p.parkCode,
        fullName: p.fullName,
        designation: p.designation || "Other",
        states: p.states || "",
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        custom: false,
      }));

    // merge custom sites
    const combined = [...allSites, ...customSites];

    buildFilters(combined);
    buildSitesByState(combined);
    document.getElementById("tot-count").textContent = combined.length;
    updateVisitedStat();

    label.style.display = "none";
    document.getElementById("hover-label").style.display = "block";
    document.getElementById("hover-label").textContent =
      "Click a state to see its sites — click a dot to mark visited";

    drawMap(combined);
  } catch (e) {
    label.textContent =
      "Could not load NPS data. Check your internet connection and refresh.";
    console.error(e);
  }
}

// ---- BUILD FILTERS ----
function buildFilters(sites) {
  const types = [...new Set(sites.map((s) => s.designation))]
    .filter(Boolean)
    .sort();
  const typeSelect = document.getElementById("type-filter");
  types.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    typeSelect.appendChild(o);
  });

  const stateList = [
    ...new Set(sites.flatMap((s) => (s.states ? s.states.split(",") : []))),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  const stateSelect = document.getElementById("state-filter");
  stateList.forEach((s) => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    stateSelect.appendChild(o);
  });

  typeSelect.addEventListener("change", () => {
    curType = typeSelect.value;
    applyFilters();
  });
  stateSelect.addEventListener("change", () => {
    curState = stateSelect.value;
    applyFilters();
  });
  document.getElementById("search-box").addEventListener("input", (e) => {
    curSearch = e.target.value.toLowerCase();
    applyFilters();
  });
}

function buildSitesByState(sites) {
  sitesByState = {};
  sites.forEach((s) => {
    const states = s.states ? s.states.split(",").map((x) => x.trim()) : [];
    states.forEach((st) => {
      if (!sitesByState[st]) sitesByState[st] = [];
      sitesByState[st].push(s);
    });
  });
}

// ---- DRAW MAP ----
async function drawMap(sites) {
  const w = 960,
    h = 560;
  projection = d3.geoAlbersUsa().scale(1200).translate([w / 2, h / 2]);
  const path = d3.geoPath(projection);

  const mapDiv = document.getElementById("map");
  svg = d3
    .select(mapDiv)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("id", "map-svg");

  const us = await d3.json(
    "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"
  );

  // build fips->name map
  us.objects.states.geometries.forEach((g) => {
    stateNameMap[g.id] = g.properties.name;
  });

  statesGroup = svg.append("g").attr("class", "states-group");
  statesGroup
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .join("path")
    .attr("class", "state-path")
    .attr("d", path)
    .attr("fill", "#E8D5BF")
    .attr("stroke", "#C4A882")
    .attr("stroke-width", 0.6)
    .attr("data-name", (d) => stateNameMap[d.id] || "")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#DEC9A8");
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("fill", "#E8D5BF");
    })
    .on("click", function (event, d) {
      const name = stateNameMap[d.id];
      openStatePanel(name, d.id);
    });

  statePaths = statesGroup.selectAll("path");

  // mesh borders
  svg
    .append("path")
    .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
    .attr("fill", "none")
    .attr("stroke", "#B09070")
    .attr("stroke-width", 0.5)
    .attr("d", path);

  const validSites = sites.filter((s) => projection([s.lng, s.lat]));

  dotsGroup = svg.append("g").attr("class", "dots-group");

  dotsGroup
    .selectAll("circle")
    .data(validSites, (d) => d.id || d.fullName)
    .join("circle")
    .attr("class", "site-dot")
    .attr("cx", (d) => projection([d.lng, d.lat])[0])
    .attr("cy", (d) => projection([d.lng, d.lat])[1])
    .attr("r", 4.5)
    .attr("fill", (d) =>
      d.custom
        ? CUSTOM_FILL
        : visited.has(d.fullName)
        ? CLAY
        : UNVISITED_FILL
    )
    .attr("stroke", (d) =>
      d.custom
        ? CUSTOM_STROKE
        : visited.has(d.fullName)
        ? CLAY_DARK
        : UNVISITED_STROKE
    )
    .attr("stroke-width", 1)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      document.getElementById("hover-label").textContent =
        d.fullName + (d.designation ? "  —  " + d.designation : "");
      d3.select(this).attr("r", 7);
    })
    .on("mouseout", function (event, d) {
      document.getElementById("hover-label").textContent =
        "Click a state to see its sites — click a dot to mark visited";
      d3.select(this).attr("r", 4.5);
    })
    .on("click", function (event, d) {
      event.stopPropagation();
      toggleVisited(d, d3.select(this));
    });
}

// ---- TOGGLE VISITED ----
function toggleVisited(d, circle) {
  if (visited.has(d.fullName)) {
    visited.delete(d.fullName);
    circle
      .attr("fill", d.custom ? CUSTOM_FILL : UNVISITED_FILL)
      .attr("stroke", d.custom ? CUSTOM_STROKE : UNVISITED_STROKE);
  } else {
    visited.add(d.fullName);
    circle.attr("fill", CLAY).attr("stroke", CLAY_DARK);
  }
  saveToStorage();
  updateVisitedStat();
  updateVisitedSection();
  refreshStatePanelIfOpen();
}

// ---- FILTERS ----
function applyFilters() {
  if (!dotsGroup) return;
  dotsGroup.selectAll(".site-dot").each(function (d) {
    const typeOk = curType === "all" || d.designation === curType;
    const stateOk =
      curState === "all" ||
      (d.states && d.states.split(",").map((x) => x.trim()).includes(curState));
    const searchOk =
      curSearch === "" || d.fullName.toLowerCase().includes(curSearch);
    const show = typeOk && stateOk && searchOk;
    d3.select(this)
      .attr("opacity", show ? 1 : 0.08)
      .attr("pointer-events", show ? "all" : "none");
  });
}

// ---- RESET ----
window.resetAll = function () {
  if (!confirm("Clear all visited sites?")) return;
  visited.clear();
  saveToStorage();
  if (dotsGroup) {
    dotsGroup.selectAll(".site-dot").each(function (d) {
      d3.select(this)
        .attr("fill", d.custom ? CUSTOM_FILL : UNVISITED_FILL)
        .attr("stroke", d.custom ? CUSTOM_STROKE : UNVISITED_STROKE);
    });
  }
  updateVisitedStat();
  updateVisitedSection();
};

// ---- STATS ----
function updateVisitedStat() {
  document.getElementById("stat-visited").querySelector(".stat-num").textContent =
    visited.size;
}

// ---- VISITED CARDS ----
function updateVisitedSection() {
  const section = document.getElementById("visited-section");
  const grid = document.getElementById("visited-grid");
  if (visited.size === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  const combined = [...allSites, ...customSites];
  const visitedSites = combined.filter((s) => visited.has(s.fullName));
  grid.innerHTML = "";
  visitedSites.sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach((s) => {
    const card = document.createElement("div");
    card.className = "visited-card";
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div class="visited-card-dot" style="${s.custom ? "background:#B8952A;" : ""}"></div>
        <div>
          <div class="visited-card-name">${s.fullName}</div>
          <div class="visited-card-type">${s.designation || "Custom Site"}${s.custom ? ' <span class="custom-badge">Custom</span>' : ""}</div>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

window.toggleVisitedList = function () {
  const grid = document.getElementById("visited-grid");
  const btn = document.querySelector(".visited-header .ctrl-btn");
  if (grid.style.display === "none") {
    grid.style.display = "grid";
    btn.textContent = "Hide List";
  } else {
    grid.style.display = "none";
    btn.textContent = "Show List";
  }
};

// ---- STATE PANEL ----
let currentStateName = null;
const STATE_ABBR = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",
  Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",
  Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",
  Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",
  Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",
  Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ",
  "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",
  Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI",
  "South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",
  Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",
  Wisconsin:"WI",Wyoming:"WY","District of Columbia":"DC"
};

window.openStatePanel = function (stateName, fipsId) {
  currentStateName = stateName;
  const abbr = STATE_ABBR[stateName];
  const sites = abbr ? (sitesByState[abbr] || []) : [];

  document.getElementById("state-panel-title").textContent =
    stateName + " National Sites";
  const vis = sites.filter((s) => visited.has(s.fullName)).length;
  document.getElementById("state-vis-count").textContent = vis + " visited";
  document.getElementById("state-tot-count").textContent =
    sites.length + " total";

  const list = document.getElementById("state-site-list");
  list.innerHTML = "";
  if (sites.length === 0) {
    list.innerHTML =
      '<p style="font-size:13px;color:var(--text-light);padding:12px 0;">No sites found for this state.</p>';
  } else {
    sites
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .forEach((s) => {
        const item = document.createElement("div");
        item.className =
          "state-site-item" + (visited.has(s.fullName) ? " visited" : "");
        item.dataset.name = s.fullName;
        item.innerHTML = `
          <div class="site-item-dot"></div>
          <div class="site-item-info">
            <div class="site-item-name">${s.fullName}</div>
            <div class="site-item-type">${s.designation || "Site"}${s.custom ? ' <span class="custom-badge">Custom</span>' : ""}</div>
          </div>`;
        item.addEventListener("click", () => {
          if (visited.has(s.fullName)) {
            visited.delete(s.fullName);
            item.classList.remove("visited");
          } else {
            visited.add(s.fullName);
            item.classList.add("visited");
          }
          // update dot on map
          dotsGroup.selectAll(".site-dot").each(function (d) {
            if (d.fullName === s.fullName) {
              d3.select(this)
                .attr("fill", visited.has(s.fullName) ? CLAY : (s.custom ? CUSTOM_FILL : UNVISITED_FILL))
                .attr("stroke", visited.has(s.fullName) ? CLAY_DARK : (s.custom ? CUSTOM_STROKE : UNVISITED_STROKE));
            }
          });
          saveToStorage();
          updateVisitedStat();
          updateVisitedSection();
          // update panel counts
          const v2 = sites.filter((x) => visited.has(x.fullName)).length;
          document.getElementById("state-vis-count").textContent = v2 + " visited";
        });
        list.appendChild(item);
      });
  }

  document.getElementById("state-panel").classList.add("open");
  document.getElementById("panel-overlay").classList.add("active");
};

window.closeStatePanel = function () {
  document.getElementById("state-panel").classList.remove("open");
  document.getElementById("panel-overlay").classList.remove("active");
  currentStateName = null;
};

function refreshStatePanelIfOpen() {
  if (currentStateName) {
    // refresh counts only
    const abbr = STATE_ABBR[currentStateName];
    const sites = abbr ? (sitesByState[abbr] || []) : [];
    const vis = sites.filter((s) => visited.has(s.fullName)).length;
    const el = document.getElementById("state-vis-count");
    if (el) el.textContent = vis + " visited";
  }
}

// ---- ADD CUSTOM SITE ----
window.openAddModal = function () {
  document.getElementById("add-modal").style.display = "flex";
};

window.closeAddModal = function () {
  document.getElementById("add-modal").style.display = "none";
  document.getElementById("add-name").value = "";
  document.getElementById("add-designation").value = "";
  document.getElementById("add-states").value = "";
  document.getElementById("add-lat").value = "";
  document.getElementById("add-lng").value = "";
  document.getElementById("add-visited").checked = false;
};

window.addCustomSite = function () {
  const name = document.getElementById("add-name").value.trim();
  const designation = document.getElementById("add-designation").value.trim() || "Custom Site";
  const states = document.getElementById("add-states").value.trim().toUpperCase();
  const lat = parseFloat(document.getElementById("add-lat").value);
  const lng = parseFloat(document.getElementById("add-lng").value);
  const markVisited = document.getElementById("add-visited").checked;

  if (!name) { alert("Please enter a site name."); return; }
  if (isNaN(lat) || isNaN(lng)) { alert("Please enter valid coordinates."); return; }

  const site = {
    id: "custom_" + Date.now(),
    fullName: name,
    designation,
    states,
    lat,
    lng,
    custom: true,
  };

  customSites.push(site);
  if (markVisited) visited.add(name);
  saveToStorage();

  // add to map
  const pos = projection([lng, lat]);
  if (pos) {
    dotsGroup
      .append("circle")
      .datum(site)
      .attr("class", "site-dot")
      .attr("cx", pos[0])
      .attr("cy", pos[1])
      .attr("r", 4.5)
      .attr("fill", markVisited ? CLAY : CUSTOM_FILL)
      .attr("stroke", markVisited ? CLAY_DARK : CUSTOM_STROKE)
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        document.getElementById("hover-label").textContent =
          d.fullName + "  —  " + d.designation + " (Custom)";
        d3.select(this).attr("r", 7);
      })
      .on("mouseout", function () {
        document.getElementById("hover-label").textContent =
          "Click a state to see its sites — click a dot to mark visited";
        d3.select(this).attr("r", 4.5);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        toggleVisited(d, d3.select(this));
      });
  }

  // update sitesByState
  if (states) {
    states.split(",").map(s => s.trim()).forEach(st => {
      if (!sitesByState[st]) sitesByState[st] = [];
      sitesByState[st].push(site);
    });
  }

  document.getElementById("tot-count").textContent =
    allSites.length + customSites.length;
  updateVisitedStat();
  updateVisitedSection();
  closeAddModal();
};

// ---- DOWNLOAD MAP ----
window.downloadMap = function () {
  const svgEl = document.getElementById("map-svg");
  if (!svgEl) { alert("Map is still loading. Please wait."); return; }

  // inject fonts & styles inline for export
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .state-path { fill: #E8D5BF; stroke: #B09070; stroke-width: 0.6; }
    .site-dot { cursor: pointer; }
  `;
  svgEl.insertBefore(style, svgEl.firstChild);

  // add title watermark
  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", "20");
  title.setAttribute("y", "530");
  title.setAttribute("font-size", "14");
  title.setAttribute("fill", "#3A1A08");
  title.setAttribute("font-family", "Georgia, serif");
  title.setAttribute("opacity", "0.6");
  title.textContent = `Dirt Wear Co. — Our Park Journey  |  ${visited.size} sites visited`;
  svgEl.appendChild(title);

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dirtwear-park-map.svg";
  a.click();
  URL.revokeObjectURL(url);

  // clean up injected elements
  svgEl.removeChild(style);
  svgEl.removeChild(title);
};
