// ============================================================
// CROWD DETECTION MODULE - crowd.js
// Integrates with existing Darideepa route.js seamlessly
// Add <script src="/static/crowd.js"></script> to base.html
// ============================================================

// ─── State ────────────────────────────────────────────────
const CrowdState = {
  locations: [],
  activeLocation: null,
  predictionData: null,
  refreshInterval: null,
  mapMarkers: [],
  crowdPanel: null,
  isVisible: false
};

// ─── Constants ────────────────────────────────────────────
const CROWD_REFRESH_MS = 30000; // refresh every 30s

const CROWD_COLORS = {
  critical: { bg: '#FF2D55', text: '#fff', bar: '#FF2D55' },
  high:     { bg: '#FF9500', text: '#fff', bar: '#FF9500' },
  medium:   { bg: '#FFCC00', text: '#000', bar: '#FFCC00' },
  low:      { bg: '#30D158', text: '#fff', bar: '#30D158' },
  empty:    { bg: '#0A84FF', text: '#fff', bar: '#0A84FF' }
};

const DIRECTION_ICONS = {
  north: '↑', south: '↓', east: '→', west: '←'
};

// ─── Init ─────────────────────────────────────────────────
async function initCrowdDetection() {
  injectCrowdStyles();
  createCrowdTab();
  createCrowdPanel();
  await loadCrowdLocations();
  await placeCrowdMarkersOnMap();
  console.log('[Crowd] Detection module initialized');
}

// ─── Tab Integration ──────────────────────────────────────
function createCrowdTab() {
  // Find existing tab container
  const tabContainer = document.querySelector('.tab-btn')?.parentElement;
  if (!tabContainer) return;

  // Check if already exists
  if (document.getElementById('crowd-tab-btn')) return;

  const crowdTabBtn = document.createElement('button');
  crowdTabBtn.id = 'crowd-tab-btn';
  crowdTabBtn.className = 'tab-btn';
  crowdTabBtn.dataset.tab = 'crowd';
  crowdTabBtn.innerHTML = `<span>👁️</span><span>CROWD</span>`;
  crowdTabBtn.onclick = () => switchTab('crowd');
  tabContainer.appendChild(crowdTabBtn);

  // Create panel
  const crowdPanel = document.createElement('div');
  crowdPanel.id = 'crowd';
  crowdPanel.className = 'tab-panel';
  crowdPanel.innerHTML = `<div id="crowd-list-container"><div class="crowd-loading">Loading locations...</div></div>`;

  const existingPanels = document.querySelector('.tab-panel')?.parentElement;
  if (existingPanels) existingPanels.appendChild(crowdPanel);
}

// ─── Load Locations ───────────────────────────────────────
async function loadCrowdLocations() {
  try {
    const res = await fetch('/api/crowd/locations');
    const data = await res.json();
    if (data.success) {
      CrowdState.locations = data.locations;
      renderCrowdList();
    }
  } catch (e) {
    console.error('[Crowd] Failed to load locations:', e);
    // Use mock data for demo
    CrowdState.locations = getMockLocations();
    renderCrowdList();
  }
}

// ─── Render Location List ─────────────────────────────────
function renderCrowdList() {
  const container = document.getElementById('crowd-list-container');
  if (!container) return;

  const temples = CrowdState.locations.filter(l => l.type === 'temple');
  const malls = CrowdState.locations.filter(l => l.type === 'mall');

  container.innerHTML = `
    <div class="crowd-search-bar">
      <input type="text" id="crowd-search-input" placeholder="🔍 Search temples & malls..." oninput="filterCrowdList(this.value)">
    </div>
    <div class="crowd-section-header">🛕 Temples</div>
    <div id="crowd-temples-list">
      ${temples.map(loc => renderLocationCard(loc)).join('')}
    </div>
    <div class="crowd-section-header" style="margin-top:8px;">🏬 Malls</div>
    <div id="crowd-malls-list">
      ${malls.map(loc => renderLocationCard(loc)).join('')}
    </div>
  `;
}

