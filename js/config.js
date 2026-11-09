/* Lemonade Inc. | config.js
   Game constants: locations, weather, shop, upgrades, feedback text, plus small helpers. */

export const W = 960, H = 440, STAND_X = 480, QY = 392, DAY_MIN = 540, SEASON = 30;
// Tuning numbers. The upgrade descriptions in UPG quote some of these, so update that text if you change them.
export const BALANCE = {
  startCash:20, startPop:10,
  lemonLife:4,            // days before a batch of lemons goes bad
  pitcherCups:12, pressPitcherCups:15,
  maxQueue:6, serveMinutes:8, registerServeMinutes:4,
  signTraffic:1.15, parasolInterest:1.2,
  forecastMiss:0.25,      // chance the day turns out different from the forecast
  recipeMax:{ l:10, s:10, i:8 },
  price:{ step:0.05, min:0.05, max:5 },
  popLoss:{ soldout:0.15, pricey:0.04, line:0.08 },
  popDailyLimit:12,
};
export const SAVE_KEY = 'sunny-squeeze-save-v1';
export const VERSION = '1.1.0';

export const LOCS = [
  { id:'lane', name:'Maple Lane', rent:0, traffic:70, tol:0.75, need:0, bias:0, icon:'🏡', desc:'A quiet street. Free to set up.' },
  { id:'park', name:'City Park', rent:12, traffic:120, tol:1.00, need:20, bias:0, icon:'🌳', desc:'Joggers and families on weekends.' },
  { id:'downtown', name:'Downtown', rent:30, traffic:190, tol:1.30, need:40, bias:-1, icon:'🏙️', desc:'Busy office crowd with money to spend.' },
  { id:'beach', name:'Beachfront', rent:45, traffic:170, tol:1.60, need:60, bias:3, icon:'🏖️', desc:'Hot, thirsty and happy to pay.' },
];
export const WEATHER = {
  hot:    { icon:'☀️', label:'Heatwave', traffic:1.1, want:1.1, t:[32,37], weight:0.15, color:'#FFB347' },
  sunny:  { icon:'🌤️', label:'Sunny',    traffic:1.0, want:1.0, t:[26,31], weight:0.35, color:'#FFD93B' },
  cloudy: { icon:'☁️', label:'Cloudy',   traffic:0.85, want:0.95, t:[20,25], weight:0.25, color:'#D5DEE3' },
  rain:   { icon:'🌧️', label:'Rain',     traffic:0.45, want:0.8, t:[17,22], weight:0.17, color:'#7FC4F0', wet:true },
  storm:  { icon:'⛈️', label:'Storm',    traffic:0.2, want:0.7, t:[15,20], weight:0.08, color:'#A99CF0', wet:true },
};
export const WORDER = Object.keys(WEATHER);
// There's no sugar-cube emoji, so draw one: a small isometric white cube.
const SUGAR_CUBE = `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true"><g stroke="#8E9CA4" stroke-width="1.2" stroke-linejoin="round">
  <path d="M16 4 28 10 16 16 4 10Z" fill="#FFFFFF"/><path d="M4 10 16 16 16 29 4 23Z" fill="#E4EAED"/><path d="M16 16 28 10 28 23 16 29Z" fill="#C7D1D6"/></g>
  <g fill="#AEBBC2"><circle cx="9" cy="16" r=".9"/><circle cx="12" cy="21" r=".9"/><circle cx="21" cy="19" r=".9"/><circle cx="24" cy="15" r=".9"/><circle cx="14" cy="9" r=".9"/><circle cx="19" cy="11" r=".9"/></g></svg>`;
export const SHOP = {
  lemons: { name:'Lemons', units:'lemons', icon:'🍋', note:`Go bad after ${BALANCE.lemonLife} days.`, packs:[[12,3.00],[40,8.80],[100,19.00]] },
  sugar:  { name:'Sugar', units:'cups of sugar', icon:SUGAR_CUBE, note:'Measured in cups. Keeps forever.', packs:[[10,1.80],[35,5.60],[90,12.60]] },
  ice:    { name:'Ice cubes', units:'ice cubes', icon:'🧊', note:'Melts overnight.', packs:[[50,1.00],[200,3.40],[500,7.50]] },
  cups:   { name:'Paper cups', units:'paper cups', icon:'🥤', note:'One per customer.', packs:[[50,1.50],[150,3.90],[400,9.00]] },
};
export const UPG = [
  { id:'cooler',   name:'Ice cooler',    icon:'🧊', cost:40, desc:'Keeps half your ice overnight.' },
  { id:'register', name:'Cash register', icon:'🧾', cost:60, desc:'Serve customers twice as fast.' },
  { id:'juicer',   name:'Lemon press',   icon:'🍋', cost:50, desc:'Each pitcher fills 15 cups instead of 12.' },
  { id:'sign',     name:'Big sign',      icon:'🪧', cost:35, desc:'15% more people walk past.' },
  { id:'parasol',  name:'Parasol',       icon:'⛱️', cost:30, desc:'More sales on hot and rainy days.' },
];
export const FB = {
  yum:'😋 Delicious', ok:'🙂 Pretty good', sour:'😖 Too sour', sweet:'🍭 Too sweet', watery:'💧 Too watery',
  strong:'😵 Too strong', ice:'🥵 Needs more ice', muchice:'🥶 Too much ice', warm:'♨️ Warm lemonade',
  pricey:'💸 Too pricey', line:'⌛ Line too long', soldout:'😞 Sold out',
};
export const TIPS = {
  sour:'Add sugar or use fewer lemons per pitcher.', sweet:'Cut back the sugar or add a lemon.',
  watery:'Use more lemons and sugar per pitcher.', strong:'Ease off the lemons and sugar a little.',
  ice:'Hot days need more ice per cup.', muchice:'It was cool out. Use less ice.',
  warm:'You ran out of ice. Buy more before opening.', pricey:'Lower your price, or build popularity first.',
  line:'People gave up waiting. A cash register serves twice as fast.',
  lineOwned:'People gave up waiting, even with the register. A higher price will thin the line.', soldout:'You ran out. Buy more supplies before opening.',
};

// ---------- icons (24px line set, same as Figma "Icon/*") ----------
const ICONS = {
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  chevron:'<path d="M9 5l7 7-7 7"/>',
  play:'<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  settings:'<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4"/><path d="M12 17h.01"/>',
  shop:'<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  pin:'<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  home:'<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10v10h11V10"/>',
  chart:'<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  reset:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  lock:'<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
export const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------- helpers ----------
export const $ = s => document.querySelector(s);
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
export const pick = a => a[Math.floor(Math.random()*a.length)];
// Everything that affects the game uses rng(), so tests can swap in a seeded generator. Looks and scenery use Math.random.
export let rng = Math.random;
export const setRng = fn => { rng = fn; };
export const rint = (a,b) => a + Math.floor(rng()*(b-a+1));
export function mulberry(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
