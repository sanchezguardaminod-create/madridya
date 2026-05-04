/* ═══════════════════════════════════════════
   MADRIDYA — app.js v4
   Fixes: add/remove places, new route modal, meals by time
═══════════════════════════════════════════ */

const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };

const state = {
  lang: 'es',
  survey: {
    firstTime: 'yes', budget: '$$',
    dates: { start: null, end: null },
    mobility: ['walking'], interests: ['museums','art','nightlife'], food: ['local']
  },
  allPlaces: [],        // all attractions fetched
  selectedPlaces: [],   // attractions currently in route
  allRestaurants: [],   // meal options
  map: null, markers: [], directionsRenderer: null,
  userLocation: null, userMarker: null, watchId: null,
  completedStops: [],
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
  mapsReady: false, navigating: false
};

// ══════════════════════════════════════════════
// MEAL SCHEDULE
// ══════════════════════════════════════════════
function getMealSchedule() {
  const hour = new Date().getHours();
  // before 9am → breakfast + lunch + dinner
  if (hour < 9) {
    return [
      { type:'breakfast', label: state.lang==='es'?'☕ Desayuno':'☕ Breakfast', time:'09:00' },
      { type:'lunch',     label: state.lang==='es'?'🍽️ Comida':'🍽️ Lunch',     time:'14:30' },
      { type:'dinner',    label: state.lang==='es'?'🌙 Cena':'🌙 Dinner',       time:'20:30' }
    ];
  }
  // 9am–11am → lunch + dinner (desayuna en el hotel)
  if (hour < 11) {
    return [
      { type:'lunch',  label: state.lang==='es'?'🍽️ Comida':'🍽️ Lunch',  time:'14:30' },
      { type:'dinner', label: state.lang==='es'?'🌙 Cena':'🌙 Dinner',    time:'20:30' }
    ];
  }
  // after 11am → only dinner
  return [
    { type:'dinner', label: state.lang==='es'?'🌙 Cena':'🌙 Dinner', time:'20:30' }
  ];
}

