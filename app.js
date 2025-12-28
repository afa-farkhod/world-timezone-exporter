/* World Timezone Explorer
 * - Uses Leaflet for map rendering.
 * - Shows "timezone bands" based on longitude (15 degrees per hour).
 * - Provides approximate local time for cursor position.
 * - Optional reverse geocoding (on click / search) via Nominatim.
 */

const el = (id) => document.getElementById(id);

// override table (used for CLICKED location after reverse geocode)
const COUNTRY_TZ_OVERRIDE = {
  kr: 9, // South Korea
  kp: 9, // North Korea
  jp: 9, // Japan
  cn: 8, // China (single national timezone)
  // add more here
};

const ui = {
  latlon: el("latlon"),
  tz: el("tz"),
  localTime: el("localTime"),
  utcTime: el("utcTime"),
  place: el("place"),
  clickLatlon: el("clickLatlon"),
  clickTz: el("clickTz"),
  clickLocalTime: el("clickLocalTime"),
  toggleBands: el("toggleBands"),
  searchInput: el("searchInput"),
  searchBtn: el("searchBtn"),
};

// --- Map init ---
const map = L.map("map", {
  worldCopyJump: true,
  minZoom: 2,
  maxZoom: 8,
  zoomControl: true,
}).setView([22, 0], 2);

// Basemap with labels (includes country names) + fallback tiles
const carto = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
).addTo(map);

// Fallback tiles (OSM standard)
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
});

let fallbackAdded = false;
carto.on("tileerror", () => {
  if (fallbackAdded) return;
  fallbackAdded = true;
  osm.addTo(map);
});

// --- Timezone band logic (approx) ---
// produce offsets in the common range [-12..+14].
function offsetFromLon(lon) {
  // normalize to [-180, 180)
  let x = ((lon + 180) % 360 + 360) % 360 - 180;
  // each band is 15°, center on multiples of 15°, boundaries at ±7.5°
  let off = Math.floor((x + 7.5) / 15);
  // clamp to real-world extremes
  if (off < -12) off = -12;
  if (off > 14) off = 14;
  return off;
}

function lonRangeForOffset(off) {
  const start = off * 15 - 7.5;
  const end = off * 15 + 7.5;
  // Clamp world bounds
  return [Math.max(-180, start), Math.min(180, end)];
}

function fmtOffset(off) {
  if (off === 0) return "UTC±0";
  const sign = off > 0 ? "+" : "−";
  return `UTC${sign}${Math.abs(off)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalTimeFromOffset(off, now = new Date()) {
  // IMPORTANT: now.getTime() is already UTC epoch milliseconds
  const utcMs = now.getTime();
  const localMs = utcMs + off * 3_600_000;
  const d = new Date(localMs);

  // Format as YYYY-MM-DD HH:MM:SS (using UTC getters because we already shifted)
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatUtc(now = new Date()) {
  const yyyy = now.getUTCFullYear();
  const mm = pad2(now.getUTCMonth() + 1);
  const dd = pad2(now.getUTCDate());
  const hh = pad2(now.getUTCHours());
  const mi = pad2(now.getUTCMinutes());
  const ss = pad2(now.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// --- Draw timezone bands as rectangles ---
const bandLayer = L.layerGroup().addTo(map);
let currentBandRect = null;

function makeBandRect(off, isCurrent = false) {
  const [w, e] = lonRangeForOffset(off);
  const bounds = [
    [-85, w],
    [85, e],
  ];
  return L.rectangle(bounds, {
    weight: isCurrent ? 1.2 : 0.6,
    opacity: isCurrent ? 0.6 : 0.25,
    fillOpacity: isCurrent ? 0.16 : 0.06,
  });
}

function renderAllBands() {
  bandLayer.clearLayers();
  for (let off = -12; off <= 14; off++) {
    const rect = makeBandRect(off, false);
    rect.addTo(bandLayer);
  }
}

renderAllBands();

// --- Hover band highlight + cursor info ---
let lastHover = { off: null, lat: null, lon: null };
let rafPending = false;

function updateHoverUI(lat, lon) {
  const off = offsetFromLon(lon);

  ui.latlon.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  ui.tz.textContent = fmtOffset(off);
  ui.localTime.textContent = formatLocalTimeFromOffset(off);
  ui.utcTime.textContent = formatUtc();

  if (lastHover.off !== off) {
    if (currentBandRect) bandLayer.removeLayer(currentBandRect);
    currentBandRect = makeBandRect(off, true);
    currentBandRect.addTo(bandLayer);
    lastHover.off = off;
  }
}

map.on("mousemove", (e) => {
  lastHover.lat = e.latlng.lat;
  lastHover.lon = e.latlng.lng;

  if (rafPending) return;
  rafPending = true;

  requestAnimationFrame(() => {
    rafPending = false;
    updateHoverUI(lastHover.lat, lastHover.lon);
  });
});

// Initialize cursor panel from map center so it doesn't show "—" on first load
{
  const c = map.getCenter();
  lastHover.lat = c.lat;
  lastHover.lon = c.lng;
  updateHoverUI(c.lat, c.lng);
}

// Update clocks every second without moving mouse (keeps UI fresh)
setInterval(() => {
  if (lastHover.lat == null || lastHover.lon == null) return;
  updateHoverUI(lastHover.lat, lastHover.lon);

  // Also update clicked card time
  if (clickedState.lat != null) {
    ui.clickLocalTime.textContent = formatLocalTimeFromOffset(clickedState.off);
  }
}, 1000);

// Show/hide band layer
ui.toggleBands.addEventListener("change", () => {
  if (ui.toggleBands.checked) {
    bandLayer.addTo(map);
  } else {
    bandLayer.removeFrom(map);
  }
});

// --- Reverse geocoding (click) ---
const clickedState = {
  lat: null,
  lon: null,
  off: null,
  cache: new Map(), // key: "lat,lon" rounded -> result object
  lastFetchAt: 0,
};

const clickMarker = L.marker([0, 0], { opacity: 0 }).addTo(map);

function cacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

async function reverseGeocode(lat, lon) {
  const key = cacheKey(lat, lon);
  if (clickedState.cache.has(key)) return clickedState.cache.get(key);

  // Gentle rate limit: at most 1 request per 1.2s
  const now = Date.now();
  const wait = Math.max(0, 1200 - (now - clickedState.lastFetchAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  clickedState.lastFetchAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Reverse geocode failed (${resp.status})`);
  const data = await resp.json();

  const addr = data.address || {};
  const country = addr.country || "Unknown country";
  const countryCode = (addr.country_code || "").toLowerCase();
  const city =
      addr.city || addr.town || addr.village || addr.state || addr.county || "";
  const label = city ? `${city}, ${country}` : country;

  const out = { label, countryCode };
  clickedState.cache.set(key, out);
  return out;
}

