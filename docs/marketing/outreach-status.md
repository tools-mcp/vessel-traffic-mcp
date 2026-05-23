# Outreach Status

Snapshot date: 2026-05-23 KST

## Current Public Surfaces

- GitHub: https://github.com/tools-mcp/vessel-traffic-mcp
- GitHub release: https://github.com/tools-mcp/vessel-traffic-mcp/releases/tag/v0.1.0
- npm: https://www.npmjs.com/package/@tools-mcp/vessel-traffic-mcp
- MCP Registry: `io.github.tools-mcp/vessel-traffic-mcp`

## Current Metrics

- GitHub Traffic API, last 14 days: 602 clones, 172 unique cloners.
- GitHub Traffic API, last 14 days: 9 views, 5 unique visitors.
- npm downloads, 2026-05-15 through 2026-05-21: 59.
- GitHub stars/forks/watchers: 0/0/0 at the time of this snapshot.

GitHub clone traffic does not identify who cloned the repository. It only
reports aggregate clone counts and unique cloners for the recent traffic
window.

## Completed Distribution Work

- npm package `@tools-mcp/vessel-traffic-mcp@0.1.0` is public.
- Official MCP Registry entry is active.
- GitHub topics are configured for MCP, vessel AIS, ship tracking, maritime,
  logistics, Claude, ChatGPT, Codex, and BYOK discovery.
- GitHub release `v0.1.0` was created after `npm run lint`, `npm test`, and
  `npm run build` passed.
- MCP.Directory submission was already sent.
- mcpservers.org submission was already sent and is pending review.
- `punkpeye/awesome-mcp-servers` PR is open:
  https://github.com/punkpeye/awesome-mcp-servers/pull/6664
- MCP Find PR is open:
  https://github.com/MCPFind/mcp-find/pull/47
  Its GitHub Actions status is `action_required` because fork workflows require
  maintainer approval; the visible Vercel failure is an authorization gate, not
  a catalog YAML validation failure.
- mcp.so issue submission is open:
  https://github.com/chatmcp/mcpso/issues/2482

## Active Blockers

- Glama does not yet return a page or API record for
  `tools-mcp/vessel-traffic-mcp`; the API returns `not_found` and the score
  badge URL returns 404 as of 2026-05-23.
- The awesome-mcp-servers PR is labeled `missing-glama` until a Glama listing
  exists and the PR entry includes the Glama score badge.
- MCPCentral submission requires sign-in and should be handled with the
  official `mcp-publisher` flow against `https://registry.mcpcentral.io`.
- PulseMCP manual submission previously hit Cloudflare and should be retried in
  a logged-in browser session if automatic registry ingestion does not pick up
  the project.
- Smithery submission should wait for a stable public HTTPS `/mcp` endpoint.

## Community Posting Targets

High fit:

- Hacker News Show HN.
- Reddit `r/mcp`, `r/MCPservers`, `r/opensource`, `r/SideProject`.
- DEV Community or Hashnode article.
- Product Hunt after a visible demo GIF or hosted endpoint exists.
- OKKY, GeekNews, Velog, and Korean logistics/maritime communities.

Posting rule:

- Avoid identical cross-posting. Keep the core link and claim set consistent,
  but tailor the opening and feedback ask to each community.
- Do not claim real-time navigation reliability.
- Do not claim provider data ownership or paywall/CAPTCHA bypass.
- Emphasize read-only MCP tools, source attribution, BYOK, and sanitized tests.
