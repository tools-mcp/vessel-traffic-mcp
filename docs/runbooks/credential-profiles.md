# BYOK credential profiles runbook (F2B.AC1)

Vessel Traffic MCP supports Bring-Your-Own-Key (BYOK) credentials for paid
or rate-limited vessel data providers. Credentials live entirely on the
operator's machine; the MCP surface only exposes labels, declared field
names, provider hints, and status — never the raw secret material.

## Sources

The credential profile loader reads from two sources and merges them:

1. **Environment variables** matching the pattern:

   ```
   VESSEL_MCP_PROFILE_<LABEL>__<FIELD>=<value>
   ```

   - `<LABEL>` is uppercased in the env var name; the loader normalizes it
     to lowercase and replaces underscores with dashes for the profile
     label (e.g. `MARINETRAFFIC_PROD` becomes `marinetraffic-prod`).
   - `<FIELD>` is one of: `provider`, `api_key`, `username`, `password`,
     `bearer_token`, `client_id`, `client_secret`, `subscription_key`.
   - Unknown field names are silently ignored to prevent typos from
     becoming visible signals.
   - Empty string values are treated as "not set".

2. **Local gitignored JSON config** at `config/credential-profiles.local.json`:

   ```json
   {
     "profiles": [
       {
         "label": "marinetraffic-prod",
         "provider": "marinetraffic",
         "fields": { "api_key": "..." }
       },
       {
         "label": "aisstream-dev",
         "provider": "aisstream",
         "fields": { "bearer_token": "..." }
       }
     ]
   }
   ```

   This file is in `.gitignore`. Do not commit it.

When the same label appears in both sources, the **environment value wins**.
Operators can override a local profile temporarily by exporting the env
form without editing the file.

## What MCP clients see

The read-only `credential_profiles` MCP tool returns a payload of the form:

```json
{
  "profiles": [
    {
      "label": "marinetraffic-prod",
      "provider": "marinetraffic",
      "source": "env",
      "fieldsPresent": ["api_key"],
      "status": "configured"
    }
  ],
  "summary": { "total": 1, "configured": 1, "incomplete": 0, "fromEnv": 1, "fromLocalConfig": 0 },
  "notes": [
    "Profile values are redacted; only labels, provider hints, declared fields, and status are exposed.",
    "..."
  ]
}
```

The tool is annotated `readOnlyHint: true`, `destructiveHint: false`. It
accepts no arguments and performs no network I/O.

## Hard rules

- **Never log raw secrets.** Internal log messages route through
  `src/util/redact.ts`, which scrubs `VESSEL_MCP_PROFILE_*` values along
  with `authorization: bearer ...`, cookies, and `api_key=...` style
  fragments.
- **MCP tool output is the labels-only contract.** The
  `CredentialProfileSummary` type has no `fields`/`value` member. Raw
  secrets are reachable only via `CredentialStore.resolveSecret(label, field)`
  inside provider adapters and are never serialized to JSON.
- **Local config stays local.** `config/credential-profiles.local.json` is
  gitignored; do not commit it. The `.env.example` template documents the
  env form but contains no real values.
- **MCP tools must remain read-only.** This tool only reads the loaded
  store. It cannot register, mutate, or delete a profile, and it never
  triggers a provider call.

## Verifying

Run from the project root:

```
npm run lint
npm test
npm run build
```

The `test/credential-profiles.test.js` suite covers:

- env-only and local-config-only loading,
- env-wins-on-label-collision merging,
- unknown field rejection and empty value handling,
- malformed JSON rejection,
- MCP tool payload shape and absence of secrets in `content[0].text`,
- `redactForLog` scrubbing of `VESSEL_MCP_PROFILE_*` log fragments.

The test suite does not call any live or paid provider; verification is
deterministic and fixture-only.
