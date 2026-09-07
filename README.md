# Tripyana MCP server — London chauffeur prices for AI agents

A public, read-only [Model Context Protocol](https://modelcontextprotocol.io/) server from [Tripyana](https://tripyana.com/), a London chauffeur company (private hire operator licence PHOP950, Tripyana Ltd, company no. 16308293).

It lets ChatGPT, Claude, Cursor, Gemini or any MCP client quote **fixed, all-inclusive prices** (GBP per car, never per passenger) for:

- [London airport transfers](https://tripyana.com/london/london-airport-transfer/) — [Heathrow](https://tripyana.com/london/london-airport-transfer/heathrow-airport-transfer-to-hotel/), [Gatwick](https://tripyana.com/london/london-airport-transfer/gatwick-airport-transfer-to-central-london/), [Stansted](https://tripyana.com/london/london-airport-transfer/stansted-to-london-transfer/), [Luton](https://tripyana.com/london/london-airport-transfer/luton-airport-transfer-to-london/) and [Heathrow ↔ Gatwick](https://tripyana.com/london/london-airport-transfer/heathrow-to-gatwick-transfer/)
- Cruise port transfers — [Heathrow to Southampton](https://tripyana.com/london/london-airport-transfer/heathrow-to-southampton-cruise-transfer/), [Southampton to Heathrow](https://tripyana.com/london/london-airport-transfer/taxi-from-southampton-to-heathrow/) and [Heathrow to Dover](https://tripyana.com/london/london-airport-transfer/heathrow-to-dover-cruise-transfer/)
- [Hourly chauffeur hire](https://tripyana.com/chauffeur-cost-london/) (4-hour minimum) and [full-day luxury car hire](https://tripyana.com/london/luxury-car-hire-london/) (8 hours)
- [Private day trips from London](https://tripyana.com/london-day-trips/) — Stonehenge & Bath, the Cotswolds, Windsor, Oxford, Cambridge, Brighton, Canterbury & Dover, Bicester Village and more
- [Heathrow VIP meet & greet](https://tripyana.com/london/heathrow-vip-meet-greet-fast-track/), [student airport pickup](https://tripyana.com/london/student-airport-pickup/), [executive cars](https://tripyana.com/london/executive-car-service-london/) and [wedding cars](https://tripyana.com/london/wedding-car-hire-london/)

…and to hand the traveller a **pre-filled booking link**. Nothing is booked by the server; payment happens on tripyana.com. No API key, no account.

## Endpoint

```
https://mcp.tripyana.com/public
```

Transport: Streamable HTTP (stateless JSON-RPC 2.0 over POST). Open the URL in a browser for a human-readable summary.

### Claude Desktop / Claude Code / Cursor / Windsurf

```json
{ "mcpServers": { "tripyana": { "url": "https://mcp.tripyana.com/public" } } }
```

Claude Code one-liner:

```bash
claude mcp add --transport http tripyana https://mcp.tripyana.com/public
```

## Tools

| Tool | What it returns |
|---|---|
| `get_transfer_price` | Fixed one-way fare per vehicle for a route (`heathrow-central-london`, `gatwick-central-london`, `stansted-central-london`, `luton-central-london`, `heathrow-gatwick`, `heathrow-southampton-cruise`, `heathrow-dover-cruise`), the recommended car for the party, and the page to book on |
| `get_hourly_price` | Hourly (4-hour minimum) and full-day (8-hour) totals per vehicle in London, rules and distance fee outside London, the Manchester day rate |
| `list_day_trips` | Every private day trip from London with whole-car return prices and links (English or Arabic) |
| `search_services` | Finds the right Tripyana page for a query, with summary and published prices |
| `get_booking_link` | Builds a booking-form URL with date, time, passengers, pickup, drop-off and contact details pre-filled |
| `get_meet_greet_price` | Heathrow VIP Meet & Assist with the Fast Track lane (£350 for two guests, £475 with hotel transfer) and student / unaccompanied-minor pickup at any London airport |
| `get_company_info` | Licence, address, phone/WhatsApp, languages, what every fare includes, cancellation policy |

Resources: `tripyana://llms.txt` (the live catalogue, also at [tripyana.com/llms.txt](https://tripyana.com/llms.txt)) and `tripyana://prices.json`.

## Example

> *"How much is a chauffeur from Heathrow to a hotel in Mayfair for 5 people with 4 suitcases?"*

`get_transfer_price {"route":"heathrow-central-london","passengers":5,"luggage":4}` → Mercedes V-Class £145 one way, fixed, meet & greet with a name board, flight tracked, 60 minutes free waiting, free cancellation up to 24 h before pickup — plus the booking page.

## Run it yourself

```bash
git clone https://github.com/tripyana/tripyana-mcp && cd tripyana-mcp
npm install && npm start          # http://127.0.0.1:8791/mcp
npm test                          # smoke test against the local server
```

Environment: `PORT` (8791), `HOST` (127.0.0.1), `PUBLIC_URL`, `LOG_DIR`. The server keeps no customer data; the access log holds timestamp, IP, method and tool name only.

## Prices

Prices come from Tripyana's published price matrix and are refreshed from `llms.txt` hourly. All prices are in GBP, per car, all-inclusive, with no surge pricing. The booking form on tripyana.com is the final word on any fare.

## Contact

Tripyana Ltd · Centurion House, London Road, Staines-upon-Thames TW18 4AX · +44 7747 720000 · [WhatsApp](https://wa.me/447747720000) · info@tripyana.com · Service in English and [Arabic](https://tripyana.com/ar/).

MIT licence.
