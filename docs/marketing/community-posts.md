# Community Post Drafts

Use these drafts for overseas community launch posts. Tailor the first
sentence to each community and avoid posting identical text everywhere.

## Hacker News - Show HN

Title:

```text
Show HN: Vessel Traffic MCP - vessel tracking and shipping schedules for AI agents
```

Body:

```text
Hi HN,

I built Vessel Traffic MCP, an MIT-licensed Model Context Protocol server for maritime data workflows.

It gives MCP clients a read-only tool surface for:

- Vessel search by name, MMSI, IMO, and callsign
- Latest AIS-style position lookup
- Bounding-box vessel lookup
- Recent tracks and port calls
- Carrier schedules and vessel schedules
- Simple schedule delay heuristics

The project is deliberately source-attributed. Live and public-provider responses include source.provider and source.landingUrl, so the user can verify the original provider and visit the source service. Commercial providers are BYOK only, and the default test path uses sanitized fixtures with no live calls.

It currently supports a local stdio MCP server, a Streamable HTTP server, a small map UI, public opt-in providers, and BYOK adapters for providers like MarineTraffic, VesselFinder, AISStream, AISHub, SeaRates, Routescanner, and others.

GitHub: https://github.com/tools-mcp/vessel-traffic-mcp
npm: https://www.npmjs.com/package/@tools-mcp/vessel-traffic-mcp

I would like feedback on the MCP tool design, provider attribution model, and what maritime/logistics workflows would be most useful to support next.
```

## Reddit - r/mcp / r/MCPservers

Title:

```text
I open-sourced Vessel Traffic MCP: vessel positions, schedules, and source-attributed maritime data for MCP clients
```

Body:

````text
I open-sourced Vessel Traffic MCP, a read-only MCP server for vessel tracking and maritime schedule workflows.

What it does:

- Search vessels by name, MMSI, IMO, or callsign
- Get latest AIS-style vessel positions
- Query vessel tracks, port calls, and map areas
- Search carrier schedules and vessel schedules
- Run simple schedule delay heuristics
- Return source.provider and source.landingUrl so users can verify the original source

It is designed for Claude, ChatGPT, Codex, MCP Inspector, and other MCP clients.

Install:

```bash
npm install -g @tools-mcp/vessel-traffic-mcp
VESSEL_MCP_TRANSPORT=stdio vessel-traffic-mcp
```

GitHub:
https://github.com/tools-mcp/vessel-traffic-mcp

npm:
https://www.npmjs.com/package/@tools-mcp/vessel-traffic-mcp

Notes:

- MIT licensed
- Read-only tools only
- Default tests use sanitized fixtures
- Public providers are opt-in
- Commercial providers are BYOK
- The project is meant to send users back to the original source service, not hide attribution

Feedback welcome, especially from anyone building logistics, maritime, or supply-chain MCP workflows.
````

## Reddit - r/opensource / r/SideProject

Title:

```text
I built an open-source MCP server for vessel tracking and shipping schedules
```

Body:

```text
I built Vessel Traffic MCP, an MIT-licensed MCP server that lets AI agents query vessel identity, AIS-style positions, tracks, port calls, carrier schedules, vessel schedules, and simple delay heuristics.

The main design principle is source attribution. Responses from live/public providers include the provider name and source URL so the user can verify the original service. Commercial providers are Bring Your Own Key only.

GitHub:
https://github.com/tools-mcp/vessel-traffic-mcp

npm:
https://www.npmjs.com/package/@tools-mcp/vessel-traffic-mcp

It also includes a small local map UI for trying vessel lookup from a browser.

I am looking for contributors interested in MCP, maritime data, logistics, schedule prediction, provider adapters, and better UI around vessel position/schedule workflows.
```

## Reddit - Maritime / Logistics Communities

Title:

```text
Open-source tool for vessel lookup, AIS-style positions, and shipping schedules
```

Body:

```text
I am working on Vessel Traffic MCP, an open-source read-only tool for vessel and shipping schedule workflows.

It can be used from AI clients that support MCP, but the domain goal is simple:

- Enter a vessel name, MMSI, or IMO
- Resolve possible vessel identities
- Fetch latest AIS-style position or schedule data from configured providers
- Show the original source provider and source URL
- Support carrier schedules and simple delay heuristics

GitHub:
https://github.com/tools-mcp/vessel-traffic-mcp

The project does not try to hide the original data source. Provider attribution and links are part of the response model. Commercial provider integrations are BYOK only.

I would appreciate feedback from maritime/logistics users about which workflows are actually useful: vessel ETA checks, port-call monitoring, route schedule comparison, exception alerts, or document-to-vessel lookup.
```

## DEV Community / Hashnode

Title:

```text
Building a Source-Attributed MCP Server for Vessel Tracking and Shipping Schedules
```

Outline:

```text
1. Why maritime data is awkward for AI agents
2. Why MCP is a useful interface
3. Tool surface: vessel_search, vessel_position, vessel_area, vessel_track, port_calls, carrier_schedule_search, vessel_schedule, schedule_delay_predict
4. Source attribution as a hard rule
5. Public providers vs BYOK commercial providers
6. Local map UI demo
7. How to install and test
8. What contributors can help with next
```

Opening:

```text
I open-sourced Vessel Traffic MCP, a read-only Model Context Protocol server for vessel identity lookup, AIS-style positions, tracks, port calls, carrier schedules, vessel schedules, and delay heuristics.

The project is built around a simple rule: if data comes from a provider, the response should expose the provider and source URL so the user can verify it and visit the original service.
```

## Lobsters

Title:

```text
Vessel Traffic MCP: source-attributed vessel tracking and shipping schedules for MCP clients
```

Description:

```text
An MIT-licensed MCP server for vessel identity lookup, AIS-style positions, tracks, port calls, carrier schedules, vessel schedules, and delay heuristics. The interesting part is the attribution and provider boundary: default tests are fixture-only, public providers are opt-in, commercial providers are BYOK, and tool responses preserve source.provider/source.landingUrl.
```

Suggested tags:

```text
ai, api, javascript, typescript, web
```

## Indie Hackers

Title:

```text
Launching an open-source MCP server for vessel tracking and maritime schedules
```

Body:

```text
I launched Vessel Traffic MCP, an open-source MCP server for vessel lookup, AIS-style positions, and shipping schedule workflows.

The initial use case is: type a vessel name, MMSI, or IMO and let an AI client retrieve current status, coordinates, schedules, and the original source URL.

GitHub:
https://github.com/tools-mcp/vessel-traffic-mcp

I am exploring where this is useful commercially: logistics exception monitoring, shipment ETA checks, broker/forwarder workflows, or document-to-vessel lookup. Feedback from shipping/logistics builders would be useful.
```
