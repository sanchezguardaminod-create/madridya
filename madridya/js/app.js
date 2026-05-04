/* ═══════════════════════════════════════════
   MADRIDYA — app.js
   Google Places API + Bilingual + Map logic
═══════════════════════════════════════════ */

// ── STATE ──────────────────────────────────
const state = {
  lang: 'es',
  survey: {
    firstTime: 'yes',
    budget: '$$',
    dates: { start: null, end: null },
    mobility: ['walking'],
    interests: ['museums', 'art', 'nightlife'],
    food: ['local']
  },
  places: [],
  selectedPlaces: [],
  map: null,
  markers: [],
  directionsRenderer: null,
  completedStops: [],
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  mapsReady: false,
  chatHistory: []
};

// Madrid centre coordinates
const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };

// ── PLACE TYPES MAPPING ──────────────────────
const INTEREST_TO_TYPES = {
  museums:   ['museum'],
  art:       ['art_gallery'],
  churches:  ['church'],
  sport:     ['stadium', 'gym'],
  nightlife: ['night_club', 'bar'],
  parks:     ['park'],
  wellness:  ['spa'],
  bars:      ['bar', 'restaurant']
};

const FOOD_TO_KEYWORDS = {
  local:    'comida española tradicional Madrid',
  italian:  'restaurante italiano Madrid',
  japanese: 'restaurante japonés sushi Madrid',
  mexican:  'restaurante mexicano Madrid',
  vegan:    'restaurante vegano Madrid'
};

const BUDGET_PRICE_LEVEL = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

// ── TRANSLATIONS ────────────────────────────
const T = {
  es: {
    noPlaces: 'No se encontraron lugares. Prueba con otros intereses.',
    errorPlaces: 'No se pudieron cargar los lugares. Inténtalo de nuevo.',
    lugares: 'lugares',
    lugar: 'lugar',
    topPick: 'Top pick',
    recommended: 'Recomendado',
    walk: '🚶',
    transit: '🚇',
    stars: '⭐',
    euro: '€',
    completado: 'Completado',
    enCamino: 'En camino',
    pendiente: 'Pendiente',
    progressLabel: '% completado',
    routeShared: '¡Enlace copiado al portapapeles!',
    mapsNotReady: 'El mapa se está cargando, espera un momento.',
    stopRemoved: 'Lugar eliminado de la ruta.',
    chatError: 'Lo siento, no pude procesar tu pregunta. Inténtalo de nuevo.',
    typingLabel: 'Escribiendo...',
    dateStart: 'Llegada: ',
    dateEnd: '  ·  Salida: ',
    selectDates: 'Selecciona fecha de llegada'
  },
  en: {
    noPlaces: 'No places found. Try different interests.',
    errorPlaces: 'Could not load places. Please try again.',
    lugares: 'places',
    lugar: 'place',
    topPick: 'Top pick',
    recommended: 'Recommended',
    walk: '🚶',
    transit: '🚇',
    stars: '⭐',
    euro: '€',
    completado: 'Completed',
    enCamino: 'On the way',
    pendiente: 'Pending',
    progressLabel: '% completed',
    routeShared: 'Link copied to clipboard!',
    mapsNotReady: 'The map is loading, please wait.',
    stopRemoved: 'Place removed from route.',
    chatError: 'Sorry, I could not process your question. Please try again.',
    typingLabel: 'Typing...',
    dateStart: 'Arrival: ',
    dateEnd: '  ·  Departure: ',
    selectDates: 'Select arrival date'
  }
};

function t(key) { return T[state.lang][key] || key; }

// ── LANGUAGE TOGGLE ──────────────────────────
function toggleLang() {
  state.lang = state.lang === 'es' ? 'en' : 'es';
  const btn = document.querySelector('.lang-btn');
  btn.textContent = state.lang === 'es' ? '🌐 EN' : '🌐 ES';

  document.querySelectorAll('[data-es]').forEach(el => {
    const key = state.lang === 'es' ? 'es' : 'en';
    if (el.tagName === 'INPUT') {
      const ph = el.getAttribute('data-placeholder-' + key);
      if (ph) el.placeholder = ph;
    } else {
      el.textContent = el.getAttribute('data-' + key);
    }
  });

  document.documentElement.setAttribute('lang', state.lang);
  renderCalendar();
}