function getRestaurantsForFood() {
  const foods = state.survey.food;
  const all = [
    { name:'Sobrino de Botín', vicinity:'Calle de los Cuchilleros, 17', rating:4.5, price_level:3,
      emoji:'🥘', gradient:'linear-gradient(135deg,#8f3a1a,#c05030)', foodType:'local',
      description: state.lang==='es'?'El restaurante más antiguo del mundo. Cochinillo y cordero asado.':'The world\'s oldest restaurant. Roast suckling pig and lamb.' },
    { name:'Mercado de San Miguel', vicinity:'Plaza de San Miguel, s/n', rating:4.5, price_level:2,
      emoji:'🍢', gradient:'linear-gradient(135deg,#6f3a1a,#a05030)', foodType:'local',
      description: state.lang==='es'?'Tapas, vinos y gastronomía local en un mercado único.':'Tapas, wines and local gastronomy in a unique market.' },
    { name:'Casa Lucio', vicinity:'Calle de la Cava Baja, 35', rating:4.4, price_level:3,
      emoji:'🍳', gradient:'linear-gradient(135deg,#3a2a1a,#705030)', foodType:'local',
      description: state.lang==='es'?'Famoso por sus huevos rotos. Cocina madrileña de siempre.':'Famous for its broken eggs. Classic Madrid cuisine.' },
    { name:'Miyama', vicinity:'Calle de Flor Baja, 5', rating:4.6, price_level:3,
      emoji:'🍣', gradient:'linear-gradient(135deg,#1a3a6f,#3060a0)', foodType:'japanese',
      description: state.lang==='es'?'Uno de los mejores japoneses de Madrid. Sushi de primera calidad.':'One of Madrid\'s best Japanese restaurants. Top quality sushi.' },
    { name:'Grosso Napoletano', vicinity:'Calle de Lope de Vega, 2', rating:4.6, price_level:2,
      emoji:'🍕', gradient:'linear-gradient(135deg,#6f1a1a,#a03030)', foodType:'italian',
      description: state.lang==='es'?'Pizza napolitana auténtica con masa madre e ingredientes importados de Italia.':'Authentic Neapolitan pizza with sourdough and ingredients from Italy.' },
    { name:'Taquería El Califa', vicinity:'Calle de la Palma, 16', rating:4.3, price_level:1,
      emoji:'🌮', gradient:'linear-gradient(135deg,#6f4a1a,#a07030)', foodType:'mexican',
      description: state.lang==='es'?'Los mejores tacos de Madrid. Ambiente informal y precios asequibles.':'The best tacos in Madrid. Casual atmosphere and affordable prices.' },
    { name:'Viva Burger', vicinity:'Calle de la Palma, 26', rating:4.3, price_level:1,
      emoji:'🥗', gradient:'linear-gradient(135deg,#1a6f3a,#30a060)', foodType:'vegan',
      description: state.lang==='es'?'Hamburguesería vegana y vegetariana. Opciones deliciosas para todos.':'Vegan and vegetarian burger place. Delicious options for everyone.' },
    { name:'Brunch & Cake', vicinity:'Calle de Augusto Figueroa, 12', rating:4.5, price_level:2,
      emoji:'🥞', gradient:'linear-gradient(135deg,#6f3a6f,#a060a0)', foodType:'brunch',
      description: state.lang==='es'?'El mejor brunch de Madrid. Tostadas, bowls y tartas artesanales.':'Madrid\'s best brunch. Toasts, bowls and artisan cakes.' },
  ];

  // Filter by selected food preferences
  const filtered = all.filter(r => foods.includes(r.foodType));
  // Always include at least 2 options
  return filtered.length >= 2 ? filtered : all.filter(r => r.foodType === 'local').concat(filtered).slice(0,3);
}

// ══════════════════════════════════════════════
// LANGUAGE
// ══════════════════════════════════════════════
function toggleLang() {
  state.lang = state.lang === 'es' ? 'en' : 'es';
  document.querySelector('.lang-btn').textContent = state.lang === 'es' ? '🌐 EN' : '🌐 ES';
  document.querySelectorAll('[data-es]').forEach(el => {
    const val = el.getAttribute('data-' + state.lang);
    if (!val) return;
    if (el.tagName === 'INPUT') el.placeholder = val;
    else el.textContent = val;
  });
  document.documentElement.setAttribute('lang', state.lang);
  renderCalendar();
}

// ══════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════
function go(n) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('s' + n).classList.add('active');
  document.querySelectorAll('.tab')[n - 1].classList.add('active');
  if (n === 3 && state.mapsReady && state.selectedPlaces.length > 0) setTimeout(renderMap, 200);
}

// ══════════════════════════════════════════════
// FORM INTERACTIONS
// ══════════════════════════════════════════════
function tog(btn) { btn.classList.toggle('sel'); syncSurvey(); }

function soloSelect(btn, groupId) {
  document.getElementById(groupId).querySelectorAll('.ob').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  syncSurvey();
}

