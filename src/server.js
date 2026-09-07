#!/usr/bin/env node
// Tripyana public MCP server — Streamable HTTP, stateless, no authentication.
// Read-only: prices, services, day trips, booking links. No customer data is stored.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { SITE, COMPANY, VEHICLES, TRANSFERS, HOURLY, OTHER_PAGES, DAY_TRIPS_FALLBACK, EXTRA_HOUR_FROM, catalogue, llmsText } from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const PORT = Number(process.env.PORT || 8791);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://mcp.tripyana.com/public';
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const gbp = n => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;
const VEH_KEYS = Object.keys(VEHICLES);
const vehicleSchema = z.enum(['e-class', 'v-class', 's-class', 'range-rover']).optional().describe('Vehicle class. Omit to get all four.');

function recommend(pax = 1, bags = 0) {
  if (pax > 7) return { key: null, why: 'More than 7 passengers needs two cars — ask for a quote.' };
  if (pax > 3 || bags > 3) return { key: 'v-class', why: `${pax} passengers${bags ? ` and ${bags} bags` : ''} — the seven-seat V-Class is the right car.` };
  return { key: 'e-class', why: 'Up to 3 passengers — the E-Class is the best-value car; S-Class or Range Rover for a premium ride.' };
}

function priceTable(prices, only) {
  return VEH_KEYS.filter(k => prices[k] != null && (!only || only === k))
    .map(k => `- ${VEHICLES[k].name} (${VEHICLES[k].note}): ${gbp(prices[k])}`).join('\n');
}

function bookingUrl(lang, params = {}) {
  const u = new URL(lang === 'ar' ? COMPANY.bookingAr : COMPANY.bookingEn);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) u.searchParams.set(k, String(v));
  u.searchParams.set('utm_source', 'mcp');
  u.searchParams.set('utm_medium', 'ai-agent');
  return u.toString();
}

function text(s, structured) {
  const out = { content: [{ type: 'text', text: s }] };
  if (structured) out.structuredContent = structured;
  return out;
}

