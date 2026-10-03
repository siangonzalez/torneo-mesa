import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getDatabase,ref,onValue,update,push,get,set}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{DEFAULT_BEST_N,normSystem,scoreGame,playersInGames,computeScores as computeStandings,computeDisplayRanks,getTiedWith,gameWinners}from"./scoring.js?v=3.7.0";
import{ROOT_PATH,PHOTOS_PATH,normalizeRemote,computeUpdates,photosFromRemote,computePhotoUpdates,photoMigrationUpdates,encodeKey}from"./sync.js?v=3.7.0";
import{escHtml,cleanName}from"./text.js?v=3.7.0";
import{dieSVG,rollValues,dieBadge}from"./dice.js?v=3.7.0";
import{cleanQuote,seedQuotesFor,statFacts,pickSplash,restrictPool}from"./quotes.js?v=3.7.0";
const firebaseConfig = {
  apiKey: "AIzaSyAh_JOEu_hU-GpaJnf-rsMEa1p2hpfuy_k",
  authDomain: "torneo-mesa.firebaseapp.com",
  databaseURL: "https://torneo-mesa-default-rtdb.firebaseio.com",
  projectId: "torneo-mesa",
  storageBucket: "torneo-mesa.firebasestorage.app",
  messagingSenderId: "541715613556",
  appId: "1:541715613556:web:4a4ef8b65d707304238e21"
};
const app=initializeApp(firebaseConfig);
const db=getDatabase(app);
const torneoRef=ref(db,ROOT_PATH);
const photosRef=ref(db,PHOTOS_PATH);
const rootRef=ref(db);
const torneoV1Ref=ref(db,'torneo');
const auth=getAuth(app);

const DEFAULT_GAMES = [
  {name:'Catan', emoji:'🏝️', type:'Competitivo', players:'3-4', duration:'60-120 min', complexity:'Media', category:'Estrategia', desc:'Construye asentamientos, recolecta recursos y comercia con otros jugadores para dominar la isla de Catan.'},
  {name:'7 Wonders', emoji:'🏛️', type:'Competitivo', players:'3-7', duration:'30-45 min', complexity:'Media', category:'Estrategia / Cartas', desc:'Desarrolla tu civilización antigua construyendo maravillas, ejércitos y estructuras científicas a través de tres eras.'},
  {name:'Heat: Pedal to the Metal', emoji:'🏎️', type:'Competitivo', players:'2-6', duration:'30-60 min', complexity:'Media', category:'Carreras', desc:'Gestiona el calor de tu motor en emocionantes carreras de Fórmula 1 retro. Acelera sin sobrecalentarte.'},
  {name:'Risk', emoji:'🌍', type:'Competitivo', players:'2-6', duration:'120-180 min', complexity:'Media', category:'Estrategia / Conquista', desc:'Domina el mundo conquistando territorios con tus ejércitos. Alianzas, traiciones y dados deciden el destino.'},
  {name:'Ticket to Ride: Europe', emoji:'🚂', type:'Competitivo', players:'2-5', duration:'45-90 min', complexity:'Baja', category:'Familiar / Estrategia', desc:'Conecta ciudades europeas con rutas de tren. Bloquea a tus rivales antes de que te bloqueen a ti.'},
  {name:'Rummikub', emoji:'🀱', type:'Competitivo', players:'2-4', duration:'30-60 min', complexity:'Baja', category:'Fichas / Familiar', desc:'Forma series y grupos con fichas numeradas. Un clásico de destreza mental y reordenamiento sobre la mesa.'},
  {name:'Survive: Escape from Atlantis!', emoji:'🌊', type:'Competitivo', players:'2-4', duration:'45-60 min', complexity:'Baja', category:'Familiar / Táctica', desc:'La isla se hunde. Evacúa tus exploradores en balsas mientras tus rivales invocan tiburones y monstruos marinos.'},
  {name:'Forbidden Island', emoji:'🗺️', type:'Cooperativo', players:'2-4', duration:'30-45 min', complexity:'Baja', category:'Cooperativo / Aventura', desc:'¡Trabajen juntos o todos pierden! Recolecten los 4 tesoros y escapen antes de que la isla se hunda bajo sus pies.'},
  {name:'The Red Cathedral', emoji:'⛪', type:'Competitivo', players:'2-4', duration:'45-75 min', complexity:'Media', category:'Estrategia / Dados', desc:'Compite por construir la Catedral de San Basilio en Moscú. Gestiona recursos y secciones con inteligente mecánica de dados.'},
  {name:'Pelusas', emoji:'🧸', type:'Competitivo', players:'2-6', duration:'15-20 min', complexity:'Baja', category:'Cartas / Party', desc:'Acumula pelusas robando cartas, pero si te pasas ¡las pierdes todas! Filler perfecto para abrir o cerrar la noche.'},
  {name:'Exploding Kittens', emoji:'🐱', type:'Competitivo', players:'2-5', duration:'15-30 min', complexity:'Baja', category:'Cartas / Party', desc:'Evita el gatito explosivo usando cartas de acción absurdas. El último sobreviviente gana. Caótico y adictivo.'},
  {name:'Virus!', emoji:'🦠', type:'Competitivo', players:'2-6', duration:'20-30 min', complexity:'Baja', category:'Cartas / Party', desc:'Infecta los órganos de tus rivales y cura los tuyos. Completa tu cuerpo sano antes que los demás. Muy atacante.'},
  {name:'Here to Slay', emoji:'🐉', type:'Competitivo', players:'2-6', duration:'30-60 min', complexity:'Baja', category:'Cartas / Party', desc:'Forma un grupo de héroes y derrota monstruos antes que tus oponentes. Muchas cartas de sabotaje entre jugadores.'},
  {name:'Dixit', emoji:'🎨', type:'Competitivo', players:'3-6', duration:'30-45 min', complexity:'Baja', category:'Creatividad / Party', desc:'Narra pistas poéticas sobre ilustraciones oníricas. Sé suficientemente críptico para no ser adivinado por todos.'},
  {name:'UNO', emoji:'🃏', type:'Competitivo', players:'2-10', duration:'15-30 min', complexity:'Baja', category:'Cartas / Familiar', desc:'El clásico de cartas. Vacía tu mano antes que los demás usando colores y números. Cuidado con el +4 malicioso.'},
  // Juegos adicionales
  {name:'Sabelotodo', emoji:'🧠', type:'Competitivo', players:'2-6', duration:'45-90 min', complexity:'Baja', category:'Trivia / Familiar', desc:'El clásico colombiano de cultura general de Ronda. Responde preguntas de geografía, ciencia, deportes, historia y arte para llegar al centro del tablero.'},
  {name:"J'suro", emoji:'🤞', type:'Competitivo', players:'2-6', duration:'20-30 min', complexity:'Baja', category:'Cartas / Party', desc:'Juego de apuestas y faroleo donde declaras cuántas cartas de un color tienes — aunque no sea cierto. Quien te cruce pierde si mientes, gana si dices la verdad.'},
  {name:'Codenames: Pictures', emoji:'🖼️', type:'Competitivo', players:'4-8', duration:'15-30 min', complexity:'Baja', category:'Party / Equipos', desc:'Como Codenames pero con imágenes surrealistas. Un espía da pistas de una palabra para que su equipo identifique las fotos correctas sin tocar las del enemigo.'},
  {name:'Hive', emoji:'🐝', type:'Competitivo', players:'2', duration:'20-30 min', complexity:'Media', category:'Abstracto / 2 jugadores', desc:'Ajedrez de insectos sin tablero. Rodea a la abeja reina del rival usando piezas de baquelita. Profundo, portátil y sin azar.'},
  {name:'Anda a Lavar', emoji:'🧺', type:'Competitivo', players:'2-6', duration:'15-25 min', complexity:'Baja', category:'Cartas / Party', desc:'Juego de cartas colombiano de descarte rápido. El objetivo es quedarse sin cartas antes que los demás. Simple, rápido y muy social.'},
  {name:'Pato Taco Queso Cabra', emoji:'🦆', type:'Competitivo', players:'2-8', duration:'10-20 min', complexity:'Baja', category:'Cartas / Party', desc:'Duck Duck Goose en versión carta. Rápido, caótico y perfecto para romper el hielo. Ideal para abrir la noche antes de juegos más serios.'},
  {name:'Blockbuster: The Game', emoji:'📼', type:'Competitivo', players:'4-10', duration:'30-45 min', complexity:'Baja', category:'Party / Películas / Equipos', desc:'Por equipos, adivinen películas describiéndolas en una palabra, con una cita o actuando. El equipo que coleccione los 8 géneros gana. Caótico y adictivo.'},
  {name:'Blockbuster and Chill', emoji:'🛋️', type:'Competitivo', players:'2', duration:'20-30 min', complexity:'Baja', category:'Party / Películas / 2 jugadores', desc:'Versión para 2 jugadores de Blockbuster. Cada uno esconde una película y el rival debe adivinarla respondiendo preguntas de cartas contra el reloj.'},
  {name:'Blockbuster Returns', emoji:'🎬', type:'Competitivo', players:'4-10', duration:'30-45 min', complexity:'Baja', category:'Party / Películas / Expansión', desc:'Expansión de Blockbuster con 4 géneros nuevos. Puede jugarse solo o combinado con el juego original para una megapartida de películas.'},
  {name:'Carcassonne', emoji:'🏰', type:'Competitivo', players:'2-5', duration:'35-45 min', complexity:'Baja', category:'Familiar / Estrategia', desc:'Coloca tiles para construir ciudades, caminos y monasterios medievales. Coloca tus seguidores estratégicamente para puntuar más que tus rivales.'},
  {name:'Zoo', emoji:'🦁', type:'Competitivo', players:'2-5', duration:'20-35 min', complexity:'Baja', category:'Familiar / Cartas', desc:'Construye tu zoológico antes que los demás coleccionando conjuntos de animales. Simple y visual, perfecto para partidas rápidas.'},
  {name:'Concept', emoji:'💡', type:'Competitivo', players:'4-12', duration:'40-60 min', complexity:'Baja', category:'Party / Adivinanza', desc:'Comunica palabras y frases sin hablar ni escribir, usando fichas sobre íconos universales. Accesible para todos los idiomas y edades.'},
  {name:'Cards vs Gravity Pro', emoji:'⚖️', type:'Competitivo', players:'2-6', duration:'20-40 min', complexity:'Baja', category:'Habilidad / Party', desc:'Construye estructuras con cartas desafiando la gravedad. El que logre la construcción más alta o estable sin derrumbar gana.'},
  {name:'Skull King', emoji:'💀', type:'Competitivo', players:'2-6', duration:'30-45 min', complexity:'Media', category:'Cartas / Bazas', desc:'Juego de bazas pirata. Predice exactamente cuántas bazas ganarás cada ronda. Acertar suma puntos, fallar los quita. Alta tensión en cada mano.'},
  {name:'Clever 4Ever', emoji:'🎲', type:'Competitivo', players:'1-4', duration:'30 min', complexity:'Media', category:'Dados / Roll & Write', desc:'Selecciona dados y anota números en tu hoja para crear combos encadenados. Los dados que no usas van a los rivales. El cuarto título de la saga Clever.'},
  {name:'Avalon', emoji:'⚔️', type:'Semi-cooperativo', players:'5-10', duration:'30-45 min', complexity:'Media', category:'Social / Deducción / Roles ocultos', desc:'Caballeros del bien vs agentes de Morgana infiltrados. Debes identificar a los traidores antes de que saboteen las misiones del rey Arturo. Mucha deducción social.'},
  {name:'El Cinéfilo', emoji:'🎥', type:'Competitivo', players:'3-8', duration:'30-60 min', complexity:'Baja', category:'Trivia / Películas / Party', desc:'Trivia de cine colombiana. Preguntas sobre películas, directores, actores y escenas. Para los que se la saben todas del cine.'},
  {name:'King of Tokyo', emoji:'🦖', type:'Competitivo', players:'2-6', duration:'30-40 min', complexity:'Baja', category:'Dados / Familiar', desc:'Monstruos gigantes se destrozan en Tokio. Tira dados para atacar, sanar y ganar puntos. El primero en llegar a 20 puntos o en ser el último monstruo vivo gana.'},
  {name:'Art Society', emoji:'🖼️', type:'Competitivo', players:'2-5', duration:'45-60 min', complexity:'Baja', category:'Subasta / Familiar', desc:'Subasta cuadros y decóralos en tu mansión. Ganas puntos por colecciones completas y combinaciones de colores bien ubicadas en tu tablero.'},
  {name:"Plunder: A Pirate's Life", emoji:'🏴‍☠️', type:'Competitivo', players:'2-4', duration:'45-75 min', complexity:'Media', category:'Estrategia / Piratas', desc:'Navega los mares, saquea puertos y acumula el mejor botín. Combina cartas y recursos para dominar las rutas comerciales antes que tus rivales piratas.'},
  {name:'Catan: Piratas y Exploradores', emoji:'⛵', type:'Competitivo', players:'3-4', duration:'90-150 min', complexity:'Alta', category:'Estrategia / Expansión', desc:'Expansión de Catan donde explores nuevas islas, construyes barcos y te enfrentas a piratas. Más complejo y épico que el Catan base.'},
  {name:'Catan Extendido', emoji:'🏝️', type:'Competitivo', players:'5-6', duration:'90-120 min', complexity:'Media', category:'Estrategia / Expansión', desc:'Expansión oficial de Catan que permite jugar con 5 o 6 jugadores. Tablero más grande, más recursos y más caos. La traición escala con los jugadores.'},
  {name:'Splendor', emoji:'💎', type:'Competitivo', players:'2-4', duration:'30 min', complexity:'Baja', category:'Estrategia / Motor', desc:'Colecciona fichas de gemas para comprar cartas y construir tu motor de recursos. El primero en llegar a 15 puntos de prestigio gana. Elegante y adictivo.'},
  {name:'Hues and Cues', emoji:'🌈', type:'Competitivo', players:'3-10', duration:'30-45 min', complexity:'Baja', category:'Party / Color / Creatividad', desc:'Da pistas de una o dos palabras para que tus amigos ubiquen exactamente un tono en una grilla de 480 colores. Puntos por acercarse más al color objetivo.'},
  {name:'Coffee Rush', emoji:'☕', type:'Competitivo', players:'2-4', duration:'20-40 min', complexity:'Baja', category:'Familiar / Rapidez', desc:'Prepara y sirve pedidos de café más rápido que tus rivales. Un juego ágil de toma de decisiones rápidas y gestión de recursos en tu cafetería.'},
  {name:'Coo Coo', emoji:'🥚', type:'Competitivo', players:'2-6', duration:'10-20 min', complexity:'Baja', category:'Habilidad / Familiar', desc:'Juego de equilibrio con palitos y huevos. Extrae palitos del soporte sin que los huevos caigan. Simple, tenso y con muchas risas garantizadas.'},
  {name:'Secret Hitler', emoji:'🗳️', type:'Semi-cooperativo', players:'5-10', duration:'45-60 min', complexity:'Media', category:'Social / Roles ocultos / Deducción', desc:'Liberales vs fascistas infiltrados. Los liberales deben aprobar 5 políticas o eliminar a Hitler. Los fascistas deben llevar a Hitler al poder. Mucha desconfianza.'},
  {name:'Clue', emoji:'🔍', type:'Competitivo', players:'2-6', duration:'45-75 min', complexity:'Baja', category:'Misterio / Deducción / Familiar', desc:'Descubre al asesino, el arma y la habitación del crimen en la mansión Tudor. El clásico juego de deducción e interrogatorio.'},
  {name:'Monopoly', emoji:'🎩', type:'Competitivo', players:'2-8', duration:'60-180 min', complexity:'Baja', category:'Familiar / Clásico', desc:'Compra propiedades, construye casas y hoteles, y arruina a tus amigos con rentas. El destructor de amistades más famoso del mundo.'},
  {name:'Betrayal at House on the Hill', emoji:'🏚️', type:'Semi-cooperativo', players:'3-6', duration:'60-90 min', complexity:'Media', category:'Terror / Aventura / Roles ocultos', desc:'Exploren juntos una mansión maldita construyendo el tablero mientras avanzan. En algún punto se activa el "haunt" y uno de los jugadores se revela como traidor. El resto debe sobrevivir o detenerlo.'},
];

const EMOJI_LIST=['🎲', '🃏', '🎯', '🎮', '🏆', '🥇', '⚔️', '🛡️', '🗡️', '🔮', '🧩', '🎰', '🎳', '🎪', '🎭', '🃏', '🀱', '🎴', '🧸', '🪆', '🦁', '🐉', '🦊', '🐺', '🦅', '🐙', '🦈', '🦖', '🐝', '🦋', '🏰', '🏯', '⛵', '🚂', '🏎️', '🚀', '⚓', '🗺️', '🌍', '🏝️', '💎', '👑', '🔱', '⚜️', '🌟', '💥', '🔥', '❄️', '🌊', '⚡', '🧠', '🔬', '🔭', '⚗️', '🧪', '📜', '📚', '🗝️', '🔍', '🪄', '🍎', '🌮', '🍕', '☕', '🍺', '🧁', '🍄', '🌺', '🌵', '🍀', '🤝', '👻', '💀', '🎨', '🎵', '🎬', '📸', '✏️', '🖌️', '🎤'];

let state={name:'Torneo de Mesa',players:[],games:[],system:'rivals',bestN:5,catalog:DEFAULT_GAMES,archive:[],playerPhotos:{}};
let catalogFilters={type:'',complexity:'',players:''};
let selectedEmoji='🎲';
let pendingPhoto=null;
let diceRollHistory=[];

// ==================== SINCRONIZACIÓN (ver js/sync.js) ====================
// `synced` es lo último que sabemos que tiene el servidor; al guardar solo se escribe la
// diferencia entre eso y `state`. Las fotos viven en su propio nodo y se escuchan aparte.
const cloneData=v=>JSON.parse(JSON.stringify(v===undefined?null:v));
let synced=null;            // torneo tal como está en el servidor (sin fotos)
let syncedPhotos={};        // fotos tal como están en el servidor
let photosLoaded=false;     // ya llegó el nodo de fotos al menos una vez
let legacyPhotos=null;      // fotos viejas guardadas dentro del torneo, pendientes de mover
let cachedLegacyPhotos=null;// las mismas, pero de la copia local: solo para mostrarlas, nunca para migrar
const newKey=list=>push(ref(db,ROOT_PATH+'/'+list)).key;

