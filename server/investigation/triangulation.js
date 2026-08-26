'use strict';

// Minimal geometric solver for bearings from known stations.
// Uses planar approximation (adequate for local simplex / DF work).
// Returns estimated lat/lon or null if insufficient data.

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function toDegrees(rad) {
  return rad * 180 / Math.PI;
}

// Intersection of two lines of bearing (planar, local meters approx)
function intersectTwo(s1, s2) {
  const lat1 = s1.lat, lon1 = s1.lon, b1 = toRadians(s1.bearing);
  const lat2 = s2.lat, lon2 = s2.lon, b2 = toRadians(s2.bearing);

  // Approximate meters per degree (local)
  const metersPerLat = 111320;
  const metersPerLon = 111320 * Math.cos(toRadians((lat1 + lat2) / 2));

  const x1 = 0;
  const y1 = 0;
  const x2 = (lon2 - lon1) * metersPerLon;
  const y2 = (lat2 - lat1) * metersPerLat;

  const dx1 = Math.sin(b1);
  const dy1 = Math.cos(b1);
  const dx2 = Math.sin(b2);
  const dy2 = Math.cos(b2);

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-8) return null; // parallel

  const t = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / det;
  const ix = x1 + t * dx1;
  const iy = y1 + t * dy1;

  return {
    lat: lat1 + iy / metersPerLat,
    lon: lon1 + ix / metersPerLon,
  };
}

function triangulate(bearings) {
  if (!Array.isArray(bearings) || bearings.length < 2) {
    return { ok: false, error: 'Need at least 2 bearings', fix: null };
  }

  const valid = bearings.filter(b =>
    typeof b.lat === 'number' && typeof b.lon === 'number' && typeof b.bearing === 'number'
  );
  if (valid.length < 2) {
    return { ok: false, error: 'Insufficient valid bearings', fix: null };
  }

  const intersections = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const pt = intersectTwo(valid[i], valid[j]);
      if (pt) intersections.push(pt);
    }
  }

  if (intersections.length === 0) {
    return { ok: false, error: 'No valid intersections (parallel bearings)', fix: null };
  }

  // Simple average of pairwise intersections
  const avg = intersections.reduce((acc, p) => {
    acc.lat += p.lat;
    acc.lon += p.lon;
    return acc;
  }, { lat: 0, lon: 0 });

  avg.lat /= intersections.length;
  avg.lon /= intersections.length;

  return {
    ok: true,
    fix: {
      lat: Number(avg.lat.toFixed(6)),
      lon: Number(avg.lon.toFixed(6)),
      method: 'pairwise-average',
      pairs: intersections.length,
      stations: valid.length,
    },
    bearings: valid.length,
  };
}

function extractBearings(evidenceList) {
  const bearings = [];
  for (const item of evidenceList || []) {
    if (String(item.kind || '').toLowerCase() !== 'bearing') continue;
    const c = item.content;
    if (!c || typeof c !== 'object') continue;
    const lat = Number(c.station_lat ?? c.lat);
    const lon = Number(c.station_lon ?? c.lon);
    const bearing = Number(c.bearing_deg ?? c.bearing);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(bearing)) {
      bearings.push({ lat, lon, bearing, evidenceId: item.evidenceId });
    }
  }
  return bearings;
}

module.exports = { triangulate, extractBearings, intersectTwo };