function buildServer() {
  const server = new McpServer({ name: 'tripyana-london-chauffeur', version: PKG.version }, {
    instructions: `Tripyana is a London chauffeur company (${COMPANY.licence}). Use these tools to quote fixed, all-inclusive prices for airport and cruise-port transfers, hourly chauffeur hire, full-day hire and private day trips from London, to find the right service page, and to build a pre-filled booking link. Prices are GBP per car, not per passenger. Answer in the user's language (English or Arabic).`,
  });

  server.registerTool('get_transfer_price', {
    title: 'Fixed transfer price',
    description: 'Fixed one-way chauffeur fare (GBP, per car, all-inclusive) between a London airport or cruise port and central London, for each vehicle class, with the recommended car for the party size and the page to book on.',
    inputSchema: {
      route: z.enum(Object.keys(TRANSFERS)).describe('Route key. heathrow-central-london, gatwick-central-london, stansted-central-london, luton-central-london, heathrow-gatwick, heathrow-southampton-cruise, heathrow-dover-cruise'),
      passengers: z.number().int().min(1).max(20).optional().describe('Number of passengers'),
      luggage: z.number().int().min(0).max(20).optional().describe('Number of large suitcases'),
      vehicle: vehicleSchema,
      return_trip: z.boolean().optional().describe('True if a return leg is also needed'),
      language: z.enum(['en', 'ar']).optional().describe('Language of the page link to return (default en)'),
    },
  }, async ({ route, passengers = 1, luggage = 0, vehicle, return_trip = false, language = 'en' }) => {
    const r = TRANSFERS[route];
    const rec = recommend(passengers, luggage);
    const lines = [
      `${r.label} — fixed one-way fares, per car (${r.duration}):`,
      priceTable(r.prices, vehicle),
      rec.key && r.prices[rec.key] != null ? `Recommended: ${VEHICLES[rec.key].name} at ${gbp(r.prices[rec.key])} — ${rec.why}` : rec.why,
      return_trip ? 'Return leg: same fare, with £20 off the return when both legs are booked together.' : '',
      `Included: ${COMPANY.included.slice(0, 4).join('; ')}.`,
      `Details and booking: ${language === 'ar' && r.pageAr ? r.pageAr : r.page}`,
      route === 'heathrow-southampton-cruise' && r.returnPage ? `Disembarkation (port → Heathrow): ${r.returnPage}` : '',
      `Book online: ${bookingUrl(language, { tpb_pax: passengers, tpb_bags: luggage || undefined })}`,
    ].filter(Boolean);
    return text(lines.join('\n'), { route, label: r.label, currency: 'GBP', prices: r.prices, recommended: rec.key, page: r.page, booking: bookingUrl(language) });
  });

  server.registerTool('get_hourly_price', {
    title: 'Hourly / full-day chauffeur price',
    description: 'Price of a chauffeur-driven Mercedes by the hour in London (4-hour minimum), the fixed 8-hour full-day rate, and the rules for trips outside London (8-hour minimum, distance fee beyond 20 miles from central London, Manchester day rate). Returns an indicative total per vehicle; the booking form confirms the exact figure.',
    inputSchema: {
      hours: z.number().int().min(1).max(14).describe('Hours needed (minimum 4 in London, 8 outside London)'),
      passengers: z.number().int().min(1).max(20).optional(),
      vehicle: vehicleSchema,
      destination: z.string().max(80).optional().describe('Main destination if outside London, e.g. "Manchester", "Oxford"'),
      one_way_miles_from_central_london: z.number().min(0).max(400).optional().describe('Driving distance from central London to the farthest point, if known'),
      language: z.enum(['en', 'ar']).optional(),
    },
  }, async ({ hours, passengers = 1, vehicle, destination, one_way_miles_from_central_london: miles, language = 'en' }) => {
    const dest = (destination || '').toLowerCase();
    const rec = recommend(passengers);
    const keys = VEH_KEYS.filter(k => !vehicle || vehicle === k);
    const lines = [];
    let structured = { currency: 'GBP', hours, perVehicle: {} };
    if (dest.includes('manchester')) {
      lines.push('London → Manchester full day (up to 9 hours, fixed, per car):');
      for (const k of keys) { lines.push(`- ${VEHICLES[k].name}: ${gbp(HOURLY.manchesterDay[k])}`); structured.perVehicle[k] = HOURLY.manchesterDay[k]; }
      lines.push(`Details: ${HOURLY.pages.manchester}`);
    } else if (/(scotland|edinburgh|glasgow)/.test(dest)) {
      lines.push('Scotland is priced separately (local chauffeur from £99/hour, Edinburgh and Glasgow airport transfers, half and full days).');
      lines.push(`See the Scotland page: ${HOURLY.pages.scotland}`);
    } else {
      const outside = (miles != null && miles > HOURLY.zoneMiles) || (!!dest && !/london/.test(dest));
      const minH = outside ? HOURLY.minHoursOutside : HOURLY.minHoursLondon;
      const h = Math.max(hours, minH);
      if (h !== hours) lines.push(`Minimum ${minH} hours ${outside ? 'for a destination outside London' : 'in London'} — quoted for ${h} hours.`);
      const distFee = outside && miles != null ? Math.max(0, miles - HOURLY.zoneMiles) * HOURLY.perMileBeyondZone : 0;
      lines.push(`${h}-hour chauffeur hire${dest ? ` to ${destination}` : ' in London'} — indicative total per car:`);
      for (const k of keys) {
        let base = h === 8 ? HOURLY.day[k] : h < 8 ? HOURLY.opening[k] + h * HOURLY.hour[k] : HOURLY.day[k] + (h - 8) * HOURLY.hour[k];
        const total = base + distFee;
        structured.perVehicle[k] = total;
        lines.push(`- ${VEHICLES[k].name}: ${gbp(total)}${h === 8 ? ' (fixed full-day rate)' : ` (${gbp(HOURLY.hour[k])}/hour)`}${distFee ? ` incl. ${gbp(distFee)} distance fee` : ''}`);
      }
      if (outside && miles == null) lines.push(`Outside London a distance fee of ${gbp(HOURLY.perMileBeyondZone)} per mile applies one way beyond ${HOURLY.zoneMiles} miles from central London; pass one_way_miles_from_central_london for an exact figure.`);
      if (miles != null && miles > HOURLY.onlineCapMiles) lines.push('Destinations beyond 230 miles are quoted individually — contact Tripyana.');
      if (rec.key) lines.push(`Recommended for ${passengers}: ${VEHICLES[rec.key].name}.`);
      lines.push(`Published rates: ${language === 'ar' ? HOURLY.pages.hourlyAr : HOURLY.pages.hourly} · full day: ${HOURLY.pages.fullDay}`);
    }
    lines.push(`Book online: ${bookingUrl(language, { tpb_pax: passengers })}`);
    return text(lines.join('\n'), structured);
  });

  server.registerTool('list_day_trips', {
    title: 'Private day trips from London',
    description: 'Catalogue of private day trips from London by chauffeur-driven car (Stonehenge & Bath, Cotswolds, Windsor, Oxford, Cambridge, Brighton, Canterbury & Dover, Bicester Village, Harry Potter studios, Woburn Safari, London landmarks and shopping tours) with fixed whole-car return prices and page links.',
    inputSchema: { language: z.enum(['en', 'ar']).optional().describe('Page language (default en)') },
  }, async ({ language = 'en' }) => {
    const entries = await catalogue();
    const live = entries.filter(e => e.lang === language && e.url.includes('/london-day-trips/') && !/\/london-day-trips\/$/.test(e.url));
    const lines = [`Private day trips from London — whole car, return, chauffeur waits at every stop (extra hours from ${gbp(EXTRA_HOUR_FROM)}/hour by vehicle):`];
    const trips = [];
    if (live.length >= 5) {
      for (const e of live) { lines.push(`- ${e.title}: ${e.prices.join(' · ') || 'see page'} — ${e.url}`); trips.push({ title: e.title, url: e.url, prices: e.prices }); }
    } else {
      for (const t of DAY_TRIPS_FALLBACK) {
        const url = `${SITE}${language === 'ar' ? '/ar' : ''}/london-day-trips/${t.slug}/`;
        const p = VEH_KEYS.filter(k => t.prices[k]).map(k => `${VEHICLES[k].name} ${gbp(t.prices[k])}`).join(' · ');
        lines.push(`- ${t.title}: ${p || 'see page'} — ${url}`); trips.push({ title: t.title, url, prices: t.prices });
      }
    }
    lines.push(`All trips: ${language === 'ar' ? SITE + '/ar/london-day-trips/' : OTHER_PAGES.dayTripsHub}`);
    return text(lines.join('\n'), { trips });
  });

  server.registerTool('search_services', {
    title: 'Find a Tripyana service page',
    description: 'Search Tripyana\'s services (airport transfers, cruise transfers, VIP meet and greet, student pickup, executive cars, wedding cars, fleet, day trips, Manchester, Scotland, Lake District, Istanbul, Bosnia) and return the matching pages with a one-paragraph summary and published prices.',
    inputSchema: {
      query: z.string().min(2).max(120).describe('Keywords, e.g. "Gatwick", "meet and greet", "wedding", "Southampton cruise"'),
      language: z.enum(['en', 'ar']).optional().describe('Restrict to English or Arabic pages'),
      limit: z.number().int().min(1).max(10).optional(),
    },
  }, async ({ query, language, limit = 5 }) => {
    const entries = await catalogue();
    const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 1);
    const scored = entries.filter(e => !language || e.lang === language).map(e => {
      const hay = `${e.title} ${e.summary} ${e.url}`.toLowerCase();
      let s = 0; for (const t of terms) { if (e.title.toLowerCase().includes(t)) s += 3; else if (e.url.toLowerCase().includes(t)) s += 2; else if (hay.includes(t)) s += 1; }
      return { e, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit);
    if (!scored.length) return text(`No page matched "${query}". Browse all London services: ${OTHER_PAGES.londonHub} or the full catalogue: ${COMPANY.llms}`, { results: [] });
    const lines = scored.map(({ e }) => `### ${e.title}\n${e.url}\n${e.summary || ''}${e.prices.length ? '\n' + e.prices.slice(0, 6).map(p => '- ' + p).join('\n') : ''}`);
    return text(lines.join('\n\n'), { results: scored.map(({ e }) => ({ title: e.title, url: e.url, summary: e.summary, prices: e.prices })) });
  });

  server.registerTool('get_booking_link', {
    title: 'Pre-filled booking link',
    description: 'Build a link to Tripyana\'s online booking form with the trip details already filled in (date, time, passengers, luggage, pickup, drop-off, contact details), so the traveller only picks the car and pays. No booking is created by this tool.',
    inputSchema: {
      language: z.enum(['en', 'ar']).optional().describe('Form language (default en)'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Pickup date YYYY-MM-DD'),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().describe('Pickup time HH:MM (24h, UK time)'),
      passengers: z.number().int().min(1).max(20).optional(),
      luggage: z.number().int().min(0).max(20).optional(),
      pickup: z.string().max(160).optional().describe('Pickup address or airport, e.g. "Heathrow Terminal 5"'),
      pickup_latlng: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional().describe('Pickup coordinates "lat,lng" (recommended with pickup)'),
      dropoff: z.string().max(160).optional(),
      dropoff_latlng: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional(),
      first_name: z.string().max(40).optional(),
      last_name: z.string().max(40).optional(),
      email: z.string().email().max(120).optional(),
      phone: z.string().max(30).optional().describe('International format, e.g. +44 7…'),
      note: z.string().max(300).optional().describe('Flight number, hotel name, special requests'),
    },
  }, async (a) => {
    const url = bookingUrl(a.language || 'en', {
      tpb_date: a.date, tpb_time: a.time, tpb_pax: a.passengers, tpb_bags: a.luggage,
      tpb_from: a.pickup, tpb_fromll: a.pickup_latlng, tpb_to: a.dropoff, tpb_toll: a.dropoff_latlng,
      tpb_fn: a.first_name, tpb_ln: a.last_name, tpb_email: a.email, tpb_phone: a.phone, tpb_note: a.note,
    });
    return text(`Booking link (form pre-filled, nothing is booked until the traveller pays):\n${url}\n\nPayment is by card on the site; the price is fixed and shown before payment. Free cancellation up to 24 hours before pickup. Help: WhatsApp ${COMPANY.whatsapp} or ${COMPANY.phone}.`, { url });
  });

  server.registerTool('get_company_info', {
    title: 'About Tripyana',
    description: 'Company facts: licence, company number, address, phone/WhatsApp, languages, hours, what every fare includes, cancellation policy and the main service pages in English and Arabic.',
    inputSchema: {},
  }, async () => {
    const lines = [
      `${COMPANY.name} — ${COMPANY.tagline}.`,
      `${COMPANY.licence} · Company no. ${COMPANY.companyNumber} · ${COMPANY.address}`,
      `Phone ${COMPANY.phone} · WhatsApp ${COMPANY.whatsapp} · ${COMPANY.email} · ${COMPANY.hours} · ${COMPANY.languages.join(' and ')}`,
      'Every fare includes: ' + COMPANY.included.join('; ') + '.',
      'Main pages:',
      `- London services hub: ${OTHER_PAGES.londonHub}`,
      `- Airport transfers: ${OTHER_PAGES.airportHub}`,
      `- Heathrow VIP meet and greet: ${OTHER_PAGES.meetGreet}`,
      `- Student airport pickup: ${OTHER_PAGES.studentPickup}`,
      `- Day trips: ${OTHER_PAGES.dayTripsHub}`,
      `- Arabic site: ${COMPANY.websiteAr}`,
      `- Book online: ${COMPANY.bookingEn} (Arabic: ${COMPANY.bookingAr})`,
      `- Machine-readable catalogue: ${COMPANY.llms}`,
    ];
    return text(lines.join('\n'), { ...COMPANY, pages: OTHER_PAGES });
  });

  server.registerResource('llms-txt', 'tripyana://llms.txt', {
    title: 'Tripyana service catalogue (llms.txt)',
    description: 'Every Tripyana service page with its summary and live fixed prices, in English and Arabic.',
    mimeType: 'text/plain',
  }, async (uri) => {
    const t = await llmsText();
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: t || 'Catalogue temporarily unavailable — see https://tripyana.com/llms.txt' }] };
  });

  server.registerResource('prices', 'tripyana://prices.json', {
    title: 'Tripyana fixed price matrix', description: 'Fixed transfer, hourly and full-day prices in GBP per car.', mimeType: 'application/json',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ currency: 'GBP', perCar: true, vehicles: VEHICLES, transfers: TRANSFERS, hourly: HOURLY, dayTrips: DAY_TRIPS_FALLBACK }, null, 1) }] }));

  return server;
}

