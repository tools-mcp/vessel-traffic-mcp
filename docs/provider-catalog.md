# Vessel Provider Catalog

Research snapshot checked on 2026-05-07. This catalog is the working backlog for
official API adapters, open-data adapters, BYOK commercial adapters, and
authorized capture candidates. It is intentionally conservative: an entry being
listed here does not mean the project may scrape it or bypass access controls.

## Product Priority

The default product model is BYOK: each MCP user or organization connects API
keys for the vessel-data services they already subscribe to. Since most users
will not buy paid AIS access before validating coverage, the first practical
fallback is free, open, trial, or community terrestrial AIS. Satellite AIS and
enterprise providers are valuable when the user supplies credentials, but they
should not block the basic "can I find this vessel at all?" workflow.

Provider routing should therefore prefer:

1. An explicitly requested BYOK credential profile.
2. Free/open/trial terrestrial AIS providers for initial coverage checks.
3. Community/regional sources with clear rate limits and terms.
4. Paid commercial/satellite providers when the user has supplied credentials.
5. Authorized capture fixtures only for development and adapter discovery, never
   as a default runtime bypass.

When no API key is configured, MCP tools should still run against configured
terrestrial AIS sources. If the result is stale, missing, outside terrestrial
coverage, or likely requires satellite AIS, the response should include
provider-specific signup or landing URLs from this catalog so the user can
obtain their own key and reconnect through BYOK.

## Capture And Access Policy

- Prefer official APIs and open-data feeds.
- Use BYOK for commercial APIs when the user or operator supplies valid
  credentials.
- Use browser/API capture only for operator-authorized sessions and only where
  the provider terms allow that use.
- Never commit raw HAR files, browser sessions, cookies, bearer tokens, API
  keys, `.env` files, or private provider responses.
- Store raw operator capture output only under ignored private paths such as
  `captures/private/`.
- Commit only sanitized fixtures, endpoint fingerprints, traffic IR summaries,
  schema summaries, and provider-adapter tickets.

## Priority Providers

| Provider | Access class | Coverage | API/capture direction | Initial priority | Source |
| --- | --- | --- | --- | --- | --- |
| MarineTraffic / Kpler | Commercial BYOK official API; web UI capture candidate only with authorization | Global AIS, events, ports, vessel data depending on plan | Implement BYOK adapter template first; use official service docs before any capture | P1 | https://servicedocs.marinetraffic.com/ |
| MarineTraffic `exportvesseltrack` | Commercial BYOK official API endpoint family | Vessel historical track | Document endpoint shape and credential profile; no live default tests | P1 | https://servicedocs.marinetraffic.com/tag/Vessel-Historical-Track |
| VesselFinder | Commercial credit API | Terrestrial AIS positions, voyage, master data | BYOK REST adapter candidate with JSON/XML normalization | P1 | https://api.vesselfinder.com/docs/vessels.html |
| MyShipTracking | Trial/commercial API | Terrestrial AIS, vessel position, zone, history, ports | BYOK/trial REST adapter candidate; useful early because docs expose current-position endpoint and trial key flow | P1 | https://api.myshiptracking.com/docs/vessel-current-position-api |
| AISStream | Free WebSocket API | Global receiver network, best-effort live AIS stream | Live stream/cache adapter for initial no-paid-API coverage checks | P1 | https://aisstream.io/ |
| AISHub | Community/member API | Contributor AIS network | Member API adapter with strict one-request-per-minute throttle | P1 | https://www.aishub.net/api |
| BarentsWatch / Norwegian Coastal Administration | Open regional API | Norway/regional real-time AIS | Open-data regional adapter | P1 | https://www.barentswatch.no/en/articles/open-data-via-barentswatch/ |
| OpenAIS | Open AIS-oriented API | Varies by project/data scope | Open/reference adapter after terms and coverage validation | P2 | https://open-ais.org/docs/API/ |
| NOAA MarineCadastre / USCG NAIS | Open historical data | United States AIS, generally delayed historical data | Historical data importer/reference identity source, not low-latency position provider | P2 | https://www.fisheries.noaa.gov/inport/item/77594 |
| Global Fishing Watch | Token API/public data | Fishing activity, vessel identity, public registry context | Identity/context provider; not a universal live-position fallback | P2 | https://globalfishingwatch.org/our-apis/documentation |

