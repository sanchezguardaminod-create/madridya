/* ═══════════════════════════════════════════
   MADRIDYA — app.js v5
   Real Google Places API integration
═══════════════════════════════════════════ */

const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };

const state = {
  lang: 'es',
  survey: {
    firstTime: 'yes', budget: '$$',
    dates: { start: null, end: null },
    mobility: ['walking'], interests: ['museums','art','nightlife'], food: ['local']
  },
  allPlaces: [],
  selectedPlaces: [],
  allRestaurants: [],
  map: null, markers: [], directionsRenderer: null,
  userLocation: null, userMarker: null, watchId: null,
  completedStops: [],
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
  mapsReady: false, navigating: false,
  placesService: null
};

// ══════════════════════════════════════════════
// GOOGLE MAPS LOADED CALLBACK
// ══════════════════════════════════════════════
function onMapsLoaded() {
  state.mapsReady = true;
  // Init a hidden div for PlacesService
  const div = document.createElement('div');
  document.body.appendChild(div);
  const tempMap = new google.maps.Map(div, { center: MADRID_CENTER, zoom: 14 });
  state.placesService = new google.maps.places.PlacesService(tempMap);
  console.log('Google Maps & Places ready ✅');
}

// ══════════════════════════════════════════════
// INTEREST → PLACES TYPE MAPPING
// ══════════════════════════════════════════════
const INTEREST_TYPES = {
  museums:   'museum',
  art:       'art_gallery',
  churches:  'church',
  sport:     'stadium',
  nightlife: 'night_club',
  parks:     'park',
  wellness:  'spa',
  bars:      'bar'
};

const FOOD_TYPES = {
  local:    'restaurant',
  italian:  'restaurant',
  japanese: 'restaurant',
  mexican:  'restaurant',
  vegan:    'restaurant',
  brunch:   'cafe'
};

const FOOD_KEYWORDS = {
  local:    'restaurante español tapas Madrid',
  italian:  'restaurante italiano Madrid',
  japanese: 'restaurante japonés sushi Madrid',
  mexican:  'restaurante mexicano Madrid',
  vegan:    'restaurante vegano vegetariano Madrid',
  brunch:   'brunch café Madrid'
};

// ══════════════════════════════════════════════
// MEAL SCHEDULE BY TIME OF DAY
// ══════════════════════════════════════════════
function getMealSchedule() {
  const hour = new Date().getHours();
  if (hour < 9) {
    return [
      { type:'breakfast', label: state.lang==='es'?'☕ Desayuno':'☕ Breakfast', time:'09:00' },
      { type:'lunch',     label: state.lang==='es'?'🍽️ Comida':'🍽️ Lunch',     time:'14:30' },
      { type:'dinner',    label: state.lang==='es'?'🌙 Cena':'🌙 Dinner',       time:'20:30' }
    ];
  }
  if (hour < 11) {
    return [
      { type:'lunch',  label: state.lang==='es'?'🍽️ Comida':'🍽️ Lunch',  time:'14:30' },
      { type:'dinner', label: state.lang==='es'?'🌙 Cena':'🌙 Dinner',    time:'20:30' }
    ];
  }
  return [
    { type:'dinner', label: state.lang==='es'?'🌙 Cena':'🌙 Dinner', time:'20:30' }
  ];
}