function selBudget(btn) {
  document.querySelectorAll('.bb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  state.survey.budget = btn.dataset.value;
}

function syncSurvey() {
  state.survey.interests = [...document.querySelectorAll('#q-interests .sel')].map(b => b.dataset.value);
  state.survey.food      = [...document.querySelectorAll('#q-food .sel')].map(b => b.dataset.value);
  state.survey.mobility  = [...document.querySelectorAll('#q-mobility .sel')].map(b => b.dataset.value);
  const ft = document.querySelector('#q-firsttime .sel');
  if (ft) state.survey.firstTime = ft.dataset.value;
}

// ══════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════
function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  if (!grid) return;
  const { calYear: y, calMonth: m } = state;
  const MONTHS = {
    es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    en:['January','February','March','April','May','June','July','August','September','October','November','December']
  };
  title.textContent = MONTHS[state.lang][m] + ' ' + y;
  const firstDay = new Date(y,m,1).getDay();
  const offset = firstDay===0 ? 6 : firstDay-1;
  const days = new Date(y,m+1,0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  grid.innerHTML = '';
  for (let i=0;i<offset;i++){const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e);}
  for (let d=1;d<=days;d++){
    const el=document.createElement('div'), date=new Date(y,m,d);
    el.className='cal-day'; el.textContent=d;
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
function selectCalDay(date){
  const{start,end}=state.survey.dates;
  if(!start||(start&&end))state.survey.dates={start:date,end:null};
  else if(date>start)state.survey.dates.end=date;
  else state.survey.dates={start:date,end:null};
  renderCalendar();
}
function updateDateDisplay(){
  const el=document.getElementById('cal-dates-display');
  if(!el)return;
  const{start,end}=state.survey.dates;
  const fmt=d=>d.toLocaleDateString(state.lang==='es'?'es-ES':'en-GB',{day:'numeric',month:'short'});
  if(!start){el.textContent=state.lang==='es'?'Selecciona fecha de llegada':'Select arrival date';return;}
  el.textContent=(state.lang==='es'?'Llegada: ':'Arrival: ')+fmt(start)+(end?(state.lang==='es'?'  ·  Salida: ':'  ·  Departure: ')+fmt(end):'');
}
function prevMonth(){if(state.calMonth===0){state.calMonth=11;state.calYear--;}else state.calMonth--;renderCalendar();}
function nextMonth(){if(state.calMonth===11){state.calMonth=0;state.calYear++;}else state.calMonth++;renderCalendar();}

// ══════════════════════════════════════════════
// MAPS LOADED
// ══════════════════════════════════════════════
function onMapsLoaded() { state.mapsReady = true; }

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
    const places = await fetchAttractions();
    state.allPlaces = places;
    state.selectedPlaces = places.slice(0, 5);
    state.allRestaurants = getRestaurantsForFood();
    renderResults();
  } catch(e) {
    console.error(e);
    document.getElementById('loading-places').style.display = 'none';
    document.getElementById('error-places').style.display = 'block';
  }
}

// ══════════════════════════════════════════════
// FETCH ATTRACTIONS
// ══════════════════════════════════════════════
function fetchAttractions() {
  return new Promise((resolve) => {
    if (!state.mapsReady) { resolve(getFallbackAttractions()); return; }
    const TYPES = {museums:['museum'],art:['art_gallery'],churches:['church'],sport:['stadium'],nightlife:['night_club'],parks:['park'],wellness:['spa'],bars:['bar']};
    const types = state.survey.interests.flatMap(i => TYPES[i]||[]);
    const primary = [...new Set(types)][0] || 'tourist_attraction';
    const radius = state.survey.mobility.includes('walking') ? 2500 : state.survey.mobility.includes('bike') ? 4000 : 8000;
    const svc = new google.maps.places.PlacesService(document.createElement('div'));
    svc.nearbySearch({
      location: new google.maps.LatLng(MADRID_CENTER.lat, MADRID_CENTER.lng),
      radius, type: primary, language: state.lang
    }, (results, status) => {
      if (status==='OK' && results.length>0) resolve(results.sort((a,b)=>(b.rating||0)-(a.rating||0)));
      else resolve(getFallbackAttractions());
    });
  });
}

