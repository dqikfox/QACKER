# QACKER Investigation Workspace

QACKER converts analyst-supplied observations and authorized security-tool output into structured evidence, technical indicators, explainable correlations, integrity verification, and investigator-ready exports.

## Safety and authorization model

A case cannot be created without an explicit authorization declaration and basis. The investigation API does **not** automatically scan, exploit, intercept, resolve subscriber identity, or geolocate a person. It works on evidence supplied by an authorized analyst.

Metasploit support is intentionally an **output parser**. Existing authorized Metasploit results can be ingested and correlated, but the investigation module does not generate exploit commands or launch modules.

Technical correlation is not attribution. A shared IP address, domain, MAC address, CVE, or hash may be an investigative lead, but it does not by itself prove identity, ownership, physical location, criminal activity, or guilt.

## Analyst UI

Start QACKER normally and open:

`http://localhost:3000/investigations.html`

The workspace can:

- create authorization-bound cases;
- open and close cases;
- ingest analyst observations, logs, forensic notes, and existing Metasploit output;
- SHA-256 hash evidence content at ingestion;
- chain new evidence records together with record hashes;
- verify stored evidence integrity;
- extract technical indicators;
- calculate explainable technical-link confidence estimates;
- generate Markdown handoff reports;
- export a machine-readable JSON case bundle.

## Probability / confidence model

QACKER reports a `probabilityEstimate` for repeated technical indicators. This is an **uncalibrated heuristic technical-link confidence estimate**, not an empirical probability that a person is a particular identity, is at a location, owns infrastructure, committed an offence, or is guilty.

The score uses:

- indicator specificity;
- number of distinct evidence items containing the indicator;
- number of distinct reported sources;
- discounts for weak or commonly reused indicators.

For example, an exact repeated SHA-256 value receives a stronger base linkage score than a shared CVE. Public IP addresses are discounted because of NAT, VPNs, relays, shared hosting, and reassignment. Private IP addresses receive a larger discount because identical addresses are routinely reused across unrelated networks.

Every estimate contains:

- `score` from 0 to 1;
- `percent`;
- `band` (`low`, `moderate`, `high`, `very-high`);
- `calibrated: false`;
- evidence/source counts;
- human-readable factors explaining the score.

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

### List/read cases

- `GET /api/investigations/cases`
- `GET /api/investigations/cases/:caseId`

### Open or close a case

`PATCH /api/investigations/cases/:caseId/status`

```json
{ "status": "closed" }
```

Closed cases reject new evidence until reopened.

### Ingest evidence

`POST /api/investigations/cases/:caseId/evidence`

```json
{
  "kind": "observation",
  "source": "analyst-note",
  "collectedAt": "2026-11-01T01:00:00Z",
  "content": "Observed demo.example during the authorized test"
}
```

Use `"kind": "metasploit"` for analyst-supplied Metasploit console output. QACKER parses module references, session observations, and technical indicators without executing Metasploit.

### Read evidence

`GET /api/investigations/cases/:caseId/evidence`

### Correlate evidence

`GET /api/investigations/cases/:caseId/correlations`

Returns repeated indicators, evidence-to-indicator edges, and explainable technical-link confidence estimates.

### Verify evidence integrity

`GET /api/investigations/cases/:caseId/verify`

For current evidence records this validates:

1. the SHA-256 hash of the evidence content;
2. the hash of the complete stored record;
3. the link to the preceding evidence record.

Legacy evidence created before record chaining is still content-hash checked and is marked as legacy.

### Generate Markdown report

`GET /api/investigations/cases/:caseId/report`

### Export JSON case bundle

`GET /api/investigations/cases/:caseId/export`

The export includes the case manifest, evidence, integrity-verification results, and technical correlations.

## Storage

Cases are stored by default under:

- Linux/macOS: `~/.qacker/investigations`
- Windows: `%USERPROFILE%\\.qacker\\investigations`

Override with `QACKER_CASE_DIR`.

Each case contains a `case.json` manifest and append-only `evidence.jsonl` log.

## Recommended operating procedure

1. Confirm legal authority and scope before creating the case.
2. Preserve original source material separately when evidentiary-retention requirements apply.
3. Ingest copies or analyst observations and identify the source accurately.
4. Run integrity verification before handoff or export.
5. Review correlation confidence as a prioritization aid, not attribution.
6. Export the report/bundle for authorized investigators or incident-response teams.
7. Use formal legal/provider processes for subscriber identity, account records, or location information.