function currentPhotos(){return {...(cachedLegacyPhotos||{}),...(legacyPhotos||{}),...syncedPhotos};}
function applyDefaults(s){if(!s.players)s.players=[];if(!s.games)s.games=[];if(!s.catalog||!s.catalog.length)s.catalog=DEFAULT_GAMES;if(!s.archive)s.archive=[];}
function withoutPhotos(s){const {playerPhotos,...rest}=s;return rest;}

function maybeMigratePhotos(){
  if(!photosLoaded||!legacyPhotos)return;
  const up=photoMigrationUpdates(legacyPhotos,syncedPhotos);
  legacyPhotos=null;
  if(Object.keys(up).length)update(rootRef,up).catch(()=>{});
}

// Copia local del último estado recibido, para abrir la app sin internet (solo en este equipo).
const LS_TORNEO='torneo_cache_v2',LS_PHOTOS='torneo_cache_photos';
function lsGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
let gotRemote=false;        // ya llegaron datos reales de Firebase en esta sesión
let isConnected=false;      // conexión real con Firebase (.info/connected)

function applyTorneo(d,fromCache){
  if(!d)return;
  const remote=normalizeRemote(d);
  // La migración de fotos solo se decide con datos reales del servidor, nunca con la copia local
  if(fromCache)cachedLegacyPhotos=remote.legacyPhotos;
  else{legacyPhotos=remote.legacyPhotos;cachedLegacyPhotos=null;}
  synced=cloneData(remote.state);
  state=remote.state;applyDefaults(state);state.playerPhotos=currentPhotos();
  if(!fromCache)maybeMigratePhotos();
}

// Escucha de datos. Se arranca cuando Firebase ya sabe si hay sesión iniciada (ver ACCESO), y
// se reinicia al iniciar sesión. Si las reglas niegan el acceso, se muestra la pantalla de ingreso.
let dataUnsubs=[];
function stopData(){dataUnsubs.forEach(u=>{try{u();}catch(e){}});dataUnsubs=[];}
function onDataError(err){
  if(err&&/permission/i.test(String(err.code||err.message||'')))handleAccessDenied();
  else setSyncStatus('off');
}
function startData(){
  stopData();accessDenied=false;hideAuthGate();
  dataUnsubs.push(onValue(torneoRef,(snap)=>{
    const d=snap.val();
    gotRemote=true;accessDenied=false;hideAuthGate();
    if(d){applyTorneo(d,false);lsSet(LS_TORNEO,d);}
    window.render();setSyncStatus(isConnected?'ok':'off');
    if(d&&ensureQuoteSeeds())window.saveState();
    fillSplash();maybeHideSplash();
  },onDataError));
  dataUnsubs.push(onValue(photosRef,(snap)=>{
    const raw=snap.val();
    syncedPhotos=photosFromRemote(raw);photosLoaded=true;lsSet(LS_PHOTOS,raw||{});
    state.playerPhotos=currentPhotos();
    maybeMigratePhotos();
    window.render();
  },onDataError));
}

onValue(ref(db,'.info/connected'),(snap)=>{
  isConnected=snap.val()===true;
  if(!isConnected){setSyncStatus(gotRemote?'off':'cache');if(!gotRemote)maybeHideSplash();}
  else if(gotRemote)setSyncStatus('ok');
});

// ==================== ACCESO (inicio de sesión con Google) ====================
// Las reglas de Firebase (database.rules.json) solo dejan entrar a los correos de `allowed`.
// Mientras las reglas sigan abiertas la app funciona igual sin iniciar sesión.
// Las claves de correo usan comas en lugar de puntos, igual que en las reglas.
const emailKey=e=>String(e||'').trim().replace(/\./g,',');
const keyToEmail=k=>String(k).replace(/,/g,'.');
let currentUser=null,accessDenied=false,isAdmin=false,authReady=false,amAllowed=null;
let adminAllowed={},adminRequests={},adminUnsubs=[];
const googleProvider=new GoogleAuthProvider();googleProvider.setCustomParameters({prompt:'select_account'});

window.signInGoogle=async function(){
  setAuthMsg('');
  try{await signInWithPopup(auth,googleProvider);}
  catch(e){
    const c=String(e&&e.code||'');
    if(/popup-blocked|operation-not-supported|web-storage-unsupported/.test(c)){try{await signInWithRedirect(auth,googleProvider);return;}catch(e2){setAuthMsg('No se pudo abrir el inicio de sesión ('+(e2.code||e2.message)+').');return;}}
    if(/popup-closed-by-user|cancelled-popup-request/.test(c))return;
    setAuthMsg('No se pudo iniciar sesión ('+(c||e.message)+').');
  }
};
window.signOutGoogle=async function(){try{await signOut(auth);}catch(e){}};
getRedirectResult(auth).catch(e=>setAuthMsg('No se pudo iniciar sesión ('+(e.code||e.message)+').'));

function setAuthMsg(t){const el=document.getElementById('authMsg');if(el)el.textContent=t;}
function hideAuthGate(){const g=document.getElementById('authGate');if(g)g.style.display='none';}
function showAuthGate(){
  const g=document.getElementById('authGate');if(!g)return;
  window.hideSplash&&window.hideSplash();
  const body=document.getElementById('authGateBody');
  if(!currentUser){
    body.innerHTML='<div class="splash-dice">🔒</div><div class="auth-title">Torneo privado</div>'+
      '<div class="auth-text">Inicia sesión con tu cuenta de Google para ver y registrar partidas.</div>'+
      '<button class="nb-btn nb-btn-primary" onclick="signInGoogle()">Entrar con Google</button>';
  }else{
    body.innerHTML='<div class="splash-dice">⏳</div><div class="auth-title">Falta tu aprobación</div>'+
      '<div class="auth-text">Tu cuenta <b>'+escHtml(currentUser.email)+'</b> todavía no tiene acceso. Ya le enviamos tu solicitud al administrador del grupo.</div>'+
      '<button class="nb-btn nb-btn-primary" onclick="retryAccess()">Volver a intentar</button>'+
      '<button class="nb-btn" style="margin-top:8px;" onclick="signOutGoogle()">Usar otra cuenta</button>';
  }
  g.style.display='flex';
}
function handleAccessDenied(){
  accessDenied=true;stopData();setSyncStatus('off');
  // Sin permiso: borrar la copia local de este equipo para no dejar datos del torneo a la vista
  try{localStorage.removeItem(LS_TORNEO);localStorage.removeItem(LS_PHOTOS);}catch(e){}
  if(currentUser)sendAccessRequest();
  showAuthGate();
}
window.retryAccess=function(){setAuthMsg('Revisando…');startData();};
async function sendAccessRequest(){
  if(!currentUser||!currentUser.email)return;
  try{await set(ref(db,'requests/'+currentUser.uid),{email:currentUser.email,name:currentUser.displayName||'',at:Date.now()});}catch(e){}
}
async function refreshMyAccess(){
  amAllowed=null;isAdmin=false;
  if(!currentUser||!currentUser.email){stopAdmin();renderAccessCard();return;}
  const k=emailKey(currentUser.email);
  try{isAdmin=(await get(ref(db,'admins/'+k))).val()===true;}catch(e){isAdmin=false;}
  try{amAllowed=(await get(ref(db,'allowed/'+k))).val()===true;}catch(e){amAllowed=false;}
  if(!amAllowed)sendAccessRequest(); // así el administrador ve quién quiere entrar, aun antes de cerrar la base
  if(isAdmin)startAdmin();else stopAdmin();
  renderAccessCard();
}
function startAdmin(){
  stopAdmin();
  adminUnsubs.push(onValue(ref(db,'allowed'),s=>{adminAllowed=s.val()||{};renderAccessCard();},()=>{}));
  adminUnsubs.push(onValue(ref(db,'requests'),s=>{adminRequests=s.val()||{};renderAccessCard();},()=>{}));
}
function stopAdmin(){adminUnsubs.forEach(u=>{try{u();}catch(e){}});adminUnsubs=[];adminAllowed={};adminRequests={};}

onAuthStateChanged(auth,(user)=>{
  currentUser=user||null;
  const first=!authReady;authReady=true;
  if(first||accessDenied)startData(); // la primera vez, o reintentar con la nueva sesión
  refreshMyAccess();
});

// Panel en Ajustes
function renderAccessCard(){
  const el=document.getElementById('accessBody');if(!el)return;
  if(!currentUser){
    el.innerHTML='<div class="auth-text" style="text-align:left;">No has iniciado sesión. Cuando el torneo se cierre, solo entrarán las cuentas de Google aprobadas.</div>'+
      '<button class="nb-btn nb-btn-primary" onclick="signInGoogle()">Entrar con Google</button>';
    return;
  }
  const status=isAdmin?'👑 Administrador':amAllowed?'✓ Con acceso':amAllowed===false?'⏳ Pendiente de aprobación':'';
  let h='<div class="access-me"><div><div style="font-weight:700;">'+escHtml(currentUser.email)+'</div><div style="font-size:12px;color:#555;font-weight:500;">'+status+'</div></div>'+
    '<button class="nb-btn nb-btn-sm" onclick="signOutGoogle()">Salir</button></div>';
  if(isAdmin){
    const reqs=Object.entries(adminRequests).filter(([,r])=>r&&r.email);
    h+='<div class="access-lbl">Solicitudes'+(reqs.length?' ('+reqs.length+')':'')+'</div>';
    h+=reqs.length?reqs.map(([uid,r])=>'<div class="access-row"><div style="flex:1;min-width:0;"><div style="font-weight:700;">'+escHtml(r.name||r.email)+'</div><div class="access-mail">'+escHtml(r.email)+'</div></div>'+
      '<button class="nb-btn nb-btn-sm nb-btn-green" onclick="approveRequest(this.dataset.uid,this.dataset.mail)" data-uid="'+escHtml(uid)+'" data-mail="'+escHtml(r.email)+'">Aprobar</button>'+
      '<button class="nb-btn nb-btn-sm nb-btn-red" onclick="rejectRequest(this.dataset.uid)" data-uid="'+escHtml(uid)+'">×</button></div>').join('')
      :'<div class="access-empty">Sin solicitudes pendientes.</div>';
    const allowed=Object.keys(adminAllowed).filter(k=>adminAllowed[k]===true).sort();
    h+='<div class="access-lbl">Con acceso ('+allowed.length+')</div>';
    h+=allowed.map(k=>'<div class="access-row"><div class="access-mail" style="flex:1;font-size:13px;color:#000;">'+escHtml(keyToEmail(k))+'</div>'+
      (k===emailKey(currentUser.email)?'<span style="font-size:11px;font-weight:700;color:#555;">tú</span>':
      '<button class="nb-btn nb-btn-sm nb-btn-red" onclick="removeAllowed(this.dataset.k)" data-k="'+escHtml(k)+'">×</button>')+'</div>').join('');
    h+='<div style="display:flex;gap:8px;margin-top:10px;"><input type="email" class="nb-input" id="allowEmail" placeholder="correo@gmail.com" style="margin:0;flex:1;">'+
      '<button class="nb-btn nb-btn-sm nb-btn-green" onclick="addAllowed()">+ Dar acceso</button></div>';
  }
  el.innerHTML=h;
}
window.approveRequest=async function(uid,email){
  try{await update(rootRef,{['allowed/'+emailKey(email)]:true,['requests/'+uid]:null});showToast(email+' ya tiene acceso ✓');playSound('success');}
  catch(e){showToast('No se pudo aprobar');}
};
window.rejectRequest=async function(uid){try{await update(rootRef,{['requests/'+uid]:null});showToast('Solicitud rechazada');}catch(e){showToast('No se pudo rechazar');}};
window.addAllowed=async function(){
  const inp=document.getElementById('allowEmail');const email=String(inp&&inp.value||'').trim().toLowerCase();
  if(!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)){showToast('Escribe un correo válido');return;}
  try{await update(rootRef,{['allowed/'+emailKey(email)]:true});inp.value='';showToast(email+' ya tiene acceso ✓');playSound('success');}
  catch(e){showToast('No se pudo dar acceso');}
};
window.removeAllowed=async function(k){
  if(currentUser&&k===emailKey(currentUser.email)){showToast('No puedes quitarte el acceso a ti mismo');return;}
  if(!await nbConfirm('Esa cuenta ya no podrá ver ni registrar partidas cuando la base esté cerrada.','¿Quitar acceso a '+keyToEmail(k)+'?','Quitar'))return;
  try{await update(rootRef,{['allowed/'+k]:null});showToast('Acceso quitado');}catch(e){showToast('No se pudo quitar');}
};

window.saveState=async function(){
  setSyncStatus('syncing');
  try{
    const up={...computeUpdates(synced||{},state,newKey),...computePhotoUpdates(syncedPhotos,state.playerPhotos||{})};
    const pending=Object.keys(up).length?update(rootRef,up):null;
    synced=cloneData(withoutPhotos(state));syncedPhotos={...(state.playerPhotos||{})};
    if(pending&&!isConnected){
      // Sin conexión: Firebase guarda el cambio y lo sube al reconectar (si la app sigue abierta)
      setSyncStatus('pending');
      window.render(); // sin conexión Firebase no confirma el cambio, así que se redibuja aquí
      pending.then(()=>setSyncStatus(isConnected?'ok':'off')).catch(()=>setSyncStatus('off'));
      return;
    }
    if(pending)await pending;
    setSyncStatus('ok');
  }catch(e){setSyncStatus('off');showToast('Error al guardar');}
};

function setSyncStatus(s){
  const labels={ok:'en vivo',syncing:'guardando...',off:'sin conexión',cache:'sin conexión · datos guardados',pending:'sin conexión · se subirá al reconectar'};
  document.getElementById('syncDot').className='sync-dot'+((s==='off'||s==='cache')?' off':(s==='syncing'||s==='pending')?' syncing':'');
  document.getElementById('syncLabel').textContent=labels[s]||labels.off;
}

// Lee un nombre de un campo de texto quitando caracteres que rompen el HTML (ver js/text.js)
function readName(inp){
  const raw=(inp&&inp.value||'').trim();const name=cleanName(raw);
  if(name!==raw.replace(/\s+/g,' '))showToast('Se quitaron caracteres no permitidos (< > " ` \\)');
  return name;
}

// ==================== FRASES (ver js/quotes.js) ====================
// Se guardan en torneo_v2/quotes como {nombre codificado: [frases]}. Las frases iniciales del
// grupo se agregan una sola vez (quotesSeeded) a los jugadores cuyo nombre coincide.
function getQuotes(name){const q=(state.quotes||{})[encodeKey(name)];return (Array.isArray(q)?q:Object.values(q||{})).filter(x=>typeof x==='string'&&x);}
function setQuotes(name,list){if(!state.quotes)state.quotes={};if(list.length)state.quotes[encodeKey(name)]=list;else delete state.quotes[encodeKey(name)];}
function groupQuotes(){const out={};(state.players||[]).forEach(p=>{const q=getQuotes(p);if(q.length)out[p]=q;});return out;}
function ensureQuoteSeeds(){
  if(state.quotesSeeded)return false;
  Object.entries(seedQuotesFor(state.players)).forEach(([p,list])=>{if(!getQuotes(p).length)setQuotes(p,list);});
  state.quotesSeeded=true;return true;
}
function renderProfileQuotes(name){
  const list=getQuotes(name);
  document.getElementById('profQuotes').innerHTML=list.length?list.map((q,i)=>
    '<div class="quote-row"><span class="q">“'+escHtml(q)+'”</span><button class="nb-btn nb-btn-sm nb-btn-red" style="padding:2px 8px;" onclick="removeQuote(this.dataset.pn,Number(this.dataset.i))" data-pn="'+escHtml(name)+'" data-i="'+i+'">×</button></div>'
  ).join(''):'<div style="font-size:13px;color:#555;font-weight:500;">Todavía no tiene frases. Agrega la primera 👇</div>';
  document.getElementById('quoteAddBtn').dataset.pn=name;
  document.getElementById('quoteInput').value='';
}
window.addQuote=async function(name){
  const inp=document.getElementById('quoteInput');const text=cleanQuote(inp.value);
  if(!name||!text)return;
  const list=getQuotes(name);
  if(list.includes(text)){showToast('Esa frase ya está');return;}
  setQuotes(name,[...list,text]);await window.saveState();
  renderProfileQuotes(name);showToast('Frase agregada ✓');playSound('success');
};
window.removeQuote=async function(name,i){
  const list=getQuotes(name);if(!(i>=0&&i<list.length))return;
  list.splice(i,1);setQuotes(name,list);await window.saveState();
  renderProfileQuotes(name);showToast('Frase eliminada');playSound('delete');
};

// Datos curiosos del momento para la pantalla de carga
function currentFacts(){
  const standings=(state.games||[]).length?computeScores(state.games):[];
  const kings={};
  getAllGamesEver().forEach(g=>gameWinners(g).forEach(w=>{(kings[g.name]=kings[g.name]||{})[w]=(kings[g.name][w]||0)+1;}));
  const titles={};
  (state.archive||[]).forEach(t=>{const c=archiveScores(t)[0];if(c&&c.pts>0)titles[c.name]=(titles[c.name]||0)+1;});
  const last=(state.archive||[]).length?state.archive[state.archive.length-1]:null;
  const lc=last?archiveScores(last)[0]:null;
  return statFacts({standings,streaks:getStreaks(),kings,titles,lastChampion:lc&&lc.pts>0?{name:lc.name,tournament:last.name}:null});
}

// De quiénes se muestran frases y datos:
//   - con un torneo en curso, solo de los jugadores de ese torneo;
//   - sin torneo en curso, del último campeón;
//   - si nunca se ha cerrado un torneo, de cualquiera del grupo.
function splashAllowed(){
  if(state._tournamentStarted&&(state.activePlayers||[]).length)return state.activePlayers.slice();
  const last=(state.archive||[]).length?state.archive[state.archive.length-1]:null;
  const lc=last?archiveScores(last)[0]:null;
  return lc&&lc.pts>0?[lc.name]:null;
}
function splashPool(){
  const allowed=splashAllowed();
  const quotes={};
  (allowed||state.players||[]).forEach(p=>{const q=getQuotes(p);if(q.length)quotes[p]=q;});
  return restrictPool({quotes,facts:currentFacts()},allowed);
}

