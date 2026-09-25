/* Lemonade Inc. | config.js
   Game constants: locations, weather, shop, upgrades, feedback text, plus small helpers. */
'use strict';

const W = 960, H = 440, STAND_X = 480, QY = 392, DAY_MIN = 540, SEASON = 30;
const SAVE_KEY = 'sunny-squeeze-save-v1';
const VERSION = '1.0.0';

const LOCS = [
  { id:'lane', name:'Maple Lane', rent:0, traffic:70, tol:0.75, need:0, bias:0, desc:'A quiet street. Free to set up.' },
  { id:'park', name:'City Park', rent:12, traffic:120, tol:1.00, need:20, bias:0, desc:'Joggers and families on weekends.' },
  { id:'downtown', name:'Downtown', rent:30, traffic:190, tol:1.30, need:40, bias:-1, desc:'Busy office crowd with money to spend.' },
  { id:'beach', name:'Beachfront', rent:45, traffic:170, tol:1.60, need:60, bias:3, desc:'Hot, thirsty and happy to pay.' },
];
const WEATHER = {
  hot:    { icon:'☀️', label:'Heatwave', traffic:1.1, want:1.1, t:[32,37] },
  sunny:  { icon:'🌤️', label:'Sunny',    traffic:1.0, want:1.0, t:[26,31] },
  cloudy: { icon:'☁️', label:'Cloudy',   traffic:0.85, want:0.95, t:[20,25] },
  rain:   { icon:'🌧️', label:'Rain',     traffic:0.45, want:0.8, t:[17,22] },
  storm:  { icon:'⛈️', label:'Storm',    traffic:0.2, want:0.7, t:[15,20] },
};
const WORDER = ['hot','sunny','cloudy','rain','storm'];
const WWEIGHT = [0.15,0.35,0.25,0.17,0.08];
const SHOP = {
  lemons: { name:'Lemons', icon:'🍋', note:'Go bad after 4 days.', packs:[[12,3.00],[40,8.80],[100,19.00]] },
  sugar:  { name:'Sugar', icon:'🍬', note:'Measured in cups. Keeps forever.', packs:[[10,1.80],[35,5.60],[90,12.60]] },
  ice:    { name:'Ice cubes', icon:'🧊', note:'Melts overnight.', packs:[[50,1.00],[200,3.40],[500,7.50]] },
  cups:   { name:'Paper cups', icon:'🥤', note:'One per customer.', packs:[[50,1.50],[150,3.90],[400,9.00]] },
};
const UPG = [
  { id:'cooler',   name:'Ice cooler',    icon:'🧊', cost:40, desc:'Keeps half your ice overnight.' },
  { id:'register', name:'Cash register', icon:'🧾', cost:60, desc:'Serve customers twice as fast.' },
  { id:'juicer',   name:'Lemon press',   icon:'🍋', cost:50, desc:'Each pitcher fills 15 cups instead of 12.' },
  { id:'sign',     name:'Big sign',      icon:'🪧', cost:35, desc:'15% more people walk past.' },
  { id:'parasol',  name:'Parasol',       icon:'⛱️', cost:30, desc:'More sales on hot and rainy days.' },
];
const FB = {
  yum:'😋 Delicious', ok:'🙂 Pretty good', sour:'😖 Too sour', sweet:'🍭 Too sweet', watery:'💧 Too watery',
  strong:'😵 Too strong', ice:'🥵 Needs more ice', muchice:'🥶 Too much ice', warm:'♨️ Warm lemonade',
  pricey:'💸 Too pricey', line:'⌛ Line too long', soldout:'😞 Sold out',
};
const TIPS = {
  sour:'Add sugar or use fewer lemons per pitcher.', sweet:'Cut back the sugar or add a lemon.',
  watery:'Use more lemons and sugar per pitcher.', strong:'Ease off the lemons and sugar a little.',
  ice:'Hot days need more ice per cup.', muchice:'It was cool out. Use less ice.',
  warm:'You ran out of ice. Buy more before opening.', pricey:'Lower your price, or build popularity first.',
  line:'People gave up waiting. A cash register serves twice as fast.', soldout:'You ran out. Buy more supplies before opening.',
};

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
const pick = a => a[Math.floor(Math.random()*a.length)];
const rint = (a,b) => a + Math.floor(Math.random()*(b-a+1));
function mulberry(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
