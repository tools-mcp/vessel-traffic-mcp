import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const RUNBOOK_URL = new URL('../docs/runbooks/clients.md', import.meta.url);
const RUNBOOK_DIR = dirname(fileURLToPath(RUNBOOK_URL));
const README_URL = new URL('../README.md', import.meta.url);
const REQUIREMENTS_URL = new URL('../docs/autodev/requirements.yaml', import.meta.url);
const PACKAGE_URL = new URL('../package.json', import.meta.url);
const CREATE_SERVER_URL = new URL('../src/server/create-server.ts', import.meta.url);

function readRunbook() {
  return readFileSync(RUNBOOK_URL, 'utf8');
}

function extractFencedBlocks(markdown, lang) {
  const fence = new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g');
  const blocks = [];
  let match;
  while ((match = fence.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function extractRelativeMarkdownLinks(markdown) {
  const linkPattern = /\]\((\.\/[^)\s]+\.md|[A-Za-z0-9_-][^)\s]*\.md)\)/g;
  const targets = new Set();
  let match;
  while ((match = linkPattern.exec(markdown)) !== null) {
    targets.add(match[1]);
  }
  return [...targets];
}

test('client setup runbook self-identifies against F1.AC3', () => {
  const text = readRunbook();
  assert.match(text, /F1\.AC3/, 'runbook should self-identify against the acceptance criterion');
});