// ── SCREEN NAVIGATION ───────────────────────
function go(n) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('s' + n).classList.add('active');
  document.querySelectorAll('.tab')[n - 1].classList.add('active');

  if (n === 3 && state.mapsReady && state.selectedPlaces.length > 0) {
    setTimeout(renderMap, 200);
  }
}

// ── FORM INTERACTIONS ───────────────────────
function tog(btn) {
  btn.classList.toggle('sel');
  syncSurveyState();
}

function soloSelect(btn, groupId) {
  document.getElementById(groupId).querySelectorAll('.ob')
    .forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  syncSurveyState();
}

function selBudget(btn) {
  document.querySelectorAll('.bb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  state.survey.budget = btn.dataset.value;
}

function syncSurveyState() {
  // Interests
  state.survey.interests = [...document.querySelectorAll('#q-interests .sel')]
    .map(b => b.dataset.value);
  // Food
  state.survey.food = [...document.querySelectorAll('#q-food .sel')]
    .map(b => b.dataset.value);
  // Mobility
  state.survey.mobility = [...document.querySelectorAll('#q-mobility .sel')]
    .map(b => b.dataset.value);
  // First time
  const ftSel = document.querySelector('#q-firsttime .sel');
  if (ftSel) state.survey.firstTime = ftSel.dataset.value;
}

// ── CALENDAR ────────────────────────────────
function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  if (!grid) return;

  const year = state.calYear;
  const month = state.calMonth;

  const monthNames = {
    es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December']
  };
  title.textContent = monthNames[state.lang][month] + ' ' + year;

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay === 0) ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  grid.innerHTML = '';

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayEl = document.createElement('div');
    const thisDate = new Date(year, month, d);
    dayEl.className = 'cal-day';
    dayEl.textContent = d;

    if (thisDate < today) {
      dayEl.classList.add('past');
    } else {
      dayEl.onclick = () => selectCalDay(new Date(year, month, d));

      const { start, end } = state.survey.dates;
      if (start && sameDay(thisDate, start)) dayEl.classList.add('start');
      else if (end && sameDay(thisDate, end)) dayEl.classList.add('end');
      else if (start && end && thisDate > start && thisDate < end) dayEl.classList.add('range');
    }

    grid.appendChild(dayEl);
  }

  updateDateDisplay();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function selectCalDay(date) {
  const { start, end } = state.survey.dates;
  if (!start || (start && end)) {
    state.survey.dates = { start: date, end: null };
  } else if (date > start) {
    state.survey.dates.end = date;
  } else {
    state.survey.dates = { start: date, end: null };
  }
  renderCalendar();
}

