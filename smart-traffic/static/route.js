/* ================================================================
   Daarideepa – route.js  (Enhanced Edition)
   Features:
   - Parking → show on map → route to parking → then destination
   - Google Maps-style turn-by-turn directions panel
   - Illegal parking detection with penalty points
   - Live GPS position tracking
   - AI traffic detection (Claude API) with Dijkstra re-routing
   - AI crowd/festival detection near temples
   - Full gamification preserved
   ================================================================ */

// ── State ────────────────────────────────────────────────────────
let map;
let routeLayers          = [];
let parkingMarkers       = [];
let currentRoutes        = [];
let destinationCoords    = null;
let startCoords          = null;
let selectedParkingSpot  = null;  // { coords, name, rewardPts, price }
let activeJourneyPhase   = null;  // 'to_parking' | 'to_destination' | null
let userMarker           = null;
let watchId              = null;
let lastKnownPosition    = null;
let isNavigating         = false;
let currentStepIndex     = 0;
let navigationSteps      = [];
let activeRouteCoords    = [];
let parkingRouteLayer    = null;
let destRouteLayer       = null;
let parkingDestMarker    = null;
let illegalParkingTimer  = null;
let nearParkingZone      = false;
let aiTrafficOverlay     = null;
let crowdAlertShown      = false;

// ── Gamification state ────────────────────────────────────────────
let userPoints    = parseInt(localStorage.getItem('dp_points')   || '0');
let userStreak    = parseInt(localStorage.getItem('dp_streak')   || '0');
let lastRouteDate = localStorage.getItem('dp_last_route') || '';
let badges        = JSON.parse(localStorage.getItem('dp_badges') || '[]');
let leaderboard   = JSON.parse(localStorage.getItem('dp_leaderboard') || JSON.stringify([
  { name: "Arjun K.",  points: 1240 },
  { name: "Priya S.",  points: 980  },
  { name: "Rahul M.",  points: 750  },
  { name: "Anita R.",  points: 620  },
  { name: "You",       points: 0    }
]));

// ── Map icons ─────────────────────────────────────────────────────
const startIcon = L.divIcon({
  className: '',
  html: `<div style="background:#4285F4;width:18px;height:18px;border-radius:50%;
         border:3px solid white;box-shadow:0 2px 10px rgba(66,133,244,0.9);
         animation:pulse-blue 2s infinite;"></div>`,
  iconSize: [18,18], iconAnchor: [9,9]
});

const endIcon = L.divIcon({
  className: '',
  html: `<div style="width:0;height:0;border-left:10px solid transparent;
         border-right:10px solid transparent;border-bottom:28px solid #EA4335;
         filter:drop-shadow(0 2px 4px rgba(234,67,53,0.7));"></div>`,
  iconSize: [20,28], iconAnchor: [10,28]
});

const userPosIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:0;background:#4285F4;border-radius:50%;
         border:3px solid white;box-shadow:0 0 0 4px rgba(66,133,244,0.3);
         animation:pulse-blue 1.8s infinite;"></div>
    <div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);
         width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
         border-bottom:8px solid #4285F4;"></div>
  </div>`,
  iconSize: [22,28], iconAnchor: [11,22]
});

const parkingSelectedIcon = L.divIcon({
  className: '',
  html: `<div style="background:#22c55e;color:white;font-size:12px;font-weight:800;
         padding:5px 10px;border-radius:10px;border:2px solid white;
         box-shadow:0 4px 16px rgba(34,197,94,0.6);white-space:nowrap;
         animation:pulse-green 1.5s infinite;">🅿️ SELECTED</div>`,
  iconSize: [100,32], iconAnchor: [50,16]
});

// ── Route metadata ────────────────────────────────────────────────
const ROUTE_META = [
  { label:'Fastest Route', color:'#EA4335', congestion:'high',   pts:20,  tag:''            },
  { label:'Eco Route',     color:'#34A853', congestion:'low',    pts:120, tag:'RECOMMENDED'  },
  { label:'Alternative',   color:'#FBBC04', congestion:'medium', pts:60,  tag:''             },
];

// ── Known temple/religious hotspots in Bengaluru ─────────────────
const TEMPLE_HOTSPOTS = [
  { name: 'ISKCON Temple',       coords: [13.0099, 77.5510], radius: 0.8 },
  { name: 'Bull Temple',         coords: [12.9429, 77.5693], radius: 0.5 },
  { name: 'Gavi Gangadhareshwara', coords: [12.9428, 77.5712], radius: 0.5 },
  { name: 'Banashankari Temple', coords: [12.9101, 77.5444], radius: 0.6 },
  { name: 'Dodda Ganesha Temple',coords: [12.9425, 77.5701], radius: 0.4 },
  { name: 'St. Mary\'s Basilica',coords: [12.9798, 77.6031], radius: 0.5 },
  { name: 'Ulsoor Lake Temple',  coords: [12.9810, 77.6163], radius: 0.4 },
];

// ── Festival / special days calendar ─────────────────────────────
const FESTIVAL_CALENDAR = (() => {
  const now = new Date();
  const y   = now.getFullYear();
  return [
    { name:'Ganesh Chaturthi', date:`${y}-08-27`, crowd:'extreme' },
    { name:'Dasara',           date:`${y}-10-12`, crowd:'high'    },
    { name:'Diwali',           date:`${y}-10-29`, crowd:'high'    },
    { name:'Ugadi',            date:`${y}-03-30`, crowd:'medium'  },
    { name:'Rama Navami',      date:`${y}-04-17`, crowd:'high'    },
    { name:'Krishna Janmashtami', date:`${y}-08-16`, crowd:'extreme' },
    { name:'Karaga',           date:`${y}-04-15`, crowd:'extreme' },
    { name:'Christmas',        date:`${y}-12-25`, crowd:'medium'  },
    { name:'New Year',         date:`${y}-01-01`, crowd:'high'    },
  ];
})();

