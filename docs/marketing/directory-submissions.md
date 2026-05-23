# Directory Submission Pack

Use this file to submit the project to MCP directories and curated lists.
Directory fields should always point to the public GitHub repository and npm
package, not to local paths or private captures.

## Submission Tracker

| Target | URL | Account Needed | Status | Notes |
| --- | --- | --- | --- | --- |
| Glama | https://glama.ai/ | Yes | Blocked | Rechecked on 2026-05-23: API returns `not_found`, badge URL returns 404, and the browser `Add Server` flow requires Glama/GitHub login before a listing exists. |
| FindMCP | https://findmcp.dev/ | Likely yes | Watch | `/submit` currently resolves to the public directory page; no direct submission endpoint found. |
| MCP Find | https://mcpfind.org/submit | GitHub | Submitted | PR opened on 2026-05-24: https://github.com/MCPFind/mcp-find/pull/47. Checks are `action_required` pending maintainer approval for fork workflows; Vercel also reports authorization required. |
| MCP.Directory | https://mcp.directory/ | No | Submitted | Submitted on 2026-05-20 via `/api/submit-server`; response: `Server submitted for review!`. |
| mcpservers.org | https://mcpservers.org/en/submit | No | Submitted | Submitted on 2026-05-20 as free listing; response id `2577`, status `pending`. |
| PulseMCP | https://www.pulsemcp.com/submit | Maybe | Blocked | Public request hit Cloudflare block on 2026-05-20; retry in browser if needed. |
| MCPCentral | https://mcpcentral.io/submit-server | Yes | Account required | Submit page redirects to sign-in. Current site recommends `mcp-publisher login github --registry https://registry.mcpcentral.io` before publish. |
| mcp.so | https://mcp.so/ | GitHub | Submitted | Issue opened on 2026-05-24: https://github.com/chatmcp/mcpso/issues/2482 |
| Smithery | https://smithery.ai/ | Yes | Blocked on public HTTPS | Server card is ready; remote submission needs a stable public HTTPS `/mcp` URL. |
| punkpeye/awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers | GitHub | Submitted | PR opened on 2026-05-20: https://github.com/punkpeye/awesome-mcp-servers/pull/6664 |
| appcypher/awesome-mcp-servers | https://github.com/appcypher/awesome-mcp-servers | GitHub | Blocked | Fork branch `tools-mcp:add-vessel-traffic-mcp` is pushed, but upstream has disabled external pull requests and issues. |
| awesome-mcp lists | GitHub search | GitHub | Ready | Submit only to maintained lists that accept PRs. |

## Common Fields

Name:

```text
Vessel Traffic MCP
```

Repository:

```text
https://github.com/tools-mcp/vessel-traffic-mcp
```

npm:

```text
https://www.npmjs.com/package/@tools-mcp/vessel-traffic-mcp
```

MCP Registry:

```text
io.github.tools-mcp/vessel-traffic-mcp
```

Category:

```text
Maritime, logistics, data, search, monitoring
```

Tags:

```text
mcp, ais, vessel-tracking, ship-tracking, maritime, logistics, byok, claude, chatgpt, codex
```

Short description:

```text
Read-only MCP server for vessel identity lookup, AIS-style positions, tracks, port calls, carrier schedules, vessel schedules, and delay heuristics with source attribution and BYOK provider support.
```

Install command:

```bash
npm install -g @tools-mcp/vessel-traffic-mcp
```

Local stdio command:

```bash
VESSEL_MCP_TRANSPORT=stdio vessel-traffic-mcp
```

Recommended env:

```text
VESSEL_MCP_TRANSPORT=stdio
VESSEL_MCP_ENABLE_PUBLIC_PROVIDERS=myshiptracking,tradlinx
```

## Glama

Use:

```text
Repository: https://github.com/tools-mcp/vessel-traffic-mcp
Name: Vessel Traffic MCP
Summary: Read-only MCP server for vessel AIS-style position data, carrier schedules, vessel schedules, and delay heuristics with source attribution and BYOK provider support.
Install: npm install -g @tools-mcp/vessel-traffic-mcp
```

The root `glama.json` already declares:

```json
{
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "maintainers": ["seokmogu", "tools-mcp"]
}
```

## FindMCP / MCP.Directory / mcpservers.org

Use the common fields above. If a long description is accepted, use the long
description from `docs/marketing/launch-kit.md`.

## MCP Find

Add this entry to `community-servers.yml`:

```yaml
  - name: "Vessel Traffic MCP"
    github_url: "https://github.com/tools-mcp/vessel-traffic-mcp"
    package_name: "@tools-mcp/vessel-traffic-mcp"
    description: "Read-only MCP server for vessel identity lookup, AIS-style positions, tracks, port calls, carrier schedules, vessel schedules, and delay heuristics with source attribution and BYOK provider support."
    package_type: "npm"
    category: "other"
```

Submitted:

```text
https://github.com/MCPFind/mcp-find/pull/47
```

## mcp.so

Use this GitHub issue title in `chatmcp/mcpso`:

```text
[Submit] Vessel Traffic MCP - Read-only maritime AIS and schedule tools
```

Use the common fields above plus the package and registry links.

Submitted:

```text
https://github.com/chatmcp/mcpso/issues/2482
```

## PulseMCP

Check whether the server appears after MCP Registry ingestion. If not, submit:

```text
Official MCP Registry name: io.github.tools-mcp/vessel-traffic-mcp
GitHub: https://github.com/tools-mcp/vessel-traffic-mcp
npm: https://www.npmjs.com/package/@tools-mcp/vessel-traffic-mcp
```

## Smithery

Current state:

- Stdio npm package is public.
- Streamable HTTP implementation exists.
- `GET /.well-known/mcp/server-card.json` exists and includes
  `serverInfo`, `authentication`, `tools`, `resources`, and `prompts`.
- Submission should wait until a stable public HTTPS URL is deployed.

When the public URL exists:

```text
Remote MCP URL: https://<public-host>/mcp
Server card: https://<public-host>/.well-known/mcp/server-card.json
Repository: https://github.com/tools-mcp/vessel-traffic-mcp
```

## Awesome List PR Entry

Use this bullet when submitting to curated GitHub lists:

```markdown
- [Vessel Traffic MCP](https://github.com/tools-mcp/vessel-traffic-mcp) - Read-only MCP server for vessel identity lookup, AIS-style positions, tracks, port calls, carrier schedules, vessel schedules, and delay heuristics with source attribution and BYOK provider support.
```

Submitted:

```text
punkpeye/awesome-mcp-servers: https://github.com/punkpeye/awesome-mcp-servers/pull/6664
```

For `appcypher/awesome-mcp-servers`, the fork branch is ready, but the
upstream repository currently blocks external pull requests and issues:

```text
https://github.com/appcypher/awesome-mcp-servers/compare/main...tools-mcp:awesome-mcp-servers:add-vessel-traffic-mcp
```

## mcp-submit Dry Run

`npx --yes mcp-submit --dry-run` on 2026-05-23 detected this package as
`io.github.tools-mcp/vessel-traffic-mcp v0.1.0 (0 tools, stdio)`.

Do not run the tool unfiltered:

- Official MCP Registry, MCPCentral, and Docker MCP Registry providers are
  currently marked ready by detection, but their implementation returns
  integration-pending failures.
- `punkpeye/awesome-mcp-servers` is already submitted and blocked on Glama.
- `appcypher/awesome-mcp-servers` is already blocked by upstream PR settings.
- Browser providers use the system `open` command; use Chrome manually instead.
