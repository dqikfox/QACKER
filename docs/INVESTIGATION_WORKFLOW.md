# QACKER Investigation Workspace

QACKER converts analyst-supplied observations and authorized security-tool output into structured evidence, technical indicators, explainable correlations, integrity verification, and investigator-ready exports.

This includes gathering and correlating metadata from images, videos, and audio that are lawfully obtained, and minimal bearing triangulation for authorized direction-finding data.

## Safety and authorization model

A case cannot be created without an explicit authorization declaration and basis. The investigation API does **not** automatically scan, exploit, intercept, resolve subscriber identity, or geolocate a person. It works on evidence supplied by an authorized analyst.

Metasploit support is intentionally an **output parser**. Existing authorized Metasploit results can be ingested and correlated, but the investigation module does not generate exploit commands or launch modules.

Technical correlation is not attribution. A shared IP address, domain, MAC address, CVE, hash, or media-derived indicator may be an investigative lead, but it does not by itself prove identity, ownership, physical location, criminal activity, or guilt.

## Analyst UI

Start QACKER normally and open:

`http://localhost:3000/investigations.html`

The workspace can:

- create authorization-bound cases;
- open and close cases;
- ingest analyst observations, logs, forensic notes, existing Metasploit output, and media metadata;
- SHA-256 hash evidence content at ingestion;
- chain new evidence records together with record hashes;
- verify stored evidence integrity;
- extract technical indicators (including from supplied image/video/audio metadata);
- calculate explainable technical-link confidence estimates;
- generate Markdown handoff reports;
- export a machine-readable JSON case bundle.

## Media metadata (images, videos & audio)

When lawfully obtained images, videos, or audio are part of an authorized investigation, analysts can extract and ingest their metadata for correlation:

- Image EXIF/IPTC/XMP: camera make/model, software, capture timestamp, GPS coordinates (if embedded), orientation, resolution.
- Video container metadata: creation/modification times, duration, encoder, device identifiers, GPS tracks (MP4, MOV, MKV, etc.).
- Audio metadata: ID3, QuickTime, or container tags including timestamps and any embedded location (MP3, M4A, WAV, FLAC, etc.).
- Media file SHA-256 hashes for integrity.

### ExifTool endpoint

Requires `exiftool` on PATH. Supports images, video, and audio files.

Extract only:

`POST /api/investigations/media/extract`

```json
{ "filePath": "/absolute/path/to/video.mp4" }
```

Returns full metadata, `mediaType` (`image` | `video` | `audio` | `other`), and a normalised `location` object when GPS is present.

Extract and ingest into a case:

`POST /api/investigations/cases/:caseId/media`

```json
{
  "filePath": "/absolute/path/to/recording.m4a",
  "source": "field-audio"
}
```

Creates a `media-metadata` evidence record that includes `mediaType`. Coordinates plot on the investigations map.

QACKER processes only local files supplied by the analyst. It does not acquire or scrape media.

Media-derived indicators (timestamps, GPS, device fingerprints) are correlated with network, endpoint, temporal, and infrastructure evidence using the same confidence model.

## Bearing triangulation (authorized DF data)

Ingest direction-finding bearings as evidence with `kind: "bearing"`. Content must be an object containing:

- `station_lat` / `station_lon` (receiver position)
- `bearing_deg` (azimuth toward the signal)

Example:

```json
{
  "kind": "bearing",
  "source": "RX-1-manual",
  "content": {
    "station_lat": -33.77,
    "station_lon": 150.91,
    "bearing_deg": 142.5,
    "frequency_mhz": 144.39,
    "rssi": -87
  }
}
```

With two or more bearings in a case, call:

`GET /api/investigations/cases/:caseId/triangulate`

Returns a planar pairwise-average fix (`lat`, `lon`, method, pair count). This is a technical estimate from supplied bearings only; it does not perform active collection or person tracking.

## Probability / confidence model

QACKER reports a `probabilityEstimate` for repeated technical indicators. This is an **uncalibrated heuristic technical-link confidence estimate**, not an empirical probability that a person is a particular identity, is at a location, owns infrastructure, committed an offence, or is guilty.

The score uses:

- indicator specificity;
- number of distinct evidence items containing the indicator;
- number of distinct reported sources;
- discounts for weak or commonly reused indicators.

For example, an exact repeated SHA-256 value receives a stronger base linkage score than a shared CVE. Public IP addresses are discounted because of NAT, VPNs, relays, shared hosting, and reassignment. Private IP addresses receive a larger discount because identical addresses are routinely reused across unrelated networks. GPS coordinates from media are treated as high-specificity when repeated across independent evidence items.

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

Use `"kind": "metasploit"` for analyst-supplied Metasploit console output. Use `"kind": "media-metadata"` for extracted image/video/audio metadata. Use `"kind": "bearing"` for direction-finding bearings. QACKER parses technical indicators without executing external tools unless configured.

### Media extraction (ExifTool)

- `POST /api/investigations/media/extract` — extract only
- `POST /api/investigations/cases/:caseId/media` — extract and ingest

Supports images, video (MP4/MOV/MKV/…), and audio (MP3/M4A/WAV/FLAC/…).

### Read evidence

`GET /api/investigations/cases/:caseId/evidence`

### Correlate evidence

`GET /api/investigations/cases/:caseId/correlations`

Returns repeated indicators, evidence-to-indicator edges, and explainable technical-link confidence estimates.

### Triangulate bearings

`GET /api/investigations/cases/:caseId/triangulate`

Computes a fix from all `kind: "bearing"` evidence in the case.

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

The export includes the case manifest, evidence, integrity-verification results, technical correlations, and triangulation result.

## Storage

Cases are stored by default under:

- Linux/macOS: `~/.qacker/investigations`
- Windows: `%USERPROFILE%\\.qacker\\investigations`

Override with `QACKER_CASE_DIR`.

Each case contains a `case.json` manifest and append-only `evidence.jsonl` log.

## Recommended operating procedure

1. Confirm legal authority and scope before creating the case.
2. Preserve original source material (including media files) separately when evidentiary-retention requirements apply.
3. Ingest copies, analyst observations, or extracted media metadata and identify the source accurately.
4. Run integrity verification before handoff or export.
5. Review correlation confidence as a prioritization aid, not attribution.
6. Export the report/bundle for authorized investigators or incident-response teams.
7. Use formal legal/provider processes for subscriber identity, account records, or location information.
