// Tripyana public MCP server — data layer.
// Prices mirror tpp_price_matrix() on tripyana.com (the single price source) and are
// refreshed from https://tripyana.com/llms.txt at runtime; the embedded copy is the fallback.

export const SITE = 'https://tripyana.com';
export const LLMS_URL = `${SITE}/llms.txt`;

export const COMPANY = {
  name: 'Tripyana Ltd',
  tagline: 'London chauffeur company — airport and cruise transfers, hourly hire and private day trips',
  licence: 'Private hire operator licence PHOP950',
  companyNumber: '16308293',
  address: 'Centurion House, London Road, Staines-upon-Thames TW18 4AX, United Kingdom',
  phone: '+44 7747 720000',
  whatsapp: 'https://wa.me/447747720000',
  email: 'info@tripyana.com',
  hours: '24/7',
  languages: ['English', 'Arabic'],
  website: `${SITE}/`,
  websiteAr: `${SITE}/ar/`,
  bookingEn: `${SITE}/online-booking/`,
  bookingAr: `${SITE}/ar/online-bookings/`,
  llms: LLMS_URL,
  included: [
    'Fixed, all-inclusive price per car (never per passenger), agreed in writing before you travel',
    'Meet and greet in the arrivals hall with a name board',
    'Flight tracking and 60 minutes of free waiting after landing',
    'No surge pricing; free cancellation up to 24 hours before pickup',
    'Chauffeur-driven Mercedes E-Class, V-Class, S-Class or Range Rover',
  ],
};

export const VEHICLES = {
  'e-class':     { name: 'Mercedes E-Class', pax: 3, note: 'up to 3 passengers' },
  'v-class':     { name: 'Mercedes V-Class', pax: 7, note: 'up to 7 passengers with luggage — the family / group choice' },
  's-class':     { name: 'Mercedes S-Class', pax: 3, note: 'up to 3 passengers, first-class saloon' },
  'range-rover': { name: 'Range Rover',      pax: 3, note: 'up to 3 passengers, SUV' },
};

// One-way fixed fares, GBP per car.
export const TRANSFERS = {
  'heathrow-central-london': {
    label: 'Heathrow Airport ↔ Central London', prices: { 'e-class': 125, 'v-class': 145, 's-class': 185, 'range-rover': 285 },
    page: `${SITE}/london/london-airport-transfer/heathrow-airport-transfer-to-hotel/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/heathrow-airport-transfer-to-hotel/`,
    duration: '45–75 minutes depending on traffic',
  },
  'gatwick-central-london': {
    label: 'Gatwick Airport ↔ Central London', prices: { 'e-class': 165, 'v-class': 195, 's-class': 245, 'range-rover': 330 },
    page: `${SITE}/london/london-airport-transfer/gatwick-airport-transfer-to-central-london/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/gatwick-airport-transfer-to-central-london/`,
    duration: '70–100 minutes',
  },
  'stansted-central-london': {
    label: 'Stansted Airport ↔ Central London', prices: { 'e-class': 185, 'v-class': 215, 's-class': 275, 'range-rover': 360 },
    page: `${SITE}/london/london-airport-transfer/stansted-to-london-transfer/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/stansted-to-london-transfer/`,
    duration: '60–90 minutes',
  },
  'luton-central-london': {
    label: 'Luton Airport ↔ Central London', prices: { 'e-class': 185, 'v-class': 215, 's-class': 275, 'range-rover': 360 },
    page: `${SITE}/london/london-airport-transfer/luton-airport-transfer-to-london/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/luton-airport-transfer-to-london/`,
    duration: '60–90 minutes',
  },
  'heathrow-gatwick': {
    label: 'Heathrow Airport ↔ Gatwick Airport', prices: { 'e-class': 145, 'v-class': 185 },
    page: `${SITE}/london/london-airport-transfer/heathrow-to-gatwick-transfer/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/heathrow-to-gatwick-transfer/`,
    duration: '60–90 minutes via the M25',
  },
  'heathrow-southampton-cruise': {
    label: 'Heathrow Airport / London ↔ Southampton Cruise Port', prices: { 'e-class': 225, 'v-class': 275, 's-class': 450, 'range-rover': 550 },
    page: `${SITE}/london/london-airport-transfer/heathrow-to-southampton-cruise-transfer/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/heathrow-to-southampton-cruise-transfer/`,
    returnPage: `${SITE}/london/london-airport-transfer/taxi-from-southampton-to-heathrow/`,
    duration: 'about 2 hours',
  },
  'heathrow-dover-cruise': {
    label: 'Heathrow Airport / London ↔ Dover Cruise Terminal', prices: { 'e-class': 330, 'v-class': 370, 's-class': 550, 'range-rover': 650 },
    page: `${SITE}/london/london-airport-transfer/heathrow-to-dover-cruise-transfer/`,
    pageAr: `${SITE}/ar/london/london-airport-transfer/heathrow-to-dover-cruise-transfer/`,
    duration: 'about 2 hours (≈100 miles)',
  },
};