// ══════════════════════════════════════════════
// FETCH REAL ATTRACTIONS FROM GOOGLE PLACES
// ══════════════════════════════════════════════
function fetchAttractions() {
  return new Promise((resolve) => {
    if (!state.mapsReady || !state.placesService) {
      console.warn('Places not ready, using fallback');
      resolve(getFallbackAttractions());
      return;
    }

    const interests = state.survey.interests;
    const radius = state.survey.mobility.includes('walking') ? 2500
                 : state.survey.mobility.includes('bike')    ? 4000
                 : 8000;

    // Fetch for each interest type, then merge and deduplicate
    const types = [...new Set(interests.map(i => INTEREST_TYPES[i]).filter(Boolean))];
    if (types.length === 0) types.push('tourist_attraction');

    const promises = types.slice(0, 3).map(type => new Promise(res => {
      state.placesService.nearbySearch({
        location: new google.maps.LatLng(MADRID_CENTER.lat, MADRID_CENTER.lng),
        radius,
        type,
        language: state.lang
      }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) res(results);
        else res([]);
      });
    }));

    Promise.all(promises).then(arrays => {
      const merged = arrays.flat();
      // Deduplicate by place_id
      const seen = new Set();
      const unique = merged.filter(p => {
        if (seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      });
      // Sort by rating
      const sorted = unique
        .filter(p => p.business_status === 'OPERATIONAL' || !p.business_status)
        .sort((a,b) => (b.rating||0) - (a.rating||0));

      if (sorted.length > 0) {
        console.log(`✅ Google Places returned ${sorted.length} attractions`);
        resolve(sorted);
      } else {
        console.warn('No results from Places API, using fallback');
        resolve(getFallbackAttractions());
      }
    });
  });
}

// ══════════════════════════════════════════════
// FETCH REAL RESTAURANTS FROM GOOGLE PLACES
// ══════════════════════════════════════════════
function fetchRestaurants() {
  return new Promise((resolve) => {
    if (!state.mapsReady || !state.placesService) {
      resolve(getFallbackRestaurants());
      return;
    }

    const foods = state.survey.food;
    const keyword = foods.map(f => FOOD_KEYWORDS[f] || '').filter(Boolean).join(' ') || 'restaurante Madrid';
    const radius = state.survey.mobility.includes('walking') ? 2000
                 : state.survey.mobility.includes('bike')    ? 4000
                 : 6000;

    state.placesService.nearbySearch({
      location: new google.maps.LatLng(MADRID_CENTER.lat, MADRID_CENTER.lng),
      radius,
      type: 'restaurant',
      keyword,
      language: state.lang
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        console.log(`✅ Google Places returned ${results.length} restaurants`);
        resolve(results.sort((a,b) => (b.rating||0) - (a.rating||0)).slice(0, 8));
      } else {
        console.warn('No restaurant results, using fallback');
        resolve(getFallbackRestaurants());
      }
    });
  });
}

// ══════════════════════════════════════════════
// GET PHOTO URL FROM GOOGLE PLACES
// ══════════════════════════════════════════════
function getPhotoUrl(place, maxWidth = 400) {
  if (place.photos && place.photos.length > 0) {
    return place.photos[0].getUrl({ maxWidth, maxHeight: 300 });
  }
  return null;
}

// ══════════════════════════════════════════════
// SUBMIT SURVEY
// ══════════════════════════════════════════════
async function submitSurvey() {
  syncSurvey();
  go(2);
  document.getElementById('loading-places').style.display = 'flex';
  document.getElementById('places-list').innerHTML = '';
  document.getElementById('error-places').style.display = 'none';
  document.getElementById('s2-actions').style.display = 'none';
  state.completedStops = [];

  try {
    const [attractions, restaurants] = await Promise.all([
      fetchAttractions(),
      fetchRestaurants()
    ]);
    state.allPlaces = attractions;
    state.selectedPlaces = attractions.slice(0, 5);
    state.allRestaurants = restaurants.length > 0 ? restaurants : getFallbackRestaurants();
    renderResults();
  } catch(e) {
    console.error('Error fetching places:', e);
    document.getElementById('loading-places').style.display = 'none';
    document.getElementById('error-places').style.display = 'block';
  }
}