function getFallbackAttractions() {
  const es = state.lang==='es';
  return [
    {name:'Museo del Prado',vicinity:'Calle de Ruiz de Alarcón, 23',rating:4.9,price_level:2,emoji:'🏛️',gradient:'linear-gradient(135deg,#003DA5,#1A6FE0)',types:['museum'],geometry:{location:{lat:()=>40.4138,lng:()=>-3.6922}},description:es?'La pinacoteca más importante de España. Velázquez, Goya y El Bosco.':'Spain\'s most important art museum.'},
    {name:'Parque del Retiro',vicinity:'Plaza de la Independencia',rating:4.8,price_level:1,emoji:'🌳',gradient:'linear-gradient(135deg,#1a6f40,#2d9e60)',types:['park'],geometry:{location:{lat:()=>40.4153,lng:()=>-3.6844}},description:es?'El pulmón verde de Madrid. Ideal para pasear y remar en el lago.':'Madrid\'s green lung.'},
    {name:'Museo Reina Sofía',vicinity:'Calle de Santa Isabel, 52',rating:4.7,price_level:2,emoji:'🎨',gradient:'linear-gradient(135deg,#4a1a8f,#7a3ad0)',types:['art_gallery'],geometry:{location:{lat:()=>40.4080,lng:()=>-3.6940}},description:es?'Arte contemporáneo y el Guernica de Picasso.':'Contemporary art and Picasso\'s Guernica.'},
    {name:'Palacio Real',vicinity:'Calle de Bailén, s/n',rating:4.7,price_level:2,emoji:'🏰',gradient:'linear-gradient(135deg,#C8922A,#E8A830)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4179,lng:()=>-3.7143}},description:es?'La residencia oficial de la Familia Real española.':'The official residence of the Spanish Royal Family.'},
    {name:'Gran Vía',vicinity:'Gran Vía, Madrid',rating:4.6,price_level:2,emoji:'🌆',gradient:'linear-gradient(135deg,#1A3A8F,#2A5ABF)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4200,lng:()=>-3.7026}},description:es?'El bulevar más famoso de Madrid. Tiendas, teatros y restaurantes.':'Madrid\'s most famous boulevard.'},
    {name:'Templo de Debod',vicinity:'Calle de Ferraz, 1',rating:4.6,price_level:1,emoji:'🏺',gradient:'linear-gradient(135deg,#8f6a1a,#c09030)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4228,lng:()=>-3.7183}},description:es?'Templo egipcio de 2.200 años. Vistas espectaculares al atardecer.':'2,200-year-old Egyptian temple. Spectacular sunset views.'},
    {name:'Mercado de San Miguel',vicinity:'Plaza de San Miguel, s/n',rating:4.5,price_level:2,emoji:'🍢',gradient:'linear-gradient(135deg,#6f3a1a,#a05030)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4152,lng:()=>-3.7089}},description:es?'Mercado gastronómico en una joya de hierro fundido del siglo XX.':'Gourmet market in a cast iron jewel.'},
    {name:'Barrio de Malasaña',vicinity:'Malasaña, Madrid',rating:4.6,price_level:2,emoji:'🎸',gradient:'linear-gradient(135deg,#2a1a6f,#5030a0)',types:['tourist_attraction'],geometry:{location:{lat:()=>40.4264,lng:()=>-3.7063}},description:es?'El barrio más bohemio de Madrid. Arte callejero, bares y tiendas vintage.':'Madrid\'s most bohemian neighbourhood.'},
  ];
}

// ══════════════════════════════════════════════
// RENDER RESULTS — main function
// ══════════════════════════════════════════════
function renderResults() {
  document.getElementById('loading-places').style.display = 'none';
  const list = document.getElementById('places-list');
  list.innerHTML = '';

  const meals = getMealSchedule();
  const restaurants = state.allRestaurants;

  // Build timeline: attractions + meals inserted at correct times
  // Attractions start at 10:00, each takes ~2h
  // Meals inserted at their scheduled times

  const timeline = [];
  let currentHour = 10;

  // Insert meals and attractions in time order
  const mealsCopy = [...meals];

  state.allPlaces.slice(0, 6).forEach((place, idx) => {
    // Check if any meal should be inserted before next attraction
    const insertBefore = mealsCopy.filter(meal => {
      const mealH = parseInt(meal.time.split(':')[0]);
      return mealH <= currentHour + 1;
    });
    insertBefore.forEach(meal => {
      const ri = mealsCopy.indexOf(meal);
      mealsCopy.splice(ri, 1);
      const rest = restaurants[(timeline.filter(x=>x.type==='meal').length) % restaurants.length];
      timeline.push({ type:'meal', meal, restaurant: rest });
    });

    timeline.push({ type:'place', place, idx });
    currentHour += 2;
  });

  // Insert remaining meals at the end
  mealsCopy.forEach(meal => {
    const rest = restaurants[(timeline.filter(x=>x.type==='meal').length) % restaurants.length];
    timeline.push({ type:'meal', meal, restaurant: rest });
  });

  // Render timeline
  timeline.forEach(item => {
    if (item.type === 'place') {
      list.appendChild(buildPlaceCard(item.place, item.idx));
    } else {
      list.appendChild(buildMealCard(item.restaurant, item.meal));
    }
  });

  const count = state.selectedPlaces.length;
  document.getElementById('results-count').textContent = count + ' ' + (state.lang==='es'?'lugares':'places');
  document.getElementById('s2-actions').style.display = 'flex';
}

// ══════════════════════════════════════════════
// BUILD PLACE CARD
// ══════════════════════════════════════════════
function buildPlaceCard(place, idx) {
  const inRoute = state.selectedPlaces.includes(place);
  const emoji = place.emoji || getEmoji(place.types);
  const gradient = place.gradient || getGradient(place.types);
  const rating = place.rating ? `⭐ ${place.rating}` : '';
  const price = place.price_level ? '💰' + '$'.repeat(place.price_level) : '';
  const mobLabel = state.survey.mobility.includes('transit') ? '🚇 Metro' : state.survey.mobility.includes('bike') ? '🚴 Bici' : '🚶 ~15 min';
  const badge = idx===0 ? 'Top pick' : idx<3 ? (state.lang==='es'?'Recomendado':'Recommended') : '';
  const desc = place.description || (state.lang==='es'?'Un lugar imprescindible en Madrid.':'A must-see in Madrid.');

  const card = document.createElement('div');
  card.className = 'place-card' + (inRoute ? ' in-route' : '');
  card.dataset.idx = idx;

  card.innerHTML = `
    <div class="place-img" style="background:${gradient}">
      ${emoji}
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
      <button class="card-add-btn ${inRoute?'hidden':''}" onclick="addToRoute(this, ${idx})">
        ${state.lang==='es'?'+ Añadir a ruta':'+ Add to route'}
      </button>
      <button class="card-remove-btn ${inRoute?'':'hidden'}" onclick="removeFromRoute(this, ${idx})">
        ${state.lang==='es'?'− Quitar de ruta':'− Remove from route'}
      </button>
    </div>
  `;
  return card;
}

// ══════════════════════════════════════════════
// BUILD MEAL CARD
// ══════════════════════════════════════════════
function buildMealCard(restaurant, meal) {
  const wrap = document.createElement('div');
  wrap.className = 'meal-section';
  wrap.innerHTML = `
    <div class="meal-header">
      <span>${meal.label}</span>
      <span class="meal-time">${meal.time}</span>
    </div>
    <div class="place-card" style="margin-bottom:0">
      <div class="place-img" style="background:${restaurant.gradient||'linear-gradient(135deg,#8f3a1a,#c05030)'}">
        ${restaurant.emoji||'🍽️'}
      </div>
      <div class="place-info">
        <div class="place-name">${restaurant.name}</div>
        <div class="place-desc">${restaurant.description||''}</div>
        <div class="place-meta">
          ${restaurant.price_level?`<span class="place-meta-tag">💰${'$'.repeat(restaurant.price_level)}</span>`:''}
          ${restaurant.rating?`<span class="place-meta-tag">⭐${restaurant.rating}</span>`:''}
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
  if (!place) return;
  if (!state.selectedPlaces.includes(place)) state.selectedPlaces.push(place);

  // Update button visibility
  const card = btn.closest('.place-card');
  card.classList.add('in-route');
  card.querySelector('.card-add-btn').classList.add('hidden');
  card.querySelector('.card-remove-btn').classList.remove('hidden');

  // Update count
  document.getElementById('results-count').textContent =
    state.selectedPlaces.length + ' ' + (state.lang==='es'?'lugares':'places');
}

function removeFromRoute(btn, idx) {
  const place = state.allPlaces[idx];
  if (!place) return;
  state.selectedPlaces = state.selectedPlaces.filter(p => p !== place);

  const card = btn.closest('.place-card');
  card.classList.remove('in-route');
  card.querySelector('.card-add-btn').classList.remove('hidden');
  card.querySelector('.card-remove-btn').classList.add('hidden');

  document.getElementById('results-count').textContent =
    state.selectedPlaces.length + ' ' + (state.lang==='es'?'lugares':'places');
}

// ══════════════════════════════════════════════
// NEW ROUTE MODAL
// ══════════════════════════════════════════════
function showNewRouteModal() {
  document.getElementById('new-route-modal').style.display = 'flex';
}
function closeNewRouteModal() {
  document.getElementById('new-route-modal').style.display = 'none';
}
function closeModalOutside(e) {
  if (e.target.id === 'new-route-modal') closeNewRouteModal();
}

// Option 1: new route, same preferences
function generateNewRoute() {
  closeNewRouteModal();
  // Reset selected places but keep survey
  state.selectedPlaces = [];
  state.completedStops = [];
  // Shuffle allPlaces to get different ones
  const shuffled = [...state.allPlaces].sort(() => Math.random() - 0.5);
  state.allPlaces = shuffled;
  state.selectedPlaces = shuffled.slice(0, 5);
  state.allRestaurants = getRestaurantsForFood();
  renderResults();
}

// Option 2: edit profile → go back to screen 1
function editProfile() {
  closeNewRouteModal();
  go(1);
}

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
      center: state.userLocation || MADRID_CENTER, zoom: 14,
      mapTypeControl:false, streetViewControl:false, fullscreenControl:false,
      styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]}]
    });
  }

  state.markers.forEach(m => m.setMap(null));
  state.markers = [];

  places.slice(0,8).forEach((place, idx) => {
    const lat = typeof place.geometry.location.lat==='function'?place.geometry.location.lat():place.geometry.location.lat;
    const lng = typeof place.geometry.location.lng==='function'?place.geometry.location.lng():place.geometry.location.lng;
    const marker = new google.maps.Marker({
      position:{lat,lng}, map:state.map, title:place.name,
      label:{text:String(idx+1),color:'white',fontWeight:'bold',fontSize:'12px'},
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:16,fillColor:idx===0?'#C8922A':'#003DA5',fillOpacity:1,strokeColor:'white',strokeWeight:2}
    });
    const iw = new google.maps.InfoWindow({content:`<div style="font-family:Inter,sans-serif;padding:4px"><strong>${place.name}</strong><p style="font-size:.75rem;color:#6B7FA3;margin-top:2px">${place.vicinity||''}</p>${place.rating?`<p style="color:#C8922A;font-size:.75rem">⭐${place.rating}</p>`:''}</div>`});
    marker.addListener('click',()=>iw.open(state.map,marker));
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
  const ds = new google.maps.DirectionsService();
  state.directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers:true,
    polylineOptions:{strokeColor:'#003DA5',strokeWeight:4,strokeOpacity:.8}
  });
  state.directionsRenderer.setMap(state.map);
  const getLoc = p => {
    const lat=typeof p.geometry.location.lat==='function'?p.geometry.location.lat():p.geometry.location.lat;
    const lng=typeof p.geometry.location.lng==='function'?p.geometry.location.lng():p.geometry.location.lng;
    return new google.maps.LatLng(lat,lng);
  };
  const travelMode = state.survey.mobility.includes('transit') ? google.maps.TravelMode.TRANSIT :
                     state.survey.mobility.includes('bike')    ? google.maps.TravelMode.BICYCLING :
                                                                  google.maps.TravelMode.WALKING;
  ds.route({
    origin:getLoc(places[0]), destination:getLoc(places[places.length-1]),
    waypoints:places.slice(1,-1).map(p=>({location:getLoc(p),stopover:true})),
    travelMode, optimizeWaypoints:false
  },(result,status)=>{ if(status==='OK') state.directionsRenderer.setDirections(result); });
}

function renderStops(places) {
  const list = document.getElementById('stops-list');
  if (!list) return;
  list.innerHTML = '';
  const pct = places.length>0 ? Math.round((state.completedStops.length/places.length)*100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + (state.lang==='es'?'% completado':'% completed');
  places.forEach((p,idx)=>{
    const done=state.completedStops.includes(idx), cur=idx===state.completedStops.length;
    const cls=done?'done':cur?'current':'pending';
    const lbl=done?(state.lang==='es'?'Completado':'Completed'):cur?(state.lang==='es'?'En camino':'On the way'):(state.lang==='es'?'Pendiente':'Pending');
    const item=document.createElement('div'); item.className='stop-item';
    item.innerHTML=`<div class="stop-num ${cls}">${done?'✓':idx+1}</div><div class="stop-info"><div class="stop-name">${p.name}</div><div class="stop-time">${10+idx*2}:00 · ${lbl}</div></div><button class="stop-remove" onclick="removeStopFromMap(${idx})">${state.lang==='es'?'− Quitar':'− Remove'}</button>`;
    if(done) item.style.opacity='.65';
    list.appendChild(item);
  });
}

function removeStopFromMap(idx) {
  state.selectedPlaces.splice(idx,1);
  if(state.map) renderMap();
}
function addStop() { go(2); }
function shareRoute() {
  const url=window.location.href;
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>alert(state.lang==='es'?'¡Enlace copiado!':'Link copied!'));
  else alert(url);
}

// ══════════════════════════════════════════════
// USER LOCATION & NAVIGATION
// ══════════════════════════════════════════════
function getUserLocation() {
  const btn=document.querySelector('.location-btn'), txt=document.getElementById('location-text');
  if(!navigator.geolocation){txt.textContent=state.lang==='es'?'No disponible':'Not available';return;}
  btn.textContent='...'; txt.textContent=state.lang==='es'?'Obteniendo ubicación...':'Getting location...';
  navigator.geolocation.getCurrentPosition(pos=>{
    state.userLocation={lat:pos.coords.latitude,lng:pos.coords.longitude};
    txt.textContent=state.lang==='es'?'📍 Ubicación obtenida':'📍 Location found';
    txt.classList.add('active'); btn.textContent=state.lang==='es'?'✓ Activo':'✓ Active'; btn.classList.add('located');
    if(state.map){state.map.setCenter(state.userLocation);showUserOnMap(state.userLocation);}
  },()=>{txt.textContent=state.lang==='es'?'No se pudo obtener la ubicación':'Could not get location';btn.textContent=state.lang==='es'?'Reintentar':'Retry';},{enableHighAccuracy:true,timeout:10000});
}

function showUserOnMap(loc) {
  if(!state.map)return;
  if(state.userMarker)state.userMarker.setMap(null);
  state.userMarker=new google.maps.Marker({position:loc,map:state.map,title:state.lang==='es'?'Tu ubicación':'Your location',icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#22C55E',fillOpacity:1,strokeColor:'white',strokeWeight:3},zIndex:999});
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
      showUserOnMap(state.userLocation); state.map.panTo(state.userLocation);
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

function getDist(a,b) {
  const R=6371000,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
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