function updateDateDisplay() {
  const display = document.getElementById('cal-dates-display');
  if (!display) return;
  const { start, end } = state.survey.dates;
  if (!start) {
    display.textContent = t('selectDates');
    return;
  }
  const fmt = (d) => d.toLocaleDateString(state.lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' });
  if (start && !end) display.textContent = t('dateStart') + fmt(start);
  else display.textContent = t('dateStart') + fmt(start) + t('dateEnd') + fmt(end);
}

function prevMonth() {
  if (state.calMonth === 0) { state.calMonth = 11; state.calYear--; }
  else state.calMonth--;
  renderCalendar();
}

function nextMonth() {
  if (state.calMonth === 11) { state.calMonth = 0; state.calYear++; }
  else state.calMonth++;
  renderCalendar();
}

// ── GOOGLE MAPS LOADED CALLBACK ──────────────
function onMapsLoaded() {
  state.mapsReady = true;
  console.log('Google Maps ready');
}

// ── SUBMIT SURVEY & FETCH PLACES ─────────────
async function submitSurvey() {
  syncSurveyState();
  go(2);

  document.getElementById('loading-places').style.display = 'flex';
  document.getElementById('places-list').innerHTML = '';
  document.getElementById('error-places').style.display = 'none';
  document.getElementById('s2-actions').style.display = 'none';

  try {
    const places = await fetchPlacesFromGoogle();
    state.places = places;
    state.selectedPlaces = places.slice(0, 8);
    renderPlaces(state.selectedPlaces);
  } catch (err) {
    console.error('Places error:', err);
    document.getElementById('loading-places').style.display = 'none';
    document.getElementById('error-places').style.display = 'block';
  }
}

// ── GOOGLE PLACES API CALL ───────────────────
function fetchPlacesFromGoogle() {
  return new Promise((resolve, reject) => {
    if (!state.mapsReady) {
      reject(new Error('Maps not loaded'));
      return;
    }

    const service = new google.maps.places.PlacesService(
      document.createElement('div')
    );

    const allTypes = state.survey.interests.flatMap(i => INTEREST_TO_TYPES[i] || []);
    const uniqueTypes = [...new Set(allTypes)];
    const primaryType = uniqueTypes[0] || 'tourist_attraction';

    const request = {
      location: new google.maps.LatLng(MADRID_CENTER.lat, MADRID_CENTER.lng),
      radius: 5000,
      type: primaryType,
      language: state.lang === 'es' ? 'es' : 'en'
    };

    service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        const filtered = results
          .filter(p => {
            if (!p.business_status || p.business_status === 'OPERATIONAL') return true;
            return false;
          })
          .sort((a, b) => (b.rating || 0) - (a.rating || 0));
        resolve(filtered);
      } else {
        // Fallback to curated Madrid places if API returns nothing
        resolve(getFallbackPlaces());
      }
    });
  });
}