// ══════════════════════════════════════════════
// RENDER RESULTS
// ══════════════════════════════════════════════
function renderResults() {
  document.getElementById('loading-places').style.display = 'none';
  const list = document.getElementById('places-list');
  list.innerHTML = '';

  const meals = getMealSchedule();
  const restaurants = state.allRestaurants;
  const attractions = state.allPlaces.slice(0, 6);

  // Build timeline with meals inserted at correct times
  const timeline = [];
  let currentHour = 10;
  const mealsCopy = [...meals];

  attractions.forEach((place, idx) => {
    // Insert meals that should appear before this slot
    const toInsert = mealsCopy.filter(m => parseInt(m.time) <= currentHour + 1);
    toInsert.forEach(meal => {
      mealsCopy.splice(mealsCopy.indexOf(meal), 1);
      const rest = restaurants[timeline.filter(x=>x.type==='meal').length % Math.max(restaurants.length,1)];
      timeline.push({ type:'meal', meal, restaurant: rest });
    });
    timeline.push({ type:'place', place, idx });
    currentHour += 2;
  });

  // Append any remaining meals
  mealsCopy.forEach(meal => {
    const rest = restaurants[timeline.filter(x=>x.type==='meal').length % Math.max(restaurants.length,1)];
    timeline.push({ type:'meal', meal, restaurant: rest });
  });

  timeline.forEach(item => {
    if (item.type === 'place') list.appendChild(buildPlaceCard(item.place, item.idx));
    else list.appendChild(buildMealCard(item.restaurant, item.meal));
  });

  document.getElementById('results-count').textContent =
    state.selectedPlaces.length + ' ' + (state.lang==='es'?'lugares':'places');
  document.getElementById('s2-actions').style.display = 'flex';
}

// ══════════════════════════════════════════════
// BUILD PLACE CARD (with real photo if available)
// ══════════════════════════════════════════════
function buildPlaceCard(place, idx) {
  const inRoute = state.selectedPlaces.includes(place);
  const photoUrl = getPhotoUrl(place);
  const emoji = place.emoji || getEmoji(place.types);
  const gradient = place.gradient || getGradient(place.types);
  const rating = place.rating ? `⭐ ${place.rating}` : '';
  const price = place.price_level ? '💰' + '$'.repeat(place.price_level) : '';
  const mobLabel = state.survey.mobility.includes('transit') ? '🚇 Metro'
                 : state.survey.mobility.includes('bike')    ? '🚴 Bici'
                 : '🚶 ~15 min';
  const badge = idx===0 ? 'Top pick' : idx<3 ? (state.lang==='es'?'Recomendado':'Recommended') : '';
  const desc = place.description || place.vicinity || (state.lang==='es'?'Un lugar imprescindible en Madrid.':'A must-see in Madrid.');
  const addLabel    = state.lang==='es' ? '+ Añadir a ruta' : '+ Add to route';
  const removeLabel = state.lang==='es' ? '− Quitar de ruta' : '− Remove from route';

  const card = document.createElement('div');
  card.className = 'place-card' + (inRoute ? ' in-route' : '');

  // Image: real photo or gradient fallback
  const imgHtml = photoUrl
    ? `<img class="place-photo" src="${photoUrl}" alt="${place.name}" loading="lazy">`
    : `<div class="place-img-fallback" style="background:${gradient}">${emoji}</div>`;

  card.innerHTML = `
    <div class="place-img-wrap">
      ${imgHtml}
      ${badge ? `<div class="place-badge">${badge}</div>` : ''}
    </div>
    <div class="place-info">
      <div class="place-name">${place.name}</div>
      <div class="place-desc">${desc}</div>
      <div class="place-meta">
        <span class="place-meta-tag">${mobLabel}</span>
        ${price ? `<span class="place-meta-tag">${price}</span>` : ''}
        ${rating ? `<span class="place-meta-tag">${rating}</span>` : ''}
      </div>
    </div>
    <div class="place-card-actions">
      <button class="card-add-btn ${inRoute?'hidden':''}" onclick="addToRoute(this,${idx})">${addLabel}</button>
      <button class="card-remove-btn ${inRoute?'':'hidden'}" onclick="removeFromRoute(this,${idx})">${removeLabel}</button>
    </div>
  `;
  return card;
}

