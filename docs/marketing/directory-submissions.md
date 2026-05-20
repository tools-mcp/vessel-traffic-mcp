# Directory Submission Pack

Use this file to submit the project to MCP directories and curated lists.
Directory fields should always point to the public GitHub repository and npm
package, not to local paths or private captures.

## Submission Tracker

| Target | URL | Account Needed | Status | Notes |
| --- | --- | --- | --- | --- |
| Glama | https://glama.ai/ | Likely yes | Ready | Repository has `glama.json`; submit GitHub URL. |
| FindMCP | https://findmcp.dev/ | Likely yes | Ready | Use the directory summary and GitHub URL. |
| MCP.Directory | https://mcp.directory/ | Likely yes | Ready | Use MCP Registry name and npm package. |
| mcpservers.org | https://mcpservers.org/en/submit | Likely yes | Ready | Submit public repo and install command. |
| PulseMCP | https://www.pulsemcp.com/submit | Maybe | Watch | Project is already in official MCP Registry; check automatic ingestion first. |
| Smithery | https://smithery.ai/ | Yes | Blocked on public HTTPS | Server card is ready; remote submission needs a stable public HTTPS `/mcp` URL. |
| punkpeye/awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers | GitHub | Ready | Open PR after checking contribution format. |
| appcypher/awesome-mcp-servers | https://github.com/appcypher/awesome-mcp-servers | GitHub | Ready | Open PR after checking contribution format. |
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
  "maintainers": ["tools-mcp"]
}
```

## FindMCP / MCP.Directory / mcpservers.org

Use the common fields above. If a long description is accepted, use the long
description from `docs/marketing/launch-kit.md`.

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