## Commercial And Enterprise Backlog

| Provider | Access class | Notes | Source |
| --- | --- | --- | --- |
| Spire Maritime | Commercial satellite/terrestrial AIS API | Global AIS data products and API offerings; BYOK adapter candidate | https://spire.com/maritime/solutions/standard-ais/ |
| ORBCOMM / CommTrace / exactEarth | Commercial satellite AIS API | Beyond-coastal satellite AIS; BYOK adapter candidate | https://api.commtrace.com/ |
| VesselAPI | Commercial/trial maritime API | Terrestrial AIS ship-tracking endpoints and maritime data API | https://vesselapi.com/ship-tracking-api |
| Data Docked | Commercial maritime data API | Vessel location, historical location, port calls, details by name, route planner, weather | https://datadocked.com/ |
| Poseidon AIS | Commercial AIS API | Vessel details, area/radius search, historical positions | https://poseidonais.com/ |
| ais.now | Commercial API/web platform candidate | Real-time AIS platform with REST API claims; validate docs, terms, and coverage before implementation | https://ais.now/ |
| FleetMon / Kpler | Commercial maritime intelligence | Treat as BYOK or authorized capture candidate only after account-specific terms review | https://www.fleetmon.com/ |
| Windward | Enterprise maritime intelligence | Enterprise provider; likely contract/API review required | https://windward.ai/ |
| Pole Star Global | Enterprise maritime intelligence | Enterprise compliance/tracking provider; likely contract/API review required | https://www.polestarglobal.com/ |
| S&P Global Sea-web | Enterprise maritime intelligence | Enterprise ship, ownership, casualty, and movement context candidate | https://www.spglobal.com/marketintelligence/en/solutions/products/sea-web |
| Lloyd's List Intelligence | Enterprise maritime intelligence | Enterprise maritime intelligence and vessel movement context candidate | https://www.lloydslistintelligence.com/ |

## Community, Free, And Candidate Web Sources

These entries need terms, API, coverage, and freshness validation before any
adapter or capture work. They should be modeled as discovery tickets first.

| Provider | Access class | Capture/API status |
| --- | --- | --- |
| AIS Friends | Community/contributor API candidate | Validate registration, contribution requirements, API terms, and whether data redistribution is allowed. |
| MyShipTracking web UI | Web UI plus official API | Prefer official API; capture only for authorized UI-only workflows not covered by API. |
| ShipXplorer | Web UI/API candidate | Validate whether a supported ship API exists and whether UI capture is allowed. |
| MarineVesselTraffic / similar map sites | Web UI candidates | Discovery-only until terms and technical feasibility are documented. |
| Regional government AIS portals | Open/regional candidates | Prioritize official open APIs and static/historical datasets before UI capture. |

## Provider Discovery Backlog

The autonomous development process should keep this catalog alive:

1. Add a structured provider inventory file, such as `config/provider-catalog.example.json`, derived from this catalog.
2. Record each provider's access class, auth mode, cost/quota model, supported capabilities, coverage, freshness expectations, source URLs, implementation status, and capture eligibility.
3. Create adapter tickets for official/open/BYOK providers.
4. Create capture tickets only for web-only services where the operator has authorized access and the terms review does not block capture.
5. Feed capture tickets into the api-capture-derived workflow: site profile, controlled Playwright session, HAR/XHR capture, replay validation, redaction, traffic IR, schema summary, sanitized fixture, and disabled-by-default adapter candidate.