// ══════════════════════════════════════════════
// BUILD MEAL CARD (with real photo if available)
// ══════════════════════════════════════════════
function buildMealCard(restaurant, meal) {
  const photoUrl = getPhotoUrl(restaurant);
  const emoji = restaurant.emoji || '🍽️';
  const gradient = restaurant.gradient || 'linear-gradient(135deg,#8f3a1a,#c05030)';
  const desc = restaurant.description || restaurant.vicinity || '';
  const rating = restaurant.rating ? `⭐${restaurant.rating}` : '';
  const price = restaurant.price_level ? '💰'+'$'.repeat(restaurant.price_level) : '';

  const imgHtml = photoUrl
    ? `<img class="place-photo" src="${photoUrl}" alt="${restaurant.name}" loading="lazy">`
    : `<div class="place-img-fallback" style="background:${gradient}">${emoji}</div>`;

  const wrap = document.createElement('div');
  wrap.className = 'meal-section';
  wrap.innerHTML = `
    <div class="meal-header">
      <span>${meal.label}</span>
      <span class="meal-time">${meal.time}</span>
    </div>
    <div class="place-card" style="margin-bottom:0">
      <div class="place-img-wrap">${imgHtml}</div>
      <div class="place-info">
        <div class="place-name">${restaurant.name}</div>
        <div class="place-desc">${desc}</div>
        <div class="place-meta">
          ${price?`<span class="place-meta-tag">${price}</span>`:''}
          ${rating?`<span class="place-meta-tag">${rating}</span>`:''}
        </div>
      </div>
    </div>
  `;
  return wrap;
}

// ══════════════════════════════════════════════
// ADD / REMOVE FROM ROUTE
// ══════════════════════════════════════════════
function addToRoute(btn, idx) {
  const place = state.allPlaces[idx];
  if (!place || state.selectedPlaces.includes(place)) return;
  state.selectedPlaces.push(place);
  const card = btn.closest('.place-card');
  card.classList.add('in-route');
  card.querySelector('.card-add-btn').classList.add('hidden');
  card.querySelector('.card-remove-btn').classList.remove('hidden');
  document.getElementById('results-count').textContent = state.selectedPlaces.length + ' ' + (state.lang==='es'?'lugares':'places');
}

function removeFromRoute(btn, idx) {
  const place = state.allPlaces[idx];
  if (!place) return;
  state.selectedPlaces = state.selectedPlaces.filter(p => p !== place);
  const card = btn.closest('.place-card');
  card.classList.remove('in-route');
  card.querySelector('.card-add-btn').classList.remove('hidden');
  card.querySelector('.card-remove-btn').classList.add('hidden');
  document.getElementById('results-count').textContent = state.selectedPlaces.length + ' ' + (state.lang==='es'?'lugares':'places');
}

// ══════════════════════════════════════════════
// NEW ROUTE MODAL
// ══════════════════════════════════════════════
function showNewRouteModal() { document.getElementById('new-route-modal').style.display = 'flex'; }
function closeNewRouteModal() { document.getElementById('new-route-modal').style.display = 'none'; }
function closeModalOutside(e) { if (e.target.id==='new-route-modal') closeNewRouteModal(); }

function generateNewRoute() {
  closeNewRouteModal();
  state.selectedPlaces = [];
  state.completedStops = [];
  state.allPlaces = [...state.allPlaces].sort(() => Math.random() - 0.5);
  state.selectedPlaces = state.allPlaces.slice(0, 5);
  renderResults();
}

function editProfile() { closeNewRouteModal(); go(1); }

// ══════════════════════════════════════════════
// MAP
// ══════════════════════════════════════════════
function initMap() {
  go(3);
  if (state.mapsReady && state.selectedPlaces.length > 0) setTimeout(renderMap, 300);
}

function renderMap() {
  const mapEl = document.getElementById('google-map');
  if (!mapEl || !state.mapsReady) return;
  const places = state.selectedPlaces.length > 0 ? state.selectedPlaces : getFallbackAttractions().slice(0,3);

  if (!state.map) {
    state.map = new google.maps.Map(mapEl, {
      center: state.userLocation || MADRID_CENTER,
      zoom: 14,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      styles: [{ featureType:'poi', elementType:'labels', stylers:[{visibility:'off'}] }]
    });
  }

  state.markers.forEach(m => m.setMap(null));
  state.markers = [];

  places.slice(0,8).forEach((place, idx) => {
    const lat = typeof place.geometry.location.lat==='function' ? place.geometry.location.lat() : place.geometry.location.lat;
    const lng = typeof place.geometry.location.lng==='function' ? place.geometry.location.lng() : place.geometry.location.lng;
    const marker = new google.maps.Marker({
      position:{lat,lng}, map:state.map, title:place.name,
      label:{text:String(idx+1),color:'white',fontWeight:'bold',fontSize:'12px'},
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:16,fillColor:idx===0?'#C8922A':'#003DA5',fillOpacity:1,strokeColor:'white',strokeWeight:2}
    });
    const iw = new google.maps.InfoWindow({
      content:`<div style="font-family:Inter,sans-serif;padding:4px;max-width:180px">
        <strong style="font-size:.85rem">${place.name}</strong>
        <p style="font-size:.72rem;color:#6B7FA3;margin-top:2px">${place.vicinity||''}</p>
        ${place.rating?`<p style="color:#C8922A;font-size:.72rem">⭐ ${place.rating}</p>`:''}
      </div>`
    });
    marker.addListener('click', () => iw.open(state.map, marker));
    state.markers.push(marker);
  });

  drawRoute(places.slice(0,5));
  renderStops(places.slice(0,5));
  document.getElementById('start-route-btn').style.display = 'flex';
  if (state.userLocation) showUserOnMap(state.userLocation);
}