// ── FALLBACK PLACES (curated Madrid data) ────
function getFallbackPlaces() {
  const es = state.lang === 'es';
  return [
    {
      name: 'Museo del Prado',
      vicinity: 'Calle de Ruiz de Alarcón, 23, Madrid',
      rating: 4.9,
      user_ratings_total: 85420,
      price_level: 2,
      geometry: { location: { lat: () => 40.4138, lng: () => -3.6922 } },
      types: ['museum'],
      emoji: '🏛️',
      gradient: 'linear-gradient(135deg,#003DA5,#1A6FE0)',
      description: es
        ? 'La pinacoteca más importante de España. Velázquez, Goya, El Bosco y más de 8.000 obras maestras.'
        : 'Spain\'s most important art museum. Velázquez, Goya, El Bosco and over 8,000 masterworks.'
    },
    {
      name: 'Parque del Retiro',
      vicinity: 'Plaza de la Independencia, Madrid',
      rating: 4.8,
      user_ratings_total: 120300,
      price_level: 1,
      geometry: { location: { lat: () => 40.4153, lng: () => -3.6844 } },
      types: ['park'],
      emoji: '🌳',
      gradient: 'linear-gradient(135deg,#1a6f40,#2d9e60)',
      description: es
        ? 'El pulmón verde de Madrid. Perfecto para pasear, remar en el lago y disfrutar al aire libre.'
        : 'Madrid\'s green lung. Perfect for walking, rowing on the lake and enjoying the outdoors.'
    },
    {
      name: 'Museo Reina Sofía',
      vicinity: 'Calle de Santa Isabel, 52, Madrid',
      rating: 4.7,
      user_ratings_total: 62100,
      price_level: 2,
      geometry: { location: { lat: () => 40.4080, lng: () => -3.6940 } },
      types: ['museum', 'art_gallery'],
      emoji: '🎨',
      gradient: 'linear-gradient(135deg,#4a1a8f,#7a3ad0)',
      description: es
        ? 'Arte contemporáneo y el Guernica de Picasso. Imprescindible para cualquier visita a Madrid.'
        : 'Contemporary art and Picasso\'s Guernica. Essential for any visit to Madrid.'
    },
    {
      name: 'Palacio Real de Madrid',
      vicinity: 'Calle de Bailén, s/n, Madrid',
      rating: 4.7,
      user_ratings_total: 95600,
      price_level: 2,
      geometry: { location: { lat: () => 40.4179, lng: () => -3.7143 } },
      types: ['tourist_attraction'],
      emoji: '🏰',
      gradient: 'linear-gradient(135deg,#C8922A,#E8A830)',
      description: es
        ? 'La residencia oficial de la Familia Real española. Arquitectura barroca y colecciones de arte únicas.'
        : 'The official residence of the Spanish Royal Family. Baroque architecture and unique art collections.'
    },
    {
      name: 'Gran Vía',
      vicinity: 'Gran Vía, Madrid',
      rating: 4.6,
      user_ratings_total: 78900,
      price_level: 2,
      geometry: { location: { lat: () => 40.4200, lng: () => -3.7026 } },
      types: ['tourist_attraction'],
      emoji: '🌆',
      gradient: 'linear-gradient(135deg,#1A3A8F,#2A5ABF)',
      description: es
        ? 'El bulevar más famoso de Madrid. Tiendas, teatros, restaurantes y arquitectura impresionante.'
        : 'Madrid\'s most famous boulevard. Shops, theatres, restaurants and impressive architecture.'
    },
    {
      name: 'Mercado de San Miguel',
      vicinity: 'Plaza de San Miguel, s/n, Madrid',
      rating: 4.5,
      user_ratings_total: 54200,
      price_level: 2,
      geometry: { location: { lat: () => 40.4152, lng: () => -3.7089 } },
      types: ['food'],
      emoji: '🍢',
      gradient: 'linear-gradient(135deg,#8f3a1a,#c05030)',
      description: es
        ? 'Mercado gastronómico en una joya de hierro fundido del siglo XX. Tapas, vinos y gastronomía local.'
        : 'Gourmet market in a 20th century cast iron jewel. Tapas, wines and local gastronomy.'
    },
    {
      name: 'Barrio de Malasaña',
      vicinity: 'Malasaña, Madrid',
      rating: 4.6,
      user_ratings_total: 31500,
      price_level: 2,
      geometry: { location: { lat: () => 40.4264, lng: () => -3.7063 } },
      types: ['neighborhood'],
      emoji: '🎸',
      gradient: 'linear-gradient(135deg,#2a1a6f,#5030a0)',
      description: es
        ? 'El barrio más bohemio y alternativo de Madrid. Arte callejero, bares con encanto y tiendas vintage.'
        : 'Madrid\'s most bohemian and alternative neighbourhood. Street art, charming bars and vintage shops.'
    },
    {
      name: 'Templo de Debod',
      vicinity: 'Calle de Ferraz, 1, Madrid',
      rating: 4.6,
      user_ratings_total: 47800,
      price_level: 1,
      geometry: { location: { lat: () => 40.4228, lng: () => -3.7183 } },
      types: ['tourist_attraction'],
      emoji: '🏺',
      gradient: 'linear-gradient(135deg,#8f6a1a,#c09030)',
      description: es
        ? 'Templo egipcio de 2.200 años de antigüedad en el corazón de Madrid. Vistas espectaculares al atardecer.'
        : '2,200-year-old Egyptian temple in the heart of Madrid. Spectacular sunset views.'
    }
  ];
}

// ── RENDER PLACES ────────────────────────────
function renderPlaces(places) {
  document.getElementById('loading-places').style.display = 'none';
  const list = document.getElementById('places-list');
  list.innerHTML = '';

  if (!places || places.length === 0) {
    list.innerHTML = `<p style="text-align:center;color:var(--muted);padding:30px">${t('noPlaces')}</p>`;
    return;
  }

  const count = places.length;
  document.getElementById('results-count').textContent =
    count + ' ' + (count === 1 ? t('lugar') : t('lugares'));

  places.forEach((place, idx) => {
    const card = createPlaceCard(place, idx);
    list.appendChild(card);
  });

  document.getElementById('s2-actions').style.display = 'flex';
}