test('client setup runbook covers all four required clients', () => {
  const text = readRunbook();
  assert.match(text, /## Claude Desktop/i);
  assert.match(text, /## Claude Code/i);
  assert.match(text, /## ChatGPT remote MCP/i);
  assert.match(text, /## Generic MCP Inspector/i);
});

test('client setup runbook documents the stdio transport contract', () => {
  const text = readRunbook();
  assert.match(text, /VESSEL_MCP_TRANSPORT=stdio/);
  assert.match(text, /dist\/index\.js/);
  assert.match(text, /claude_desktop_config\.json/);
  assert.match(text, /\.mcp\.json/, 'Claude Code project-scoped MCP config');
  assert.match(text, /@modelcontextprotocol\/inspector/);
});

test('client setup runbook documents the Streamable HTTP transport contract', () => {
  const text = readRunbook();
  assert.match(text, /VESSEL_MCP_TRANSPORT=http/);
  assert.match(text, /VESSEL_MCP_HTTP_HOST/);
  assert.match(text, /VESSEL_MCP_HTTP_PORT/);
  assert.match(text, /VESSEL_MCP_AUTH_TOKEN/);
  assert.match(text, /Authorization: Bearer/);
  assert.match(text, /GET \/health/);
  assert.match(text, /POST \/mcp/);
  assert.match(text, /X-Request-Id/);
});

test('client setup runbook names the registered read-only tool surface', () => {
  const text = readRunbook();
  assert.match(text, /provider_status/);
  assert.match(text, /data_sources/);
  assert.match(text, /credential_profiles/);
  assert.match(text, /readOnlyHint/);
  assert.match(text, /read-only/i);
});

test('client setup runbook keeps the no-secret, no-bypass posture', () => {
  const text = readRunbook();
  assert.match(text, /Never paste secrets into chat/i);
  assert.match(
    text,
    /Default verification.*fixture/i,
    'must state that default verification stays fixture-only',
  );
  // stdout is the MCP stream — no log writes there.
  assert.match(text, /stdout is the MCP protocol stream/i);
});

test('client setup runbook does not leak credential-shaped strings', () => {
  const text = readRunbook();
  assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'no JWTs');
  assert.doesNotMatch(text, /\b(AKIA|ASIA)[A-Z0-9]{16}\b/, 'no AWS access key IDs');
  assert.doesNotMatch(text, /\bghp_[A-Za-z0-9]{20,}\b/, 'no GitHub PATs');
  assert.doesNotMatch(text, /\bsk-[A-Za-z0-9]{20,}\b/, 'no sk- secrets');
});

test('client setup runbook references the package binary target', () => {
  const text = readRunbook();
  const pkg = JSON.parse(readFileSync(PACKAGE_URL, 'utf8'));
  const binaryTarget = pkg.bin['vessel-traffic-mcp'];
  assert.equal(binaryTarget, './dist/index.js');
  // The runbook should point clients at this same binary path.
  assert.ok(text.includes('dist/index.js'), 'runbook must point at the dist/index.js binary');
});

test('README links the client setup runbook so MCP clients can find it', () => {
  const readme = readFileSync(README_URL, 'utf8');
  assert.match(readme, /docs\/runbooks\/clients\.md/, 'README must link the client setup runbook');
});

test('client setup runbook JSON config snippets are valid mcpServers entries', () => {
  const text = readRunbook();
  const jsonBlocks = extractFencedBlocks(text, 'json');
  assert.ok(jsonBlocks.length >= 2, 'runbook should include at least two JSON config snippets');

  const mcpServerBlocks = jsonBlocks.filter((block) => block.includes('mcpServers'));
  assert.ok(
    mcpServerBlocks.length >= 2,
    'runbook should include Claude Desktop and Claude Code mcpServers JSON snippets',
  );

  for (const block of mcpServerBlocks) {
    const parsed = JSON.parse(block);
    assert.ok(parsed && typeof parsed === 'object', 'JSON snippet must parse to an object');
    assert.ok(parsed.mcpServers, 'snippet must define mcpServers');
    const entry = parsed.mcpServers['vessel-traffic-mcp'];
    assert.ok(entry, 'snippet must register vessel-traffic-mcp under mcpServers');
    assert.equal(entry.command, 'node');
    assert.ok(Array.isArray(entry.args), 'args must be an array');
    assert.ok(
      entry.args.some((a) => typeof a === 'string' && a.endsWith('dist/index.js')),
      'args must point at dist/index.js',
    );
    assert.ok(entry.env, 'env block must exist so VESSEL_MCP_TRANSPORT can be set');
    assert.equal(entry.env.VESSEL_MCP_TRANSPORT, 'stdio');
  }
});

test('client setup runbook references existing runbook files (no broken links)', () => {
  const text = readRunbook();
  const targets = extractRelativeMarkdownLinks(text);
  assert.ok(
    targets.includes('./stdio-fixture-server.md'),
    'must reference stdio-fixture-server.md',
  );
  assert.ok(
    targets.includes('./streamable-http-server.md'),
    'must reference streamable-http-server.md',
  );
  for (const target of targets) {
    const resolved = resolve(RUNBOOK_DIR, target);
    assert.ok(existsSync(resolved), `referenced runbook file must exist: ${target}`);
  }
});

test('client setup runbook documents the MCP Inspector for both transports', () => {
  const text = readRunbook();
  // stdio inspector usage
  assert.match(text, /npx\s+@modelcontextprotocol\/inspector\s+node\s+dist\/index\.js/);
  // streamable-http inspector usage
  assert.match(text, /--transport\s+streamable-http/);
  assert.match(text, /--server-url\s+"http:\/\/127\.0\.0\.1:\d+\/mcp"/);
  assert.match(text, /--header\s+"Authorization: Bearer \$VESSEL_MCP_AUTH_TOKEN"/);
});

test('client setup runbook enumerates the full registered read-only tool surface', () => {
  const text = readRunbook();
  const serverSource = readFileSync(CREATE_SERVER_URL, 'utf8');
  const registerCalls = [...serverSource.matchAll(/server\.registerTool\(\s*'([^']+)'/g)];
  const registeredTools = registerCalls.map((m) => m[1]);
  assert.ok(registeredTools.length >= 3, 'create-server.ts must register at least the F1 tool set');

  for (const tool of registeredTools) {
    assert.match(
      text,
      new RegExp(`\\b${tool}\\b`),
      `runbook must mention registered tool ${tool} so MCP clients see the full surface`,
    );
  }
});

test('F1.AC3 status in requirements.yaml is set to implemented for this acceptance criterion', () => {
  const reqs = readFileSync(REQUIREMENTS_URL, 'utf8');
  const f1Index = reqs.indexOf('id: F1');
  assert.ok(f1Index > 0, 'requirements.yaml must contain feature F1');
  const f2Index = reqs.indexOf('id: F2', f1Index);
  const f1Block = reqs.slice(f1Index, f2Index > 0 ? f2Index : undefined);

  const ac3Index = f1Block.indexOf('id: AC3');
  assert.ok(ac3Index > 0, 'F1 must contain acceptance criterion AC3');
  const ac3Block = f1Block.slice(ac3Index, ac3Index + 400);
  assert.match(ac3Block, /client setup documentation/i, 'AC3 description must match the client-setup criterion');
  assert.match(ac3Block, /status: implemented/, 'F1.AC3 status must be flipped to implemented');
  assert.match(ac3Block, /verification: docs-review/, 'F1.AC3 verification must remain docs-review');
});