export const HOURLY = {
  opening: { 'e-class': 50, 'v-class': 70, 's-class': 130, 'range-rover': 170 },
  hour:    { 'e-class': 45, 'v-class': 55, 's-class': 70, 'range-rover': 80 },
  min4:    { 'e-class': 230, 'v-class': 290, 's-class': 410, 'range-rover': 490 },
  day:     { 'e-class': 370, 'v-class': 460, 's-class': 620, 'range-rover': 730 },
  manchesterDay: { 'e-class': 870, 'v-class': 950, 's-class': 1100, 'range-rover': 1230 },
  minHoursLondon: 4,
  minHoursOutside: 8,
  zoneMiles: 20,
  perMileBeyondZone: 2.5,
  onlineCapMiles: 230,
  pages: {
    hourly: `${SITE}/chauffeur-cost-london/`,
    hourlyAr: `${SITE}/ar/london/hourly-chauffeur/`,
    fullDay: `${SITE}/london/luxury-car-hire-london/`,
    hireCar: `${SITE}/london/hire-car-with-driver-in-london/`,
    hireCarAr: `${SITE}/ar/london/hire-car-with-driver-in-london/`,
    executive: `${SITE}/london/executive-car-service-london/`,
    manchester: `${SITE}/london-to-manchester-chauffeur/`,
    scotland: `${SITE}/scotland-tour-from-london/`,
  },
};

export const OTHER_PAGES = {
  meetGreet: `${SITE}/london/heathrow-vip-meet-greet-fast-track/`,
  studentPickup: `${SITE}/london/student-airport-pickup/`,
  wedding: `${SITE}/london/wedding-car-hire-london/`,
  shoreExcursions: `${SITE}/southampton-shore-excursions/`,
  londonHub: `${SITE}/london/`,
  airportHub: `${SITE}/london/london-airport-transfer/`,
  dayTripsHub: `${SITE}/london-day-trips/`,
  b2b: `${SITE}/b2b-partnership-london/`,
};

// Fallback day-trip catalogue (whole car, return from any London address; refreshed from llms.txt at runtime).
export const DAY_TRIPS_FALLBACK = [
  { slug: 'stonehenge-bath', title: 'Stonehenge & Bath day trip', prices: { 'e-class': 550, 'v-class': 620, 's-class': 900 } },
  { slug: 'bibury-english-countryside', title: 'Cotswolds day trip (Bibury, Burford, Bourton)', prices: { 'e-class': 500, 'v-class': 570, 's-class': 850 } },
  { slug: 'windsor-castle', title: 'Marlow & Windsor day trip', prices: { 'e-class': 420, 'v-class': 480, 's-class': 750 } },
  { slug: 'oxford', title: 'Oxford day trip', prices: { 'e-class': 420, 'v-class': 480, 's-class': 750, 'range-rover': 880 } },
  { slug: 'cambridge', title: 'Cambridge day trip', prices: { 'e-class': 420, 'v-class': 480, 's-class': 750 } },
  { slug: 'bicester-village', title: 'Bicester Village shopping day', prices: { 'e-class': 420, 'v-class': 480, 's-class': 750 } },
  { slug: 'harry-potter-studio-tour', title: 'Harry Potter Studio Tour transfer', prices: {} },
  { slug: 'woburn-safari-park', title: 'Woburn Safari Park day trip', prices: { 'e-class': 450, 'v-class': 520, 's-class': 800 } },
  { slug: 'brighton-seven-sisters', title: 'Brighton & Seven Sisters day trip', prices: { 'e-class': 500, 'v-class': 570, 's-class': 850, 'range-rover': 990 } },
  { slug: 'canterbury-dover', title: 'Canterbury & White Cliffs of Dover day trip', prices: { 'e-class': 500, 'v-class': 570, 's-class': 850, 'range-rover': 990 } },
  { slug: 'private-london-tour', title: 'Private London landmarks tour by car (8 hours)', prices: { 'e-class': 370, 'v-class': 460, 's-class': 620, 'range-rover': 730 } },
  { slug: 'london-shopping-tour', title: 'London shopping tour with a private driver (8 hours)', prices: { 'e-class': 370, 'v-class': 460, 's-class': 620, 'range-rover': 730 } },
];
export const EXTRA_HOUR_FROM = 55; // GBP per extra hour on day trips, by vehicle (E-Class rate)

// ---------- llms.txt live catalogue ----------
let cache = { at: 0, entries: null };
const TTL = 60 * 60 * 1000;

export function parseLlms(text) {
  const entries = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) { cur = { title: line.slice(4).trim(), url: '', summary: '', prices: [] }; entries.push(cur); continue; }
    if (!cur) continue;
    const link = line.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)\s*$/);
    if (link) { cur.url = link[1]; continue; }
    if (line.startsWith('> ')) { cur.summary = line.slice(2).trim(); continue; }
    if (line.startsWith('- ')) { cur.prices.push(line.slice(2).trim()); }
  }
  for (const e of entries) e.lang = e.url.includes('/ar/') ? 'ar' : 'en';
  return entries.filter(e => e.url);
}

export async function catalogue() {
  const now = Date.now();
  if (cache.entries && now - cache.at < TTL) return cache.entries;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(LLMS_URL, { signal: ctl.signal, headers: { 'user-agent': 'tripyana-mcp/1.0 (+https://mcp.tripyana.com/public)' } });
    clearTimeout(t);
    if (r.ok) {
      const entries = parseLlms(await r.text());
      if (entries.length > 20) { cache = { at: now, entries }; return entries; }
    }
  } catch { /* fall through to cached/fallback */ }
  if (cache.entries) return cache.entries;
  return [];
}

export async function llmsText() {
  try {
    const r = await fetch(LLMS_URL, { headers: { 'user-agent': 'tripyana-mcp/1.0' } });
    if (r.ok) return await r.text();
  } catch { /* ignore */ }
  return null;
}