function createPlaceCard(place, idx) {
  const card = document.createElement('div');
  card.className = 'place-card';

  const emoji = place.emoji || getEmojiForType(place.types);
  const gradient = place.gradient || getGradientForType(place.types);
  const rating = place.rating ? `⭐ ${place.rating}` : '';
  const priceLevel = place.price_level ? '💰 ' + '$'.repeat(place.price_level) : '';
  const mobility = state.survey.mobility.includes('transit') ? '🚇 Metro' : '🚶 15 min';
  const description = place.description || (state.lang === 'es'
    ? 'Un lugar imprescindible en tu visita a Madrid.'
    : 'A must-see during your visit to Madrid.');
  const badgeText = idx === 0 ? t('topPick') : (idx < 3 ? t('recommended') : '');

  card.innerHTML = `
    <div class="place-img" style="background:${gradient}">
      ${emoji}
      ${badgeText ? `<div class="place-badge">${badgeText}</div>` : ''}
    </div>
    <div class="place-info">
      <div class="place-name">${place.name}</div>
      <div class="place-desc">${description}</div>
      <div class="place-meta">
        <span class="place-meta-tag">${mobility}</span>
        ${priceLevel ? `<span class="place-meta-tag">${priceLevel}</span>` : ''}
        ${rating ? `<span class="place-meta-tag">${rating}</span>` : ''}
      </div>
    </div>
  `;

  card.onclick = () => showPlaceDetail(place);
  return card;
}

function showPlaceDetail(place) {
  // In Phase 2 this opens a detail modal; for now go to map
  if (!state.selectedPlaces.includes(place)) {
    state.selectedPlaces.push(place);
  }
  initMap();
}

// ── HELPERS ──────────────────────────────────
function getEmojiForType(types) {
  if (!types) return '📍';
  const map = { museum:'🏛️', art_gallery:'🎨', park:'🌳', church:'⛪', bar:'🍸',
    night_club:'🌙', restaurant:'🍽️', spa:'🧘', stadium:'🏟️', tourist_attraction:'🗺️' };
  for (const t of types) { if (map[t]) return map[t]; }
  return '📍';
}

function getGradientForType(types) {
  if (!types) return 'linear-gradient(135deg,#003DA5,#1A6FE0)';
  if (types.includes('park')) return 'linear-gradient(135deg,#1a6f40,#2d9e60)';
  if (types.includes('museum') || types.includes('art_gallery')) return 'linear-gradient(135deg,#4a1a8f,#7a3ad0)';
  if (types.includes('bar') || types.includes('night_club')) return 'linear-gradient(135deg,#1a1a6f,#3030a0)';
  if (types.includes('restaurant')) return 'linear-gradient(135deg,#8f3a1a,#c05030)';
  return 'linear-gradient(135deg,#003DA5,#1A6FE0)';
}

// ── GOOGLE MAP ────────────────────────────────
function initMap() {
  go(3);
  if (!state.mapsReady) {
    alert(t('mapsNotReady'));
    return;
  }
  setTimeout(renderMap, 300);
}

