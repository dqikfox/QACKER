# QACKER Investigation Core

This module converts analyst-supplied observations and authorized security-tool output into structured evidence, technical indicators, correlations, and a Markdown handoff report.

## Safety and authorization model

QACKER requires an explicit authorization declaration when a case is created. The investigation API does **not** automatically scan, exploit, intercept, resolve subscriber identity, or geolocate a person. It works on evidence supplied to it by an authorized analyst.

Metasploit support is intentionally an **output parser**. Existing authorized Metasploit results can be ingested and correlated, but this investigation module does not generate exploit commands or launch modules.

Technical correlation is not attribution. A shared IP address, domain, MAC address, CVE, or hash can be an investigative lead, but it does not by itself prove identity, ownership, location, criminal activity, or guilt.

## API

All routes are mounted below `/api/investigations`.

### Create a case

`POST /api/investigations/cases`

```json
{
  "title": "Authorized laboratory validation",
  "purpose": "Correlate technical observations",
  "scope": "Systems owned by the research team",
  "authorization": {
    "confirmed": true,
    "basis": "Owned infrastructure",
    "reference": "ENGAGEMENT-001"
  }
}
```

### Ingest evidence

`POST /api/investigations/cases/:caseId/evidence`

```json
{
  "kind": "observation",
  "source": "analyst-note",
  "collectedAt": "2026-10-31T02:00:00Z",
  "content": "Observed demo.example during the authorized test"
}
```

Use `"kind": "metasploit"` for analyst-supplied Metasploit console output. QACKER will parse module references, session observations, and technical indicators without executing Metasploit.

### Correlate evidence

`GET /api/investigations/cases/:caseId/correlations`

Returns repeated technical indicators and evidence-to-indicator edges. The graph deliberately stops at technical correlation; it does not infer a human identity.

### Generate a report

`GET /api/investigations/cases/:caseId/report`

Returns a Markdown investigation report containing the authorization record, evidence inventory, SHA-256 hashes, and repeated technical indicators.

## Storage

Cases are stored by default under:

- Linux/macOS: `~/.qacker/investigations`
- Windows: `%USERPROFILE%\\.qacker\\investigations`

Override with `QACKER_CASE_DIR`.

Each case contains a `case.json` manifest and append-only `evidence.jsonl` evidence log. Evidence content is SHA-256 hashed at ingestion so later exports can verify integrity.

## Recommended operating procedure

1. Confirm legal authority and scope before creating the case.
2. Preserve original source material outside QACKER when evidentiary retention requirements apply.
3. Ingest copies or analyst observations and record the source accurately.
4. Review correlations as leads rather than conclusions.
5. Export the report for authorized investigators or incident-response teams.
6. Use formal legal/provider processes for subscriber identity, account records, or location information.