// ==================== PANTALLA DE CARGA ====================
// Se ve al abrir la app mientras se conecta. Muestra una frase o un dato apenas hay datos (de
// Firebase o de la copia local), se queda al menos SPLASH_MIN para alcanzar a leerla, se salta
// con un toque y nunca dura más de SPLASH_MAX.
const SPLASH_MIN=2200,SPLASH_MAX=7000;
let splashShownAt=0,splashDone=false;
function fillSplash(){
  if(splashShownAt||splashDone)return;
  try{
    const pick=pickSplash(splashPool());
    if(!pick)return;
    const body=document.getElementById('splashBody');if(!body)return;
    body.innerHTML=splashCardHTML(pick,'🎲 '+(state.name||'Torneo de Mesa'));
    splashShownAt=performance.now();
  }catch(e){}
}
// HTML de la tarjeta de frase o dato (pantalla de carga y botón de datos curiosos)
function splashCardHTML(pick,quoteTag){
  if(pick.type==='quote'){
    const t=(state.archive||[]).filter(a=>{const c=archiveScores(a)[0];return c&&c.name===pick.name&&c.pts>0;}).length;
    return '<div class="splash-tag">'+escHtml(quoteTag)+'</div>'+
      '<div class="splash-avatar">'+av(pick.name,72)+'</div>'+
      '<div class="splash-quote">'+escHtml(pick.text)+'</div>'+
      '<div class="splash-author">— '+escHtml(pick.name)+'</div>'+
      (t?'<div class="splash-sub">🏆 '+t+(t===1?' título':' títulos')+'</div>':'');
  }
  return '<div class="splash-tag">¿Sabías que…?</div>'+
    (pick.name?'<div class="splash-avatar">'+av(pick.name,64)+'</div>':'')+
    '<div class="splash-fact-icon">'+pick.icon+'</div>'+
    '<div class="splash-fact">'+escHtml(pick.text)+'</div>'+
    (pick.sub?'<div class="splash-sub" style="margin-top:8px;">'+escHtml(pick.sub)+'</div>':'');
}

// ==================== BOTÓN DE DATOS CURIOSOS ====================
// Frase o dato al azar de cualquier jugador del grupo (no solo del torneo en curso), sin
// repetir el anterior. Suma los datos de las estadísticas globales para más variedad.
let lastCuriosity=null;
function curiosityPool(){
  const quotes={};
  const names=new Set([...(state.players||[]),...Object.keys(state.quotes||{}).map(k=>{try{return decodeURIComponent(k);}catch(e){return k;}})]);
  names.forEach(p=>{const q=getQuotes(p);if(q.length)quotes[p]=q;});
  let facts=[];
  try{facts=currentFacts();}catch(e){}
  try{if(getAllGamesEver().length)globalStatCards().forEach(c=>facts.push({icon:c.icon,text:c.label+': '+c.value,sub:c.sub}));}catch(e){}
  return {quotes,facts};
}
window.openCuriosity=function(){
  const pool=curiosityPool();
  let pick=null;
  for(let i=0;i<8;i++){pick=pickSplash(pool);if(!pick||pick.text!==lastCuriosity)break;}
  if(!pick){showToast('Todavía no hay frases ni datos: agrega frases en el perfil de cada jugador');return;}
  lastCuriosity=pick.text;
  let el=document.getElementById('curiosity');
  if(!el){
    el=document.createElement('div');el.id='curiosity';el.className='splash curiosity';
    el.addEventListener('click',e=>{if(e.target===el)window.closeCuriosity();});
    document.body.appendChild(el);
  }
  el.innerHTML='<div class="splash-card">'+splashCardHTML(pick,'💬 Frase célebre')+
    '<div class="curiosity-actions"><button class="nb-btn nb-btn-primary" onclick="openCuriosity()">🎲 Otro</button>'+
    '<button class="nb-btn" onclick="closeCuriosity()">Cerrar</button></div></div>';
  playSound('tap');
};
window.closeCuriosity=function(){const el=document.getElementById('curiosity');if(el)el.remove();};

window.hideSplash=function(){
  if(splashDone)return;splashDone=true;
  const el=document.getElementById('splash');if(!el)return;
  el.classList.add('hide');setTimeout(()=>el.remove(),400);
};
function maybeHideSplash(){
  if(splashDone)return;
  const wait=splashShownAt?Math.max(0,SPLASH_MIN-(performance.now()-splashShownAt)):0;
  setTimeout(window.hideSplash,wait);
}

// ==================== PUNTAJE (ver js/scoring.js) ====================
// Envoltorios que le pasan al módulo de puntaje el estado del torneo actual.
function getBestN(){const n=state.bestN;return (n===undefined||n===null)?DEFAULT_BEST_N:Number(n)||0;}

// Marcador; por defecto el del torneo actual (sistema, mejores N y jugadores activos).
function computeScores(games,opts){
  opts=opts||{};
  return computeStandings(games,{
    system:opts.system!==undefined?opts.system:state.system,
    bestN:opts.bestN!==undefined?opts.bestN:getBestN(),
    players:opts.players||state.activePlayers||state.players||[],
  });
}

// Marcador de un torneo archivado, con el sistema y la regla de partidas con que se jugó.
// Los torneos cerrados antes de guardar ese dato se jugaron con Proporcional y suma total.
function archiveScores(t){
  return computeScores(t.games||[],{system:t.system||'proportional',bestN:t.bestN||0,players:playersInGames(t.games)});
}

// Lista de todas las partidas de la historia, cada una con el sistema de su torneo
function getAllGamesWithSystem(){
  const list=[];
  (state.archive||[]).forEach(t=>(t.games||[]).forEach(g=>list.push({g,system:t.system||'proportional'})));
  (state.games||[]).forEach(g=>list.push({g,system:state.system}));
  return list;
}

// Chips de resultado de una partida para el historial (equipos, puestos y quienes jugaron sin podio)
function gameResultChips(g,system){
  const sg=scoreGame(g,system);
  if(g.teams&&g.teams.length){
    return g.teams.map((team,ti)=>{const pts=team.length&&sg[team[0]]?sg[team[0]].pts:0;return '<span class="nb-chip">'+(ti+1)+'° '+team.map(escHtml).join(' + ')+' +'+pts+'</span>';}).join('');
  }
  return Object.entries(sg).sort((a,b)=>(a[1].ranked===b[1].ranked?a[1].rank-b[1].rank:(a[1].ranked?-1:1)))
    .map(([p,r])=>'<span class="nb-chip"'+(r.ranked?'':' style="background:#fff;"')+'>'+(r.ranked?(r.rank+1)+'° ':'')+escHtml(p)+' +'+r.pts+'</span>').join('');
}

// Ordena una lista de nombres de jugadores por su puntaje del torneo ACTUAL (mismo criterio
// de desempate que el marcador: pts → wins → podiums → alfabético). Jugadores sin puntaje
// registrado en el torneo actual (0 partidas) quedan al final, en orden alfabético entre ellos.
function sortPlayersByScore(names){
  const sc=computeScores(state.games);
  const map={};
  sc.forEach(p=>{ map[p.name]={pts:p.pts,wins:p.wins,podiums:p.podiums}; });
  return (names||[]).slice().sort((a,b)=>{
    const sa=map[a]||{pts:0,wins:0,podiums:0};
    const sb=map[b]||{pts:0,wins:0,podiums:0};
    return sb.pts-sa.pts || sb.wins-sa.wins || sb.podiums-sa.podiums || a.localeCompare(b,'es');
  });
}

const medals=['🥇','🥈','🥉'];
function gameEmoji(name){const f=(state.catalog||[]).find(g=>g.name===name);return f?f.emoji:'🎲';}
function av(p,size=36){const photo=(state.playerPhotos||{})[p];const s=`width:${size}px;height:${size}px;border-radius:50%;border:2px solid #000;background:#A3E635;display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*.38)}px;font-weight:700;flex-shrink:0;overflow:hidden;`;return photo?`<img src="${photo}" style="${s}object-fit:cover;">`:`<div style="${s}">${escHtml(p[0].toUpperCase())}</div>`;}

