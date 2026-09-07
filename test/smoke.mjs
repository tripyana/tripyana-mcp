// Smoke test: initialize + every tool + both resources against a running server (default local).
const URL_ = process.env.MCP_URL || 'http://127.0.0.1:8791/mcp';
let id = 0;
async function rpc(method, params) {
  const r = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} → HTTP ${r.status}: ${t.slice(0, 300)}`);
  const j = JSON.parse(t.startsWith('event:') ? t.split('\n').find(l => l.startsWith('data:')).slice(5) : t);
  if (j.error) throw new Error(`${method} → ${JSON.stringify(j.error)}`);
  return j.result;
}
const calls = [
  ['get_transfer_price', { route: 'heathrow-central-london', passengers: 5, luggage: 4, return_trip: true }],
  ['get_transfer_price', { route: 'heathrow-southampton-cruise', passengers: 2, language: 'ar' }],
  ['get_hourly_price', { hours: 6, passengers: 2 }],
  ['get_hourly_price', { hours: 4, destination: 'Oxford', one_way_miles_from_central_london: 60 }],
  ['get_hourly_price', { hours: 8, destination: 'Manchester' }],
  ['list_day_trips', { language: 'en' }],
  ['list_day_trips', { language: 'ar' }],
  ['search_services', { query: 'meet and greet heathrow', language: 'en' }],
  ['search_services', { query: 'كروز ساوثهامبتون' }],
  ['get_booking_link', { date: '2026-10-05', time: '14:30', passengers: 3, pickup: 'Heathrow Terminal 5', pickup_latlng: '51.4700,-0.4543', dropoff: 'The Savoy, London', first_name: 'Test', note: 'BA123' }],
  ['get_meet_greet_price', { guests: 2 }],
  ['get_meet_greet_price', { service: 'student-pickup', language: 'ar' }],
  ['get_company_info', {}],
];
const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
console.log('server:', init.serverInfo.name, init.serverInfo.version, 'protocol', init.protocolVersion);
const tools = await rpc('tools/list', {});
console.log('tools:', tools.tools.map(t => t.name).join(', '));
let fails = 0;
for (const [name, args] of calls) {
  try { const r = await rpc('tools/call', { name, arguments: args }); const txt = r.content[0].text; console.log(`\n▶ ${name} ${JSON.stringify(args).slice(0, 80)}\n${txt.split('\n').slice(0, 6).join('\n')}${txt.split('\n').length > 6 ? '\n…' : ''}`); if (r.isError) { fails++; console.log('  ISERROR'); } }
  catch (e) { fails++; console.log(`\n✗ ${name}: ${e.message}`); }
}
const res = await rpc('resources/list', {});
console.log('\nresources:', res.resources.map(r => r.uri).join(', '));
for (const uri of ['tripyana://prices.json', 'tripyana://llms.txt']) { const r = await rpc('resources/read', { uri }); console.log(uri, '→', r.contents[0].text.length, 'chars'); }
// bad input must be a JSON-RPC/tool error, not a crash
try { const r = await rpc('tools/call', { name: 'get_transfer_price', arguments: { route: 'mars' } }); if (r.isError) console.log('bad input rejected OK (isError)'); else { console.log('bad input: accepted?!'); fails++; } } catch (e) { console.log('bad input rejected OK (rpc error)'); }
console.log(fails ? `\nFAILS: ${fails}` : '\nALL PASS');
process.exit(fails ? 1 : 0);