// ================================================================
// INIT
// ================================================================
window.onload = function () {
  map = L.map("map", { zoomControl: false }).setView([12.9716, 77.5946], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors", maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  setTimeout(() => map.invalidateSize(), 300);

  // Inject extra CSS
  injectCSS();

  updatePointsDisplay();
  updateStreakDisplay();
  renderBadges();
  updateLeaderboard();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Start GPS tracking
  startGPSTracking();

  // Check festival crowd on load
  checkFestivalCrowd();

  // AI traffic refresh every 3 minutes
  setInterval(() => {
    if (currentRoutes.length > 0) aiRefreshTraffic();
  }, 180000);
};

// ================================================================
// CSS INJECTION (new elements)
// ================================================================
function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse-blue {
      0%,100% { box-shadow: 0 0 0 0 rgba(66,133,244,0.5); }
      50%      { box-shadow: 0 0 0 10px rgba(66,133,244,0); }
    }
    @keyframes pulse-green {
      0%,100% { box-shadow: 0 4px 16px rgba(34,197,94,0.6); }
      50%      { box-shadow: 0 4px 28px rgba(34,197,94,0.9); }
    }
    @keyframes fadeInDown {
      from { opacity:0; transform:translateY(-16px); }
      to   { opacity:1; transform:translateY(0); }
    }

    /* ── Journey Progress Bar ── */
    #journey-bar {
      background: linear-gradient(135deg,#0d1f3c,#1a2f5a);
      border-bottom: 1px solid rgba(66,133,244,0.3);
      padding: 10px 20px;
      display: none;
      animation: fadeInDown .3s ease;
    }
    #journey-bar.active { display: block; }
    .jb-phase {
      font-size: 11px; font-weight:700; text-transform:uppercase;
      letter-spacing:.8px; color: var(--accent3); margin-bottom:4px;
    }
    .jb-dest {
      font-size: 13px; font-weight:600; color:var(--text); margin-bottom:6px;
    }
    .jb-steps { display:flex; align-items:center; gap:8px; }
    .jb-step {
      background:var(--surface3); border:1px solid var(--border2);
      border-radius:6px; padding:3px 8px;
      font-size:11px; color:var(--text2);
    }
    .jb-step.done { background:rgba(52,168,83,0.15); border-color:#34A853; color:#34A853; }
    .jb-step.active{ background:rgba(66,133,244,0.15); border-color:var(--accent); color:var(--accent); }

    /* ── Navigation Directions Panel ── */
    #nav-panel {
      background: var(--surface2);
      border: 1.5px solid var(--accent);
      border-radius: var(--radius);
      margin: 0 20px 12px;
      overflow: hidden;
      display: none;
      animation: fadeInDown .3s ease;
    }
    #nav-panel.active { display: block; }
    .nav-header {
      background: linear-gradient(135deg,rgba(66,133,244,0.2),rgba(66,133,244,0.05));
      padding: 10px 14px;
      display:flex; align-items:center; gap:10px;
      border-bottom:1px solid var(--border2);
    }
    .nav-arrow-big {
      font-size:28px; min-width:36px; text-align:center;
    }
    .nav-step-text { font-size:13px; font-weight:600; color:var(--text); flex:1; }
    .nav-dist-badge {
      font-family:'Space Mono',monospace; font-size:12px; font-weight:700;
      color:var(--accent); background:rgba(66,133,244,0.1);
      border:1px solid rgba(66,133,244,0.25); padding:3px 8px; border-radius:20px;
    }
    .nav-meta {
      display:flex; gap:16px; padding:8px 14px; font-size:12px; color:var(--text3);
    }
    .nav-meta span { display:flex; align-items:center; gap:4px; }
    .nav-steps-list {
      max-height:180px; overflow-y:auto; padding:8px 0;
      scrollbar-width:thin; scrollbar-color:var(--surface3) transparent;
    }
    .nav-step-item {
      display:flex; gap:10px; align-items:flex-start;
      padding:7px 14px; font-size:12px; color:var(--text2);
      border-left: 3px solid transparent;
      transition: var(--transition);
    }
    .nav-step-item.current {
      background:rgba(66,133,244,0.08);
      border-left-color:var(--accent);
      color:var(--text);
    }
    .nav-step-item.done { opacity:.4; }
    .nav-step-icon { font-size:16px; min-width:22px; text-align:center; margin-top:1px; }
    .nav-end-btn {
      width:calc(100% - 28px); margin:8px 14px 12px;
      padding:9px; background:rgba(234,67,53,0.1);
      border:1px solid rgba(234,67,53,0.3); border-radius:var(--radius-sm);
      color:#EA4335; font-family:'DM Sans',sans-serif; font-size:12px;
      font-weight:700; cursor:pointer; transition:var(--transition);
    }
    .nav-end-btn:hover { background:rgba(234,67,53,0.2); }

    /* ── AI Traffic Banner ── */
    #ai-traffic-banner {
      background: linear-gradient(135deg,rgba(251,188,4,0.12),rgba(251,188,4,0.05));
      border:1px solid rgba(251,188,4,0.3); border-radius:var(--radius);
      padding:10px 14px; margin:0 20px 10px;
      font-size:12px; color:var(--text2); display:none;
      animation: fadeInDown .3s ease;
    }
    #ai-traffic-banner.active { display:flex; gap:10px; align-items:flex-start; }
    .ai-banner-icon { font-size:20px; }
    .ai-banner-body { flex:1; }
    .ai-banner-title { font-weight:700; color:var(--accent3); font-size:12px; margin-bottom:3px; }
    .ai-reroute-btn {
      margin-top:6px; padding:5px 12px;
      background:rgba(251,188,4,0.15); border:1px solid rgba(251,188,4,0.4);
      border-radius:20px; color:var(--accent3); font-size:11px;
      font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif;
      transition:var(--transition);
    }
    .ai-reroute-btn:hover { background:rgba(251,188,4,0.25); }

    /* ── Crowd Alert Banner ── */
    #crowd-alert-banner {
      background:linear-gradient(135deg,rgba(234,67,53,0.12),rgba(234,67,53,0.05));
      border:1px solid rgba(234,67,53,0.3); border-radius:var(--radius);
      padding:10px 14px; margin:0 20px 10px;
      font-size:12px; display:none; animation:fadeInDown .3s ease;
    }
    #crowd-alert-banner.active { display:flex; gap:10px; align-items:flex-start; }
    .crowd-banner-title { font-weight:700; color:#EA4335; font-size:12px; margin-bottom:3px; }

    /* ── Penalty Toast ── */
    .penalty-toast {
      position:fixed; top:24px; left:50%; transform:translateX(-50%) translateY(-80px);
      background:linear-gradient(135deg,#3a0d0d,#1a0505);
      border:2px solid #EA4335; border-radius:var(--radius);
      padding:14px 20px; display:flex; align-items:center; gap:12px;
      font-family:'DM Sans',sans-serif; z-index:9999; opacity:0;
      transition:all .4s cubic-bezier(.34,1.56,.64,1); max-width:320px;
      box-shadow:0 8px 32px rgba(234,67,53,0.4);
    }
    .penalty-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
    .penalty-icon { font-size:28px; }
    .penalty-body .penalty-title { font-weight:700; color:#EA4335; font-size:14px; }
    .penalty-body .penalty-sub   { font-size:12px; color:#c07070; margin-top:2px; }

    /* ── Two-Phase Route Card in Parking ── */
    .pk-nav-full-btn {
      width:100%; padding:9px; margin-top:8px;
      background:linear-gradient(135deg,var(--accent),#0f62fe);
      border:none; border-radius:var(--radius-sm); color:white;
      font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700;
      cursor:pointer; transition:var(--transition);
      box-shadow:0 4px 12px rgba(66,133,244,0.35);
    }
    .pk-nav-full-btn:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(66,133,244,0.45); }

    /* ── Dijkstra reroute badge on route card ── */
    .ai-reroute-tag {
      font-size:9px; font-weight:700;
      background:linear-gradient(135deg,#FBBC04,#f59e0b);
      color:#1a1200; padding:2px 7px;
      border-radius:20px; letter-spacing:.5px;
    }

    /* ── GPS status dot ── */
    #gps-status {
      display:inline-flex; align-items:center; gap:5px;
      font-size:11px; color:var(--text3); padding:4px 10px;
      background:var(--surface3); border-radius:20px;
      position:fixed; bottom:60px; right:16px; z-index:1000;
    }
    .gps-dot {
      width:7px; height:7px; border-radius:50%;
      background:var(--accent2); animation:pulse-blue 1.5s infinite;
    }
    .gps-dot.off { background:#EA4335; animation:none; }
  `;
  document.head.appendChild(style);

  // Inject GPS status indicator
  document.body.insertAdjacentHTML('beforeend', `
    <div id="gps-status">
      <span class="gps-dot off" id="gps-dot"></span>
      <span id="gps-label">GPS off</span>
    </div>
  `);

  // Inject journey bar into panel (before route panel)
  const panel = document.getElementById('panel-routes');
  if (panel) {
    panel.insertAdjacentHTML('beforebegin', `
      <div id="journey-bar">
        <div class="jb-phase" id="jb-phase-label">Phase 1 of 2</div>
        <div class="jb-dest" id="jb-dest-label">Navigating...</div>
        <div class="jb-steps">
          <span class="jb-step" id="jb-step1">📍 Your Location</span>
          <span style="color:var(--text3)">→</span>
          <span class="jb-step" id="jb-step2">🅿️ Parking</span>
          <span style="color:var(--text3)">→</span>
          <span class="jb-step" id="jb-step3">🏁 Destination</span>
        </div>
      </div>
      <div id="ai-traffic-banner">
        <div class="ai-banner-icon">🤖</div>
        <div class="ai-banner-body">
          <div class="ai-banner-title">AI Traffic Alert</div>
          <div id="ai-traffic-msg">Analyzing traffic conditions...</div>
          <button class="ai-reroute-btn" onclick="aiRerouteDijkstra()">⚡ Reroute via Dijkstra</button>
        </div>
      </div>
      <div id="crowd-alert-banner">
        <div class="ai-banner-icon">🛕</div>
        <div class="ai-banner-body">
          <div class="crowd-banner-title" id="crowd-alert-title">Festival Crowd Alert</div>
          <div id="crowd-alert-msg"></div>
        </div>
      </div>
    `);
  }

  // Inject nav panel into routes panel
  const routesPanel = document.getElementById('panel-routes');
  if (routesPanel) {
    routesPanel.insertAdjacentHTML('afterbegin', `
      <div id="nav-panel">
        <div class="nav-header">
          <div class="nav-arrow-big" id="nav-arrow">↑</div>
          <div class="nav-step-text" id="nav-current-step">Calculating route...</div>
          <div class="nav-dist-badge" id="nav-dist">--</div>
        </div>
        <div class="nav-meta">
          <span>📏 <span id="nav-total-dist">--</span></span>
          <span>⏱️ <span id="nav-eta">--</span></span>
          <span id="nav-phase-badge" style="color:var(--accent)">Phase --</span>
        </div>
        <div class="nav-steps-list" id="nav-steps-list"></div>
        <button class="nav-end-btn" onclick="endNavigation()">✖ End Navigation</button>
      </div>
    `);
  }
}

// ================================================================
// GPS TRACKING
// ================================================================
function startGPSTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(
    pos => {
      const coords = [pos.coords.latitude, pos.coords.longitude];
      lastKnownPosition = coords;

      // Update GPS indicator
      document.getElementById('gps-dot').classList.remove('off');
      document.getElementById('gps-label').textContent = 'GPS live';

      // Update user marker
      if (!userMarker) {
        userMarker = L.marker(coords, { icon: userPosIcon, zIndexOffset: 1000 }).addTo(map);
        userMarker.bindPopup('<b>📍 You are here</b>');
      } else {
        userMarker.setLatLng(coords);
      }

      if (isNavigating) {
        updateNavigationProgress(coords);
        checkIllegalParking(coords);
      }
    },
    err => {
      document.getElementById('gps-dot').classList.add('off');
      document.getElementById('gps-label').textContent = 'GPS error';
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

// ================================================================
// SEARCH + GEOCODE
// ================================================================
window.getRoute = function() {

  const destination = document.getElementById("destination").value.trim();
  if (!destination) {
    showToast("Please enter a destination ❌", "error");
    return;
  }

  showLoading(true);
  map.closePopup();

  const geoSrc = lastKnownPosition
    ? Promise.resolve({ coords: { latitude: lastKnownPosition[0], longitude: lastKnownPosition[1] } })
    : new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));

  geoSrc.then(pos => {

    startCoords = [pos.coords.latitude, pos.coords.longitude];

    fetch('/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },

      // 🔥 FORCE BANGALORE CONTEXT
      body: JSON.stringify({
        place: destination + ", Bangalore, India"
      })
    })
    .then(r => r.json())
    .then(data => {

      if (!data.features || data.features.length === 0) {
        showToast("Location not found ❌", "error");
        showLoading(false);
        return;
      }

      const raw = data.features[0].geometry.coordinates;

      // ✅ FIX COORD ORDER
      destinationCoords = [parseFloat(raw[1]), parseFloat(raw[0])];

      console.log("✅ START:", startCoords);
      console.log("✅ DEST:", destinationCoords);

      // ❗ SAFETY CHECK (Bangalore lat ~ 12–13)
      if (destinationCoords[0] > 20 || destinationCoords[0] < 5) {
        showToast("Wrong location detected ❌", "error");
        showLoading(false);
        return;
      }

      fetchAndDrawRoutes(startCoords, destinationCoords);
      showParkingOptions(startCoords, destinationCoords);
      checkTempleProximity(destinationCoords);
      aiAnalyzeTraffic(startCoords, destinationCoords);

    })
    .catch(() => {
      showToast("Geocode failed ❌", "error");
      showLoading(false);
    });

  }).catch(() => {
    showToast("Location access denied ❌", "error");
  });
};

// ================================================================
// FETCH ROUTES
// ================================================================
function fetchAndDrawRoutes(start, end, aiRouteData) {

  console.log("🚀 fetchAndDrawRoutes called", start, end);

  fetch('/get-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end })
  })
  .then(r => r.json())
  .then(data => {

    console.log("Route API response:", data);

    showLoading(false);

    if (!data.routes || data.routes.length === 0) {
      showToast("No routes found ❌", "error");
      return;
    }

    // 🔥 CLEAR OLD
    routeLayers.forEach(l => map.removeLayer(l));
    routeLayers = [];
    currentRoutes = [];

    if (typeof heatLayer !== "undefined" && heatLayer) {
      map.removeLayer(heatLayer);
    }

    // 🎯 DRAW ROUTES
    data.routes.forEach((apiRoute, idx) => {

      let coords;

      if (Array.isArray(apiRoute.geometry)) {
        coords = apiRoute.geometry.map(c => [c[1], c[0]]); // ✅ FIX
      } else {
        coords = safeDecode(apiRoute.geometry);
        coords = coords.map(c => [c[1], c[0]]); // ✅ FIX
      }

      if (!coords || coords.length < 2) return;

      const distance = apiRoute.distance || apiRoute.summary?.distance || 5000;
      const duration = apiRoute.duration || apiRoute.summary?.duration || 600;

      const color = ['#EA4335', '#34A853', '#4285F4'][idx % 3];

      // 🔥 GLOW
      const glow = L.polyline(coords, {
        color: color,
        weight: 14,
        opacity: 0.2
      }).addTo(map);

      // 🔥 MAIN ROUTE
      const line = L.polyline(coords, {
        color: color,
        weight: 7,
        opacity: 1
      }).addTo(map);

      setTimeout(() => {
        glow.bringToFront();
        line.bringToFront();
      }, 100);

      routeLayers.push(glow, line);

      currentRoutes.push({
        coords,
        line,
        glowLine: glow,
        distKm: (distance / 1000).toFixed(1),
        timeMin: Math.round(duration / 60),
        label: ROUTE_META[idx]?.label || `Route ${idx + 1}`,
        color,
        congestion: ROUTE_META[idx]?.congestion || "medium",
        rewardPoints: ROUTE_META[idx]?.pts || 50,
        steps: buildSteps(coords, distance / 1000, duration / 60)
      });

    });

    // 🔥 FIT MAP
    const allCoords = currentRoutes.flatMap(r => r.coords);
    map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });

    // 🔥 HEATMAP (ONLY MAIN ROUTE)
    if (currentRoutes[0]) {
      showRouteHeatmap(currentRoutes[0].coords);
    }

    renderRouteCards(0);
    selectRoute(0);

    showToast("Route drawn ✅", "success");

  })
  .catch(err => {
    console.error(err);
    showToast("Route fetch failed ❌", "error");
  });
}
// ================================================================
// SELECT ROUTE
// ================================================================
function selectRoute(index) {
  if (!currentRoutes[index]) return;

  currentRoutes.forEach((r, i) => {
    const active = (i === index);
    r.line.setStyle({ color: active ? r.color : '#aaaaaa', weight: active ? 7 : 3, opacity: active ? 0.95 : 0.3 });
    if (r.glowLine) {
        r.glowLine.setStyle({ color: r.color, weight: 16, opacity: active ? 0.15 : 0 });
    }
    if (active) { r.line.bringToFront(); r.glowLine.bringToFront(); r.line.bringToFront(); }
  });

  document.querySelectorAll('.route-card').forEach((card, i) => card.classList.toggle('selected', i === index));

  const sel = currentRoutes[index];
  showRouteHeatmap(sel.coords);

  const mid = sel.coords[Math.floor(sel.coords.length / 2)];
  const congIcon = { low:'🟢', medium:'🟡', high:'🔴' }[sel.congestion];

  L.popup({ closeButton:false, offset:[0,-6] })
    .setLatLng(mid)
    .setContent(`
      <div style="font-family:'DM Sans',sans-serif;padding:2px;min-width:180px">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#e6edf3">
          ${sel.label} ${sel.aiTag ? `<span style="font-size:10px;background:#FBBC04;color:#1a1200;padding:2px 6px;border-radius:20px;margin-left:4px">${sel.aiTag}</span>` : ''}
        </div>
        <div style="display:flex;gap:14px;font-size:13px;color:#8b949e;margin-bottom:8px">
          <span>📏 ${sel.distKm} km</span>
          <span>⏱️ ${sel.timeMin} min</span>
          <span>${congIcon} ${sel.congestion}</span>
        </div>
        <div style="background:rgba(52,168,83,0.15);border:1px solid rgba(52,168,83,0.3);
             border-radius:6px;padding:5px 9px;font-size:12px;color:#34A853;font-weight:700">
          🌿 Choose this → +${sel.rewardPoints} pts
        </div>
      </div>
    `)
    .openOn(map);
}

// ================================================================
// RENDER ROUTE CARDS
// ================================================================
function renderRouteCards(recommended = 0) {
  const container = document.getElementById('route-cards');
  if (!container) return;
  container.innerHTML = '';

  document.getElementById('routes-empty').style.display = 'none';
  document.getElementById('route-list-section').style.display = 'block';

  const congestionInfo = {
    low:    { label:'Light Traffic', color:'#34A853', icon:'🟢' },
    medium: { label:'Moderate',      color:'#FBBC04', icon:'🟡' },
    high:   { label:'Heavy Traffic', color:'#EA4335', icon:'🔴' }
  };

  currentRoutes.forEach((route, idx) => {
    const c    = congestionInfo[route.congestion];
    const isRec = idx === recommended;
    const card = document.createElement('div');
    card.className = 'route-card' + (isRec ? ' selected' : '');
    card.dataset.index = idx;
    card.innerHTML = `
      <div class="route-card-header">
        <span class="route-dot" style="background:${route.color}"></span>
        <span class="route-label">${route.label}</span>
        ${isRec ? '<span class="best-tag">RECOMMENDED</span>' : ''}
        ${route.aiTag ? `<span class="ai-reroute-tag">🤖 ${route.aiTag}</span>` : ''}
      </div>
      <div class="route-meta">
        <div class="route-stat"><span class="stat-val">${route.distKm}</span><span class="stat-unit"> km</span></div>
        <div class="route-stat"><span class="stat-val">${route.timeMin}</span><span class="stat-unit"> min</span></div>
        <div class="route-stat" style="color:${c.color};font-size:12px;font-weight:700">
          ${c.icon} ${c.label}
        </div>
      </div>
      <div class="route-reward">
        <span class="reward-pts">+${route.rewardPoints} pts</span>
        <span class="reward-desc">Accept to earn</span>
      </div>
      <button class="accept-btn" onclick="acceptRoute(${idx});event.stopPropagation()">
        ✅ Accept &amp; Navigate
      </button>
    `;
    card.addEventListener('click', () => selectRoute(idx));
    container.appendChild(card);
  });
}

// ================================================================
// ACCEPT ROUTE → award points + START NAVIGATION
// ================================================================
function acceptRoute(index) {
  const route = currentRoutes[index];
  if (!route) return;

  const pts = route.rewardPoints;
  userPoints += pts;
  localStorage.setItem('dp_points', userPoints);

  const today = new Date().toDateString();
  if (lastRouteDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    userStreak = (lastRouteDate === yesterday) ? userStreak + 1 : 1;
    localStorage.setItem('dp_streak',    userStreak);
    localStorage.setItem('dp_last_route', today);
    lastRouteDate = today;
  }

  checkAndAwardBadges(route);
  updateLeaderboardSelf();
  updatePointsDisplay();
  updateStreakDisplay();
  showToast(`+${pts} points! 🎉 Navigation started`, "success");
  showCongestionImpact(route);

  // Start navigation
  activeRouteCoords = route.coords;
  navigationSteps   = route.steps || buildSteps(route.coords, route.distKm, route.timeMin);
  startNavigation(route, selectedParkingSpot ? 'to_destination' : 'to_destination');
}

// ================================================================
// NAVIGATION ENGINE
// ================================================================
function startNavigation(route, phase) {
  isNavigating     = true;
  currentStepIndex = 0;
  activeJourneyPhase = phase;

  const navPanel = document.getElementById('nav-panel');
  if (navPanel) navPanel.classList.add('active');

  renderNavSteps(route);
  updateNavHeader(0, route);

  document.getElementById('nav-total-dist').textContent = route.distKm + ' km';
  document.getElementById('nav-eta').textContent = route.timeMin + ' min';
  document.getElementById('nav-phase-badge').textContent =
    selectedParkingSpot ? `Phase ${phase === 'to_parking' ? 1 : 2} of 2` : 'Direct Route';

  switchTab('routes');
}

function renderNavSteps(route) {
  const list = document.getElementById('nav-steps-list');
  if (!list) return;
  list.innerHTML = '';
  const steps = route.steps || navigationSteps;
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'nav-step-item' + (i === 0 ? ' current' : '');
    div.id = `nav-item-${i}`;
    div.innerHTML = `<span class="nav-step-icon">${step.icon}</span>
      <div><div style="font-weight:${i===0?700:400}">${step.text}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${step.dist}</div></div>`;
    list.appendChild(div);
  });
}

function updateNavHeader(stepIdx, route) {
  const steps = route ? (route.steps || navigationSteps) : navigationSteps;
  const step  = steps[Math.min(stepIdx, steps.length - 1)];
  if (!step) return;
  document.getElementById('nav-arrow').textContent       = step.icon;
  document.getElementById('nav-current-step').textContent = step.text;
  document.getElementById('nav-dist').textContent         = step.dist;
}

function updateNavigationProgress(userCoords) {
  if (!activeRouteCoords.length || !navigationSteps.length) return;

  // Find closest point on route
  let minDist = Infinity, closestIdx = 0;
  activeRouteCoords.forEach((pt, i) => {
    const d = getDistance(userCoords, pt);
    if (d < minDist) { minDist = d; closestIdx = i; }
  });

  // Determine step progress (rough: map route point ratio to steps)
  const ratio = closestIdx / activeRouteCoords.length;
  const newStep = Math.min(Math.floor(ratio * navigationSteps.length), navigationSteps.length - 1);

  if (newStep !== currentStepIndex) {
    currentStepIndex = newStep;

    // Update list highlight
    document.querySelectorAll('.nav-step-item').forEach((el, i) => {
      el.classList.toggle('done',    i < newStep);
      el.classList.toggle('current', i === newStep);
    });

    // Scroll to current
    const cur = document.getElementById(`nav-item-${newStep}`);
    if (cur) cur.scrollIntoView({ behavior:'smooth', block:'nearest' });

    // Update header with fake route obj
    updateNavHeader(newStep, { steps: navigationSteps });
  }

  // Check if arrived at parking
  if (selectedParkingSpot && activeJourneyPhase === 'to_parking') {
    const distToParking = getDistance(userCoords, selectedParkingSpot.coords);
    if (distToParking < 0.05) { // within 50m
      arrivedAtParking();
    }
  }

  // Check if arrived at destination
  if (destinationCoords && activeJourneyPhase === 'to_destination') {
    const distToDest = getDistance(userCoords, destinationCoords);
    if (distToDest < 0.08) { // within 80m
      arrivedAtDestination();
    }
  }
}

function arrivedAtParking() {

  if (activeJourneyPhase !== 'to_parking') return;

  activeJourneyPhase = 'to_destination';

  showToast('✅ Arrived at parking! Now going to destination...', 'success');
  updateJourneyBar('to_destination');

  // 🎁 Reward
  if (selectedParkingSpot) {
    userPoints += selectedParkingSpot.rewardPts || 75;
    localStorage.setItem('dp_points', userPoints);
    updatePointsDisplay();
    updateLeaderboardSelf();
  }

  if (!destinationCoords || !selectedParkingSpot) return;

  fetch('/get-route', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      start: selectedParkingSpot.coords,
      end: destinationCoords
    })
  })
  .then(r => r.json())
  .then(data => {

    if (!data.routes || !data.routes[0]) return;

    let coords = safeDecode(data.routes[0].geometry);

    // ✅ FIX COORDS
    coords = coords.map(c => [c[1], c[0]]);

    activeRouteCoords = coords;
    navigationSteps = buildSteps(coords, 5, 10);

    updateNavHeader(0, { steps: navigationSteps });

  });
}

function arrivedAtDestination() {
  showToast('🏁 You have arrived at your destination!', 'success');
  endNavigation();

  // Award arrival bonus
  userPoints += 50;
  localStorage.setItem('dp_points', userPoints);
  updatePointsDisplay();
  updateLeaderboardSelf();

  if (!badges.includes('arrived_safely')) {
    badges.push('arrived_safely');
    localStorage.setItem('dp_badges', JSON.stringify(badges));
  }
}

function endNavigation() {
  isNavigating         = false;
  activeJourneyPhase   = null;
  navigationSteps      = [];
  currentStepIndex     = 0;
  activeRouteCoords    = [];

  const navPanel = document.getElementById('nav-panel');
  if (navPanel) navPanel.classList.remove('active');

  const journeyBar = document.getElementById('journey-bar');
  if (journeyBar) journeyBar.classList.remove('active');

  clearIllegalParkingWatch();
  showToast('Navigation ended', 'info');
}

// ================================================================
// JOURNEY BAR
// ================================================================
function updateJourneyBar(phase) {
  const bar = document.getElementById('journey-bar');
  if (!bar) return;
  bar.classList.add('active');

  const s1 = document.getElementById('jb-step1');
  const s2 = document.getElementById('jb-step2');
  const s3 = document.getElementById('jb-step3');
  const lbl = document.getElementById('jb-phase-label');
  const dest = document.getElementById('jb-dest-label');

  if (phase === 'to_parking') {
    lbl.textContent  = 'Phase 1 of 2 · To Parking';
    dest.textContent = selectedParkingSpot ? `🅿️ ${selectedParkingSpot.name}` : '🅿️ Parking';
    s1.className = 'jb-step active';
    s2.className = 'jb-step';
    s3.className = 'jb-step';
  } else {
    lbl.textContent  = 'Phase 2 of 2 · To Destination';
    dest.textContent = `🏁 ${document.getElementById('destination').value || 'Destination'}`;
    s1.className = 'jb-step done';
    s2.className = 'jb-step done';
    s3.className = 'jb-step active';
  }
}

// ================================================================
// ILLEGAL PARKING DETECTION
// ================================================================
function startIllegalParkingWatch(userCoords) {
  clearIllegalParkingWatch();
  let stationaryStart = Date.now();
  let lastPos = userCoords;

  illegalParkingTimer = setInterval(() => {
    if (!lastKnownPosition) return;

    const moved = getDistance(lastPos, lastKnownPosition);
    if (moved < 0.005) { // less than 5m movement
      const stoppedFor = (Date.now() - stationaryStart) / 60000; // minutes

      if (stoppedFor > 3 && !nearParkingZone) {
        // User has been stationary 3+ min and not near a parking zone → illegal parking
        applyParkingPenalty();
        stationaryStart = Date.now(); // reset timer so penalty fires once per 5 min
      }
    } else {
      stationaryStart = Date.now();
      lastPos = [...lastKnownPosition];
    }
  }, 30000); // check every 30s
}

function checkIllegalParking(coords) {
  // Check if user is near any parking spot
  const spots = parkingMarkers
    .map(m => m.getLatLng ? [m.getLatLng().lat, m.getLatLng().lng] : null)
    .filter(Boolean);
  nearParkingZone = spots.some(sp => getDistance(coords, sp) < 0.1);
}

function applyParkingPenalty() {
  const penalty = 50;
  userPoints = Math.max(0, userPoints - penalty);
  localStorage.setItem('dp_points', userPoints);
  updatePointsDisplay();
  updateLeaderboardSelf();

  showPenaltyToast(penalty);
  showToast(`-${penalty} pts: Illegal parking detected ⚠️`, 'error');
}

function showPenaltyToast(pts) {
  const el = document.createElement('div');
  el.className = 'penalty-toast';
  el.innerHTML = `
    <div class="penalty-icon">⚠️</div>
    <div class="penalty-body">
      <div class="penalty-title">Illegal Parking Detected!</div>
      <div class="penalty-sub">-${pts} points penalty applied.<br>Use designated parking areas.</div>
    </div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 5000);
}

function clearIllegalParkingWatch() {
  if (illegalParkingTimer) { clearInterval(illegalParkingTimer); illegalParkingTimer = null; }
}

// ================================================================
// PARKING SELECTION → TWO-PHASE ROUTING
// ================================================================
const PARK_NAMES = [
  'Garuda Mall Parking', 'Forum Mall P2', 'UB City Basement',
  'Mantri Square P3', 'Central Parking Hub', 'EcoSmart Park A',
  'Phoenix Market City', 'Orion Mall P3'
];

function generateParkingSpots(start, destination, routeCoords = []) {

    let spots = [];

    // 🎯 1. PARKING NEAR DESTINATION (70%)
    for (let i = 0; i < 5; i++) {
        let lat = destination[0] + (Math.random() - 0.5) * 0.01;
        let lng = destination[1] + (Math.random() - 0.5) * 0.01;

        spots.push({
            name: "Parking Near Destination",
            coords: [lat, lng],
            price: Math.floor(Math.random() * 40) + 20,
            slots: Math.floor(Math.random() * 50) + 5,
            rewardPts: 50
        });
    }

    // 🛣️ 2. PARKING ALONG ROUTE (30%)
    if (routeCoords && routeCoords.length > 0) {

        for (let i = 0; i < 3; i++) {

            let idx = Math.floor(Math.random() * routeCoords.length);
            let point = routeCoords[idx];

            let lat = point[0] + (Math.random() - 0.5) * 0.003;
            let lng = point[1] + (Math.random() - 0.5) * 0.003;

            spots.push({
                name: "Parking Along Route",
                coords: [lat, lng],
                price: Math.floor(Math.random() * 40) + 20,
                slots: Math.floor(Math.random() * 50) + 5,
                rewardPts: 70
            });
        }
    }

    return spots;
}

function showParkingOptions(start, destination) {
  parkingMarkers.forEach(m => map.removeLayer(m));
  parkingMarkers = [];

  const routeCoords = currentRoutes[0]?.coords || [];
  const spots = generateParkingSpots(start, destination, routeCoords);
  const container = document.getElementById('parking-cards');
  if (container) container.innerHTML = '';

  spots.forEach((spot, i) => {
    const parkIcon = L.divIcon({
      className: '',
      html: `<div style="background:#161b22;color:white;font-size:11px;font-weight:700;
             padding:4px 8px;border-radius:8px;border:2px solid #4285F4;
             white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🅿️ ₹${spot.price}</div>`,
      iconSize:[72,28], iconAnchor:[36,14]
    });

    const marker = L.marker(spot.coords, { icon: parkIcon }).addTo(map);
    parkingMarkers.push(marker);

    marker.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;min-width:190px">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px">${spot.name}</div>
        <div style="font-size:13px;line-height:2.1">
          💰 ₹${spot.price}/hr
          ${spot.discount ? `<span style="background:#22c55e;color:white;font-size:10px;
            padding:1px 5px;border-radius:4px;margin-left:4px">${spot.discount}</span>` : ''}<br>
          🅿️ ${spot.slots} slots available<br>
          🎁 +${spot.rewardPts} pts on check-in
        </div>
        <button onclick="selectParkingAndNavigate([${start}],[${spot.coords}],
          ${spot.price},'${spot.name}',${spot.rewardPts},[${destination}])"
          style="margin-top:8px;width:100%;background:#4285F4;color:white;border:none;
          border-radius:8px;padding:8px;font-weight:700;cursor:pointer;font-size:13px">
          🗺️ Navigate via this Parking
        </button>
      </div>
    `);

    if (container) {
      const card = document.createElement('div');
      card.className = 'parking-card';
      card.innerHTML = `
        <div class="pk-header">
          <span class="pk-name">${spot.name}</span>
          ${spot.discount ? `<span class="pk-discount">${spot.discount}</span>` : ''}
        </div>
        <div class="pk-meta">
          <span>💰 ₹${spot.price}/hr</span>
          <span>🅿️ ${spot.slots} slots</span>
          <span class="pk-pts">+${spot.rewardPts} pts</span>
        </div>
        <button class="pk-nav-btn" onclick="map.flyTo([${spot.coords}],16);parkingMarkers[${i}].openPopup();">
          👁 View on Map
        </button>
        <button class="pk-nav-full-btn" onclick="selectParkingAndNavigate(
          [${start}],[${spot.coords}],${spot.price},'${spot.name}',${spot.rewardPts},
          [${destination}])">
          🗺️ Navigate: Here → Parking → Destination
        </button>
      `;
      container.appendChild(card);
    }
  });
}

// ── The main two-phase navigation trigger ────────────────────────
function selectParkingAndNavigate(start, parkingCoords, price, name, rewardPts, destination) {

  selectedParkingSpot = { coords: parkingCoords, name, price, rewardPts };

  // 🔥 CLEAR OLD
  if (parkingRouteLayer) map.removeLayer(parkingRouteLayer);
  if (destRouteLayer) map.removeLayer(destRouteLayer);
  if (parkingDestMarker) map.removeLayer(parkingDestMarker);

  // 🔥 MARK SELECTED PARKING
  parkingMarkers.forEach(m => {
    const ll = m.getLatLng();
    if (Math.abs(ll.lat - parkingCoords[0]) < 0.0001 &&
        Math.abs(ll.lng - parkingCoords[1]) < 0.0001) {
      m.setIcon(parkingSelectedIcon);
    }
  });

  // 🔥 PARKING LABEL
  parkingDestMarker = L.marker(parkingCoords, {
    icon: L.divIcon({
      className: '',
      html: `<div style="background:#22c55e;color:white;padding:5px 10px;border-radius:10px;
        font-weight:800;font-size:12px;border:2px solid white">
        🅿️ ${name}</div>`
    })
  }).addTo(map);

  // 🚀 ROUTE 1: START → PARKING
  fetch('/get-route', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ start, end: parkingCoords })
  })
  .then(r => r.json())
  .then(data => {

    if (!data.routes || !data.routes[0]) return;

    let coords1 = safeDecode(data.routes[0].geometry);

    // ✅ FIX LAT/LNG
    coords1 = coords1.map(c => [c[1], c[0]]);

    // 🔥 DRAW ROUTE
    parkingRouteLayer = L.polyline(coords1, {
      color:'#22c55e',
      weight:7,
      opacity:1,
      dashArray:'10,6'
    }).addTo(map);

    const d1 = (data.routes[0].summary.distance / 1000).toFixed(1);
    const t1 = Math.round(data.routes[0].summary.duration / 60);

    // 🚀 ROUTE 2: PARKING → DESTINATION
    fetch('/get-route', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ start: parkingCoords, end: destination })
    })
    .then(r2 => r2.json())
    .then(data2 => {

      if (!data2.routes || !data2.routes[0]) return;

      let coords2 = safeDecode(data2.routes[0].geometry);

      // ✅ FIX LAT/LNG
      coords2 = coords2.map(c => [c[1], c[0]]);

      destRouteLayer = L.polyline(coords2, {
        color:'#4285F4',
        weight:7,
        opacity:1
      }).addTo(map);

      // 🔥 BRING TO FRONT
      parkingRouteLayer.bringToFront();
      destRouteLayer.bringToFront();

      const d2 = (data2.routes[0].summary.distance / 1000).toFixed(1);
      const t2 = Math.round(data2.routes[0].summary.duration / 60);

      // 🔥 FIT MAP
      const allPts = [...coords1, ...coords2];
      map.fitBounds(L.latLngBounds(allPts), { padding:[60,60] });

      showToast("🗺️ Full route ready (via parking)", "success");

      // OPTIONAL: update nav panel
      showTwoPhaseDirections(coords1, coords2, d1, t1, d2, t2, name);

    });

  })
  .catch(() => showToast('Route failed ❌', 'error'));

  switchTab('routes');
  updateJourneyBar('to_parking');
  startIllegalParkingWatch(start);
}
function beginTwoPhaseNavigation(start, parkingCoords, destination) {
  map.closePopup();
  showToast('▶ Navigation started! Follow the green route to parking.', 'success');
  isNavigating = true;
  activeJourneyPhase = 'to_parking';
  updateJourneyBar('to_parking');

  // Fetch directions steps for phase 1
  fetch('/get-route', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ start, end: parkingCoords })
  })
  .then(r => r.json())
  .then(data => {
    if (data.routes && data.routes[0]) {
      const coords = safeDecode(data.routes[0].geometry);
      coords = safeDecode(altRoute.geometry);
      coords = coords.map(c => [c[1], c[0]]); // ✅ FIX
      const d = (data.routes[0].summary.distance/1000).toFixed(1);
      const t = Math.round(data.routes[0].summary.duration/60);
      activeRouteCoords = coords;
      navigationSteps   = buildSteps(coords, d, t);

      const navPanel = document.getElementById('nav-panel');
      if (navPanel) navPanel.classList.add('active');

      renderNavSteps({ steps: navigationSteps });
      document.getElementById('nav-total-dist').textContent = d + ' km';
      document.getElementById('nav-eta').textContent        = t + ' min';
      document.getElementById('nav-phase-badge').textContent = 'Phase 1 of 2';
      updateNavHeader(0, { steps: navigationSteps });

      switchTab('routes');
    }
  });
}

function showTwoPhaseDirections(coords1, coords2, d1, t1, d2, t2, parkingName) {
  const steps1 = buildSteps(coords1, d1, t1);
  const steps2 = buildSteps(coords2, d2, t2);

  const list = document.getElementById('nav-steps-list');
  if (!list) return;
  list.innerHTML = '';

  // Phase 1 header
  const ph1 = document.createElement('div');
  ph1.style.cssText = 'padding:6px 14px;font-size:11px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:.8px;background:rgba(34,197,94,0.08);border-bottom:1px solid rgba(34,197,94,0.15)';
  ph1.textContent = `🟢 Phase 1 · To ${parkingName}`;
  list.appendChild(ph1);

  steps1.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'nav-step-item' + (i === 0 ? ' current' : '');
    div.innerHTML = `<span class="nav-step-icon">${step.icon}</span>
      <div><div>${step.text}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${step.dist}</div></div>`;
    list.appendChild(div);
  });

  // Phase 2 header
  const ph2 = document.createElement('div');
  ph2.style.cssText = 'padding:6px 14px;font-size:11px;font-weight:700;color:#4285F4;text-transform:uppercase;letter-spacing:.8px;background:rgba(66,133,244,0.08);border-top:1px solid rgba(66,133,244,0.15);margin-top:4px;border-bottom:1px solid rgba(66,133,244,0.15)';
  ph2.textContent = '🔵 Phase 2 · To Destination';
  list.appendChild(ph2);

  steps2.forEach((step) => {
    const div = document.createElement('div');
    div.className = 'nav-step-item';
    div.style.opacity = '.5';
    div.innerHTML = `<span class="nav-step-icon">${step.icon}</span>
      <div><div>${step.text}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${step.dist}</div></div>`;
    list.appendChild(div);
  });

  const navPanel = document.getElementById('nav-panel');
  if (navPanel) navPanel.classList.add('active');
  document.getElementById('nav-total-dist').textContent = (parseFloat(d1)+parseFloat(d2)).toFixed(1) + ' km';
  document.getElementById('nav-eta').textContent = (t1 + t2) + ' min';
  document.getElementById('nav-phase-badge').textContent = '2-Phase Route';
  document.getElementById('nav-arrow').textContent = steps1[0]?.icon || '↑';
  document.getElementById('nav-current-step').textContent = steps1[0]?.text || 'Head to parking';
  document.getElementById('nav-dist').textContent = steps1[0]?.dist || '--';
}

// ================================================================
// LEGACY selectParking (keep backward compat from popup)
// ================================================================
function selectParking(start, parkingCoords, price, name, rewardPts) {
  selectParkingAndNavigate(start, parkingCoords, price, name, rewardPts, destinationCoords || parkingCoords);
}

// ================================================================
// AI TRAFFIC ANALYSIS (via Claude API)
// ================================================================
async function aiAnalyzeTraffic(start, end) {
  const now    = new Date();
  const hour   = now.getHours();
  const day    = now.toLocaleDateString('en-US', { weekday:'long' });
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

  const prompt = `You are an AI traffic analyst for Bengaluru, India. Analyze current traffic conditions.

Current time: ${timeStr} on a ${day}
Origin area: near coordinates ${start[0].toFixed(3)},${start[1].toFixed(3)}
Destination area: near coordinates ${end[0].toFixed(3)},${end[1].toFixed(3)}

Based on typical Bengaluru traffic patterns for this time:
1. Rate overall congestion: low/medium/high/extreme
2. Estimate delay in minutes above normal travel time
3. Identify the top traffic hotspot between these areas (road name)
4. Give a 1-sentence actionable recommendation

Respond ONLY in this exact JSON format (no preamble):
{"congestion":"medium","delayMinutes":8,"hotspot":"Silk Board Junction","recommendation":"Take the Outer Ring Road to avoid peak hour congestion near Electronic City."}`;

  try {
    const resp = await fetch('/ai-traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role:'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const text = data.content?.map(b => b.text||'').join('').replace(/```json|```/g,'').trim();
    const ai   = JSON.parse(text);

    updateAITrafficBanner(ai);
    applyAITrafficToRoutes(ai);
  } catch(e) {
    console.log('AI traffic analysis unavailable, using simulated data');
    const simulated = simulateTrafficData(hour);
    updateAITrafficBanner(simulated);
    applyAITrafficToRoutes(simulated);
  }
}

function simulateTrafficData(hour) {
  // Simulate realistic Bengaluru traffic patterns
  const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
  const isMidDay = hour >= 11 && hour <= 15;
  const congestion = isPeak ? 'high' : isMidDay ? 'medium' : 'low';
  const delay = isPeak ? 12 + Math.floor(Math.random()*8) : isMidDay ? 5 + Math.floor(Math.random()*5) : 2;
  const hotspots = ['Silk Board Junction','Marathahalli Bridge','KR Puram','Hebbal Flyover','Electronic City Toll'];
  return {
    congestion,
    delayMinutes: delay,
    hotspot: hotspots[Math.floor(Math.random() * hotspots.length)],
    recommendation: isPeak
      ? 'Heavy peak hour traffic detected. Eco route via ORR recommended.'
      : 'Moderate traffic. All routes viable.'
  };
}

function updateAITrafficBanner(ai) {
  const banner = document.getElementById('ai-traffic-banner');
  if (!banner) return;

  const icon = { low:'🟢', medium:'🟡', high:'🔴', extreme:'🆘' }[ai.congestion] || '🟡';
  document.getElementById('ai-traffic-msg').innerHTML =
    `${icon} <b>${ai.congestion.toUpperCase()}</b> congestion · +${ai.delayMinutes} min delay<br>
    ⚠️ Hotspot: <b>${ai.hotspot}</b><br>
    💡 ${ai.recommendation}`;

  if (ai.congestion === 'high' || ai.congestion === 'extreme' || ai.delayMinutes > 5) {
    banner.classList.add('active');
  }
}

function applyAITrafficToRoutes(ai) {
  // Update route cards congestion & ETA based on AI data
  currentRoutes.forEach((route, idx) => {
    if (idx === 0 && ai.delayMinutes > 0) {
      route.timeMin  += ai.delayMinutes;
      route.congestion = ai.congestion === 'extreme' ? 'high' : ai.congestion;
      route.aiTag      = ai.congestion === 'high' || ai.congestion === 'extreme' ? 'AI-CONGESTED' : '';
    } else if (idx === 1) {
      route.timeMin += Math.round(ai.delayMinutes * 0.4); // eco route less affected
      route.aiTag    = ai.congestion === 'low' ? 'AI-OPTIMAL' : '';
    }
  });
  if (currentRoutes.length > 0) renderRouteCards(1);
}

async function aiRefreshTraffic() {
  if (!startCoords || !destinationCoords) return;
  showToast('🤖 AI refreshing traffic data...', 'info');
  await aiAnalyzeTraffic(startCoords, destinationCoords);
}

// ================================================================
// DIJKSTRA RE-ROUTING (AI-triggered)
// ================================================================
async function aiRerouteDijkstra() {

  if (!startCoords || !destinationCoords) {
    showToast('Search a route first to enable re-routing ❌', 'error');
    return;
  }

  showToast('🤖 AI Dijkstra rerouting...', 'info');

  const banner = document.getElementById('ai-traffic-banner');
  if (banner) {
    document.getElementById('ai-traffic-msg').textContent =
      '⚡ Calculating optimal route using AI...';
  }

  // 🧠 AI PROMPT
  const prompt = `You are a traffic-aware routing AI for Bengaluru.
From: ${startCoords}
To: ${destinationCoords}

Suggest best alternate route avoiding congestion.

Respond JSON only:
{"avoidArea":"Silk Board","suggestedVia":"Outer Ring Road","expectedDelaySaving":10}`;

  let aiData;

  try {
    // ✅ CALL YOUR BACKEND (NO CORS ISSUE)
    const resp = await fetch('/ai-traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await resp.json();

    const text = data.content?.map(b => b.text || '').join('')
      .replace(/```json|```/g, '')
      .trim();

    aiData = JSON.parse(text);

  } catch (err) {
    console.log("AI failed → using fallback");

    // ✅ SAFE FALLBACK
    aiData = {
      avoidArea: 'Silk Board Junction',
      suggestedVia: 'Outer Ring Road',
      expectedDelaySaving: 8
    };
  }

  // 🚀 FETCH NEW ROUTE
  fetch('/get-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start: startCoords, end: destinationCoords })
  })
  .then(r => r.json())
  .then(data => {

    if (!data.routes || data.routes.length === 0) {
      showToast("No alternate routes found ❌", "error");
      return;
    }

    // 🔥 PICK LAST ROUTE AS ALTERNATIVE
    const altRoute = data.routes[data.routes.length - 1];

    let coords;

    // ✅ HANDLE BOTH FORMATS
    if (typeof altRoute.geometry === "string") {
      coords = safeDecode(altRoute.geometry);
      coords = coords.map(c => [c[1], c[0]]);
    } else {
      coords = altRoute.geometry;
    }

    if (!coords || coords.length < 2) {
      showToast("Invalid route data ❌", "error");
      return;
    }

    const distance = altRoute.distance || altRoute.summary?.distance || 5000;
    const duration = altRoute.duration || altRoute.summary?.duration || 600;

    const distKm = (distance / 1000).toFixed(1);
    const baseTime = Math.round(duration / 60);
    const saved = aiData.expectedDelaySaving || 8;

    // ⏱️ Adjusted time after AI optimization
    const finalTime = Math.max(baseTime - saved, Math.round(baseTime * 0.8));

    const routeColor = '#a855f7'; // purple AI route

    // 🔥 DRAW GLOW
    const glowLine = L.polyline(coords, {
      color: routeColor,
      weight: 14,
      opacity: 0.15
    }).addTo(map);

    // 🔥 DRAW MAIN ROUTE
    const line = L.polyline(coords, {
      color: routeColor,
      weight: 7,
      opacity: 1
    }).addTo(map);

    // 🔥 ENSURE ON TOP
    glowLine.bringToFront();
    line.bringToFront();

    routeLayers.push(glowLine, line);

    // 🧭 BUILD STEPS
    const steps = buildSteps(coords, distKm, finalTime);

    // 📦 STORE ROUTE
    currentRoutes.push({
      coords,
      line,
      glowLine,
      distKm,
      timeMin: finalTime,
      congestion: 'low',
      label: 'AI Optimized Route',
      color: routeColor,
      rewardPoints: 150,
      aiTag: 'AI-DIJKSTRA',
      steps
    });

    const newIndex = currentRoutes.length - 1;

    // 🖱 CLICK HANDLER
    line.on("click", () => selectRoute(newIndex));
    glowLine.on("click", () => selectRoute(newIndex));

    // 🎯 UPDATE UI
    renderRouteCards(newIndex);
    selectRoute(newIndex);

    // 🔥 UPDATE BANNER
    if (banner) {
      document.getElementById('ai-traffic-msg').innerHTML = `
        ✅ <b>AI Route Ready</b><br>
        Via: ${aiData.suggestedVia}<br>
        ⏱ Save ~${saved} min
      `;
    }

    showToast(`⚡ AI route ready! Save ~${saved} min`, 'success');

  })
  .catch(err => {
    console.error(err);
    showToast("AI reroute failed ❌", "error");
  });
}
// ================================================================
// TEMPLE CROWD / FESTIVAL AI DETECTION
// ================================================================
async function checkTempleProximity(destCoords) {
  if (!destCoords) return;

  // Check if destination is near a temple hotspot
  const nearbyTemples = TEMPLE_HOTSPOTS.filter(t =>
    getDistance(destCoords, t.coords) < (t.radius + 0.5)
  );

  if (nearbyTemples.length === 0) return;

  // Check festival calendar
  const todayStr = new Date().toISOString().split('T')[0];
  const todayFestival = FESTIVAL_CALENDAR.find(f => {
    const diff = Math.abs(new Date(f.date) - new Date(todayStr)) / 86400000;
    return diff <= 1; // ±1 day
  });

  const templeNames = nearbyTemples.map(t => t.name).join(', ');
  await aiCheckTempleCrowd(templeNames, todayFestival, nearbyTemples[0]);
}

async function checkFestivalCrowd() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayFestival = FESTIVAL_CALENDAR.find(f => {
    const diff = Math.abs(new Date(f.date) - new Date(todayStr)) / 86400000;
    return diff <= 2;
  });

  if (todayFestival && !crowdAlertShown) {
    showCrowdAlertBanner(
      `🎉 ${todayFestival.name} Alert`,
      `Major festival detected (${todayFestival.name}). Crowd levels expected: <b>${todayFestival.crowd.toUpperCase()}</b>. All temple-adjacent routes will have extra delays. Eco routes strongly recommended today.`
    );
    crowdAlertShown = true;
  }
}

async function aiCheckTempleCrowd(templeNames, festival, primaryTemple) {

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  const festivalContext = festival
    ? `Today is ${festival.name}, a major festival. Expected crowd: ${festival.crowd}.`
    : 'No major festival today.';

  const prompt = `You are a crowd intelligence AI for Bengaluru religious sites.

Temples near destination: ${templeNames}
Current: ${timeStr} on ${dateStr}
${festivalContext}

Analyze crowd conditions and routing impact. Respond ONLY in JSON:
{"crowdLevel":"high","impactRadius":0.8,"expectedDelay":15,"avoidanceRoute":"Take Inner Ring Road, avoid temple street","alert":"Heavy crowd expected near ISKCON due to weekend evening prayers.","parkingAdvice":"All parking within 500m of temple full. Use Smart City Parking on 2nd Cross."}`;

  try {
    // ✅ CALL BACKEND (NO CORS)
    const resp = await fetch('/ai-traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await resp.json();
    console.log("AI response:", data);

    // ✅ EXTRACT TEXT SAFELY
    const text = data.content?.map(b => b.text || '').join('')
      .replace(/```json|```/g, '')
      .trim();

    const ai = JSON.parse(text);

    // 🚨 APPLY AI RESULT
    if (ai.crowdLevel !== 'low') {

      showCrowdAlertBanner(
        `🛕 Crowd Alert: ${templeNames}`,
        `${ai.alert}<br>
         <b>🚗 Route advice:</b> ${ai.avoidanceRoute}<br>
         <b>🅿️ Parking:</b> ${ai.parkingAdvice}<br>
         <span style="color:#FBBC04">+${ai.expectedDelay} min expected delay</span>`
      );

      // 🎯 BOOST ROUTE REWARD
      if (currentRoutes.length > 1) {
        currentRoutes[1].rewardPoints += 30;
        currentRoutes[1].aiTag = 'CROWD-AVOID';
        renderRouteCards(1);
      }
    }

  } catch (e) {

    console.log("AI failed → using fallback", e);

    // ✅ FALLBACK USING FESTIVAL DATA
    if (festival) {
      showCrowdAlertBanner(
        `🛕 Crowd Alert: ${templeNames}`,
        `${festival.name} is today — elevated crowd expected near ${templeNames}.<br>
         <b>🚗 Recommendation:</b> Use alternate roads and avoid peak hours.<br>
         <b>🅿️ Tip:</b> Book parking early.`
      );
    }
  }
}

function showCrowdAlertBanner(title, msg) {
  const banner = document.getElementById('crowd-alert-banner');
  if (!banner) return;
  document.getElementById('crowd-alert-title').textContent = title;
  document.getElementById('crowd-alert-msg').innerHTML = msg;
  banner.classList.add('active');
  setTimeout(() => banner.classList.remove('active'), 30000);
}

// ================================================================
// HEATMAP
// ================================================================
function showRouteHeatmap(coords) {
  const heatData = [];
  coords.forEach(pt => {
    const intensity = Math.random() * 1.5;
    for (let i = 0; i < 3; i++) {
      heatData.push([
        pt[0] + (Math.random()-0.5)*0.001,
        pt[1] + (Math.random()-0.5)*0.001,
        intensity
      ]);
    }
  });
  if (window.heatLayer) map.removeLayer(window.heatLayer);
  window.heatLayer = L.heatLayer(heatData, {
    radius:22, blur:16,
    gradient:{ 0.3:'#00b4d8', 0.6:'#f59e0b', 1.0:'#ef4444' }
  }).addTo(map);
}

// ================================================================
// CONGESTION IMPACT MODAL
// ================================================================
function showCongestionImpact(route) {
  const impact = Math.floor(route.rewardPoints * 1.2);
  const modal  = document.getElementById('impact-modal');
  document.getElementById('impact-val').textContent   = impact + '%';
  document.getElementById('impact-pts').textContent   = '+' + route.rewardPoints + ' pts';
  document.getElementById('impact-route').textContent = route.label;
  modal.classList.add('show');
  setTimeout(() => modal.classList.remove('show'), 4000);
}

// ================================================================
// BADGES
// ================================================================
const BADGE_DEFS = [
  { id:'first_route',  icon:'🗺️', name:'Pathfinder',     desc:'First route taken'           },
  { id:'eco_hero',     icon:'🚦', name:'Traffic Hero',   desc:'Chose a low-traffic route'   },
  { id:'streak_3',     icon:'🔥', name:'3-Day Streak',   desc:'3 days in a row'             },
  { id:'pt_500',       icon:'⭐', name:'Point Master',   desc:'500 points earned'           },
  { id:'smart_park',   icon:'🅿️', name:'Smart Parker',   desc:'Used a smart parking spot'   },
  { id:'pt_1000',      icon:'💎', name:'Legend',         desc:'1000 points earned'          },
  { id:'dijkstra',     icon:'⚡', name:'Route Hacker',   desc:'Used AI Dijkstra reroute'    },
  { id:'festival_nav', icon:'🛕', name:'Festival Pilot', desc:'Navigated during a festival' },
];

function checkAndAwardBadges(route) {
  const newBadges = [];
  const add = id => { if (!badges.includes(id)) { badges.push(id); newBadges.push(BADGE_DEFS.find(b=>b.id===id)); } };

  add('first_route');
  if (route.congestion === 'low')         add('eco_hero');
  if (userStreak >= 3)                    add('streak_3');
  if (userPoints >= 500)                  add('pt_500');
  if (userPoints >= 1000)                 add('pt_1000');
  if (route.aiTag === 'AI-DIJKSTRA')      add('dijkstra');
  if (route.aiTag === 'CROWD-AVOID')      add('festival_nav');

  localStorage.setItem('dp_badges', JSON.stringify(badges));
  newBadges.filter(Boolean).forEach((b, i) => setTimeout(() => showBadgeUnlock(b), i * 1600));
  renderBadges();
}

function showBadgeUnlock(badge) {
  const el = document.createElement('div');
  el.className = 'badge-unlock-toast';
  el.innerHTML = `<span style="font-size:28px">${badge.icon}</span>
    <div><div style="font-weight:700">Badge Unlocked!</div>
    <div style="opacity:.75;font-size:13px">${badge.name}</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function renderBadges() {
  const container = document.getElementById('badges-grid');
  if (!container) return;
  container.innerHTML = '';
  BADGE_DEFS.forEach(b => {
    const earned = badges.includes(b.id);
    const el     = document.createElement('div');
    el.className = 'badge-item ' + (earned ? 'earned' : 'locked');
    el.title     = earned ? b.desc : 'Not yet earned';
    el.innerHTML = `<span style="font-size:26px">${b.icon}</span>
      <div style="font-size:11px;margin-top:4px;font-weight:600">${b.name}</div>`;
    container.appendChild(el);
  });
}

// ================================================================
// LEADERBOARD
// ================================================================
function updateLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  const sorted = [...leaderboard].sort((a,b) => b.points - a.points);
  tbody.innerHTML = '';
  sorted.forEach((user, i) => {
    const rankIcon = ['🥇','🥈','🥉'][i] || `#${i+1}`;
    const tr = document.createElement('tr');
    tr.className = user.name === 'You' ? 'you-row' : '';
    tr.innerHTML = `<td>${rankIcon}</td>
      <td>${user.name === 'You' ? '<b>You</b>' : user.name}</td>
      <td><span class="pts-badge">${user.points.toLocaleString()}</span></td>`;
    tbody.appendChild(tr);
  });
}

function updateLeaderboardSelf() {
  const idx = leaderboard.findIndex(u => u.name === 'You');
  if (idx !== -1) leaderboard[idx].points = userPoints;
  localStorage.setItem('dp_leaderboard', JSON.stringify(leaderboard));
  updateLeaderboard();
}

// ================================================================
// COUPONS
// ================================================================
function redeemCoupon(cost, desc) {
  if (userPoints < cost) { showToast(`Need ${cost} pts to redeem ❌`, 'error'); return; }
  userPoints -= cost;
  localStorage.setItem('dp_points', userPoints);
  updatePointsDisplay();
  updateLeaderboardSelf();
  showToast(`Redeemed: ${desc} ✅`, 'success');
}

// ================================================================
// UI HELPERS
// ================================================================
function updatePointsDisplay() {
  document.querySelectorAll('.points-val').forEach(el => el.textContent = userPoints.toLocaleString());
}
function updateStreakDisplay() {
  document.querySelectorAll('#streak-val, #streak-val2').forEach(el => { if (el) el.textContent = userStreak; });
}
function showLoading(show) {
  const btn = document.getElementById('find-btn');
  if (!btn) return;
  btn.disabled = show;
  btn.innerHTML = show
    ? `<span class="spinner"></span> Finding...`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
         <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Find Smart Route`;
}
function showToast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3200);
}
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id==='panel-'+name));
}

// ================================================================
// POLYLINE DECODE
// ================================================================
function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index=0, lat=0, lng=0;
  while (index < encoded.length) {
    let b, shift=0, result=0;
    do { b=encoded.charCodeAt(index++)-63; result|=(b&0x1f)<<shift; shift+=5; } while(b>=0x20);
    lat += (result&1) ? ~(result>>1) : (result>>1);
    shift=0; result=0;
    do { b=encoded.charCodeAt(index++)-63; result|=(b&0x1f)<<shift; shift+=5; } while(b>=0x20);
    lng += (result&1) ? ~(result>>1) : (result>>1);
    points.push([lat/1e5, lng/1e5]);
  }
  return points;
}

// ================================================================
// DISTANCE (Haversine)
// ================================================================
function getDistance(a, b) {
  const R=6371, dLat=(b[0]-a[0])*Math.PI/180, dLng=(b[1]-a[1])*Math.PI/180;
  const lat1=a[0]*Math.PI/180, lat2=b[0]*Math.PI/180;
  const x=Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2*Math.cos(lat1)*Math.cos(lat2);
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function startOracle() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

    recognition.start();

    recognition.onresult = function(event) {
        let text = event.results[0][0].transcript.toLowerCase();

        console.log("User:", text);

        fetch('/api/ask', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ query: text })
        })
        .then(res => res.json())
        .then(data => {
            console.log("Oracle:", data);

            speak(data.reply);

            // ✅ THIS FIXES EVERYTHING
            handleOracleCommand(data, text);
        });
    };
}
function handleOracleCommand(data, text) {

    // 🧭 ROUTE
    if (data.type === "route") {

        let destination = data.destination;
        let input = document.getElementById("destination");

        input.value = destination;

        showToast(`🧭 Showing routes to ${destination}`, "success");

        if (!navigator.geolocation) {
            showToast("Geolocation not supported ❌", "error");
            return;
        }

        navigator.geolocation.getCurrentPosition(pos => {

            let start = [pos.coords.latitude, pos.coords.longitude];
            startCoords = start;  // ✅ IMPORTANT (GLOBAL)

            console.log("Start:", start);

            // 🔥 GEOCODE DESTINATION
            fetch('/geocode', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ place: destination })
            })
            .then(res => {
                if (!res.ok) throw new Error("Geocode failed");
                return res.json();
            })
            .then(geo => {

                if (!geo.features || geo.features.length === 0) {
                    showToast("Location not found ❌", "error");
                    return;
                }

                let coords = geo.features[0].geometry.coordinates;
                let end = [coords[1], coords[0]];

                destinationCoords = end; // ✅ IMPORTANT (GLOBAL)

                console.log("Destination:", end);

                // 🔥 CALL YOUR MAIN SYSTEM
                console.log("Drawing route...");

                setTimeout(() => {
                   console.log("🚀 Calling fetchAndDrawRoutes", start, end);


                   fetchAndDrawRoutes(start, end);
                   showParkingOptions(start, end);
                   aiAnalyzeTraffic(start, end);


                   setTimeout(() => {
                   map.invalidateSize();
                   }, 300);

                }, 200);

                // Switch to routes tab
                document.querySelector('[data-tab="routes"]').click();

            })
            .catch(err => {
                console.error(err);
                showToast("Error finding location ❌", "error");
            });

        }, err => {
            showToast("Location permission denied ❌", "error");
        });
    }

    // 🅿️ PARKING NEAR CURRENT LOCATION
    else if (data.type === "parking_here") {

        showToast("🅿️ Finding parking near you", "info");

        if (!startCoords) {
            showToast("Get location first (say: go somewhere)", "error");
            return;
        }

        // Use current location as both start & center
        showParkingOptions(startCoords, startCoords);

        document.querySelector('[data-tab="parking"]').click();
    }

    // 🅿️ PARKING NEAR DESTINATION
    else if (data.type === "parking_destination") {

        showToast("🅿️ Finding parking near destination", "info");

        if (!startCoords || !destinationCoords) {
            showToast("Set a destination first ❌", "error");
            return;
        }

        showParkingOptions(startCoords, destinationCoords);

        document.querySelector('[data-tab="parking"]').click();
    }

    // 🚦 TRAFFIC
    else if (data.type === "traffic") {

        showToast("🚦 Checking traffic...", "info");

        if (!startCoords || !destinationCoords) {
            showToast("Search a route first ❌", "error");
            return;
        }

        aiRefreshTraffic();
    }

    // ❓ UNKNOWN
    else {
        showToast("Try: 'Go to Whitefield'", "info");
    }

}

function speak(text) {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    speech.pitch = 1.1;
    speech.rate = 1;

    window.speechSynthesis.speak(speech);
}
let heatLayer = null;

function showRouteHeatmap(coords) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }

  if (!coords || coords.length === 0) return;

  const heatPoints = coords.map(c => [c[0], c[1], 0.5]);

  heatLayer = L.heatLayer(heatPoints, {
    radius: 25,
    blur: 20,
    maxZoom: 17
  }).addTo(map);
}
// ================================================================
// BUILD STEP-BY-STEP DIRECTIONS
// ================================================================
function buildSteps(coords, distKm, timeMin) {

  if (!coords || coords.length < 2) return [];

  const steps = [];
  const segLen = Math.max(1, Math.floor(coords.length / 8));

  steps.push({
    icon: '↑',
    text: 'Head toward your destination',
    dist: '0 m'
  });

  for (let i = segLen; i < coords.length - segLen; i += segLen) {

    const prev = coords[i - segLen];
    const curr = coords[i];
    const next = coords[Math.min(i + segLen, coords.length - 1)];

    const bearing1 = getBearing(prev, curr);
    const bearing2 = getBearing(curr, next);

    const turn = bearing2 - bearing1;
    const segDist = (getDistance(prev, curr) * 1000).toFixed(0);

    let icon = '↑', text = 'Continue straight';

    if (turn > 20 && turn <= 90) {
      icon = '↗'; text = 'Bear right';
    }
    else if (turn > 90) {
      icon = '→'; text = 'Turn right';
    }
    else if (turn < -20 && turn >= -90) {
      icon = '↖'; text = 'Bear left';
    }
    else if (turn < -90) {
      icon = '←'; text = 'Turn left';
    }

    steps.push({
      icon,
      text: `${text} on road`,
      dist: `${segDist} m`
    });
  }

  steps.push({
    icon: '🏁',
    text: 'Arrive at destination',
    dist: `${distKm.toFixed(1)} km · ${Math.round(timeMin)} min`
  });

  return steps;
}
function getDistance(a, b) {
  const R = 6371; // km
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;

  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;

  const x = dLat/2 * dLat/2 +
            Math.cos(lat1) * Math.cos(lat2) *
            dLng/2 * dLng/2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
function getBearing(a, b) {
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}
function safeDecode(geometry) {
  if (!geometry) return [];

  if (Array.isArray(geometry)) {
    return geometry.map(c => [c[1], c[0]]);
  }

  return decodePolyline(geometry).map(c => [c[1], c[0]]);
}