map.on("click", async (e) => {
  const { lat, lng } = e.latlng;
  let off = offsetFromLon(lng);

  clickedState.lat = lat;
  clickedState.lon = lng;
  clickedState.off = off;

  ui.clickLatlon.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  ui.clickTz.textContent = fmtOffset(off);
  ui.clickLocalTime.textContent = formatLocalTimeFromOffset(off);
  ui.place.textContent = "Looking up place name…";

  clickMarker.setLatLng([lat, lng]);
  clickMarker.setOpacity(1);

  try {
    const geo = await reverseGeocode(lat, lng);
    ui.place.textContent = geo.label;

    const forced = COUNTRY_TZ_OVERRIDE[geo.countryCode];
    if (typeof forced === "number") {
      off = forced;
      clickedState.off = off;
      ui.clickTz.textContent = fmtOffset(off);
      ui.clickLocalTime.textContent = formatLocalTimeFromOffset(off);
    }
  } catch (err) {
    ui.place.textContent =
        "Could not reverse-geocode (network issue or rate limit).";
  }
});

// --- Search (Nominatim) ---
async function searchPlace(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "en");

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Search failed (${resp.status})`);

  const results = await resp.json();
  if (!results || results.length === 0) return null;

  const r = results[0];
  return {
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    label: r.display_name,
  };
}

async function handleSearch() {
  const q = ui.searchInput.value.trim();
  if (!q) return;

  ui.searchBtn.disabled = true;
  ui.searchBtn.textContent = "Searching…";

  try {
    const res = await searchPlace(q);
    if (!res) {
      alert("No results. Try a different query.");
      return;
    }

    map.setView([res.lat, res.lon], 4, { animate: true });

    // Populate clicked card with the found location
    let off = offsetFromLon(res.lon);
    let placeLabel = res.label;

    try {
      // reuse reverseGeocode() to get country_code, then apply override if present
      const geo = await reverseGeocode(res.lat, res.lon);
      placeLabel = geo.label;

      const forced = COUNTRY_TZ_OVERRIDE[geo.countryCode];
      if (typeof forced === "number") off = forced;
    } catch (_) {
      // ignore lookup failures; keep approximate longitude offset
    }

    clickedState.lat = res.lat;
    clickedState.lon = res.lon;
    clickedState.off = off;

    ui.place.textContent = placeLabel;
    ui.clickLatlon.textContent = `${res.lat.toFixed(4)}, ${res.lon.toFixed(4)}`;
    ui.clickTz.textContent = fmtOffset(off);
    ui.clickLocalTime.textContent = formatLocalTimeFromOffset(off);

    clickMarker.setLatLng([res.lat, res.lon]);
    clickMarker.setOpacity(1);
  } catch (err) {
    alert("Search failed. Please try again later.");
  } finally {
    ui.searchBtn.disabled = false;
    ui.searchBtn.textContent = "Search";
  }
}

ui.searchBtn.addEventListener("click", handleSearch);
ui.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

// Initial UTC clock fill
ui.utcTime.textContent = formatUtc();