function drawRoute(places) {
  if (!state.mapsReady || places.length < 2) return;
  if (state.directionsRenderer) state.directionsRenderer.setMap(null);
  state.directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: { strokeColor:'#003DA5', strokeWeight:4, strokeOpacity:.8 }
  });
  state.directionsRenderer.setMap(state.map);

  const getLoc = p => {
    const lat = typeof p.geometry.location.lat==='function'?p.geometry.location.lat():p.geometry.location.lat;
    const lng = typeof p.geometry.location.lng==='function'?p.geometry.location.lng():p.geometry.location.lng;
    return new google.maps.LatLng(lat,lng);
  };
  const travelMode = state.survey.mobility.includes('transit') ? google.maps.TravelMode.TRANSIT
                   : state.survey.mobility.includes('bike')    ? google.maps.TravelMode.BICYCLING
                   : google.maps.TravelMode.WALKING;

  new google.maps.DirectionsService().route({
    origin: getLoc(places[0]),
    destination: getLoc(places[places.length-1]),
    waypoints: places.slice(1,-1).map(p=>({location:getLoc(p),stopover:true})),
    travelMode, optimizeWaypoints: false
  }, (result,status) => { if(status==='OK') state.directionsRenderer.setDirections(result); });
}

function renderStops(places) {
  const list = document.getElementById('stops-list');
  if (!list) return;
  list.innerHTML = '';
  const pct = places.length>0 ? Math.round((state.completedStops.length/places.length)*100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + (state.lang==='es'?'% completado':'% completed');
  places.forEach((p,idx) => {
    const done=state.completedStops.includes(idx), cur=idx===state.completedStops.length;
    const cls=done?'done':cur?'current':'pending';
    const lbl=done?(state.lang==='es'?'Completado':'Completed'):cur?(state.lang==='es'?'En camino':'On the way'):(state.lang==='es'?'Pendiente':'Pending');
    const item=document.createElement('div'); item.className='stop-item';
    item.innerHTML=`
      <div class="stop-num ${cls}">${done?'✓':idx+1}</div>
      <div class="stop-info">
        <div class="stop-name">${p.name}</div>
        <div class="stop-time">${10+idx*2}:00 · ${lbl}</div>
      </div>
      <button class="stop-remove" onclick="removeStopFromMap(${idx})">${state.lang==='es'?'− Quitar':'− Remove'}</button>
    `;
    if(done) item.style.opacity='.65';
    list.appendChild(item);
  });
}

function removeStopFromMap(idx) { state.selectedPlaces.splice(idx,1); if(state.map) renderMap(); }
function addStop() { go(2); }
function shareRoute() {
  if(navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(()=>alert(state.lang==='es'?'¡Enlace copiado!':'Link copied!'));
  else alert(window.location.href);
}

// ══════════════════════════════════════════════
// USER LOCATION & NAVIGATION
// ══════════════════════════════════════════════
function getUserLocation() {
  const btn=document.querySelector('.location-btn'), txt=document.getElementById('location-text');
  if(!navigator.geolocation){txt.textContent=state.lang==='es'?'No disponible':'Not available';return;}
  btn.textContent='...';
  txt.textContent=state.lang==='es'?'Obteniendo ubicación...':'Getting location...';
  navigator.geolocation.getCurrentPosition(pos=>{
    state.userLocation={lat:pos.coords.latitude,lng:pos.coords.longitude};
    txt.textContent=state.lang==='es'?'📍 Ubicación obtenida':'📍 Location found';
    txt.classList.add('active');
    btn.textContent=state.lang==='es'?'✓ Activo':'✓ Active';
    btn.classList.add('located');
    if(state.map){state.map.setCenter(state.userLocation);showUserOnMap(state.userLocation);}
  },()=>{
    txt.textContent=state.lang==='es'?'No se pudo obtener la ubicación':'Could not get location';
    btn.textContent=state.lang==='es'?'Reintentar':'Retry';
  },{enableHighAccuracy:true,timeout:10000});
}

function showUserOnMap(loc) {
  if(!state.map)return;
  if(state.userMarker)state.userMarker.setMap(null);
  state.userMarker=new google.maps.Marker({
    position:loc,map:state.map,
    title:state.lang==='es'?'Tu ubicación':'Your location',
    icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#22C55E',fillOpacity:1,strokeColor:'white',strokeWeight:3},
    zIndex:999
  });
}

function startNavigation() {
  if(!state.userLocation){getUserLocation();return;}
  state.navigating=true;
  const btn=document.getElementById('start-route-btn');
  btn.innerHTML='⏹ '+(state.lang==='es'?'Detener ruta':'Stop route');
  btn.onclick=stopNavigation;
  if(navigator.geolocation){
    state.watchId=navigator.geolocation.watchPosition(pos=>{
      state.userLocation={lat:pos.coords.latitude,lng:pos.coords.longitude};
      showUserOnMap(state.userLocation);
      state.map.panTo(state.userLocation);
      checkProximity(state.userLocation);
    },null,{enableHighAccuracy:true,maximumAge:5000});
  }
}

function stopNavigation() {
  state.navigating=false;
  if(state.watchId!==null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null;}
  const btn=document.getElementById('start-route-btn');
  btn.innerHTML='▶ '+(state.lang==='es'?'Iniciar ruta':'Start route');
  btn.onclick=startNavigation;
}

function checkProximity(loc) {
  const next=state.completedStops.length;
  if(next>=state.selectedPlaces.length)return;
  const p=state.selectedPlaces[next];
  const lat=typeof p.geometry.location.lat==='function'?p.geometry.location.lat():p.geometry.location.lat;
  const lng=typeof p.geometry.location.lng==='function'?p.geometry.location.lng():p.geometry.location.lng;
  if(getDist(loc,{lat,lng})<100){state.completedStops.push(next);renderStops(state.selectedPlaces.slice(0,5));}
}

function getDist(a,b){
  const R=6371000,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

// ══════════════════════════════════════════════
// LANGUAGE
// ══════════════════════════════════════════════
function toggleLang() {
  state.lang = state.lang==='es'?'en':'es';
  document.querySelector('.lang-btn').textContent = state.lang==='es'?'🌐 EN':'🌐 ES';
  document.querySelectorAll('[data-es]').forEach(el=>{
    const val=el.getAttribute('data-'+state.lang);
    if(!val)return;
    if(el.tagName==='INPUT')el.placeholder=val; else el.textContent=val;
  });
  document.documentElement.setAttribute('lang',state.lang);
  renderCalendar();
}

// ══════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════
function go(n) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('s'+n).classList.add('active');
  document.querySelectorAll('.tab')[n-1].classList.add('active');
  if(n===3&&state.mapsReady&&state.selectedPlaces.length>0) setTimeout(renderMap,200);
}

// ══════════════════════════════════════════════
// FORM
// ══════════════════════════════════════════════
function tog(btn){btn.classList.toggle('sel');syncSurvey();}
function soloSelect(btn,groupId){document.getElementById(groupId).querySelectorAll('.ob').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');syncSurvey();}
function selBudget(btn){document.querySelectorAll('.bb').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');state.survey.budget=btn.dataset.value;}
function syncSurvey(){
  state.survey.interests=[...document.querySelectorAll('#q-interests .sel')].map(b=>b.dataset.value);
  state.survey.food=[...document.querySelectorAll('#q-food .sel')].map(b=>b.dataset.value);
  state.survey.mobility=[...document.querySelectorAll('#q-mobility .sel')].map(b=>b.dataset.value);
  const ft=document.querySelector('#q-firsttime .sel');
  if(ft)state.survey.firstTime=ft.dataset.value;
}

// ══════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════
function renderCalendar(){
  const grid=document.getElementById('cal-grid'),title=document.getElementById('cal-title');
  if(!grid)return;
  const{calYear:y,calMonth:m}=state;
  const MONTHS={es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],en:['January','February','March','April','May','June','July','August','September','October','November','December']};
  title.textContent=MONTHS[state.lang][m]+' '+y;
  const firstDay=new Date(y,m,1).getDay(),offset=firstDay===0?6:firstDay-1,days=new Date(y,m+1,0).getDate();
  const today=new Date();today.setHours(0,0,0,0);
  grid.innerHTML='';
  for(let i=0;i<offset;i++){const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e);}
  for(let d=1;d<=days;d++){
    const el=document.createElement('div'),date=new Date(y,m,d);
    el.className='cal-day';el.textContent=d;
    if(date<today){el.classList.add('past');}
    else{
      el.onclick=()=>selectCalDay(new Date(y,m,d));
      const{start,end}=state.survey.dates;
      if(start&&sameDay(date,start))el.classList.add('start');
      else if(end&&sameDay(date,end))el.classList.add('end');
      else if(start&&end&&date>start&&date<end)el.classList.add('range');
    }
    grid.appendChild(el);
  }
  updateDateDisplay();
}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
function selectCalDay(date){const{start,end}=state.survey.dates;if(!start||(start&&end))state.survey.dates={start:date,end:null};else if(date>start)state.survey.dates.end=date;else state.survey.dates={start:date,end:null};renderCalendar();}
function updateDateDisplay(){
  const el=document.getElementById('cal-dates-display');if(!el)return;
  const{start,end}=state.survey.dates;
  const fmt=d=>d.toLocaleDateString(state.lang==='es'?'es-ES':'en-GB',{day:'numeric',month:'short'});
  if(!start){el.textContent=state.lang==='es'?'Selecciona fecha de llegada':'Select arrival date';return;}
  el.textContent=(state.lang==='es'?'Llegada: ':'Arrival: ')+fmt(start)+(end?(state.lang==='es'?'  ·  Salida: ':'  ·  Departure: ')+fmt(end):'');
}
function prevMonth(){if(state.calMonth===0){state.calMonth=11;state.calYear--;}else state.calMonth--;renderCalendar();}
function nextMonth(){if(state.calMonth===11){state.calMonth=0;state.calYear++;}else state.calMonth++;renderCalendar();}

// ══════════════════════════════════════════════
// FALLBACKS
// ══════════════════════════════════════════════
function getFallbackAttractions(){
  const es=state.lang==='es';
  return [
    {name:'Museo del Prado',vicinity:'Calle de Ruiz de Alarcón, 23',rating:4.9,price_level:2,emoji:'🏛️',gradient:'linear-gradient(135deg,#003DA5,#1A6FE0)',types:['museum'],geometry:{location:{lat:()=>40.4138,lng:()=>-3.6922}},description:es?'La pinacoteca más importante de España. Velázquez, Goya y El Bosco.':'Spain\'s most important art museum.'},
    {name:'Parque del Retiro',vicinity:'Plaza de la Independencia',rating:4.8,price_level:1,emoji:'🌳',gradient:'linear-gradient(135deg,#1a6f40,#2d9e60)',types:['park'],geometry:{location:{lat:()=>40.4153,lng:()=>-3.6844}},description:es?'El pulmón verde de Madrid.':'Madrid\'s green lung.'},
    {name:'Museo Reina Sofía',vicinity:'Calle de Santa Isabel, 52',rating:4.7,price_level:2,emoji:'🎨',gradient:'linear-gradient(135deg,#4a1a8f,#7a3ad0)',types:['art_gallery'],geometry:{location:{lat:()=>40.4080,lng:()=>-3.6940}},description:es?'Arte contemporáneo y el Guernica de Picasso.':'Contemporary art and Picasso\'s Guernica.'},
    {name:'Palacio Real',vicinity:'Calle de Bailén, s/n',rating:4.7,price_level:2,emoji:'🏰',gradient:'linear-gradient(135deg,#C8922A,#E8A830)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4179,lng:()=>-3.7143}},description:es?'La residencia oficial de la Familia Real española.':'The official residence of the Spanish Royal Family.'},
    {name:'Gran Vía',vicinity:'Gran Vía, Madrid',rating:4.6,price_level:2,emoji:'🌆',gradient:'linear-gradient(135deg,#1A3A8F,#2A5ABF)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4200,lng:()=>-3.7026}},description:es?'El bulevar más famoso de Madrid.':'Madrid\'s most famous boulevard.'},
    {name:'Templo de Debod',vicinity:'Calle de Ferraz, 1',rating:4.6,price_level:1,emoji:'🏺',gradient:'linear-gradient(135deg,#8f6a1a,#c09030)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4228,lng:()=>-3.7183}},description:es?'Templo egipcio de 2.200 años. Vistas al atardecer.':'2,200-year-old Egyptian temple.'},
    {name:'Mercado de San Miguel',vicinity:'Plaza de San Miguel',rating:4.5,price_level:2,emoji:'🍢',gradient:'linear-gradient(135deg,#6f3a1a,#a05030)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4152,lng:()=>-3.7089}},description:es?'Mercado gastronómico en una joya de hierro fundido.':'Gourmet market in a cast iron jewel.'},
    {name:'Barrio de Malasaña',vicinity:'Malasaña, Madrid',rating:4.6,price_level:2,emoji:'🎸',gradient:'linear-gradient(135deg,#2a1a6f,#5030a0)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4264,lng:()=>-3.7063}},description:es?'El barrio más bohemio de Madrid.':'Madrid\'s most bohemian neighbourhood.'},
  ];
}

function getFallbackRestaurants(){
  const es=state.lang==='es';
  return [
    {name:'Sobrino de Botín',vicinity:'Calle de los Cuchilleros, 17',rating:4.5,price_level:3,emoji:'🥘',gradient:'linear-gradient(135deg,#8f3a1a,#c05030)',description:es?'El restaurante más antiguo del mundo. Cochinillo asado.':'The world\'s oldest restaurant.'},
    {name:'Mercado de San Miguel',vicinity:'Plaza de San Miguel, s/n',rating:4.5,price_level:2,emoji:'🍢',gradient:'linear-gradient(135deg,#6f3a1a,#a05030)',description:es?'Tapas y vinos en un mercado único.':'Tapas and wines in a unique market.'},
    {name:'Casa Lucio',vicinity:'Calle de la Cava Baja, 35',rating:4.4,price_level:3,emoji:'🍳',gradient:'linear-gradient(135deg,#3a2a1a,#705030)',description:es?'Famoso por sus huevos rotos. Cocina madrileña.':'Famous for broken eggs. Madrid cuisine.'},
  ];
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function getEmoji(t){if(!t)return'📍';const m={museum:'🏛️',art_gallery:'🎨',park:'🌳',church:'⛪',bar:'🍸',night_club:'🌙',restaurant:'🍽️',spa:'🧘',tourist_attraction:'🗺️'};for(const x of t)if(m[x])return m[x];return'📍';}
function getGradient(t){if(!t)return'linear-gradient(135deg,#003DA5,#1A6FE0)';if(t.includes('park'))return'linear-gradient(135deg,#1a6f40,#2d9e60)';if(t.includes('museum')||t.includes('art_gallery'))return'linear-gradient(135deg,#4a1a8f,#7a3ad0)';if(t.includes('bar')||t.includes('night_club'))return'linear-gradient(135deg,#1a1a6f,#3030a0)';if(t.includes('restaurant'))return'linear-gradient(135deg,#8f3a1a,#c05030)';return'linear-gradient(135deg,#003DA5,#1A6FE0)';}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  state.survey.dates.start = new Date();
  state.survey.dates.end = new Date(Date.now() + 3*24*60*60*1000);
  renderCalendar();
});