function renderMap() {
  const mapEl = document.getElementById('google-map');
  if (!mapEl || !state.mapsReady) return;

  const places = state.selectedPlaces.length > 0 ? state.selectedPlaces : getFallbackPlaces().slice(0, 3);

  // Init map
  if (!state.map) {
    state.map = new google.maps.Map(mapEl, {
      center: MADRID_CENTER,
      zoom: 14,
      mapId: 'madridya_map',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'simplified' }] }
      ]
    });
  }

  // Clear old markers
  state.markers.forEach(m => m.setMap(null));
  state.markers = [];

  // Add markers
  places.slice(0, 8).forEach((place, idx) => {
    const lat = typeof place.geometry.location.lat === 'function'
      ? place.geometry.location.lat()
      : place.geometry.location.lat;
    const lng = typeof place.geometry.location.lng === 'function'
      ? place.geometry.location.lng()
      : place.geometry.location.lng;

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: state.map,
      title: place.name,
      label: {
        text: String(idx + 1),
        color: 'white',
        fontWeight: 'bold',
        fontSize: '12px'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 16,
        fillColor: idx === 0 ? '#C8922A' : '#003DA5',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="font-family:Inter,sans-serif;padding:4px 2px">
        <strong style="font-size:.9rem">${place.name}</strong>
        <p style="font-size:.78rem;color:#6B7FA3;margin-top:3px">${place.vicinity || ''}</p>
        ${place.rating ? `<p style="font-size:.78rem;color:#C8922A">⭐ ${place.rating}</p>` : ''}
      </div>`
    });
    marker.addListener('click', () => {
      infoWindow.open(state.map, marker);
    });

    state.markers.push(marker);
  });

  // Draw route
  drawRoute(places.slice(0, 5));
  renderStops(places.slice(0, 5));
}

function drawRoute(places) {
  if (!state.mapsReady || places.length < 2) return;

  if (state.directionsRenderer) {
    state.directionsRenderer.setMap(null);
  }

  const directionsService = new google.maps.DirectionsService();
  state.directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#003DA5',
      strokeWeight: 4,
      strokeOpacity: 0.8
    }
  });
  state.directionsRenderer.setMap(state.map);

  const getLoc = (p) => {
    const lat = typeof p.geometry.location.lat === 'function' ? p.geometry.location.lat() : p.geometry.location.lat;
    const lng = typeof p.geometry.location.lng === 'function' ? p.geometry.location.lng() : p.geometry.location.lng;
    return new google.maps.LatLng(lat, lng);
  };

  const origin = getLoc(places[0]);
  const destination = getLoc(places[places.length - 1]);
  const waypoints = places.slice(1, -1).map(p => ({ location: getLoc(p), stopover: true }));

  const travelMode = state.survey.mobility.includes('transit')
    ? google.maps.TravelMode.TRANSIT
    : state.survey.mobility.includes('bike')
    ? google.maps.TravelMode.BICYCLING
    : google.maps.TravelMode.WALKING;

  directionsService.route({
    origin, destination, waypoints, travelMode,
    optimizeWaypoints: false
  }, (result, status) => {
    if (status === 'OK') {
      state.directionsRenderer.setDirections(result);
    }
  });
}

// ── RENDER STOPS ──────────────────────────────
function renderStops(places) {
  const list = document.getElementById('stops-list');
  if (!list) return;
  list.innerHTML = '';

  const completed = state.completedStops.length;
  const total = places.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + t('progressLabel');

  const baseHour = 10;
  places.forEach((place, idx) => {
    const item = document.createElement('div');
    item.className = 'stop-item';
    const hour = baseHour + (idx * 2);
    const timeStr = `${hour}:00`;
    const isDone = state.completedStops.includes(idx);
    const isCurrent = idx === state.completedStops.length;
    const statusClass = isDone ? 'done' : (isCurrent ? 'current' : 'pending');
    const statusLabel = isDone ? t('completado') : (isCurrent ? t('enCamino') : t('pendiente'));

    item.innerHTML = `
      <div class="stop-num ${statusClass}">${isDone ? '✓' : idx + 1}</div>
      <div class="stop-info">
        <div class="stop-name">${place.name}</div>
        <div class="stop-time">${timeStr} · ${statusLabel}</div>
      </div>
      <button class="stop-remove" onclick="removeStop(${idx})">− Quitar</button>
    `;

    if (isDone) item.style.opacity = '.65';
    list.appendChild(item);
  });
}

function removeStop(idx) {
  state.selectedPlaces.splice(idx, 1);
  if (state.map) {
    renderMap();
  }
}

function addStop() {
  go(2);
}

function shareRoute() {
  const url = window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert(t('routeShared')));
  } else {
    alert(url);
  }
}

// ── CHATBOT ───────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addChatMessage(text, 'user');
  showTyping();

  try {
    const reply = await callGeminiChat(text);
    removeTyping();
    addChatMessage(reply, 'bot');
  } catch (err) {
    removeTyping();
    addChatMessage(t('chatError'), 'bot');
  }
}

function askQuick(btn) {
  const q = btn.getAttribute('data-' + state.lang) || btn.textContent;
  document.getElementById('chat-input').value = q.replace(/^[^\s]+\s/, '');
  sendMessage();
}

function addChatMessage(text, role) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role === 'bot' ? 'bot' : 'user'}`;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="mb">${text}</div>
    <div class="msg-time">${now}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  state.chatHistory.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
}

function showTyping() {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="typing-indicator"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

// ── GEMINI CHAT API ───────────────────────────
async function callGeminiChat(userMessage) {
  const GEMINI_KEY = window.GEMINI_API_KEY;
  if (!GEMINI_KEY || GEMINI_KEY === 'PLACEHOLDER_GEMINI_KEY') {
    return getFallbackChatResponse(userMessage);
  }

  const systemPrompt = state.lang === 'es'
    ? `Eres el asistente turístico de MadridYa, una app de turismo de Madrid. 
       Respondes SOLO preguntas puntuales sobre Madrid: horarios, precios, cómo llegar, 
       recomendaciones de sitios concretos, clima, transporte. 
       NO creas itinerarios completos (eso lo hace otro módulo).
       Sé conciso, amable y en español. Máximo 3 frases por respuesta.`
    : `You are the tourist assistant for MadridYa, a Madrid tourism app.
       You ONLY answer quick questions about Madrid: opening hours, prices, directions,
       specific place recommendations, weather, transport.
       Do NOT create full itineraries (another module handles that).
       Be concise, friendly and in English. Maximum 3 sentences per answer.`;

  const messages = [
    ...state.chatHistory.slice(-6),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
      })
    }
  );

  if (!response.ok) throw new Error('Gemini API error');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || t('chatError');
}