function renderLocationCard(loc) {
  const c = CROWD_COLORS[loc.crowd_level] || CROWD_COLORS.medium;
  return `
    <div class="crowd-location-card" onclick="openCrowdDetail('${loc.id}')" id="card-${loc.id}">
      <div class="crowd-card-left">
        <span class="crowd-icon">${loc.icon}</span>
        <div class="crowd-card-info">
          <div class="crowd-card-name">${loc.name}</div>
          <div class="crowd-card-meta">${loc.gate_count} gates • ${loc.crowd_emoji} ${loc.crowd_level.toUpperCase()}</div>
        </div>
      </div>
      <div class="crowd-badge" style="background:${c.bg};color:${c.text}">${loc.crowd_percentage}%</div>
    </div>
  `;
}

function filterCrowdList(query) {
  const q = query.toLowerCase();
  const cards = document.querySelectorAll('.crowd-location-card');
  cards.forEach(card => {
    const name = card.querySelector('.crowd-card-name')?.textContent?.toLowerCase() || '';
    card.style.display = name.includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.crowd-section-header').forEach(h => h.style.display = '');
}

// ─── Detail Panel ─────────────────────────────────────────
function createCrowdPanel() {
  if (document.getElementById('crowd-detail-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'crowd-detail-panel';
  panel.className = 'crowd-detail-panel hidden';
  panel.innerHTML = `
    <div class="crowd-panel-header">
      <button class="crowd-back-btn" onclick="closeCrowdDetail()">← Back</button>
      <div id="crowd-panel-title">Loading...</div>
      <div id="crowd-panel-status"></div>
    </div>
    <div id="crowd-panel-body"></div>
  `;
  document.body.appendChild(panel);
  CrowdState.crowdPanel = panel;
}

async function openCrowdDetail(locationId) {
  const panel = document.getElementById('crowd-detail-panel');
  if (!panel) return;

  CrowdState.activeLocation = locationId;
  panel.classList.remove('hidden');
  panel.classList.add('visible');

  document.getElementById('crowd-panel-title').textContent = 'Loading...';
  document.getElementById('crowd-panel-body').innerHTML = `
    <div class="crowd-loading-spinner">
      <div class="spinner"></div>
      <div>AI Camera Analysis...</div>
    </div>
  `;

  await refreshCrowdDetail(locationId);

  // Auto-refresh
  if (CrowdState.refreshInterval) clearInterval(CrowdState.refreshInterval);
  CrowdState.refreshInterval = setInterval(() => refreshCrowdDetail(locationId), CROWD_REFRESH_MS);
}

async function refreshCrowdDetail(locationId) {
  try {
    const res = await fetch(`/api/crowd/predict/${locationId}`);
    const data = await res.json();
    if (data.success) {
      renderCrowdDetail(data.data);
    }
  } catch (e) {
    renderCrowdDetail(getMockPrediction(locationId));
  }
}

function renderCrowdDetail(data) {
  const titleEl = document.getElementById('crowd-panel-title');
  const bodyEl = document.getElementById('crowd-panel-body');
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = data.location_name;

  const overallC = data.overall_crowd_percentage >= 70 ? CROWD_COLORS.high
    : data.overall_crowd_percentage >= 40 ? CROWD_COLORS.medium : CROWD_COLORS.low;

  const bestGate = data.gates.find(g => g.id === data.best_gate_id);

  bodyEl.innerHTML = `
    <!-- Overall Status -->
    <div class="crowd-overall-card">
      <div class="crowd-overall-left">
        <div class="crowd-overall-pct" style="color:${overallC.bg}">${data.overall_crowd_percentage}%</div>
        <div class="crowd-overall-label">Overall Crowd</div>
        <div class="crowd-trend">${data.trend_icon} ${data.trend.toUpperCase()}</div>
      </div>
      <div class="crowd-overall-right">
        <div class="crowd-time-info">🕐 ${data.current_time} • ${data.current_day}</div>
        ${data.is_peak_time ? '<div class="crowd-peak-badge">⚡ PEAK TIME</div>' : '<div class="crowd-offpeak-badge">✅ OFF PEAK</div>'}
        <div class="crowd-forecast">
          <span>15m: <b>${data.forecast_15min}%</b></span>
          <span>30m: <b>${data.forecast_30min}%</b></span>
          <span>1hr: <b>${data.forecast_60min}%</b></span>
        </div>
      </div>
    </div>

    <!-- AI Recommendation -->
    <div class="crowd-ai-rec">
      <div class="crowd-ai-icon">🤖</div>
      <div class="crowd-ai-text">${data.ai_recommendation}</div>
    </div>

    <!-- Gate Architecture Map -->
    <div class="crowd-section-title">📍 Gate Status (Live AI Camera)</div>
    <div class="crowd-gate-map">
      ${renderGateMap(data.gates, data.best_gate_id)}
    </div>

    <!-- Gate List -->
    <div class="crowd-section-title">🚪 Gate Details</div>
    <div class="crowd-gates-list">
      ${data.gates.map(gate => renderGateCard(gate, gate.id === data.best_gate_id)).join('')}
    </div>

    <!-- Navigate to Best Gate -->
    ${bestGate ? `
    <button class="crowd-navigate-btn" onclick="navigateToBestGate('${data.location_id}', '${bestGate.name}')">
      🧭 Navigate to ${bestGate.name}
    </button>
    ` : ''}

    <!-- Camera Feed Indicator -->
    <div class="crowd-camera-footer">
      <span class="camera-live-dot"></span>
      AI Camera Feed Active • Confidence: ${data.gates[0]?.camera_confidence ? Math.round(data.gates[0].camera_confidence * 100) : 94}%
      <span class="crowd-refresh-note">Auto-refresh: 30s</span>
    </div>
  `;
}

function renderGateMap(gates, bestGateId) {
  // Simple compass-style gate layout
  const dirMap = { north: 'top', south: 'bottom', east: 'right', west: 'left' };
  return `
    <div class="gate-compass">
      <div class="compass-center">
        <div class="compass-building">🏛️</div>
        <div class="compass-label">Main Area</div>
      </div>
      ${gates.map(gate => {
        const pos = dirMap[gate.direction] || 'top';
        const c = CROWD_COLORS[gate.level] || CROWD_COLORS.medium;
        const isBest = gate.id === bestGateId;
        return `
          <div class="compass-gate compass-${pos} ${isBest ? 'best-gate' : ''}" 
               title="${gate.name}: ${gate.label}">
            <div class="compass-gate-dot" style="background:${c.bg}">
              ${isBest ? '⭐' : DIRECTION_ICONS[gate.direction] || '•'}
            </div>
            <div class="compass-gate-label">${gate.name.split(' ')[0]}</div>
            <div class="compass-gate-pct" style="color:${c.bg}">${gate.crowd_percentage}%</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderGateCard(gate, isBest) {
  const c = CROWD_COLORS[gate.level] || CROWD_COLORS.medium;
  return `
    <div class="crowd-gate-card ${isBest ? 'best-gate-card' : ''}">
      <div class="gate-card-header">
        <div class="gate-name">
          ${isBest ? '<span class="best-tag">⭐ BEST</span>' : ''}
          ${gate.name}
        </div>
        <div class="gate-badge" style="background:${c.bg};color:${c.text}">${gate.emoji} ${gate.label}</div>
      </div>
      <div class="gate-bar-wrap">
        <div class="gate-bar" style="width:${gate.crowd_percentage}%;background:${c.bar}"></div>
      </div>
      <div class="gate-stats">
        <span>👥 ${gate.crowd_percentage}% capacity</span>
        <span>⏱️ ~${gate.wait_minutes} min wait</span>
        ${gate.anomaly_detected ? '<span class="anomaly-tag">⚠️ Spike detected</span>' : ''}
      </div>
      <div class="gate-camera-info">
        📷 AI Camera • ${Math.round((gate.camera_confidence || 0.94) * 100)}% confidence
      </div>
    </div>
  `;
}

function closeCrowdDetail() {
  const panel = document.getElementById('crowd-detail-panel');
  if (panel) {
    panel.classList.remove('visible');
    panel.classList.add('hidden');
  }
  if (CrowdState.refreshInterval) {
    clearInterval(CrowdState.refreshInterval);
    CrowdState.refreshInterval = null;
  }
  CrowdState.activeLocation = null;
}

// ─── Map Integration ──────────────────────────────────────
async function placeCrowdMarkersOnMap() {
  // Uses existing map variable from route.js
  if (typeof map === 'undefined') {
    setTimeout(placeCrowdMarkersOnMap, 1000);
    return;
  }

  CrowdState.locations.forEach(loc => {
    const crowdColor = loc.crowd_level === 'high' ? '#FF2D55'
      : loc.crowd_level === 'medium' ? '#FF9500' : '#30D158';

    // Custom marker HTML
    const markerHtml = `
      <div class="crowd-map-marker" onclick="openCrowdDetailFromMap('${loc.id}')">
        <div class="crowd-map-icon">${loc.icon}</div>
        <div class="crowd-map-badge" style="background:${crowdColor}">${loc.crowd_percentage}%</div>
      </div>
    `;

    // Use Leaflet DivIcon if available
    if (typeof L !== 'undefined') {
      const icon = L.divIcon({
        html: markerHtml,
        className: 'crowd-leaflet-marker',
        iconSize: [50, 60],
        iconAnchor: [25, 60]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindTooltip(`<b>${loc.name}</b><br>${loc.crowd_emoji} ${loc.crowd_level} crowd`, {
          permanent: false, direction: 'top'
        });

      marker.on('click', () => openCrowdDetailFromMap(loc.id));
      CrowdState.mapMarkers.push(marker);
    }
  });
}

function openCrowdDetailFromMap(locationId) {
  // Switch to crowd tab if tabs exist
  if (typeof switchTab === 'function') switchTab('crowd');
  openCrowdDetail(locationId);
}

// ─── Navigation Integration ───────────────────────────────
function navigateToBestGate(locationId, gateName) {
  const loc = CrowdState.locations.find(l => l.id === locationId);
  if (!loc) return;

  // Pre-fill destination with location name + gate
  const destInput = document.querySelector('input[name="destination"], #destination-input, .search-input');
  if (destInput) {
    destInput.value = `${loc.name} - ${gateName}, Bangalore`;
    destInput.dispatchEvent(new Event('input'));
  }

  // Close crowd panel
  closeCrowdDetail();

  // Trigger route search if function exists
  if (typeof findRoute === 'function') {
    setTimeout(findRoute, 300);
  } else if (typeof handleSearch === 'function') {
    setTimeout(handleSearch, 300);
  }

  showToast(`🧭 Navigating to ${gateName} (least crowded)`);
}

// ─── Toast (reuse existing or create) ─────────────────────
function showCrowdToast(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
    return;
  }
  const el = document.createElement('div');
  el.className = 'crowd-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3000);
}

// ─── Mock Data (fallback when backend unavailable) ────────
function getMockLocations() {
  return [
    { id: 'iskcon_bangalore', name: 'ISKCON Temple', type: 'temple', icon: '🛕', lat: 13.0098, lng: 77.5511, crowd_level: 'medium', crowd_percentage: 52, crowd_emoji: '🟡', gate_count: 4 },
    { id: 'banashankari_temple', name: 'Banashankari Temple', type: 'temple', icon: '🛕', lat: 12.9134, lng: 77.5490, crowd_level: 'high', crowd_percentage: 78, crowd_emoji: '🔴', gate_count: 4 },
    { id: 'bull_temple', name: 'Bull Temple', type: 'temple', icon: '🛕', lat: 12.9447, lng: 77.5703, crowd_level: 'low', crowd_percentage: 28, crowd_emoji: '🟢', gate_count: 2 },
    { id: 'dodda_ganesha', name: 'Dodda Ganapathi Temple', type: 'temple', icon: '🛕', lat: 12.9716, lng: 77.5946, crowd_level: 'medium', crowd_percentage: 45, crowd_emoji: '🟡', gate_count: 2 },
    { id: 'venkataramana_temple', name: 'Venkataramana Temple', type: 'temple', icon: '🛕', lat: 12.9592, lng: 77.5762, crowd_level: 'low', crowd_percentage: 31, crowd_emoji: '🟢', gate_count: 3 },
    { id: 'phoenix_marketcity', name: 'Phoenix Marketcity', type: 'mall', icon: '🏬', lat: 12.9965, lng: 77.6961, crowd_level: 'high', crowd_percentage: 81, crowd_emoji: '🔴', gate_count: 5 },
    { id: 'orion_mall', name: 'Orion Mall', type: 'mall', icon: '🏬', lat: 13.0108, lng: 77.5540, crowd_level: 'medium', crowd_percentage: 58, crowd_emoji: '🟠', gate_count: 4 },
    { id: 'forum_mall', name: 'Forum Mall', type: 'mall', icon: '🏬', lat: 12.9344, lng: 77.6101, crowd_level: 'high', crowd_percentage: 74, crowd_emoji: '🔴', gate_count: 4 },
    { id: 'ub_city', name: 'UB City Mall', type: 'mall', icon: '🏬', lat: 12.9716, lng: 77.5946, crowd_level: 'low', crowd_percentage: 33, crowd_emoji: '🟢', gate_count: 3 },
    { id: 'garuda_mall', name: 'Garuda Mall', type: 'mall', icon: '🏬', lat: 12.9736, lng: 77.6082, crowd_level: 'medium', crowd_percentage: 49, crowd_emoji: '🟡', gate_count: 3 },
    { id: 'nexus_central', name: 'Nexus Central Mall', type: 'mall', icon: '🏬', lat: 12.9592, lng: 77.6476, crowd_level: 'medium', crowd_percentage: 55, crowd_emoji: '🟡', gate_count: 4 },
  ];
}

function getMockPrediction(locationId) {
  const gates = [
    { id: 'main_gate', name: 'Main Gate (North)', direction: 'north', crowd_ratio: 0.72, crowd_percentage: 72, level: 'high', color: '#FF9500', emoji: '🟠', label: 'Crowded', wait_minutes: 18, camera_confidence: 0.96, anomaly_detected: false },
    { id: 'east_gate', name: 'East Entrance', direction: 'east', crowd_ratio: 0.28, crowd_percentage: 28, level: 'low', color: '#30D158', emoji: '🟢', label: 'Light', wait_minutes: 4, camera_confidence: 0.94, anomaly_detected: false },
    { id: 'south_gate', name: 'South Gate', direction: 'south', crowd_ratio: 0.52, crowd_percentage: 52, level: 'medium', color: '#FFCC00', emoji: '🟡', label: 'Moderate', wait_minutes: 11, camera_confidence: 0.91, anomaly_detected: false },
    { id: 'west_gate', name: 'West Exit', direction: 'west', crowd_ratio: 0.15, crowd_percentage: 15, level: 'empty', color: '#0A84FF', emoji: '🔵', label: 'Very Light', wait_minutes: 1, camera_confidence: 0.97, anomaly_detected: false },
  ];
  return {
    location_id: locationId,
    location_name: CrowdState.locations.find(l => l.id === locationId)?.name || 'Temple/Mall',
    location_type: 'temple',
    current_time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    current_day: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()],
    overall_crowd_percentage: 42,
    trend: 'stable', trend_icon: '➡️',
    forecast_15min: 45, forecast_30min: 50, forecast_60min: 38,
    best_gate_id: 'west_gate',
    gates,
    is_peak_time: false,
    ai_recommendation: 'Use West Exit (Very Light crowd, ~1 min wait). Avoid Main Gate (Crowded).'
  };
}

// ─── Styles ───────────────────────────────────────────────
function injectCrowdStyles() {
  if (document.getElementById('crowd-styles')) return;
  const style = document.createElement('style');
  style.id = 'crowd-styles';
  style.textContent = `
    /* ── Crowd Tab Panel ── */
    #crowd { padding: 0; overflow-y: auto; height: calc(100vh - 140px); }
    .crowd-search-bar { padding: 10px 12px 6px; }
    .crowd-search-bar input {
      width: 100%; padding: 8px 12px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08);
      color: #fff; font-size: 13px; outline: none; box-sizing: border-box;
    }
    .crowd-section-header {
      padding: 8px 14px 4px; font-size: 11px; font-weight: 700;
      color: rgba(255,255,255,0.5); letter-spacing: 1px; text-transform: uppercase;
    }
    .crowd-location-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; margin: 3px 10px; border-radius: 12px;
      background: rgba(255,255,255,0.06); cursor: pointer;
      transition: background 0.2s; border: 1px solid rgba(255,255,255,0.08);
    }
    .crowd-location-card:hover { background: rgba(255,255,255,0.12); }
    .crowd-card-left { display: flex; align-items: center; gap: 10px; }
    .crowd-icon { font-size: 22px; }
    .crowd-card-name { font-size: 13px; font-weight: 600; color: #fff; }
    .crowd-card-meta { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 2px; }
    .crowd-badge {
      padding: 4px 10px; border-radius: 20px; font-size: 12px;
      font-weight: 700; min-width: 42px; text-align: center;
    }
    .crowd-loading { padding: 30px; text-align: center; color: rgba(255,255,255,0.5); }

    /* ── Detail Panel ── */
    .crowd-detail-panel {
      position: fixed; top: 0; right: 0; width: 420px; height: 100vh;
      background: #1a1a2e; z-index: 9999; overflow-y: auto;
      box-shadow: -4px 0 30px rgba(0,0,0,0.5);
      transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
      border-left: 1px solid rgba(255,255,255,0.1);
    }
    .crowd-detail-panel.visible { transform: translateX(0); }
    .crowd-detail-panel.hidden { transform: translateX(100%); }

    @media (max-width: 768px) {
      .crowd-detail-panel { width: 100%; right: 0; top: auto; bottom: 0; height: 85vh; border-radius: 20px 20px 0 0; transform: translateY(100%); }
      .crowd-detail-panel.visible { transform: translateY(0); }
    }

    .crowd-panel-header {
      padding: 16px 16px 12px; background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0; z-index: 10;
    }
    .crowd-back-btn {
      background: rgba(255,255,255,0.1); border: none; color: #fff;
      padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px;
      margin-bottom: 8px; transition: background 0.2s;
    }
    .crowd-back-btn:hover { background: rgba(255,255,255,0.2); }
    #crowd-panel-title { font-size: 17px; font-weight: 700; color: #fff; }

    /* ── Overall Card ── */
    .crowd-overall-card {
      margin: 14px; padding: 16px; border-radius: 16px;
      background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
      border: 1px solid rgba(255,255,255,0.12); display: flex; gap: 16px;
    }
    .crowd-overall-left { flex: 0 0 auto; }
    .crowd-overall-pct { font-size: 42px; font-weight: 800; line-height: 1; }
    .crowd-overall-label { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px; }
    .crowd-trend { font-size: 12px; font-weight: 700; margin-top: 6px; color: rgba(255,255,255,0.8); }
    .crowd-overall-right { flex: 1; }
    .crowd-time-info { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
    .crowd-peak-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      background: #FF2D55; color: #fff; font-size: 11px; font-weight: 700; margin-bottom: 8px;
    }
    .crowd-offpeak-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      background: #30D158; color: #fff; font-size: 11px; font-weight: 700; margin-bottom: 8px;
    }
    .crowd-forecast { display: flex; gap: 10px; font-size: 11px; color: rgba(255,255,255,0.6); }
    .crowd-forecast b { color: #fff; }

    /* ── AI Recommendation ── */
    .crowd-ai-rec {
      margin: 0 14px 14px; padding: 12px 14px; border-radius: 14px;
      background: rgba(48,209,88,0.1); border: 1px solid rgba(48,209,88,0.25);
      display: flex; gap: 10px; align-items: flex-start;
    }
    .crowd-ai-icon { font-size: 20px; flex: 0 0 auto; }
    .crowd-ai-text { font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.5; }

    /* ── Gate Compass Map ── */
    .crowd-section-title {
      padding: 4px 14px 8px; font-size: 12px; font-weight: 700;
      color: rgba(255,255,255,0.6); letter-spacing: 0.5px;
    }
    .crowd-gate-map { padding: 0 14px 14px; }
    .gate-compass {
      position: relative; width: 100%; aspect-ratio: 1; max-height: 220px;
      background: rgba(255,255,255,0.04); border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1); overflow: hidden;
    }
    .compass-center {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      text-align: center; z-index: 2;
    }
    .compass-building { font-size: 32px; }
    .compass-label { font-size: 10px; color: rgba(255,255,255,0.5); }

    .compass-gate {
      position: absolute; text-align: center; cursor: pointer; z-index: 3;
    }
    .compass-top    { top: 8px;   left: 50%; transform: translateX(-50%); }
    .compass-bottom { bottom: 8px; left: 50%; transform: translateX(-50%); }
    .compass-left   { left: 8px;  top: 50%;  transform: translateY(-50%); }
    .compass-right  { right: 8px; top: 50%;  transform: translateY(-50%); }

    .compass-gate-dot {
      width: 36px; height: 36px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 14px;
      margin: 0 auto; box-shadow: 0 0 12px rgba(0,0,0,0.4);
      transition: transform 0.2s;
    }
    .compass-gate-dot:hover { transform: scale(1.15); }
    .best-gate .compass-gate-dot { box-shadow: 0 0 0 3px #30D158, 0 0 16px rgba(48,209,88,0.5); }
    .compass-gate-label { font-size: 9px; color: rgba(255,255,255,0.7); margin-top: 3px; }
    .compass-gate-pct { font-size: 10px; font-weight: 700; }

    /* ── Gate Cards ── */
    .crowd-gates-list { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 8px; }
    .crowd-gate-card {
      padding: 12px 14px; border-radius: 14px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    }
    .best-gate-card { background: rgba(48,209,88,0.08); border-color: rgba(48,209,88,0.3); }
    .gate-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .gate-name { font-size: 13px; font-weight: 600; color: #fff; }
    .best-tag {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      background: #30D158; color: #fff; font-size: 10px; font-weight: 700; margin-right: 6px;
    }
    .gate-badge {
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
    }
    .gate-bar-wrap {
      height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-bottom: 8px; overflow: hidden;
    }
    .gate-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .gate-stats { display: flex; gap: 12px; font-size: 11px; color: rgba(255,255,255,0.65); flex-wrap: wrap; }
    .anomaly-tag { color: #FF9500; font-weight: 700; }
    .gate-camera-info { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 6px; }

    /* ── Navigate Button ── */
    .crowd-navigate-btn {
      display: block; width: calc(100% - 28px); margin: 0 14px 14px;
      padding: 14px; background: linear-gradient(135deg, #00b894, #00cec9);
      border: none; border-radius: 14px; color: #fff; font-size: 15px;
      font-weight: 700; cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.3px;
    }
    .crowd-navigate-btn:hover { opacity: 0.88; }

    /* ── Camera Footer ── */
    .crowd-camera-footer {
      margin: 0 14px 20px; padding: 10px 14px; border-radius: 12px;
      background: rgba(255,255,255,0.04); font-size: 11px; color: rgba(255,255,255,0.45);
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .camera-live-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #30D158;
      animation: pulse-dot 1.5s infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }
    .crowd-refresh-note { margin-left: auto; color: rgba(255,255,255,0.3); }

    /* ── Loading Spinner ── */
    .crowd-loading-spinner { padding: 60px 0; text-align: center; color: rgba(255,255,255,0.5); }
    .spinner {
      width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #30D158; border-radius: 50%; margin: 0 auto 16px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Map Markers ── */
    .crowd-leaflet-marker { background: transparent !important; border: none !important; }
    .crowd-map-marker {
      position: relative; cursor: pointer; text-align: center;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      transition: transform 0.2s;
    }
    .crowd-map-marker:hover { transform: scale(1.15); }
    .crowd-map-icon { font-size: 28px; line-height: 1; }
    .crowd-map-badge {
      position: absolute; top: -4px; right: -8px;
      padding: 2px 6px; border-radius: 10px; font-size: 10px;
      font-weight: 800; color: #fff; border: 2px solid #1a1a2e;
    }

    /* ── Toast ── */
    .crowd-toast {
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: rgba(30,30,50,0.95); color: #fff; padding: 12px 20px;
      border-radius: 25px; font-size: 14px; opacity: 0; z-index: 99999;
      transition: opacity 0.3s, transform 0.3s; border: 1px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
    }
    .crowd-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(style);
}

// ─── Boot ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCrowdDetection);
} else {
  initCrowdDetection();
}

// Export for module use
if (typeof module !== 'undefined') module.exports = { initCrowdDetection, openCrowdDetail };
