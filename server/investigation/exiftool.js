'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.avi', '.webm', '.3gp', '.mts', '.m2ts']);
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma', '.aiff']);

function classifyMedia(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (['.jpg', '.jpeg', '.png', '.heic', '.tiff', '.webp'].includes(ext)) return 'image';
  return 'other';
}

function runExifTool(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath required');
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error('File not found or not a regular file');
  }

  const result = spawnSync('exiftool', ['-j', '-n', '-a', '-G1', resolved], {
    encoding: 'utf8',
    timeout: 45000,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('exiftool not found on PATH. Install ExifTool.');
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `exiftool exited ${result.status}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '[]');
  } catch (err) {
    throw new Error('Failed to parse exiftool JSON output');
  }

  const meta = Array.isArray(parsed) && parsed.length ? parsed[0] : {};
  const mediaType = classifyMedia(resolved);

  return {
    file: resolved,
    mediaType,
    metadata: meta,
    location: extractLocation(meta),
  };
}

function extractLocation(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const latKeys = [
    'GPSLatitude',
    'GPS:GPSLatitude',
    'QuickTime:GPSLatitude',
    'Composite:GPSLatitude',
    'XMP:GPSLatitude',
    'Exif:GPSLatitude',
  ];
  const lonKeys = [
    'GPSLongitude',
    'GPS:GPSLongitude',
    'QuickTime:GPSLongitude',
    'Composite:GPSLongitude',
    'XMP:GPSLongitude',
    'Exif:GPSLongitude',
  ];

  const lat = pickNumber(meta, latKeys);
  const lon = pickNumber(meta, lonKeys);

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon, source: 'exiftool' };
  }

  const isoCandidates = [
    meta['QuickTime:GPSCoordinates'],
    meta['QuickTime:LocationInformation'],
    meta['Composite:GPSPosition'],
    meta['GPSCoordinates'],
    meta['XMP:GPSCoordinates'],
    meta['ItemList:GPSCoordinates'],
  ];

  for (const iso of isoCandidates) {
    if (typeof iso !== 'string') continue;
    const m = iso.match(/([+-]?\d+(?:\.\d+)?)\s*([+-]?\d+(?:\.\d+)?)/);
    if (m) {
      return { lat: Number(m[1]), lon: Number(m[2]), source: 'iso6709' };
    }
  }

  return null;
}

function pickNumber(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

module.exports = { runExifTool, extractLocation, classifyMedia };