function getFallbackChatResponse(msg) {
  const es = state.lang === 'es';
  const lower = msg.toLowerCase();
  if (lower.includes('prado') && (lower.includes('hora') || lower.includes('abre') || lower.includes('opening')))
    return es ? 'El Museo del Prado abre de lunes a sábado de 10:00 a 20:00, y domingos de 10:00 a 19:00. No cierra ningún día. 🎨'
              : 'Museo del Prado opens Monday-Saturday 10am-8pm, Sundays 10am-7pm. Open every day. 🎨';
  if (lower.includes('metro'))
    return es ? 'El metro de Madrid tiene 12 líneas y funciona de 6:00 a 1:30. El billete sencillo cuesta 1,50-2€ según zona. 🚇'
              : 'Madrid metro has 12 lines, running 6am-1:30am. Single ticket costs €1.50-2 depending on zone. 🚇';
  if (lower.includes('tiempo') || lower.includes('weather') || lower.includes('clima'))
    return es ? 'Madrid tiene clima continental: veranos calurosos (30-35°C) e inviernos fríos (5-10°C). ¡Comprueba la previsión del día! ☀️'
              : 'Madrid has a continental climate: hot summers (30-35°C) and cold winters (5-10°C). Check today\'s forecast! ☀️';
  if (lower.includes('taxi') || lower.includes('uber'))
    return es ? 'Puedes usar taxis (tarifa mínima ~4€) o Uber y Cabify. El trayecto del aeropuerto cuesta tarifa fija de 30€. 🚖'
              : 'You can use taxis (min fare ~€4) or Uber and Cabify. Airport transfer is a fixed €30 fare. 🚖';
  return es
    ? 'Estoy aquí para ayudarte con cualquier duda sobre Madrid: horarios, precios, transporte o recomendaciones. ¿Qué necesitas? 😊'
    : 'I\'m here to help with any Madrid question: opening hours, prices, transport or recommendations. What do you need? 😊';
}



// ── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  // Set today as start date
  state.survey.dates.start = new Date();
  state.survey.dates.end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  renderCalendar();
});