// ---------- HTTP layer ----------
const hits = new Map(); // ip -> [count, windowStart]
function limited(ip) {
  const now = Date.now(); const w = hits.get(ip);
  if (!w || now - w[1] > 60_000) { hits.set(ip, [1, now]); return false; }
  w[0]++; return w[0] > 120;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v[1] > 120_000) hits.delete(k); }, 60_000).unref();

function log(ip, method, rpc, tool, status) {
  fs.appendFile(path.join(LOG_DIR, 'access.log'), `${new Date().toISOString()}\t${ip}\t${method}\t${rpc || '-'}\t${tool || '-'}\t${status}\n`, () => {});
}

const LANDING = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tripyana MCP server — London chauffeur prices for AI agents</title><meta name="description" content="Public Model Context Protocol server: fixed London airport transfer, cruise transfer, hourly chauffeur and day-trip prices from Tripyana, with pre-filled booking links."><style>body{font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#222}code,pre{background:#f4f4f4;border-radius:4px;padding:2px 6px}pre{padding:12px;overflow:auto}h1{font-size:1.5rem}</style></head><body>
<h1>Tripyana MCP server</h1>
<p>A public, read-only <a href="https://modelcontextprotocol.io/">Model Context Protocol</a> server from <a href="${SITE}/">Tripyana</a>, a London chauffeur company (${COMPANY.licence}). It gives AI assistants fixed, all-inclusive prices for <a href="${OTHER_PAGES.airportHub}">London airport transfers</a>, <a href="${TRANSFERS['heathrow-southampton-cruise'].page}">Southampton</a> and <a href="${TRANSFERS['heathrow-dover-cruise'].page}">Dover cruise transfers</a>, <a href="${HOURLY.pages.hourly}">hourly chauffeur hire</a>, <a href="${HOURLY.pages.fullDay}">full-day luxury car hire</a> and <a href="${OTHER_PAGES.dayTripsHub}">private day trips from London</a>, plus pre-filled booking links. No API key needed.</p>
<h2>Endpoint</h2><pre>${PUBLIC_URL}</pre>
<p>Transport: Streamable HTTP (JSON-RPC 2.0 over POST). Example client config:</p>
<pre>{ "mcpServers": { "tripyana": { "url": "${PUBLIC_URL}" } } }</pre>
<h2>Tools</h2><ul>
<li><code>get_transfer_price</code> — fixed fares Heathrow, Gatwick, Stansted, Luton ↔ central London; Heathrow ↔ Gatwick; Heathrow ↔ Southampton / Dover cruise ports</li>
<li><code>get_hourly_price</code> — hourly (4-hour minimum) and full-day (8-hour) chauffeur hire, Manchester day rate, rules outside London</li>
<li><code>list_day_trips</code> — Stonehenge &amp; Bath, Cotswolds, Windsor, Oxford, Cambridge, Brighton, Canterbury &amp; Dover and more</li>
<li><code>search_services</code> — find the right service page (English or Arabic)</li>
<li><code>get_booking_link</code> — pre-filled online booking link</li>
<li><code>get_company_info</code> — licence, contact, what every fare includes</li></ul>
<h2>Resources</h2><ul><li><code>tripyana://llms.txt</code> — the full catalogue (<a href="${COMPANY.llms}">llms.txt</a>)</li><li><code>tripyana://prices.json</code> — price matrix</li></ul>
<p>Prices are GBP per car, never per passenger. Source of truth: <a href="${SITE}/chauffeur-cost-london/">published London chauffeur rates</a>. Arabic site: <a href="${COMPANY.websiteAr}">tripyana.com/ar</a>. Contact: <a href="tel:+447747720000">${COMPANY.phone}</a> · <a href="${COMPANY.whatsapp}">WhatsApp</a>.</p>
<p><small>${COMPANY.name} · Company no. ${COMPANY.companyNumber} · ${COMPANY.address} · Server v${PKG.version}</small></p></body></html>`;

const httpServer = http.createServer(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname !== '/mcp') { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
  if (limited(ip)) { log(ip, req.method, null, null, 429); res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' }); return res.end('{"error":"rate limited: 120 requests/minute"}'); }
  if (req.method === 'GET' && !(req.headers.accept || '').includes('text/event-stream')) {
    log(ip, 'GET', 'landing', null, 200);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }); return res.end(LANDING());
  }
  let body;
  if (req.method === 'POST') {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 100_000) { res.writeHead(413); return res.end(); } chunks.push(c); }
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); } catch { res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error"},"id":null}'); }
  }
  const rpc = body && !Array.isArray(body) ? body.method : Array.isArray(body) ? 'batch' : null;
  const tool = body && body.method === 'tools/call' ? body.params?.name : null;
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    log(ip, req.method, rpc, tool, res.statusCode);
  } catch (e) {
    log(ip, req.method, rpc, tool, 500);
    if (!res.headersSent) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null })); }
  }
});
httpServer.listen(PORT, HOST, () => console.log(`tripyana-mcp v${PKG.version} listening on http://${HOST}:${PORT}/mcp`));
