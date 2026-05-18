const els = {
  form: document.querySelector('#search-form'),
  query: document.querySelector('#query'),
  button: document.querySelector('#search-form button'),
  alert: document.querySelector('#alert'),
  movement: document.querySelector('#movement'),
  speed: document.querySelector('#speed'),
  course: document.querySelector('#course'),
  freshness: document.querySelector('#freshness'),
  vesselName: document.querySelector('#vessel-name'),
  providerName: document.querySelector('#provider-name'),
  sourceLink: document.querySelector('#source-link'),
  mmsi: document.querySelector('#mmsi'),
  imo: document.querySelector('#imo'),
  coordinates: document.querySelector('#coordinates'),
  observed: document.querySelector('#observed'),
  candidateCount: document.querySelector('#candidate-count'),
  candidateList: document.querySelector('#candidate-list'),
};

const map = L.map('map', {
  zoomControl: false,
  worldCopyJump: true,
}).setView([20, 0], 2);

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const vesselIcon = L.divIcon({
  className: 'vessel-marker',
  html: `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
    <circle cx="17" cy="17" r="14" fill="#2563eb" stroke="#fff" stroke-width="3"/>
    <path d="M17 7l7 18-7-4-7 4 7-18z" fill="#fff"/>
  </svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -16],
});

let marker;

function dash(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatFreshness(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}초 전`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}시간 전`;
  return `${Math.round(seconds / 86400)}일 전`;
}

function setAlert(message) {
  if (!message) {
    els.alert.hidden = true;
    els.alert.textContent = '';
    return;
  }
  els.alert.hidden = false;
  els.alert.textContent = message;
}

function setLoading(isLoading) {
  els.button.disabled = isLoading;
  els.button.querySelector('span:last-child').textContent = isLoading ? '조회 중' : '조회';
}

function renderCandidates(candidates = []) {
  els.candidateCount.textContent = String(candidates.length);
  els.candidateList.replaceChildren(
    ...candidates.map((candidate) => {
      const li = document.createElement('li');
      const main = document.createElement('div');
      const name = document.createElement('div');
      const meta = document.createElement('div');
      const flag = document.createElement('span');

      name.className = 'candidate-name';
      name.textContent = candidate.name || 'UNKNOWN';
      meta.className = 'candidate-meta';
      meta.textContent = [`MMSI ${dash(candidate.mmsi)}`, `IMO ${dash(candidate.imo)}`, candidate.type]
        .filter(Boolean)
        .join(' · ');
      flag.className = 'candidate-flag';
      flag.textContent = candidate.flag || '';

      main.append(name, meta);
      li.append(main, flag);
      return li;
    }),
  );
}

function renderNoData(message) {
  els.movement.textContent = '조회 실패';
  els.movement.className = 'state-unknown';
  els.speed.textContent = '-';
  els.course.textContent = '-';
  els.freshness.textContent = '-';
  els.providerName.textContent = 'No data';
  els.sourceLink.href = 'https://www.myshiptracking.com/';
  setAlert(message);
}

function renderResult(result) {
  const { identity, position, movement, source } = result;
  const lat = position.lat;
  const lon = position.lon;
  const title = identity.name || position.identity?.name || 'UNKNOWN VESSEL';

  setAlert('');
  els.vesselName.textContent = title;
  els.providerName.textContent = source?.provider || 'provider';
  els.sourceLink.href = result.sourceUrl || source?.landingUrl || 'https://www.myshiptracking.com/';
  els.movement.textContent = movement.label;
  els.movement.className = `state-${movement.tone}`;
  els.speed.textContent = Number.isFinite(position.speedKnots)
    ? `${formatNumber(position.speedKnots, 1)} kn`
    : '-';
  els.course.textContent = Number.isFinite(position.courseDeg)
    ? `${formatNumber(position.courseDeg, 0)}°`
    : '-';
  els.freshness.textContent = formatFreshness(position.freshnessSeconds);
  els.mmsi.textContent = dash(identity.mmsi || position.identity?.mmsi);
  els.imo.textContent = dash(identity.imo || position.identity?.imo);
  els.coordinates.textContent = `${formatNumber(lat, 5)}, ${formatNumber(lon, 5)}`;
  els.observed.textContent = formatTime(position.observedAt);
  renderCandidates(result.candidates);

  if (!marker) {
    marker = L.marker([lat, lon], { icon: vesselIcon }).addTo(map);
  } else {
    marker.setLatLng([lat, lon]);
  }
  marker
    .bindPopup(
      `<div class="popup-title">${title}</div>
      <div class="popup-meta">MMSI ${dash(identity.mmsi)}</div>
      <div class="popup-meta">${formatNumber(lat, 5)}, ${formatNumber(lon, 5)}</div>`,
    )
    .openPopup();
  map.setView([lat, lon], 10, { animate: true });
}

async function runLookup(query) {
  setLoading(true);
  setAlert('');
  try {
    const response = await fetch(`/api/vessel?query=${encodeURIComponent(query)}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      renderCandidates(payload.candidates || []);
      renderNoData(payload.message || '조회할 수 없습니다.');
      return;
    }
    renderResult(payload);
  } catch (error) {
    renderNoData(error instanceof Error ? error.message : String(error));
  } finally {
    setLoading(false);
  }
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  runLookup(els.query.value);
});

runLookup(els.query.value);