window.render=function(){
  document.getElementById('tourneyName').textContent=state.name||'Torneo de Mesa';
  document.getElementById('settingName').value=state.name||'';
  document.getElementById('settingSystem').value=normSystem(state.system);
  const bnSel=document.getElementById('settingBestN');if(bnSel)bnSel.value=String(getBestN());
  const gc=(state.games||[]).length;
  document.getElementById('gameCount').textContent=gc+' juego'+(gc===1?'':'s');

  // Leaderboard
  // Dynamic nav button: Crear torneo vs Registrar
  var navBtns=document.querySelectorAll('.nav button');
  if(navBtns[1]) {
    var hasTorneo=state._tournamentStarted&&(state.activePlayers||[]).length;
    navBtns[1].classList.remove('disabled');
    if(hasTorneo) {
      navBtns[1].innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Registrar';
      navBtns[1].onclick=function(){window.goTo("add",this);};
    } else {
      navBtns[1].innerHTML='<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>Crear';
      navBtns[1].onclick=function(){window.startOnboarding();};
    }
  }

  // Show action buttons only with active tournament
  const ba=document.getElementById('boardActions');
  if(ba){
    if(state._tournamentStarted&&(state.activePlayers||[]).length){
      ba.innerHTML='<button class="nb-btn nb-btn-sm nb-btn-yellow" onclick="shareScoreboard()" style="font-size:11px;padding:4px 8px;">📤</button>'+
        '<button class="nb-btn nb-btn-sm nb-btn-yellow" onclick="openCuriosity()" title="Dato curioso" style="font-size:11px;padding:4px 8px;">💬</button>'+
        '<button class="nb-btn nb-btn-sm nb-btn-pink" onclick="openQueJugamos()" style="color:#000;">🎲 ¿Qué jugamos?</button>';
    } else {
      ba.innerHTML=(state.players||[]).length?'<button class="nb-btn nb-btn-sm nb-btn-yellow" onclick="openCuriosity()" style="font-size:11px;padding:4px 8px;">💬 Dato curioso</button>':'';
    }
  }
  const board=document.getElementById('leaderList');
  if(!(state.players||[]).length || (!(state.games||[]).length && !state._tournamentStarted)){board.innerHTML=`<div style="text-align:center;padding:24px 16px;">
      <div style="font-size:48px;margin-bottom:12px;">🎲</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:6px;">${(state.players||[]).length ? 'Nuevo torneo' : 'Bienvenido'}</div>
      <div style="font-size:14px;font-weight:500;color:#555;margin-bottom:20px;">${(state.players||[]).length ? 'Elige quién juega hoy' : 'Configura tu primer torneo'}</div>
      <button class="nb-btn nb-btn-primary" style="margin-bottom:10px;" onclick="startOnboarding()">🏆 ${(state.players||[]).length ? 'Configurar torneo' : 'Crear torneo'}</button>
    </div>`;}
  else{
    const sc=computeScores(state.games);
    const ranks=computeDisplayRanks(sc);
    const streaks=getStreaks();
    board.innerHTML=sc.map((p,i)=>{
      const rank=ranks[i];
      const isFirst=rank===1;
      const streak=streaks[p.name];
      return `<div class="leader-row${isFirst?' first-place':''}">
        <span class="rank">${rank<=3?medals[rank-1]:rank}</span>
        ${av(p.name,36)}
        <div style="flex:1;">
          <div class="player-name">${escHtml(p.name)}</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px;">
            ${p.wins?`<span class="nb-tag tag-win">${p.wins}V</span>`:''}
            ${p.podiums>p.wins?`<span class="nb-tag tag-pod">${p.podiums} pod</span>`:''}
            <span class="nb-tag tag-games">${p.gamesPlayed} part${p.counted<p.gamesPlayed?` · cuentan ${p.counted}`:''}</span>
            ${streak?`<span class="nb-tag" style="background:#FF6B9D;border-color:#000;">\u{1F525} ${streak} racha</span>`:''}
          </div>
        </div>
        <div class="player-pts">${p.pts}<small> pts</small></div>
      </div>`;
    }).join('');
  }

  // Último campeón — solo se muestra cuando no hay torneo activo (pantalla de bienvenida/nuevo torneo)
  const lcc=document.getElementById('lastChampCard');
  if(lcc){
    const noActiveTourney=!(state.players||[]).length || (!(state.games||[]).length && !state._tournamentStarted);
    const lastArchived=(state.archive||[]).length?state.archive[state.archive.length-1]:null;
    if(noActiveTourney && lastArchived && lastArchived.games && lastArchived.games.length){
      const lsc=archiveScores(lastArchived);
      const lchamp=lsc[0];
      const lTied=getTiedWith(lsc,lchamp);
      const ld=lastArchived.date?new Date(lastArchived.date).toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'}):'';
      lcc.style.display='block';
      lcc.innerHTML=`<div class="nb-card" style="background:#FFE066;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:8px;">🏆 Último campeón</div>
        <div style="display:flex;align-items:center;gap:12px;">
          ${av(lchamp.name,44)}
          <div style="flex:1;">
            <div style="font-size:17px;font-weight:700;">${escHtml(lchamp.name)}</div>
            <div style="font-size:12px;font-weight:500;color:#555;">${escHtml(lastArchived.name)}${ld?' · '+ld:''}${lTied.length?' · empate c/ '+lTied.map(escHtml).join(', '):''}</div>
          </div>
          <div class="player-pts">${lchamp.pts}<small> pts</small></div>
        </div>
      </div>`;
    } else {
      lcc.style.display='none';
      lcc.innerHTML='';
    }
  }

  // Estadísticas globales (carrusel)
  renderGlobalStats();
  // La columna lateral del marcador (último campeón + estadísticas) se oculta si no muestra nada
  const side=document.getElementById('boardSide');
  if(side)side.classList.toggle('empty',![...side.children].some(c=>c.style.display!=='none'));

  // Game select + search
  filterGameSelect();

  // Players settings — ordenados por puntaje actual del torneo
  const pl=document.getElementById('playersList');
  const sortedRoster=sortPlayersByScore(state.players||[]);
  pl.innerHTML=sortedRoster.length?sortedRoster.map(p=>{
    const i=state.players.indexOf(p); // índice real en state.players, no en la lista ordenada
    return `<div class="player-item">${av(p,38)}<span style="flex:1;font-size:14px;font-weight:700;">${escHtml(p)}</span>
    <label style="cursor:pointer;font-size:18px;">📷<input type="file" accept="image/*" style="display:none;" onchange="updatePhoto(this.dataset.pn,event)" data-pn="${escHtml(p)}"></label>
    <button class="nb-btn nb-btn-sm nb-btn-red" onclick="removePlayer(${i})">×</button></div>`;
  }).join(''):'<div style="font-size:13px;color:#555;font-weight:500;padding:8px 0;">Sin jugadores.</div>';

  // Catalog
  renderCatalog();

  // Emoji grid
  const eg=document.getElementById('emojiGrid');
  if(eg&&!eg.children.length)eg.innerHTML=EMOJI_LIST.map(e=>`<button class="emoji-btn" onclick="selectEmoji('${e}')">${e}</button>`).join('');

  // History
  const hist=document.getElementById('historyList');
  if(!(state.games||[]).length){hist.innerHTML='<div class="nb-empty">Sin juegos registrados.</div>';}
  else{hist.innerHTML=[...(state.games||[])].reverse().map((g,ri)=>{
    const i=state.games.length-1-ri;
    const d=g.date?new Date(g.date).toLocaleDateString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="game-row">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div style="font-size:14px;font-weight:700;">${gameEmoji(g.name)} ${escHtml(g.name)}</div>${d?`<div style="font-size:11px;color:#555;">${d}</div>`:''}</div>
        <button class="nb-btn nb-btn-sm nb-btn-red" onclick="deleteGame(${i})" style="padding:3px 8px;font-size:11px;">×</button>
      </div>
      <div style="margin-top:5px;">${gameResultChips(g,state.system)}</div>
    </div>`;
  }).join('');}

  // Archive
  const arch=document.getElementById('archiveList');
  if(!(state.archive||[]).length){arch.innerHTML='<div class="nb-empty">Sin torneos cerrados aún.</div>';}
  else{arch.innerHTML=[...(state.archive||[])].reverse().map((t,i)=>{
    const champ=archiveScores(t)[0];
    const d=t.date?new Date(t.date).toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'}):'';
    return `<div class="archive-item" onclick="showArchiveTorney(${state.archive.length-1-i})">
      <div class="archive-title">🏆 ${escHtml(t.name)}</div>
      <div class="archive-sub">${d} · ${t.games.length} juegos · Campeón: ${champ?escHtml(champ.name):'—'}</div>
    </div>`;
  }).join('');}

  // Stats
  renderStats();

  // Profile picker — ordenado por puntaje del torneo actual
  document.getElementById('profilePicker').innerHTML=sortPlayersByScore(state.players||[]).map(p=>
    `<div class="player-item" style="cursor:pointer;" onclick="showProfile(this.dataset.pn)" data-pn="${escHtml(p)}">
      ${av(p,34)}<span style="flex:1;font-size:14px;font-weight:700;">${escHtml(p)}</span><span style="font-size:18px;">›</span>
    </div>`
  ).join('')||'<div class="nb-empty">Sin jugadores.</div>';

  // Migration
  const mc=document.getElementById('migrationCard');
  if(mc)mc.style.display=(state.archive||[]).find(t=>t._migratedFromV1)?'none':'block';

  // Pos selects
  refreshPosSelects();
};

window.filterGameSelect=function(){
  const q=(document.getElementById('gameSearch')||{}).value||'';
  const gs=document.getElementById('gameSelect');
  if(!gs)return;
  const prev=gs.value;
  const filtered=(state.catalog||[]).filter(g=>!q||g.name.toLowerCase().includes(q.toLowerCase()));
  gs.innerHTML='<option value="">— Selecciona un juego —</option>'+
    filtered.map(g=>`<option value="${escHtml(g.name)}">${g.emoji||'🎲'} ${escHtml(g.name)}</option>`).join('')+
    '<option value="__custom__">✏️ Otro juego...</option>';
  if(prev&&[...gs.options].find(o=>o.value===prev))gs.value=prev;
};

window.renderCatalog=function(){
  const search=(document.getElementById('catalogSearch')||{}).value||'';
  const{type,complexity,players}=catalogFilters;
  const filtered=(state.catalog||[]).filter(g=>{
    if(search&&!g.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(type&&g.type!==type)return false;
    if(complexity&&g.complexity!==complexity)return false;
    if(players&&g.players){
      const parts=g.players.replace(/\s/g,'').split('-');
      const min=parseInt(parts[0]);const max=parseInt(parts[parts.length-1]);
      const want=parseInt(players);
      if(want===2){if(min>2)return false;}else{if(max<want)return false;}
    }
    return true;
  });
  const cc=document.getElementById('catalogCount');
  if(cc)cc.textContent=filtered.length+' de '+(state.catalog||[]).length+' juegos';
  const cl=document.getElementById('catalogList');
  if(!cl)return;
  const typeClass=t=>t==='Cooperativo'?'nb-tag-type-c':t==='Semi-cooperativo'?'nb-tag-type-s':'nb-tag-type-v';
  const compClass=c=>c==='Alta'?'nb-tag-comp-high':c==='Media'?'nb-tag-comp-med':'nb-tag-comp-low';
  cl.innerHTML=filtered.map(g=>{
    const i=(state.catalog||[]).indexOf(g);
    const expandId='gexp_'+i;
    const hasInfo=!!(g.type||g.players||g.duration||g.complexity||g.category||g.desc);
    const isCustom=i>=DEFAULT_GAMES.length;
    let html='<div><div class="game-cat-item"'+(hasInfo?' onclick="toggleGameCard(this.dataset.eid)" data-eid="'+expandId+'"':'')+'>'+
      '<span class="game-emoji">'+(g.emoji||'🎲')+'</span>'+
      '<div style="flex:1;"><div class="game-name-text">'+escHtml(g.name)+'</div>'+
      (g.players||g.duration?'<div class="game-meta-text">'+(g.players?'👥 '+escHtml(g.players):'')+(g.players&&g.duration?' · ':'')+(g.duration?'⏱ '+escHtml(g.duration):'')+'</div>':'')+'</div>'+
      '<div style="display:flex;align-items:center;gap:5px;">'+
      (isCustom?'<button class="nb-btn nb-btn-sm nb-btn-red" onclick="event.stopPropagation();removeGameFromCatalog('+i+')" style="padding:2px 7px;font-size:11px;">×</button>':'')+
      (hasInfo?'<span style="font-size:16px;font-weight:700;color:#555;" id="arr_'+i+'">›</span>':'')+
      '</div></div>';
    if(hasInfo){
      html+='<div class="game-expand-card" id="'+expandId+'">'+
        '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">'+
        (g.type?'<span class="nb-tag '+typeClass(g.type)+'">'+(g.type==='Cooperativo'?'🤝':'⚔️')+' '+g.type+'</span>':'')+
        (g.complexity?'<span class="nb-tag '+compClass(g.complexity)+'">🎯 '+g.complexity+'</span>':'')+
        (g.category?'<span class="nb-tag nb-tag-cat">🏷 '+escHtml(g.category)+'</span>':'')+
        '</div>'+
        (g.players?'<div style="font-size:12px;font-weight:700;margin-bottom:3px;">👥 '+escHtml(g.players)+'</div>':'')+
        (g.duration?'<div style="font-size:12px;font-weight:700;margin-bottom:3px;">⏱ '+escHtml(g.duration)+'</div>':'')+
        (g.desc?'<div style="font-size:13px;font-weight:500;color:#333;margin-top:4px;">'+escHtml(g.desc)+'</div>':'')+
        '</div>';
    }
    html+='</div>';
    return html;
  }).join('');
};

function renderStats(){
  const allGames=[...(state.games||[]),...(state.archive||[]).flatMap(t=>t.games||[])];
  const freq={};allGames.forEach(g=>{freq[g.name]=(freq[g.name]||0)+1;});
  const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  const sgl=document.getElementById('statsGamesList');
  sgl.innerHTML=sorted.length?sorted.map(([name,count])=>
    `<div class="game-cat-item" style="cursor:default;">
      <span class="game-emoji">${gameEmoji(name)}</span>
      <div style="flex:1;"><div class="game-name-text">${escHtml(name)}</div>
        <div style="height:5px;background:#f0f0f0;border:1px solid #000;border-radius:3px;margin-top:4px;overflow:hidden;">
          <div style="height:100%;background:#A3E635;width:${Math.round(count/sorted[0][1]*100)}%;"></div></div></div>
      <span style="font-size:14px;font-weight:700;">${count}×</span>
    </div>`
  ).join(''):'<div class="nb-empty">Sin datos.</div>';
  const kings={};
  allGames.forEach(g=>{gameWinners(g).forEach(w=>{if(!kings[g.name])kings[g.name]={};kings[g.name][w]=(kings[g.name][w]||0)+1;});});
  const ke=Object.entries(kings);
  document.getElementById('statsKings').innerHTML=ke.length?ke.map(([game,players])=>{
    const max=Math.max(...Object.values(players));
    const kingsNames=Object.keys(players).filter(p=>players[p]===max).sort((a,b)=>a.localeCompare(b,'es'));
    return `<div class="stat-row"><div>${gameEmoji(game)} <span style="font-size:14px;font-weight:700;">${escHtml(game)}</span></div>
      <div style="font-size:14px;font-weight:700;text-align:right;">👑 ${kingsNames.map(escHtml).join(' y ')} <span style="font-size:11px;font-weight:500;">${max}V</span></div></div>`;
  }).join(''):'<div class="nb-empty">Sin datos.</div>';
}

// Resuelve el resultado de UN jugador en UNA partida, sea individual rankeado,
// individual sin puesto (jugó pero no quedó en podio), o de equipos.
function getPlayerGameResult(g,name,system){
  const r=scoreGame(g,system!==undefined?system:state.system)[name];
  if(!r)return{participated:false};
  return{participated:true,ranked:r.ranked,idx:r.rank,points:r.pts};
}

window.showProfile=function(name){
  document.getElementById('profileModal').style.display='flex';
  renderProfileQuotes(name);
  const myGames=getAllGamesWithSystem().map(({g,system})=>({g,r:getPlayerGameResult(g,name,system)})).filter(x=>x.r.participated);
  let wins=0,podiums=0,pts=0;const gamePts={};
  myGames.forEach(({g,r})=>{
    pts+=r.points;
    if(r.ranked&&r.idx===0)wins++;
    if(r.ranked&&r.idx<3)podiums++;
    if(!gamePts[g.name])gamePts[g.name]={pts:0,games:0,wins:0};
    gamePts[g.name].pts+=r.points;gamePts[g.name].games++;
    if(r.ranked&&r.idx===0)gamePts[g.name].wins++;
  });
  // Win rate clásico: victorias / partidas que este jugador realmente jugó
  const winRate=myGames.length?Math.round(wins/myGames.length*100):0;
  const profAv=document.getElementById('profAvatar');
  const photo=(state.playerPhotos||{})[name];
  if(photo){profAv.innerHTML=`<img src="${photo}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;">`;profAv.style.background='none';}
  else{profAv.textContent=name[0].toUpperCase();profAv.style.background='#A3E635';}
  document.getElementById('profName').textContent=name;
  document.getElementById('profSub').textContent=myGames.length+' partidas jugadas';
  document.getElementById('profMetrics').innerHTML=
    `<div class="metric-box"><div class="metric-val">${pts}</div><div class="metric-lbl">Puntos</div></div>
    <div class="metric-box"><div class="metric-val">${wins}</div><div class="metric-lbl">Victorias</div></div>
    <div class="metric-box"><div class="metric-val">${podiums}</div><div class="metric-lbl">Podios</div></div>
    <div class="metric-box"><div class="metric-val">${winRate}%</div><div class="metric-lbl">Win rate</div></div>`;
  const best=Object.entries(gamePts).sort((a,b)=>b[1].wins-a[1].wins)[0];
  document.getElementById('profBestGame').innerHTML=best?`${gameEmoji(best[0])} ${escHtml(best[0])} — ${best[1].wins}V en ${best[1].games} partidas`:'Sin datos';
  document.getElementById('profHistory').innerHTML=myGames.slice(-10).reverse().map(({g,r})=>{
    const label=r.ranked?(r.idx<3?medals[r.idx]:(r.idx+1)+'°'):'Participó';
    return `<div class="stat-row"><div>${gameEmoji(g.name)} <span style="font-size:13px;font-weight:700;">${escHtml(g.name)}</span></div>
      <div>${label} <span class="nb-tag tag-win">+${r.points}</span></div></div>`;
  }).join('')||'<div class="nb-empty">Sin partidas.</div>';
};

window.showArchiveTorney=function(i){
  const t=state.archive[i];if(!t)return;
  const sc=archiveScores(t);
  const ranks=computeDisplayRanks(sc);
  const d=t.date?new Date(t.date).toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'}):'';
  document.getElementById('archiveModalTitle').textContent='🏆 '+t.name;
  document.getElementById('archiveModalSub').textContent=d+' · '+t.games.length+' juegos jugados';
  const ms=['🥇','🥈','🥉'];
  document.getElementById('archiveModalBody').innerHTML=
    sc.map((p,pi)=>{
      const rank=ranks[pi];
      const isFirst=rank===1;
      return '<div class="leader-row'+(isFirst?' first-place':'')+'">'+
        '<span class="rank">'+(rank<=3?ms[rank-1]:rank)+'</span>'+
        '<div style="flex:1;"><div class="player-name">'+escHtml(p.name)+'</div>'+
        '<div style="display:flex;gap:3px;margin-top:3px;">'+
        (p.wins?'<span class="nb-tag tag-win">'+p.wins+'V</span>':'')+
        (p.podiums>p.wins?'<span class="nb-tag tag-pod">'+p.podiums+' pod</span>':'')+
        '</div></div>'+
        '<div class="player-pts">'+p.pts+'<small> pts</small></div>'+
        '</div>';
    }).join('')+
    '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;margin:14px 0 6px;">Juegos jugados</div>'+
    t.games.map(g=>{
      return '<div class="game-row">'+
        '<div style="font-size:13px;font-weight:700;">'+gameEmoji(g.name)+' '+escHtml(g.name)+'</div>'+
        '<div style="margin-top:4px;">'+gameResultChips(g,t.system||'proportional')+'</div>'+
        '</div>';
    }).join('');
  document.getElementById('archiveModal').style.display='flex';
};

window.closeTournament=async function(){
  if(!(state.games||[]).length){showToast('No hay juegos registrados aún');return;}
  const sc=computeScores(state.games);const champ=sc[0];
  const tied=getTiedWith(sc,champ);
  let confirmMsg='🏆 Campeón: '+champ.name+' con '+champ.pts+' pts';
  if(tied.length){
    confirmMsg+='\n\n(Empate en puntos, victorias y podios con '+tied.join(', ')+'. Se definió por orden alfabético — el trofeo es para '+champ.name+'.)';
  }
  confirmMsg+='\n\nEl torneo se archivará y empezará uno nuevo.';
  if(!await nbConfirm(confirmMsg,'¿Cerrar "'+state.name+'"?','Cerrar torneo'))return;
  if(!state.archive)state.archive=[];
  state.archive.push({name:state.name,date:new Date().toISOString(),games:state.games,players:state.players,system:normSystem(state.system),bestN:getBestN()});
  state.games=[];state._tournamentStarted=false;state.activePlayers=null;if(window._turnPlayers)window._turnPlayers.length=0;if(window._turnOrder)window._turnOrder.length=0;var _tol=document.getElementById('turnOrderList');if(_tol)_tol.innerHTML='';var _tpp=document.getElementById('turnPlayerPicker');if(_tpp)_tpp.innerHTML='';await window.saveState();
  playSound('fanfare');showChampionScreen(champ.name,champ.pts);
};

function showChampionScreen(name,pts){
  const div=document.createElement('div');div.className='champ-screen';
  div.innerHTML=`<canvas class="confetti-canvas" id="confetti"></canvas><div class="champ-trophy">🏆</div>
    <div style="font-size:13px;font-weight:700;opacity:.6;margin-bottom:8px;text-transform:uppercase;">Campeón del torneo</div>
    <div class="champ-name">${escHtml(name)}</div><div class="champ-sub">${pts} puntos</div>
    ${(q=>q.length?`<div class="champ-quote">${escHtml(q[Math.floor(Math.random()*q.length)])}</div>`:'')(getQuotes(name))}
    <button class="nb-btn nb-btn-primary" style="margin-top:16px;" onclick="this.parentElement.remove()">Cerrar</button>`;
  document.body.appendChild(div);
  const c=div.querySelector('#confetti');c.width=window.innerWidth;c.height=window.innerHeight;
  const ctx=c.getContext('2d');
  const pieces=Array.from({length:80},()=>({x:Math.random()*c.width,y:Math.random()*-c.height,r:Math.random()*6+3,col:`hsl(${Math.random()*360},80%,60%)`,v:Math.random()*3+2,a:Math.random()*Math.PI*2,va:Math.random()*.1-.05}));
  let fr;function draw(){ctx.clearRect(0,0,c.width,c.height);pieces.forEach(p=>{p.y+=p.v;p.x+=Math.sin(p.a)*1.5;p.a+=p.va;if(p.y>c.height){p.y=-10;p.x=Math.random()*c.width;}ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});fr=requestAnimationFrame(draw);}
  draw();setTimeout(()=>cancelAnimationFrame(fr),6000);
}

// Emoji picker
window.toggleEmojiPicker=function(){
  const p=document.getElementById('emojiPicker');p.style.display=p.style.display==='none'?'block':'none';
};
window.selectEmoji=function(e){
  selectedEmoji=e;
  document.getElementById('newGameEmoji').textContent=e;
  document.getElementById('emojiPicker').style.display='none';
};

// Pos selects
function buildPlayerOpts(){return'<option value="">— jugador —</option>'+((state.activePlayers||state.players)||[]).map(p=>'<option value="'+escHtml(p)+'">'+escHtml(p)+'</option>').join('');}
function refreshPosSelects(){[...document.querySelectorAll('#posSelect select')].forEach(s=>{const v=s.value;s.innerHTML=buildPlayerOpts();if(v)s.value=v;s.setAttribute('onchange','renderOtherParticipants()');});window.renderOtherParticipants&&window.renderOtherParticipants();}
window.addPosRow=function(){const cont=document.getElementById('posSelect');const i=cont.children.length;const d=document.createElement('div');d.className='pos-item';d.innerHTML='<span class="pos-label">'+(i+1)+'°</span><select onchange="renderOtherParticipants()">'+buildPlayerOpts()+'</select>';cont.appendChild(d);window.renderOtherParticipants&&window.renderOtherParticipants();};
window.removePosRow=function(){const cont=document.getElementById('posSelect');if(cont.children.length>1)cont.removeChild(cont.lastChild);window.renderOtherParticipants&&window.renderOtherParticipants();};

window.onGameSelect=function(){const v=document.getElementById('gameSelect').value;document.getElementById('gameCustom').style.display=v==='__custom__'?'block':'none';};

window.saveGame=async function(){
  let name=selectedGame;
  if(!name){showToast('Selecciona o escribe el juego');return;}
  if(!name||name==='__custom__'){showToast('Selecciona o escribe el juego');return;}
  
  var positions, teamPositions;
  
  if(gameMode==='teams') {
    var validTeams=teams.filter(function(t){return t.members.length>0;});
    if(validTeams.length<1){showToast('Necesitas al menos 1 equipo con jugadores');return;}
    positions=[];
    teamPositions=validTeams.map(function(t){return t.members;});
    validTeams.forEach(function(t){t.members.forEach(function(m){positions.push(m);});});
  } else {
    const sels=document.querySelectorAll('#posSelect select');
    positions=[...sels].map(s=>s.value).filter(Boolean);
    const unique=[...new Set(positions)];
    if(unique.length<1){showToast('Asigna al menos 1 jugador');return;}
    if(unique.length!==positions.length){showToast('Jugadores repetidos');return;}
    positions=unique;
  }
  
  // participants = todos los que realmente jugaron esta partida (podio + los marcados sin puesto).
  // En equipos, positions ya incluye a todos los miembros de todos los equipos.
  var participants = positions.slice();
  if(gameMode!=='teams'){
    otherParticipants.forEach(function(p){ if(participants.indexOf(p)===-1) participants.push(p); });
  }

  if(!state.games)state.games=[];
  // Snapshot de la dificultad ACTUAL del catálogo al momento de registrar — así, si luego
  // editas la dificultad de este juego en el catálogo, los puntos de esta partida no cambian.
  var catEntry=(state.catalog||[]).find(function(c){return c.name===name;});
  var complexity=(catEntry&&catEntry.complexity)?catEntry.complexity:'Baja';
  var gameEntry={name:name,positions:positions,participants:participants,complexity:complexity,date:new Date().toISOString()};
  if(teamPositions){gameEntry.teams=teamPositions;}
  state.games.push(gameEntry);
  await window.saveState();
  selectedGame=null;if(gameMode==='teams'){teams=[{name:'Equipo 1',members:[]},{name:'Equipo 2',members:[]}];}otherParticipants=[];document.getElementById('gameCustom').value='';document.getElementById('gameCustom').style.display='none';document.getElementById('gameSearch').value='';document.getElementById('gameSelected').style.display='none';document.getElementById('gameResultsList').style.display='none';
  document.getElementById('posSelect').innerHTML='';window.addPosRow();window.addPosRow();window.renderOtherParticipants();
  window.goTo('board',document.querySelector('.nav button'));showToast('✓ Resultado guardado');playSound('success');
};

window.deleteGame=async function(i){if(!await nbConfirm('Se eliminará este resultado y sus puntos.','¿Borrar resultado?','Borrar'))return;state.games.splice(i,1);await window.saveState();showToast('Borrado');playSound('delete');};
window.addPlayer=async function(){const inp=document.getElementById('newPlayerName');const n=readName(inp);if(!n)return;if((state.players||[]).includes(n)){showToast('Ya existe');return;}if(!state.players)state.players=[];state.players.push(n);if(pendingPhoto){if(!state.playerPhotos)state.playerPhotos={};state.playerPhotos[n]=pendingPhoto;pendingPhoto=null;document.getElementById('photoPreview').style.display='none';document.getElementById('photoPlaceholder').style.display='block';}inp.value='';await window.saveState();showToast(n+' agregado ✓');playSound('success');};
window.removePlayer=async function(i){const name=state.players[i];if(!await nbConfirm('Sus puntos en juegos ya registrados se conservan.','¿Quitar a '+name+'?','Quitar'))return;state.players.splice(i,1);if(state.playerPhotos&&state.playerPhotos[name])delete state.playerPhotos[name];await window.saveState();};
window.saveName=async function(){state.name=readName(document.getElementById('settingName'))||'Torneo de Mesa';await window.saveState();showToast('Guardado ✓');};
window.saveSystem=async function(){state.system=document.getElementById('settingSystem').value;await window.saveState();};
window.saveBestN=async function(){state.bestN=Number(document.getElementById('settingBestN').value);await window.saveState();};
window.addGameToCatalog=async function(){const inp=document.getElementById('newGameName');const n=readName(inp);if(!n)return;if((state.catalog||[]).find(g=>g.name===n)){showToast('Ya está en el catálogo');return;}if(!state.catalog)state.catalog=[...DEFAULT_GAMES];state.catalog.push({name:n,emoji:selectedEmoji});inp.value='';selectedEmoji='🎲';document.getElementById('newGameEmoji').textContent='🎲';await window.saveState();showToast(n+' agregado al catálogo ✓');};
window.removeGameFromCatalog=async function(i){if(!await nbConfirm('Se quitará del catálogo.','¿Quitar juego?','Quitar'))return;state.catalog.splice(i,1);await window.saveState();};
window.confirmReset=async function(){if(!await nbConfirm('Se borran los juegos del torneo actual. Los torneos archivados se conservan.','¿Reiniciar torneo?','Reiniciar'))return;state.games=[];await window.saveState();showToast('Torneo reiniciado');};

window.setFilter=function(key,val,btn){
  catalogFilters[key]=val;
  const bar=btn.closest('.filter-bar');
  bar.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');renderCatalog();
};

window.toggleGameCard=function(id){
  const card=document.getElementById(id);const arr=document.getElementById('arr_'+id.replace('gexp_',''));
  if(!card)return;const isOpen=card.classList.contains('open');
  document.querySelectorAll('.game-expand-card').forEach(c=>c.classList.remove('open'));
  document.querySelectorAll('[id^="arr_"]').forEach(a=>a.textContent='›');
  if(!isOpen){card.classList.add('open');if(arr)arr.textContent='⌄';}
};

window.goTo=function(pg,btn){

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('pg-'+pg).classList.add('active');btn.classList.add('active');
  if(pg==='add'){const cont=document.getElementById('posSelect');if(!cont.children.length){window.addPosRow();window.addPosRow();}else refreshPosSelects();filterGameSelect();}
  if(pg==='stats')renderStats();
};

window.setHistTab=function(tab,btn){document.querySelectorAll('#histSeg button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('histCurrent').style.display=tab==='current'?'block':'none';document.getElementById('histArchive').style.display=tab==='archive'?'block':'none';document.getElementById('histStats').style.display=tab==='stats'?'block':'none';if(tab==='stats')renderStats();};
window.setStatTab=function(tab,btn){document.querySelectorAll('#statSeg button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('statsGames').style.display=tab==='games'?'block':'none';document.getElementById('statsPlayers').style.display=tab==='players'?'block':'none';};

// Photo
let pendingPhotoData=null;
function compressImage(file,maxSize=100,quality=.72){return new Promise(res=>{const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=maxSize;canvas.height=maxSize;const ctx=canvas.getContext('2d');const min=Math.min(img.width,img.height);const sx=(img.width-min)/2;const sy=(img.height-min)/2;ctx.drawImage(img,sx,sy,min,min,0,0,maxSize,maxSize);res(canvas.toDataURL('image/jpeg',quality));};img.src=e.target.result;};reader.readAsDataURL(file);});}
window.onPhotoSelected=async function(event){const file=event.target.files[0];if(!file)return;const compressed=await compressImage(file);pendingPhoto=compressed;document.getElementById('photoPreview').src=compressed;document.getElementById('photoPreview').style.display='block';document.getElementById('photoPlaceholder').style.display='none';};
window.updatePhoto=async function(playerName,event){const file=event.target.files[0];if(!file)return;showToast('Comprimiendo...');const compressed=await compressImage(file);if(!state.playerPhotos)state.playerPhotos={};state.playerPhotos[playerName]=compressed;await window.saveState();showToast('Foto actualizada ✓');};

// ¿Qué jugamos?
window._queCompatible = [];
window.filterQueJugamos = function() {
  var q = (document.getElementById('queJugamosSearch')||{}).value || '';
  var filtered = window._queCompatible.filter(function(g) {
    return !q || g.name.toLowerCase().indexOf(q.toLowerCase()) >= 0;
  });
  renderQueJugamosList(filtered);
};


window.renderQueJugamosList = function(games) {
  var list = document.getElementById('queJugamosList');
  if(!list) return;
  var groups = {Baja:[],Media:[],Alta:[],'':[]};
  games.forEach(function(g){ (groups[g.complexity||'']||groups['']).push(g); });
  var complexLabel = {Baja:'🟢 Fácil',Media:'🟡 Media',Alta:'🔴 Experto'};
  var html = '';
  ['Baja','Media','Alta',''].forEach(function(comp) {
    var gms = groups[comp]; if(!gms.length) return;
    html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:10px 0 6px;color:#555;">' + (complexLabel[comp]||'Sin clasificar') + '</div>';
    gms.forEach(function(g, i) {
      var idx = 'qj_' + comp + '_' + i;
      html += '<div class="game-cat-item" style="flex-direction:column;align-items:stretch;" onclick="toggleQJCard(this.dataset.qid)" data-qid="' + idx + '">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:22px;">' + (g.emoji||'🎲') + '</span>' +
        '<div style="flex:1;"><div class="game-name-text">' + escHtml(g.name) + '</div>' +
        '<div class="game-meta-text">' + (g.players?'👥 '+escHtml(g.players):'') + (g.players&&g.duration?' · ':'') + (g.duration?'⏱ '+escHtml(g.duration):'') + '</div></div>' +
        '<span style="font-size:16px;font-weight:700;color:#555;" id="arr_' + idx + '">›</span></div>' +
        '<div class="game-expand-card" id="' + idx + '">' +
        (g.desc?'<div style="font-size:13px;font-weight:500;color:#333;margin-bottom:10px;">' + escHtml(g.desc) + '</div>':'') +
        '<button class="nb-btn nb-btn-sm nb-btn-primary" style="width:100%;" onclick="event.stopPropagation();playThisGame(this.dataset.gn)" data-gn="' + escHtml(g.name) + '">🎮 Jugar este</button>' +
        '</div></div>';
    });
  });
  html += '<div style="padding:12px 0;border-top:2px solid #000;margin-top:8px;cursor:pointer;" onclick="quePlayCustom()"><span style="font-size:14px;font-weight:700;">✏️ Jugar un juego no listado...</span></div>';
  list.innerHTML = html;
};
window.openQueJugamos=function(){
  const count=(state.activePlayers||state.players||[]).length;if(!count){showToast('Agrega jugadores primero');return;}
  var searchEl = document.getElementById('queJugamosSearch');
  if(searchEl) searchEl.value = '';
  const sub=document.getElementById('queJugamosSub');const list=document.getElementById('queJugamosList');
  const compatible=(state.catalog||[]).filter(g=>{if(!g.players)return true;const parts=g.players.replace(/\s/g,'').split('-');const min=parseInt(parts[0]);const max=parseInt(parts[parts.length-1]);return count>=min&&count<=max;});
  const order={Baja:0,Media:1,Alta:2};compatible.sort((a,b)=>(order[a.complexity]??1)-(order[b.complexity]??1)||a.name.localeCompare(b.name,'es'));
  sub.innerHTML='Con <strong>'+count+' jugador'+(count>1?'es':'')+'</strong> pueden jugar <strong>'+compatible.length+'</strong> de los '+(state.catalog||[]).length+' juegos.';
  window._queCompatible = compatible;
  renderQueJugamosList(compatible);
  document.getElementById('queJugamosModal').style.display='flex';
};

window.toggleQJCard=function(id){const card=document.getElementById(id);const arr=document.getElementById('arr_'+id);if(!card)return;const isOpen=card.classList.contains('open');document.querySelectorAll('.game-expand-card').forEach(c=>c.classList.remove('open'));document.querySelectorAll('[id^="arr_qj"]').forEach(a=>a.textContent='›');if(!isOpen){card.classList.add('open');if(arr)arr.textContent='⌄';}};
window.closeQueJugamos=function(e){if(e.target===document.getElementById('queJugamosModal'))document.getElementById('queJugamosModal').style.display='none';};
window.closeQueJugamosBtn=function(){document.getElementById('queJugamosModal').style.display='none';};
window.pickRandomGame=function(){
  const count=(state.activePlayers||state.players||[]).length;if(!count){showToast('Agrega jugadores primero');return;}
  const playedNames=new Set((state.games||[]).map(g=>g.name));
  const compatible=(state.catalog||[]).filter(g=>{if(!g.players)return true;const parts=g.players.replace(/\s/g,'').split('-');const min=parseInt(parts[0]);const max=parseInt(parts[parts.length-1]);return count>=min&&count<=max;});
  const unplayed=compatible.filter(g=>!playedNames.has(g.name));
  const pool=unplayed.length>0?unplayed:compatible;
  const alreadyPlayed=unplayed.length===0&&compatible.length>0;
  if(!pool.length){document.getElementById('pickResult').innerHTML='<div class="nb-empty">No hay juegos compatibles.</div>';document.getElementById('pickResult').style.display='block';return;}
  const pick=pool[Math.floor(Math.random()*pool.length)];
  const el=document.getElementById('pickResult');el.style.display='block';
  el.innerHTML=`<div class="pick-result">
    ${alreadyPlayed?'<div style="font-size:10px;font-weight:700;opacity:.5;margin-bottom:6px;text-transform:uppercase;">Ya jugaron todos — nueva selección</div>':'<div style="font-size:10px;font-weight:700;opacity:.5;margin-bottom:6px;text-transform:uppercase;">Selección aleatoria</div>'}
    <div class="pick-emoji">${pick.emoji||'🎲'}</div>
    <div class="pick-name">${escHtml(pick.name)}</div>
    <div class="pick-meta">${pick.players?'👥 '+escHtml(pick.players):''}${pick.players&&pick.duration?' · ':''}${pick.duration?'⏱ '+escHtml(pick.duration):''}</div>
    ${pick.desc?'<div class="pick-desc">'+escHtml(pick.desc)+'</div>':''}
    <button class="pick-reroll" onclick="pickRandomGame()">🔀 Otra opción</button>
  </div>${!alreadyPlayed&&unplayed.length>1?'<div style="font-size:12px;font-weight:700;color:#555;text-align:center;margin-bottom:8px;">Quedan '+(unplayed.length-1)+' juegos sin jugar</div>':''}`;
};

// Migration
window.migrateV1=async function(){
  const statusEl=document.getElementById('migrateStatus');const btn=document.getElementById('migrateBtn');
  if((state.archive||[]).find(t=>t._migratedFromV1)){statusEl.textContent='✓ Ya importado anteriormente.';return;}
  statusEl.textContent='Leyendo datos anteriores...';btn.disabled=true;
  try{
    const snap=await get(torneoV1Ref);const v1=snap.val();
    if(!v1||!v1.games||!v1.games.length){statusEl.textContent='⚠️ No se encontraron juegos.';btn.disabled=false;return;}
    const playersSet=new Set();v1.games.forEach(g=>(g.positions||[]).forEach(p=>p&&playersSet.add(p)));
    const players=v1.players||[...playersSet];
    const archived={name:v1.name||'Juegolimpiadas (v1)',date:v1.games[0].date||new Date().toISOString(),games:v1.games,players,_migratedFromV1:true};
    if(!state.archive)state.archive=[];state.archive.push(archived);
    const newPlayers=players.filter(p=>!(state.players||[]).includes(p));
    if(newPlayers.length&&await nbConfirm(newPlayers.join(', '),'¿Agregar estos jugadores?','Agregar')){if(!state.players)state.players=[];state.players.push(...newPlayers);}
    await window.saveState();statusEl.textContent='✓ Importados '+v1.games.length+' juegos.';document.getElementById('migrationCard').style.display='none';showToast('Datos v1 importados ✓');
  }catch(e){statusEl.textContent='✗ Error: '+e.message;btn.disabled=false;}
};

// ==================== SOUND SYSTEM ====================
var audioCtx = null;
function getAudioCtx() {
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// iOS audio unlock — resume AudioContext on first tap
document.addEventListener('touchstart', function iosUnlock() {
  getAudioCtx();
  document.removeEventListener('touchstart', iosUnlock);
}, {once: true});

function playSound(type) {
  try {
    var ctx = getAudioCtx();
    var t = ctx.currentTime;
    if(type === 'tap') {
      // Short pop
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 800;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.08);
      osc.start(t); osc.stop(t+0.08);
    } else if(type === 'success') {
      // Two-note chime
      [523, 659].forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        g.gain.setValueAtTime(0.25, t + i*0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t + i*0.12 + 0.25);
        osc.start(t + i*0.12); osc.stop(t + i*0.12 + 0.25);
      });
    } else if(type === 'dice') {
      // Rattle effect
      for(var i=0; i<6; i++) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = 200 + Math.random()*400;
        osc.type = 'square';
        g.gain.setValueAtTime(0.08, t + i*0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + i*0.05 + 0.04);
        osc.start(t + i*0.05); osc.stop(t + i*0.05 + 0.04);
      }
    } else if(type === 'turn') {
      // Swoosh - descending
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(200, t+0.15);
      osc.type = 'sine';
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
      osc.start(t); osc.stop(t+0.2);
    } else if(type === 'fanfare') {
      // Victory fanfare - 5 notes
      var notes = [523, 659, 784, 659, 1047];
      var durations = [0.15, 0.15, 0.15, 0.15, 0.4];
      var offset = 0;
      notes.forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        g.gain.setValueAtTime(0.3, t + offset);
        g.gain.exponentialRampToValueAtTime(0.001, t + offset + durations[i]);
        osc.start(t + offset); osc.stop(t + offset + durations[i] + 0.05);
        offset += durations[i];
      });
    } else if(type === 'delete') {
      // Descending tone
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(150, t+0.2);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
      osc.start(t); osc.stop(t+0.25);
    }
  } catch(e) {}
}
// Expose to module scope
window._playSound = playSound;

// ==================== STREAK DETECTION ====================
// Rachas activas del torneo actual: victorias seguidas de quien ganó la última partida.
// En partidas de equipos, la victoria cuenta para todo el equipo ganador.
function getStreaks() {
  const games=state.games||[];
  if(games.length<2) return {};
  const current={};
  games.forEach(g=>{
    const w=gameWinners(g);
    if(!w.length) return;
    Object.keys(current).forEach(p=>{ if(w.indexOf(p)<0) current[p]=0; });
    w.forEach(p=>{ current[p]=(current[p]||0)+1; });
  });
  const result={};
  gameWinners(games[games.length-1]).forEach(p=>{ if(current[p]>=2) result[p]=current[p]; });
  return result;
}

// ==================== ESTADÍSTICAS GLOBALES (histórico: archivados + torneo actual) ====================
function getAllGamesEver(){
  return [...(state.archive||[]).flatMap(t=>t.games||[]), ...(state.games||[])];
}

// Racha de victorias consecutivas más larga de toda la historia (no solo la activa)
function getLongestStreakEver(){
  const games=getAllGamesEver();
  const current={}; let best=null;
  games.forEach((g,gi)=>{
    const w=gameWinners(g);
    if(!w.length)return;
    Object.keys(current).forEach(p=>{ if(w.indexOf(p)<0) current[p]=0; });
    w.forEach(p=>{
      current[p]=(current[p]||0)+1;
      if(!best||current[p]>best.len) best={names:[p],len:current[p],at:gi};
      else if(current[p]===best.len&&best.at===gi&&best.names.indexOf(p)<0) best.names.push(p); // compañeros de equipo
    });
  });
  return (best&&best.len>=2)?{name:best.names.join(' y '),len:best.len}:null;
}

// Puntos acumulados de por vida por jugador (independiente del roster activo actual)
function getLifetimePoints(){
  const totals={};
  getAllGamesWithSystem().forEach(({g,system})=>{
    Object.entries(scoreGame(g,system)).forEach(([p,r])=>{ totals[p]=(totals[p]||0)+r.pts; });
  });
  return Object.entries(totals).map(([name,pts])=>({name,pts})).sort((a,b)=>b.pts-a.pts);
}

// Win rate histórico (victorias/partidas jugadas de por vida), con mínimo de partidas para filtrar muestras chicas
function getLifetimeWinRates(minGames){
  const games=getAllGamesEver();
  const wins={},played={};
  games.forEach(g=>{
    const participants=g.participants||g.positions||[];
    participants.forEach(p=>{ played[p]=(played[p]||0)+1; });
    if(g.teams&&g.teams.length){
      if(g.teams[0]) g.teams[0].forEach(p=>{ wins[p]=(wins[p]||0)+1; });
    } else {
      const w=(g.positions||[])[0];
      if(w) wins[w]=(wins[w]||0)+1;
    }
  });
  return Object.keys(played).filter(p=>played[p]>=minGames)
    .map(p=>({name:p,winRate:Math.round((wins[p]||0)/played[p]*100),games:played[p],wins:wins[p]||0}))
    .sort((a,b)=>b.winRate-a.winRate||b.games-a.games);
}

// Jugador que más veces quedó en último lugar (partidas individuales o de equipos con 2+ rankeados)
function getLastPlaceLeader(){
  const games=getAllGamesEver();
  const counts={};
  games.forEach(g=>{
    if(g.teams&&g.teams.length>=2){
      const lastTeam=g.teams[g.teams.length-1];
      lastTeam.forEach(p=>{ counts[p]=(counts[p]||0)+1; });
    } else if(g.positions && g.positions.length>=2){
      const last=g.positions[g.positions.length-1];
      if(last) counts[last]=(counts[last]||0)+1;
    }
  });
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  return entries.length ? {name:entries[0][0],count:entries[0][1]} : null;
}

// Juego probado por más jugadores distintos a lo largo de la historia
function getMostVersatileGame(){
  const games=getAllGamesEver();
  const byGame={};
  games.forEach(g=>{
    const participants=g.participants||g.positions||[];
    if(!byGame[g.name]) byGame[g.name]=new Set();
    participants.forEach(p=>byGame[g.name].add(p));
  });
  let best=null;
  Object.entries(byGame).forEach(([name,set])=>{ if(!best||set.size>best.count) best={name,count:set.size}; });
  return best;
}

// Estimación de minutos jugados a partir de la duración del catálogo (promedio del rango)
function parseDurationMinutes(durationStr){
  if(!durationStr) return 0;
  const nums=(durationStr.match(/\d+/g)||[]).map(Number);
  if(!nums.length) return 0;
  return nums.length>=2 ? (nums[0]+nums[1])/2 : nums[0];
}
function getTotalPlayMinutes(){
  const games=getAllGamesEver();
  let total=0;
  games.forEach(g=>{
    const cat=(state.catalog||[]).find(c=>c.name===g.name);
    total+=parseDurationMinutes(cat&&cat.duration);
  });
  return Math.round(total);
}
function formatMinutes(mins){
  if(mins<60) return mins+' min';
  const h=Math.floor(mins/60), m=Math.round(mins%60);
  return h+'h'+(m?' '+m+'m':'');
}

// Dupla de jugadores que más veces coincidió jugando juntos en la misma partida
function getTopDuo(){
  const games=getAllGamesEver();
  const pairCounts={};
  games.forEach(g=>{
    const participants=g.participants||g.positions||[];
    for(let i=0;i<participants.length;i++){
      for(let j=i+1;j<participants.length;j++){
        const key=[participants[i],participants[j]].sort((a,b)=>a.localeCompare(b,'es')).join(' & ');
        pairCounts[key]=(pairCounts[key]||0)+1;
      }
    }
  });
  const entries=Object.entries(pairCounts).sort((a,b)=>b[1]-a[1]);
  return entries.length ? {pair:entries[0][0],count:entries[0][1]} : null;
}

// Torneo archivado con el marcador más reñido (menor diferencia de puntos entre 1° y 2°)
function getClosestTournament(){
  let best=null;
  (state.archive||[]).forEach(t=>{
    const sc=archiveScores(t);
    if(sc.length>=2){
      const diff=sc[0].pts-sc[1].pts;
      if(!best||diff<best.diff) best={name:t.name,diff,champ:sc[0].name,runnerUp:sc[1].name};
    }
  });
  return best;
}

// Tarjetas de estadísticas globales (también alimentan el botón de datos curiosos)
function globalStatCards(){
  const archivedGames=(state.archive||[]).flatMap(t=>t.games||[]);
  const allGames=getAllGamesEver();
  const cards=[];

  // Campeón con más títulos
  const titles={};
  (state.archive||[]).forEach(t=>{ const champ=archiveScores(t)[0]; if(champ) titles[champ.name]=(titles[champ.name]||0)+1; });
  const titleEntries=Object.entries(titles).sort((a,b)=>b[1]-a[1]);
  if(titleEntries.length){
    const [tName,tCount]=titleEntries[0];
    const tied=titleEntries.filter(([n,c])=>c===tCount&&n!==tName);
    cards.push({icon:'🏆',label:'Más títulos',value:tName,sub:tCount+' torneo'+(tCount===1?'':'s')+(tied.length?' (empate)':'')});
  }

  // Racha histórica más larga
  const streak=getLongestStreakEver();
  if(streak) cards.push({icon:'🔥',label:'Racha histórica',value:streak.len+' victorias seguidas',sub:streak.name});

  // Juego más jugado de siempre
  const freq={}; allGames.forEach(g=>{freq[g.name]=(freq[g.name]||0)+1;});
  const freqEntries=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  if(freqEntries.length){
    const [gName,gCount]=freqEntries[0];
    cards.push({icon:gameEmoji(gName),label:'Más jugado',value:gName,sub:gCount+' partida'+(gCount===1?'':'s')});
  }

  // Top 3 histórico por puntos
  const lifetime=getLifetimePoints();
  if(lifetime.length){
    const top3=lifetime.slice(0,3);
    cards.push({icon:'📊',label:'Más puntos (histórico)',value:top3[0].name+' · '+top3[0].pts+' pts',sub:top3.slice(1).map((p,i)=>(i+2)+'° '+p.name).join(' · ')||'Único con puntos'});
  }

  // Total de partidas y torneos
  const nTourneys=(state.archive||[]).length;
  cards.push({icon:'📅',label:'Total jugado',value:archivedGames.length+' partida'+(archivedGames.length===1?'':'s'),sub:nTourneys+' torneo'+(nTourneys===1?'':'s')+' cerrado'+(nTourneys===1?'':'s')});

  // Mejor win rate histórico (mínimo 5 partidas)
  const winRates=getLifetimeWinRates(5);
  if(winRates.length){
    const best=winRates[0];
    cards.push({icon:'🥇',label:'Mejor win rate',value:best.name+' · '+best.winRate+'%',sub:best.wins+'V en '+best.games+' partidas (mín. 5)'});
  }

  // --- Datos curiosos ---

  // Quien más veces quedó último
  const lastPlace=getLastPlaceLeader();
  if(lastPlace) cards.push({icon:'🐢',label:'Más últimos lugares',value:lastPlace.name,sub:lastPlace.count+(lastPlace.count===1?' vez':' veces')});

  // Juego con más jugadores distintos
  const versatile=getMostVersatileGame();
  if(versatile) cards.push({icon:'🎭',label:'Más variado',value:versatile.name,sub:versatile.count+' jugadores distintos lo probaron'});

  // Tiempo total jugado (estimado)
  const totalMin=getTotalPlayMinutes();
  if(totalMin>0) cards.push({icon:'⏱️',label:'Tiempo total jugado',value:formatMinutes(totalMin),sub:'estimado según duración del catálogo'});

  // Dupla que más veces coincidió jugando junta
  const duo=getTopDuo();
  if(duo) cards.push({icon:'🤝',label:'Dupla más frecuente',value:duo.pair,sub:duo.count+' partidas juntos'});

  // Torneo más reñido
  const closest=getClosestTournament();
  if(closest) cards.push({icon:'📈',label:'Torneo más reñido',value:closest.name,sub:closest.diff===0?'¡Empate! '+closest.champ+' vs '+closest.runnerUp:closest.diff+' pts entre '+closest.champ+' y '+closest.runnerUp});

  return cards;
}

function renderGlobalStats(){
  const gsc=document.getElementById('globalStatsCard');
  if(!gsc)return;
  const noActiveTourney=!(state.players||[]).length || (!(state.games||[]).length && !state._tournamentStarted);
  const archivedGames=(state.archive||[]).flatMap(t=>t.games||[]);
  const allGames=getAllGamesEver();
  if(!noActiveTourney || !allGames.length){ gsc.style.display='none'; return; }

  const cards=globalStatCards();
  if(!cards.length){ gsc.style.display='none'; return; }
  gsc.style.display='block';
  document.getElementById('globalStatsList').innerHTML=cards.map(c=>
    `<div class="stat-card-mini">
      <div class="sc-icon">${c.icon}</div>
      <div class="sc-label">${c.label}</div>
      <div class="sc-value">${escHtml(c.value)}</div>
      <div class="sc-sub">${escHtml(c.sub)}</div>
    </div>`
  ).join('');
}

// ==================== SHARE SCOREBOARD ====================
window.shareScoreboard = async function() {
  var sc = computeScores(state.games);
  if(!sc.length) { showToast('Sin datos para compartir'); return; }

  // Build text version
  var text = '🏆 ' + (state.name||'Torneo') + '\n';
  text += (state.games||[]).length + ' juegos jugados\n\n';
  var ms = ['🥇','🥈','🥉'];
  sc.forEach(function(p, i) {
    text += (i<3 ? ms[i] : (i+1)+'°') + ' ' + p.name + ' — ' + p.pts + ' pts';
    if(p.wins) text += ' (' + p.wins + 'V)';
    text += '\n';
  });

  // Try Web Share API first (works great on iOS)
  if(navigator.share) {
    try {
      await navigator.share({
        title: state.name || 'Torneo de Mesa',
        text: text
      });
      playSound('success');
      return;
    } catch(e) {
      // User cancelled or error - fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    showToast('Marcador copiado al portapapeles ✓');
    playSound('success');
  } catch(e) {
    showToast('No se pudo compartir');
  }
};


(function() {
var renderTurnOrder; // Forward declaration
// ==================== TIMER ====================
let timerMode = 'stopwatch';

window.setTimerMode = function(mode, btn) {
  timerMode = mode;
  document.querySelectorAll('.timer-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('timerStopwatch').style.display  = mode==='stopwatch' ? 'block' : 'none';
  document.getElementById('timerCountdown').style.display  = mode==='countdown' ? 'block' : 'none';
  document.getElementById('timerTurns').style.display      = mode==='turns'     ? 'block' : 'none';
  if(mode==='turns') {
    renderTurnPicker();
  }
};

// ---- STOPWATCH ----
let swInterval = null, swSeconds = 0, swRunning = false;

var fmtTime = window.fmtTime = function(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if(h>0) return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}

window.swToggle = function() {
  if(swRunning) {
    clearInterval(swInterval); swRunning = false;
    document.getElementById('swStartBtn').textContent = 'Continuar';
    document.getElementById('swSub').textContent = 'pausado';
  } else {
    swRunning = true;
    document.getElementById('swStartBtn').textContent = 'Pausar';
    document.getElementById('swSub').textContent = 'en curso';
    swInterval = setInterval(function() {
      swSeconds++;
      document.getElementById('swDisplay').textContent = fmtTime(swSeconds);
    }, 1000);
  }
};

window.swReset = function() {
  clearInterval(swInterval); swRunning = false; swSeconds = 0;
  document.getElementById('swDisplay').textContent = '00:00';
  document.getElementById('swStartBtn').textContent = 'Iniciar';
  document.getElementById('swSub').textContent = 'listo para iniciar';
};

// ---- COUNTDOWN ----
let cdInterval = null, cdSeconds = 300, cdTotal = 300, cdRunning = false;
window._cd = {get s(){return cdSeconds;},set s(v){cdSeconds=v;},get t(){return cdTotal;},set t(v){cdTotal=v;},get r(){return cdRunning;},set r(v){cdRunning=v;}};

window.setCdPreset = function(mins, btn) {
  document.querySelectorAll('.timer-preset').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('cdMinutes').value = mins;
  cdReset();
};

window.cdToggle = function() {
  if(cdRunning) {
    clearInterval(cdInterval); cdRunning = false;
    document.getElementById('cdStartBtn').textContent = 'Continuar';
    document.getElementById('cdSub').textContent = 'pausado';
    // Show controls - restore whichever mode was active
    var seg=document.getElementById('cdModeSeg');if(seg)seg.style.display='';
    var cm=document.getElementById('cdCustomMode');
    var pm=document.getElementById('cdPresetMode');
    if(cm&&cm.dataset.wasOpen==='1'){
      cm.style.display='block';
      if(pm)pm.style.display='none';
      document.getElementById('cdTimerDisplay').style.display='none';
      // Sync custom display with current remaining time
      var customDisp=document.getElementById('cdCustomDisplay');
      if(customDisp)customDisp.textContent=window.fmtTime(window._cd.s);
    } else {
      if(pm)pm.style.display='block';
      if(cm)cm.style.display='none';
    }
  } else {
    if(cdSeconds <= 0) window.cdReset();
    cdRunning = true;
    document.getElementById('cdStartBtn').textContent = 'Pausar';
    document.getElementById('cdSub').textContent = 'en curso';
    // Hide controls, show timer
    var seg=document.getElementById('cdModeSeg');if(seg)seg.style.display='none';
    var pm=document.getElementById('cdPresetMode');if(pm)pm.style.display='none';
    var cm=document.getElementById('cdCustomMode');
    if(cm){cm.dataset.wasOpen=cm.style.display!=='none'?'1':'';cm.style.display='none';}
    var td=document.getElementById('cdTimerDisplay');if(td)td.style.display='block';
    cdInterval = setInterval(function() {
      cdSeconds--;
      var pct = cdSeconds / cdTotal;
      var el = document.getElementById('cdDisplay');
      el.textContent = fmtTime(cdSeconds);
      el.className = 'timer-time';
      if(cdSeconds <= 0) {
        el.className = 'timer-time danger';
        clearInterval(cdInterval); cdRunning = false;
        document.getElementById('cdStartBtn').textContent = 'Iniciar';
        document.getElementById('cdSub').textContent = 'tiempo!';
        playBeep(3);
      } else if(pct <= 0.5) {
        el.className = 'timer-time warning';
        if(cdSeconds === Math.floor(cdTotal * 0.5)) playBeep(1);
      }
    }, 1000);
  }
};

window.cdReset = function() {
  clearInterval(cdInterval); cdRunning = false;
  var mins = parseInt(document.getElementById('cdMinutes').value) || 5;
  cdTotal = cdSeconds = mins * 60;
  document.getElementById('cdDisplay').textContent = fmtTime(cdSeconds);
  document.getElementById('cdDisplay').className = 'timer-time';
  document.getElementById('cdStartBtn').textContent = 'Iniciar';
  document.getElementById('cdSub').textContent = 'listo para iniciar';
};

// ---- BEEP ----
function playBeep(times) {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var t = ctx.currentTime;
    for(var i=0; i<times; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = i === times-1 ? 880 : 660;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t+0.3);
      osc.start(t); osc.stop(t+0.3);
      t += 0.4;
    }
  } catch(e) {}
}



// ---- TURN TIMER ----
var turnPlayers = window._turnPlayers = [];
var turnOrder = window._turnOrder = [];
var turnTimes = window._turnTimes = {};
var turnCurrent = 0;
var turnInterval = null;
var turnSeconds = 0;
var turnRunning = false;
var turnLimit = 0;
var turnLimitReached = false;

window._renderTurnPicker = function() {
  var picker = document.getElementById('turnPlayerPicker');
  if(!picker) return;
  var selected = {};
  turnPlayers.forEach(function(p){ selected[p]=true; });
  var turnPlayerList = state._tournamentStarted ? (state.activePlayers || []) : [];
  if(!turnPlayerList.length) {
    picker.innerHTML = '<div class="nb-empty">' + (state._tournamentStarted ? 'Sin jugadores activos.' : 'Inicia un torneo para seleccionar jugadores.') + '</div>';
    if(window._renderTurnOrder) window._renderTurnOrder();
    var countEl = document.getElementById('turnOrderCount');
    if(countEl) countEl.textContent = '';
    return;
  }
  picker.innerHTML = turnPlayerList.map(function(p) {
    var photo = (state.playerPhotos||{})[p];
    var av = photo
      ? '<img src="'+photo+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">'
      : '<div style="width:28px;height:28px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;">'+escHtml(p[0])+'</div>';
    var sel = !!selected[p];
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:0.5px solid rgba(0,0,0,.07);cursor:pointer;" onclick="toggleTurnPlayer(this.dataset.p)" data-p="'+escHtml(p)+'">'
      + av
      + '<span style="flex:1;font-size:14px;">'+escHtml(p)+'</span>'
      + '<span style="font-size:18px;color:'+(sel?'#1a1a1a':'#ccc')+';">'+(sel?'✓':'○')+'</span>'
      + '</div>';
  }).join('') || '<div style="font-size:13px;color:#aaa;padding:8px 0;">Sin jugadores en el torneo.</div>';
  renderTurnOrder();
};

window.toggleTurnPlayer = function(name) {
  var idx = turnOrder.indexOf(name);
  if(idx >= 0) {
    // Already selected - remove from order
    turnOrder.splice(idx, 1);
    turnPlayers = turnPlayers.filter(function(p){return p!==name;});
  } else {
    // Not selected - add to END of order (preserves tap sequence)
    turnOrder.push(name);
    turnPlayers.push(name);
  }
  renderTurnPicker();
};

window.addTurnPlayers = function() {
  var list = state._tournamentStarted ? (state.activePlayers || []) : [];
  if(!list.length) { showToast('Inicia un torneo primero'); return; }
  list.forEach(function(p) {
    if(turnPlayers.indexOf(p)<0) { turnPlayers.push(p); turnOrder.push(p); }
  });
  renderTurnPicker();
};

window.addTurnCustomPlayer = function() {
  var inp = document.getElementById('turnCustomPlayer');
  var name = readName(inp);
  if(!name) return;
  if(turnPlayers.indexOf(name)<0) { turnPlayers.push(name); turnOrder.push(name); }
  inp.value = '';
  renderTurnPicker();
};

window.shuffleTurnOrder = function() {
  for(var i=turnOrder.length-1;i>0;i--){
    var j=Math.floor(Math.random()*(i+1));
    var tmp=turnOrder[i]; turnOrder[i]=turnOrder[j]; turnOrder[j]=tmp;
  }
  renderTurnOrder();
};

renderTurnOrder = window._renderTurnOrder = function() {
  var list = document.getElementById('turnOrderList');
  if(!list) return;
  list.innerHTML = turnOrder.map(function(p,i) {
    var photo = (state.playerPhotos||{})[p];
    var av = photo
      ? '<img src="'+photo+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">'
      : '<div style="width:28px;height:28px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;">'+escHtml(p[0])+'</div>';
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f5f5f2;border-radius:8px;margin-bottom:4px;">'
      + '<span style="font-size:12px;color:#aaa;width:18px;">'+(i+1)+'.</span>'
      + av
      + '<span style="flex:1;font-size:14px;">'+escHtml(p)+'</span>'
      + '<div style="display:flex;gap:4px;">'
      + (i>0?'<button class="btn btn-sm" onclick="moveTurnPlayer('+i+',-1)" style="padding:2px 8px;">↑</button>':'')
      + (i<turnOrder.length-1?'<button class="btn btn-sm" onclick="moveTurnPlayer('+i+',1)" style="padding:2px 8px;">↓</button>':'')
      + '<button class="btn btn-sm btn-danger" onclick="removeTurnPlayer('+i+')" style="padding:2px 8px;">×</button>'
      + '</div></div>';
  }).join('') || '<div style="font-size:13px;color:#aaa;">Selecciona jugadores arriba.</div>';
}

window.moveTurnPlayer = function(i, dir) {
  var j = i+dir;
  if(j<0||j>=turnOrder.length) return;
  var tmp=turnOrder[i]; turnOrder[i]=turnOrder[j]; turnOrder[j]=tmp;
  renderTurnOrder();
};

window.removeTurnPlayer = function(i) {
  var name = turnOrder[i];
  turnOrder.splice(i,1);
  turnPlayers = turnPlayers.filter(function(p){return p!==name;});
  renderTurnPicker();
};

window.startTurnTimer = function() {
  if(turnOrder.length < 1) { showToast('Agrega al menos 1 jugador'); return; }
  turnTimes = {};
  turnOrder.forEach(function(p){ turnTimes[p]=0; });
  turnCurrent = 0; turnSeconds = 0; turnRunning = false; turnLimitReached = false;
  turnLimit = (parseInt(document.getElementById('turnLimit').value)||0) * 60;
  document.getElementById('turnSetup').style.display = 'none';
  document.getElementById('turnActive').style.display = 'block';
  document.getElementById('turnResults').style.display = 'none';
  renderTurnActive();
  playSound('turn');
  turnResume();
};

function renderTurnActive() {
  var list = document.getElementById('turnPlayerList');
  if(!list) return;
  list.innerHTML = turnOrder.map(function(p,i) {
    var isCurrent = i === turnCurrent;
    var photo = (state.playerPhotos||{})[p];
    var av = photo
      ? '<img src="'+photo+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">'
      : '<div class="turn-avatar" style="'+(isCurrent?'background:#fff;color:#1a1a1a;':'')+'">'+escHtml(p[0])+'</div>';
    return '<div class="turn-player'+(isCurrent?' active-turn':'')+'">'
      + av
      + '<span class="turn-name">'+escHtml(p)+'</span>'
      + '<span class="turn-time">'+fmtTime(turnTimes[p])+'</span>'
      + '</div>';
  }).join('');

  var el = document.getElementById('turnDisplay');
  el.textContent = fmtTime(turnSeconds);
  document.getElementById('turnSub').textContent = 'turno de ' + turnOrder[turnCurrent];

  if(turnLimit > 0) {
    var pct = turnSeconds / turnLimit;
    el.className = 'timer-time';
    if(pct >= 1) el.className = 'timer-time danger';
    else if(pct >= 0.5) el.className = 'timer-time warning';
  }
}

function turnResume() {
  if(turnRunning) return;
  turnRunning = true;
  document.getElementById('turnPauseBtn').textContent = 'Pausar';
  turnInterval = setInterval(function() {
    turnSeconds++;
    turnTimes[turnOrder[turnCurrent]]++;
    renderTurnActive();
    if(turnLimit > 0) {
      var pct = turnSeconds / turnLimit;
      if(pct >= 1 && !turnLimitReached) {
        turnLimitReached = true;
        playBeep(3);
        document.getElementById('turnDisplay').className = 'timer-time danger';
        var el = document.getElementById('turnActive');
        el.classList.add('flash-red');
        setTimeout(function(){ el.classList.remove('flash-red'); }, 600);
      } else if(turnSeconds === Math.floor(turnLimit * 0.5) && !turnLimitReached) {
        playBeep(1);
      }
    }
  }, 1000);
}

window.turnPause = function() {
  if(turnRunning) {
    clearInterval(turnInterval); turnRunning = false;
    document.getElementById('turnPauseBtn').textContent = 'Continuar';
  } else {
    turnResume();
  }
};

window.turnNext = function() {
  clearInterval(turnInterval); turnRunning = false;
  turnCurrent = (turnCurrent + 1) % turnOrder.length;
  turnSeconds = 0; turnLimitReached = false;
  document.getElementById('turnDisplay').className = 'timer-time';
  renderTurnActive();
  turnResume();
};

window.turnEnd = async function() {
  if(!await nbConfirm('Se detendrá el contador y verás quién tardó más.','¿Terminar partida?','Terminar')) return;
  clearInterval(turnInterval); turnRunning = false;
  showTurnResults();
};

function showTurnResults() {
  document.getElementById('turnActive').style.display = 'none';
  document.getElementById('turnResults').style.display = 'block';
  var sorted = turnOrder.slice().sort(function(a,b){ return turnTimes[b]-turnTimes[a]; });
  var total = 0;
  turnOrder.forEach(function(p){ total += turnTimes[p]; });
  var medals = ['1', '2', '3'];
  document.getElementById('turnResultsList').innerHTML = sorted.map(function(p,i) {
    var photo = (state.playerPhotos||{})[p];
    var av = photo
      ? '<img src="'+photo+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">'
      : '<div class="turn-avatar">'+escHtml(p[0])+'</div>';
    var pct = total > 0 ? Math.round(turnTimes[p]/total*100) : 0;
    var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'';
    return '<div class="result-row">'
      + '<span style="font-size:18px;width:28px;">'+medal+'</span>'
      + av
      + '<div style="flex:1;">'
      + '<div style="font-size:14px;font-weight:500;">'+escHtml(p)+'</div>'
      + '<div style="height:4px;background:#f0f0ee;border-radius:2px;margin-top:4px;overflow:hidden;">'
      + '<div style="height:100%;background:#1a1a1a;border-radius:2px;width:'+pct+'%;"></div>'
      + '</div></div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:14px;font-weight:500;">'+fmtTime(turnTimes[p])+'</div>'
      + '<div style="font-size:11px;color:#aaa;">'+pct+'%</div>'
      + '</div></div>';
  }).join('') + '<div style="text-align:center;font-size:13px;color:#aaa;margin-top:10px;">Tiempo total: '+fmtTime(total)+'</div>';
}

window.turnRestart = function() {
  clearInterval(turnInterval); turnRunning = false;
  turnPlayers = []; turnOrder = []; turnTimes = {}; turnCurrent = 0; turnSeconds = 0;
  document.getElementById('turnSetup').style.display = 'block';
  document.getElementById('turnActive').style.display = 'none';
  document.getElementById('turnResults').style.display = 'none';
  renderTurnPicker();
};

})();

window.renderTurnPicker = function() {
  var picker = document.getElementById('turnPlayerPicker');
  if(!picker) return;
  var turnOrder = window._turnOrder || [];
  var turnPlayers = window._turnPlayers || [];
  // Build position map: player -> their position in turnOrder (1-based)
  var posMap = {};
  turnOrder.forEach(function(p, i){ posMap[p] = i+1; });

  var turnPlayerList = state._tournamentStarted ? (state.activePlayers || []) : [];
  if(!turnPlayerList.length) {
    picker.innerHTML = '<div class="nb-empty">' + (state._tournamentStarted ? 'Sin jugadores activos.' : 'Inicia un torneo para seleccionar jugadores.') + '</div>';
    if(window._renderTurnOrder) window._renderTurnOrder();
    var countEl = document.getElementById('turnOrderCount');
    if(countEl) countEl.textContent = '';
    return;
  }
  picker.innerHTML = turnPlayerList.map(function(p) {
    var photo = (state.playerPhotos||{})[p];
    var avHtml = photo
      ? '<img src="'+photo+'" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #000;">'
      : '<div style="width:32px;height:32px;border-radius:50%;border:2px solid #000;background:#A3E635;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">'+escHtml(p[0])+'</div>';
    var pos = posMap[p];
    var sel = !!pos;
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:2px solid #000;cursor:pointer;" onclick="toggleTurnPlayer(this.dataset.p)" data-p="'+escHtml(p)+'">'
      + avHtml
      + '<span style="flex:1;font-size:14px;font-weight:700;">'+escHtml(p)+'</span>'
      + (sel
        ? '<span style="width:28px;height:28px;border-radius:50%;background:#000;color:#A3E635;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">'+pos+'</span>'
        : '<span style="width:28px;height:28px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:18px;color:#ccc;">+</span>')
      + '</div>';
  }).join('') || '<div class="nb-empty">' + (state._tournamentStarted ? 'Sin jugadores en el torneo.' : 'Inicia un torneo para seleccionar jugadores.') + '</div>';

  // Update order count
  var countEl = document.getElementById('turnOrderCount');
  if(countEl) countEl.textContent = turnOrder.length ? '('+turnOrder.length+' seleccionados)' : '';

  if(window._renderTurnOrder) window._renderTurnOrder();
};

window.clearTurnOrder = function() {
  if(window._turnPlayers) window._turnPlayers.length = 0;
  if(window._turnOrder) window._turnOrder.length = 0;
  var orderList = document.getElementById('turnOrderList');
  if(orderList) orderList.innerHTML = '';
  var countEl = document.getElementById('turnOrderCount');
  if(countEl) countEl.textContent = '';
  window.renderTurnPicker();
};

// ==================== DADOS ====================
// ==================== DADOS (dibujo en js/dice.js) ====================
let diceRolling=false;
const reduceMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

window.rollDice = function() {
  if(diceRolling) return;
  const count = parseInt(document.getElementById('diceCount').value);
  const faces = parseInt(document.getElementById('diceFaces').value);
  const rolls = rollValues(count, faces);
  const total = rolls.reduce((a,b)=>a+b,0);
  const avg = ((faces+1)/2*count).toFixed(1);

  document.getElementById('diceResultCard').style.display = 'block';
  const resultsEl = document.getElementById('diceResults');
  const totalEl = document.getElementById('diceTotal');
  const btn = document.getElementById('diceRollBtn');
  playSound('dice');

  // Cada dado: cae girando con un pequeño retraso respecto al anterior, cambiando de número en el
  // aire, y se detiene en su valor al aterrizar. Luego la suma cuenta hasta el total.
  const still = reduceMotion();
  const DUR=720, STAGGER=110;
  resultsEl.innerHTML = rolls.map((r,i) =>
    '<div class="die-wrap'+(still?'':' throw')+'" id="dr'+i+'" style="--delay:'+(i*STAGGER)+'ms;--dur:'+DUR+'ms;--r0:'+(Math.random()<.5?-1:1)*(160+Math.random()*200|0)+'deg;--dx:'+((Math.random()*80-40)|0)+'px;">'+
      '<div class="die-face">'+dieSVG(faces, still?r:rollValues(1,faces)[0])+'</div>'+
      '<div class="die-lbl">d'+faces+'</div></div>'
  ).join('');

  const land=(i)=>{
    const el=document.getElementById('dr'+i);if(!el)return;
    el.querySelector('.die-face').innerHTML=dieSVG(faces,rolls[i]);
    el.classList.remove('throw');el.classList.add('landed');
    const badge=dieBadge(faces,rolls[i]);
    if(badge){el.classList.add(badge.cls);el.querySelector('.die-lbl').textContent=badge.label;}
  };
  document.getElementById('diceTotalLbl').textContent =
    count > 1 ? 'suma de '+count+'d'+faces+' · promedio: '+avg : 'resultado d'+faces;

  if(still){
    rolls.forEach((_,i)=>land(i));totalEl.textContent=total;
  } else {
    diceRolling=true;if(btn)btn.disabled=true;
    totalEl.textContent='…';
    const start=performance.now();
    const shuffle=setInterval(()=>{
      const t=performance.now()-start;
      rolls.forEach((_,i)=>{
        const el=document.getElementById('dr'+i);
        if(el&&el.classList.contains('throw')&&t<i*STAGGER+DUR*0.78) el.querySelector('.die-face').innerHTML=dieSVG(faces,rollValues(1,faces)[0]);
      });
    },70);
    rolls.forEach((_,i)=>setTimeout(()=>{land(i);if(navigator.vibrate)navigator.vibrate(15);},i*STAGGER+DUR*0.78));
    const end=(count-1)*STAGGER+DUR;
    setTimeout(()=>{
      clearInterval(shuffle);
      const t0=performance.now(),CU=380;
      const tick=()=>{const k=Math.min(1,(performance.now()-t0)/CU);totalEl.textContent=Math.round(total*k*k*(3-2*k));if(k<1)requestAnimationFrame(tick);else{totalEl.textContent=total;diceRolling=false;if(btn)btn.disabled=false;}};
      tick();
    },end);
  }

  diceRollHistory.unshift({count, faces, rolls, total,
    time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})});
  if(diceRollHistory.length > 8) diceRollHistory.pop();

  const histCard = document.getElementById('diceHistCard');
  histCard.style.display = 'block';
  document.getElementById('diceHistory').innerHTML = diceRollHistory.map(h =>
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #ddd;font-size:12px;font-weight:500;">'+
    '<span style="color:#555;">'+h.time+' · '+h.count+'d'+h.faces+'</span>'+
    '<span>['+h.rolls.join(', ')+'] = <strong>'+h.total+'</strong></span>'+
    '</div>'
  ).join('');
};

window.toggleDiceHist = function() {
  var el = document.getElementById('diceHistory');
  var arrow = document.getElementById('diceHistArrow');
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▼' : '▲';
};

// Custom neobrutalist confirm
let confirmResolver = null;
function nbConfirm(msg, title, okLabel) {
  return new Promise(resolve => {
    confirmResolver = resolve;
    document.getElementById('confirmTitle').textContent = title || '¿Seguro?';
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmOkBtn').textContent = okLabel || 'Confirmar';
    document.getElementById('confirmModal').style.display = 'flex';
  });
}
window.resolveConfirm = function(val) {
  document.getElementById('confirmModal').style.display = 'none';
  if(confirmResolver) { confirmResolver(val); confirmResolver = null; }
};

// ==================== ONBOARDING ====================
var obPlayers = [];

window.startOnboarding = function() {
  obPlayers = [];
  document.getElementById('obTorneoName').value = state.name || '';
  document.getElementById('obStep1').style.display = 'block';
  document.getElementById('obStep2').style.display = 'none';
  document.getElementById('obStep3').style.display = 'none';
  document.getElementById('obTitle').textContent = 'Paso 1 de 3';
  document.getElementById('onboardingModal').style.display = 'flex';
  playSound('tap');
};

window.obNext = function(step) {
  playSound('success');
  if(step === 2) {
    var name = readName(document.getElementById('obTorneoName')) || 'Torneo de Mesa';
    state.name = name;
    document.getElementById('obStep1').style.display = 'none';
    document.getElementById('obStep2').style.display = 'block';
    document.getElementById('obTitle').textContent = 'Paso 2 de 3';
    window.obRenderExisting();
    window.obUpdateBtn();
  } else if(step === 3) {
    document.getElementById('obStep2').style.display = 'none';
    document.getElementById('obStep3').style.display = 'block';
    document.getElementById('obTitle').textContent = 'Paso 3 de 3';
    document.getElementById('obFinalName').textContent = state.name;
    document.getElementById('obFinalPlayers').textContent = obPlayers.length + ' jugadores';
  }
};

var obPendingPhoto = null;

window.obPhotoSelected = async function(event) {
  var file = event.target.files[0];
  if(!file) return;
  var compressed = await compressImage(file);
  obPendingPhoto = compressed;
  document.getElementById('obPhotoPreview').src = compressed;
  document.getElementById('obPhotoPreview').style.display = 'block';
  document.getElementById('obPhotoPlaceholder').style.display = 'none';
};

window.obAddPlayer = function() {
  var inp = document.getElementById('obPlayerName');
  var name = readName(inp);
  if(!name) return;
  if(obPlayers.indexOf(name) >= 0) { showToast('Ya seleccionado'); return; }
  // Add to permanent roster if new
  if((state.players||[]).indexOf(name) < 0) {
    if(!state.players) state.players = [];
    state.players.push(name);
  }
  // Save photo if provided
  if(obPendingPhoto) {
    if(!state.playerPhotos) state.playerPhotos = {};
    state.playerPhotos[name] = obPendingPhoto;
    obPendingPhoto = null;
    document.getElementById('obPhotoPreview').style.display = 'none';
    document.getElementById('obPhotoPlaceholder').style.display = 'block';
    document.getElementById('obPhotoInput').value = '';
  }
  obPlayers.push(name);
  inp.value = '';
  inp.focus();
  window.obRenderExisting();
  window.obUpdateBtn();
  playSound('tap');
};

window.obRenderExisting = function() {
  var list = document.getElementById('obExistingPlayers');
  if(!list) return;
  var allPlayers = (state.players || []).slice().sort((a,b)=>a.localeCompare(b,'es'));
  var selectedSet = {};
  obPlayers.forEach(function(p){ selectedSet[p] = true; });
  
  if(allPlayers.length) {
    list.innerHTML = allPlayers.map(function(p) {
      var photo = (state.playerPhotos||{})[p];
      var avHtml = photo
        ? '<img src="'+photo+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #000;">'
        : '<div style="width:36px;height:36px;border-radius:50%;border:2px solid #000;background:#A3E635;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">'+escHtml(p[0])+'</div>';
      var sel = !!selectedSet[p];
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:2px solid #000;cursor:pointer;" onclick="obTogglePlayer(this.dataset.pn)" data-pn="'+escHtml(p)+'">' +
        avHtml +
        '<span style="flex:1;font-size:14px;font-weight:700;">'+escHtml(p)+'</span>' +
        (sel
          ? '<span style="width:30px;height:30px;border-radius:50%;background:#000;color:#A3E635;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">✓</span>'
          : '<span style="width:30px;height:30px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:16px;color:#ccc;">+</span>') +
        '</div>';
    }).join('');
  } else {
    list.innerHTML = '<div style="font-size:13px;font-weight:500;color:#555;padding:8px 0;">No hay jugadores guardados. Agrega nuevos abajo.</div>';
  }
}

window.obUpdateBtn = function() {
  var btn = document.getElementById('obStep2Btn');
  if(obPlayers.length >= 2) {
    btn.disabled = false;
    btn.textContent = 'Siguiente → (' + obPlayers.length + ' jugadores)';
  } else {
    btn.disabled = true;
    var need = 2 - obPlayers.length;
    btn.textContent = 'Necesitas al menos ' + need + ' jugador' + (need===1?'':'es') + ' más';
  }
}

window.obTogglePlayer = function(name) {
  var idx = obPlayers.indexOf(name);
  if(idx >= 0) {
    obPlayers.splice(idx, 1);
  } else {
    obPlayers.push(name);
  }
  playSound('tap');
  window.obRenderExisting();
  window.obUpdateBtn();
};

window.obRemovePlayer = function(name) {
  var idx = obPlayers.indexOf(name);
  if(idx >= 0) obPlayers.splice(idx, 1);
  obRenderExisting();
  obUpdateBtn();
};

window.obFinish = async function() {
  state.activePlayers = obPlayers.slice();
  state.games = [];
  state._tournamentStarted = true;
  // Make sure all selected players are in the permanent roster
  obPlayers.forEach(function(p) {
    if((state.players||[]).indexOf(p) < 0) {
      if(!state.players) state.players = [];
      state.players.push(p);
    }
  });
  await window.saveState();
  document.getElementById('onboardingModal').style.display = 'none';
  playSound('fanfare');
  showToast('Torneo creado!');
};

// Enter key for onboarding inputs
document.addEventListener('DOMContentLoaded', function() {
  var obNameEl = document.getElementById('obPlayerName');
  if(obNameEl) obNameEl.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') { e.preventDefault(); window.obAddPlayer(); }
  });
  var obTorneoEl = document.getElementById('obTorneoName');
  if(obTorneoEl) obTorneoEl.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') { e.preventDefault(); window.obNext(2); }
  });
});

// ==================== TIMER → REGISTRAR ====================
window.turnSaveResult = function() {
  var players = (window._turnOrder||[]).slice();
  if(!players.length) { showToast('Sin resultados para guardar'); return; }
  
  // Show modal with game selection + position assignment
  window._tsr_players = players;
  window._tsr_positions = [];
  
  var modal = document.getElementById('turnGameModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'turnGameModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.onclick = function(e) { if(e.target === modal) modal.style.display = 'none'; };
    modal.innerHTML = '<div class="modal-sheet" style="max-height:85vh;">' +
      '<div class="modal-header"><h2>Guardar resultado</h2>' +
      '<button class="modal-close" onclick="closeTurnGameModal()">×</button></div>' +
      '<div class="modal-body" id="turnSaveBody"></div></div>';
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
  }
  
  window.tsrRenderStep1();
};

window.closeTurnGameModal = function() {
  var m = document.getElementById('turnGameModal');
  if(m) m.style.display = 'none';
};

window.tsrRenderStep1 = function() {
  var body = document.getElementById('turnSaveBody');
  body.innerHTML = '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;color:#555;">Paso 1: Selecciona el juego</div>' +
    '<div class="search-wrap"><input type="text" class="nb-search" id="tsrGameSearch" placeholder="Buscar juego..." oninput="tsrFilterGames()" autocomplete="off"></div>' +
    '<div id="tsrGameList"></div>';
  window.tsrFilterGames();
}

window.tsrFilterGames = function() {
  var q = (document.getElementById('tsrGameSearch')||{}).value || '';
  var listEl = document.getElementById('tsrGameList');
  if(!listEl) return;
  var filtered = (state.catalog||[]).filter(function(g) {
    return !q || g.name.toLowerCase().indexOf(q.toLowerCase()) >= 0;
  });
  listEl.innerHTML = filtered.map(function(g) {
    return '<button class="nb-btn" style="margin-bottom:6px;text-align:left;padding:10px 14px;" ' +
      'onclick="tsrSelectGame(this.dataset.gn)" data-gn="' + escHtml(g.name) + '">' +
      (g.emoji||'🎲') + ' ' + escHtml(g.name) + '</button>';
  }).join('') || '<div class="nb-empty">Sin resultados</div>';
};

window.tsrSelectGame = function(gameName) {
  window._tsr_game = gameName;
  window._tsr_positions = [];
  window.tsrRenderStep2();
};

window.tsrRenderStep2 = function() {
  var body = document.getElementById('turnSaveBody');
  var positions = window._tsr_positions || [];
  var players = window._tsr_players || [];
  var remaining = players.filter(function(p) { return positions.indexOf(p) < 0; });
  var times = window._turnTimes || {};
  
  var html = '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;color:#555;">Paso 2: Toca jugadores en orden de posición</div>';
  html += '<div style="font-size:12px;font-weight:500;color:#555;margin-bottom:10px;">1° = ganador. El orden en que los toques es su posición.</div>';
  
  // Show assigned positions
  if(positions.length) {
    html += '<div style="margin-bottom:10px;">';
    positions.forEach(function(p, i) {
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'°';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#A3E635;border:2px solid #000;border-radius:8px;margin-bottom:4px;">' +
        '<span style="font-weight:700;">' + medal + '</span>' +
        '<span style="flex:1;font-weight:700;">' + escHtml(p) + '</span>' +
        '<span style="font-size:12px;color:#555;">' + window.fmtTime(times[p]||0) + '</span>' +
        '</div>';
    });
    html += '</div>';
  }
  
  // Show remaining players to assign
  if(remaining.length) {
    html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;color:#555;">Sin asignar</div>';
    remaining.forEach(function(p) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff;border:2px solid #000;border-radius:8px;margin-bottom:4px;cursor:pointer;" ' +
        'onclick="tsrAssignPlayer(this.dataset.pn)" data-pn="' + escHtml(p) + '">' +
        '<span style="font-size:18px;color:#ccc;font-weight:700;">+</span>' +
        '<span style="flex:1;font-weight:700;">' + escHtml(p) + '</span>' +
        '<span style="font-size:12px;color:#555;">' + window.fmtTime(times[p]||0) + '</span>' +
        '</div>';
    });
  }
  
  // Action buttons
  html += '<div style="display:flex;gap:6px;margin-top:12px;">';
  if(positions.length > 0) {
    html += '<button class="nb-btn nb-btn-sm nb-btn-red" onclick="tsrUndoLast()">↩ Deshacer</button>';
  }
  html += '</div>';
  
  if(positions.length >= 1) {
    html += '<button class="nb-btn nb-btn-primary" style="margin-top:10px;" onclick="tsrSave()">💾 Guardar (' + positions.length + ' posiciones)</button>';
  }
  
  body.innerHTML = html;
}

window.tsrAssignPlayer = function(name) {
  window._tsr_positions.push(name);
  playSound('tap');
  window.tsrRenderStep2();
};

window.tsrUndoLast = function() {
  window._tsr_positions.pop();
  window.window.tsrRenderStep2();
};

window.tsrSave = function() {
  var positions = window._tsr_positions || [];
  var gameName = window._tsr_game;
  if(!positions.length || !gameName) return;
  
  if(!state.games) state.games = [];
  var catEntry=(state.catalog||[]).find(function(c){return c.name===gameName;});
  var complexity=(catEntry&&catEntry.complexity)?catEntry.complexity:'Baja';
  state.games.push({
    name: gameName,
    positions: positions,
    participants: positions.slice(),
    complexity: complexity,
    date: new Date().toISOString()
  });
  
  window.saveState().then(function() {
    document.getElementById('turnGameModal').style.display = 'none';
    playSound('success');
    showToast('Resultado guardado!');
    window.goTo('board', document.querySelector('.nav button'));
  });
};

window.cancelTournament = async function() {
  if(!await nbConfirm('Se descartarán todos los juegos de este torneo. No se archivará nada. Los jugadores y fotos se conservan.','¿Cancelar torneo?','Cancelar torneo')) return;
  state.games = [];
  state._tournamentStarted = false;
  state.activePlayers = null;
  if(window._turnPlayers)window._turnPlayers.length=0;
  if(window._turnOrder)window._turnOrder.length=0;
  var ts=document.getElementById('turnSetup');if(ts)ts.style.display='block';
  var ta=document.getElementById('turnActive');if(ta)ta.style.display='none';
  var tr=document.getElementById('turnResults');if(tr)tr.style.display='none';
  var tol=document.getElementById('turnOrderList');if(tol)tol.innerHTML='';
  var toc=document.getElementById('turnOrderCount');if(toc)toc.textContent='';
  var tpp=document.getElementById('turnPlayerPicker');if(tpp)tpp.innerHTML='';
  await window.saveState();
  playSound('delete');
  showToast('Torneo cancelado');
  window.goTo('board', document.querySelector('.nav button'));
};

// ==================== GAME AUTOCOMPLETE ====================
var selectedGame = null;

window.filterGameResults = function() {
  var q = (document.getElementById('gameSearch')||{}).value || '';
  var listEl = document.getElementById('gameResultsList');
  if(!listEl) return;
  
  var catalog = state.catalog || [];
  var filtered = q 
    ? catalog.filter(function(g){ return g.name.toLowerCase().indexOf(q.toLowerCase()) >= 0; })
    : catalog;
  
  if(selectedGame) { listEl.style.display = 'none'; return; }
  
  var html = filtered.map(function(g) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:2px solid #000;cursor:pointer;background:#fff;" onclick="selectGame(this.dataset.gn)" data-gn="' + escHtml(g.name) + '">' +
      '<span style="font-size:20px;">' + (g.emoji||'🎲') + '</span>' +
      '<div style="flex:1;"><div style="font-size:14px;font-weight:700;">' + escHtml(g.name) + '</div>' +
      (g.players||g.duration ? '<div style="font-size:11px;color:#555;font-weight:500;">' + (g.players?'👥 '+escHtml(g.players):'') + (g.players&&g.duration?' · ':'') + (g.duration?'⏱ '+escHtml(g.duration):'') + '</div>' : '') +
      '</div></div>';
  }).join('');
  
  html += '<div style="padding:10px 12px;border-bottom:none;cursor:pointer;background:#FFE066;" onclick="selectCustomGame()"><span style="font-size:14px;font-weight:700;">✏️ Otro juego no listado...</span></div>';
  
  listEl.innerHTML = html;
  listEl.style.display = filtered.length || q ? 'block' : 'none';
};

window.selectGame = function(name) {
  selectedGame = name;
  document.getElementById('gameSearch').value = '';
  document.getElementById('gameResultsList').style.display = 'none';
  document.getElementById('gameCustom').style.display = 'none';
  var selEl = document.getElementById('gameSelected');
  selEl.style.display = 'block';
  document.getElementById('gameSelectedName').textContent = (gameEmoji(name)||'🎲') + ' ' + name;
  playSound('tap');
};

window.selectCustomGame = function() {
  selectedGame = null;
  document.getElementById('gameSearch').value = '';
  document.getElementById('gameResultsList').style.display = 'none';
  document.getElementById('gameCustom').style.display = 'none';
  document.getElementById('gameSelected').style.display = 'none';
  // Show custom game input card
  var container = document.getElementById('gameCustomCard');
  if(!container) {
    container = document.createElement('div');
    container.id = 'gameCustomCard';
    container.style.cssText = 'padding:10px 12px;background:#FFE066;border:2px solid #000;border-radius:8px;margin-bottom:8px;box-shadow:2px 2px 0 #000;';
    var searchWrap = document.getElementById('gameResultsList');
    searchWrap.parentElement.insertBefore(container, searchWrap.nextSibling);
  }
  container.style.display = 'block';
  container.innerHTML = '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;margin-bottom:6px;">Juego personalizado</div>' +
    '<div style="display:flex;gap:8px;align-items:center;">' +
    '<input type="text" class="nb-input" id="gameCustomName" placeholder="Nombre del juego..." style="margin:0;flex:1;font-size:14px;">' +
    '<button class="nb-btn nb-btn-sm nb-btn-primary" onclick="confirmCustomGame()">✓ Agregar</button>' +
    '</div>';
  setTimeout(function(){ var inp=document.getElementById('gameCustomName');if(inp)inp.focus(); }, 100);
  playSound('tap');
};

window.confirmCustomGame = function() {
  var inp = document.getElementById('gameCustomName');
  var name = inp ? readName(inp) : '';
  if(!name) { showToast('Escribe el nombre del juego'); return; }
  selectedGame = name;
  // Show as selected
  document.getElementById('gameSelected').style.display = 'block';
  document.getElementById('gameSelectedName').textContent = '🎲 ' + name;
  // Hide custom card
  var cc = document.getElementById('gameCustomCard');
  if(cc) cc.style.display = 'none';
  playSound('success');
};

window.clearGameSelection = function() {
  selectedGame = null;
  document.getElementById('gameSelected').style.display = 'none';
  document.getElementById('gameCustom').style.display = 'none';
  var cc = document.getElementById('gameCustomCard');
  if(cc) cc.style.display = 'none';
  document.getElementById('gameSearch').value = '';
  document.getElementById('gameSearch').focus();
};

document.addEventListener('click', function(e) {
  var list = document.getElementById('gameResultsList');
  var search = document.getElementById('gameSearch');
  if(list && search && !list.contains(e.target) && e.target !== search) {
    list.style.display = 'none';
  }
});

window.playThisGame = function(gameName) {
  // Close the modal
  document.getElementById('queJugamosModal').style.display = 'none';
  // Pre-select the game in Registrar
  selectedGame = gameName;
  document.getElementById('gameSearch').value = '';
  document.getElementById('gameResultsList').style.display = 'none';
  document.getElementById('gameCustom').style.display = 'none';
  var selEl = document.getElementById('gameSelected');
  selEl.style.display = 'block';
  document.getElementById('gameSelectedName').textContent = (gameEmoji(gameName)||'🎲') + ' ' + gameName;
  // Navigate to Registrar
  window.goTo('add', document.querySelectorAll('.nav button')[1]);
  playSound('tap');
};

window.setCdMode = function(mode, btn) {
  document.querySelectorAll('#cdModeSeg button').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('cdPresetMode').style.display = mode==='preset' ? 'block' : 'none';
  document.getElementById('cdCustomMode').style.display = mode==='custom' ? 'block' : 'none';
  // In custom mode, hide the big timer display (the +/- IS the display)
  document.getElementById('cdTimerDisplay').style.display = mode==='custom' ? 'none' : 'block';
  if(mode==='preset') window.cdReset();
};

window.setCdCustom = function() {
  window.cdReset();
  playSound('tap');
};

// ==================== TEAM MODE ====================
var gameMode = 'individual';
var teams = [];
// Jugadores marcados como "participó pero no llegó a podio" en modo individual
var otherParticipants = [];

window.renderOtherParticipants = function(){
  var wrap = document.getElementById('otherParticipantsList');
  if(!wrap) return;
  var active = (state.activePlayers || state.players || []);
  var ranked = [...document.querySelectorAll('#posSelect select')].map(function(s){return s.value;}).filter(Boolean);
  var available = active.filter(function(p){ return ranked.indexOf(p)===-1; });
  if(!available.length){
    wrap.innerHTML = '<div style="font-size:12px;color:#888;">Todos los jugadores activos ya están en el podio.</div>';
    return;
  }
  wrap.innerHTML = available.map(function(p){
    var sel = otherParticipants.indexOf(p)>=0;
    var esc = p.replace(/'/g,"\\'");
    return '<span class="nb-chip" style="cursor:pointer;'+(sel?'background:#A3E635;':'background:#fff;')+'" onclick="toggleOtherParticipant(this.dataset.pn)" data-pn="'+escHtml(p)+'">'+(sel?'✓ ':'+ ')+escHtml(p)+'</span>';
  }).join('');
};

window.toggleOtherParticipant = function(name){
  var idx = otherParticipants.indexOf(name);
  if(idx>=0) otherParticipants.splice(idx,1); else otherParticipants.push(name);
  playSound('tap');
  window.renderOtherParticipants();
};

window.setGameMode = function(mode, btn) {
  gameMode = mode;
  var seg = btn.parentElement;
  seg.querySelectorAll('button').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('modeIndividual').style.display = mode==='individual' ? 'block' : 'none';
  document.getElementById('modeTeams').style.display = mode==='teams' ? 'block' : 'none';
  if(mode==='teams' && !teams.length) {
    teams = [{name:'Equipo 1',members:[]},{name:'Equipo 2',members:[]}];
    window.renderTeams();
  }
};

window.addTeam = function() {
  teams.push({name:'Equipo '+(teams.length+1), members:[]});
  window.renderTeams();
  playSound('tap');
};

window.removeTeam = function(i) {
  if(teams.length <= 1) { showToast('Mínimo 1 equipo'); return; }
  teams.splice(i,1);
  window.renderTeams();
};

window.addPlayerToTeam = function(teamIdx, playerName) {
  if(!playerName) return;
  teams.forEach(function(t){ t.members = t.members.filter(function(m){return m!==playerName;}); });
  teams[teamIdx].members.push(playerName);
  window.renderTeams();
  playSound('tap');
};

window.removePlayerFromTeam = function(teamIdx, playerName) {
  teams[teamIdx].members = teams[teamIdx].members.filter(function(m){return m!==playerName;});
  window.renderTeams();
};

window.renderTeams = function() {
  var list = document.getElementById('teamsList');
  if(!list) return;
  var activePlayers = state.activePlayers || state.players || [];
  var assigned = {};
  teams.forEach(function(t){ t.members.forEach(function(m){ assigned[m]=true; }); });
  var unassigned = activePlayers.filter(function(p){ return !assigned[p]; });

  list.innerHTML = teams.map(function(t, ti) {
    var posLabel = ti===0?'🥇 1°':ti===1?'🥈 2°':ti===2?'🥉 3°':(ti+1)+'°';
    return '<div style="border:2px solid #000;border-radius:8px;padding:10px;margin-bottom:8px;box-shadow:2px 2px 0 #000;background:#fff;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<span style="font-size:14px;font-weight:700;">' + posLabel + ' ' + escHtml(t.name) + '</span>' +
      (teams.length>1?'<button class="nb-btn nb-btn-sm nb-btn-red" onclick="removeTeam('+ti+')" style="padding:2px 6px;">×</button>':'') +
      '</div>' +
      t.members.map(function(m) {
        var photo = (state.playerPhotos||{})[m];
        var avHtml = photo
          ? '<img src="'+photo+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #000;">'
          : '<div style="width:28px;height:28px;border-radius:50%;border:2px solid #000;background:#A3E635;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">'+escHtml(m[0])+'</div>';
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;">' + avHtml +
          '<span style="flex:1;font-size:13px;font-weight:700;">' + escHtml(m) + '</span>' +
          '<button class="nb-btn nb-btn-sm nb-btn-red" onclick="removePlayerFromTeam('+ti+',this.dataset.pn)" data-pn="'+escHtml(m)+'" style="padding:2px 6px;font-size:10px;">×</button>' +
          '</div>';
      }).join('') +
      '<select class="nb-select" style="margin:4px 0 0;font-size:13px;padding:6px 8px;" onchange="addPlayerToTeam('+ti+',this.value);this.value=\'\';">' +
      '<option value="">+ Agregar jugador...</option>' +
      unassigned.map(function(p){ return '<option value="'+escHtml(p)+'">'+escHtml(p)+'</option>'; }).join('') +
      '</select>' +
      '</div>';
  }).join('');
};

window.cdAdjust = function(delta) {
  var secs = window._cd.t + (delta * 30);
  secs = Math.max(30, Math.min(5940, secs));
  window._cd.t = secs;
  window._cd.s = secs;
  document.getElementById('cdMinutes').value = Math.ceil(secs/60);
  var customDisp = document.getElementById('cdCustomDisplay');
  if(customDisp) customDisp.textContent = window.fmtTime(secs);
  document.getElementById('cdDisplay').textContent = window.fmtTime(secs);
  playSound('tap');
};

window.cdFromInput = function() {
  window.cdReset();
};

window.quePlayCustom = function() {
  document.getElementById('queJugamosModal').style.display = 'none';
  window.selectCustomGame();
  window.goTo('add', document.querySelectorAll('.nav button')[1]);
};

window.removeLastTeam = function() {
  if(teams.length <= 1) { showToast('Mínimo 1 equipo'); return; }
  teams.pop();
  window.renderTeams();
  playSound('delete');
};

// Enter key for custom game name
document.addEventListener('keydown', function(e) {
  if(e.key === 'Enter' && e.target.id === 'gameCustomName') {
    e.preventDefault();
    window.confirmCustomGame();
  }
});

// Enter key support for inputs
document.addEventListener('DOMContentLoaded', function() {
  var enterMap = {
    'newPlayerName': 'addPlayer',
    'newGameName': 'addGameToCatalog',
    'turnCustomPlayer': 'addTurnCustomPlayer',
    'settingName': 'saveName'
  };
  Object.keys(enterMap).forEach(function(id) {
    var el = document.getElementById(id);
    if(el) el.addEventListener('keydown', function(e) {
      if(e.key === 'Enter') { e.preventDefault(); window[enterMap[id]](); }
    });
  });
});

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}

// Init — explicit bridge resolution
window.addPosRow();window.addPosRow();

// La interfaz queda bloqueada (clase .booting) hasta que este módulo termina de cargar,
// así ningún botón se toca antes de que sus funciones existan.
document.body.classList.remove('booting');

// Si Firebase todavía no respondió (sin internet o conexión lenta), mostrar lo último guardado
// en este equipo mientras tanto.
if(!gotRemote){
  const cachedPhotos=lsGet(LS_PHOTOS);
  if(cachedPhotos){syncedPhotos=photosFromRemote(cachedPhotos);}
  const cached=lsGet(LS_TORNEO);
  if(cached){applyTorneo(cached,true);window.render();setSyncStatus('cache');fillSplash();}
}
setTimeout(window.hideSplash,SPLASH_MAX);
document.getElementById('quoteInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.addQuote(document.getElementById('quoteAddBtn').dataset.pn);}});

// Uso sin conexión: guarda la app en el equipo (ver sw.js)
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
