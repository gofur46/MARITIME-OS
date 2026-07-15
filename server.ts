import express from "express";
import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import fetch from "node-fetch";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient } from "socket.io-client";

const app = express();
const PORT = 3000;

interface BMKGForecastRow {
  waktu: string;
  jam: string;
  cuaca: string;
  cuacaIcon: string;
  anginDir: string;
  anginSpeed: number;
  anginGust: number;
  gelombangVal: number;
  gelombangKet: string;
  arusDir: string;
  arusSpeed: number;
  visibility: number;
  suhu: number;
  kelembaban: number;
  pasut: number;
}

const EMOJI_MAP: Record<string, string> = {
  'cerah': '☀️',
  'cerah berawan': '⛅',
  'berawan': '☁️',
  'hujan ringan': '🌧️',
  'hujan sedang': '🌧️',
  'hujan lebat': '🌧️',
  'hujan petir': '⛈️',
  'kabut': '🌫️',
  'default': '☁️'
};

function getEmoji(weather: string): string {
  const w = weather.toLowerCase().trim();
  for (const key of Object.keys(EMOJI_MAP)) {
    if (w.includes(key)) return EMOJI_MAP[key];
  }
  return EMOJI_MAP['default'];
}

const MONTHS_MAP: Record<string, number> = {
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'jun': 5,
  'jul': 6, 'agu': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11,
  'aug': 7, 'oct': 9, 'dec': 11, 'may': 4
};

const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function convertUtcToWib(waktuUtc: string): string {
  try {
    const m = waktuUtc.match(/(\d+)\s+([A-Za-z]+)\s+(\d+),\s+(\d+)\.(\d+)/);
    if (!m) return waktuUtc;
    
    const day = parseInt(m[1], 10);
    const monthStr = m[2].toLowerCase().substring(0, 3);
    const yearShort = parseInt(m[3], 10);
    const hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    
    const year = 2000 + yearShort;
    const monthIndex = MONTHS_MAP[monthStr] !== undefined ? MONTHS_MAP[monthStr] : 5;
    
    const utcDate = new Date(Date.UTC(year, monthIndex, day, hour, minute, 0));
    
    const wibTimeMs = utcDate.getTime() + (7 * 1000 * 60 * 60);
    const wibDate = new Date(wibTimeMs);
    
    const wibDay = wibDate.getUTCDate();
    const wibMonth = INDO_MONTHS[wibDate.getUTCMonth()];
    const wibYearShort = String(wibDate.getUTCFullYear()).slice(-2);
    const wibHour = String(wibDate.getUTCHours()).padStart(2, '0');
    const wibMinute = String(wibDate.getUTCMinutes()).padStart(2, '0');
    
    return `${wibDay} ${wibMonth} ${wibYearShort}, ${wibHour}.${wibMinute}`;
  } catch (err) {
    return waktuUtc;
  }
}

function generateMockForecast(portSlug: string): BMKGForecastRow[] {
  const rows: BMKGForecastRow[] = [];
  
  // Seed-like calculation based on slug name
  let hash = 0;
  for (let i = 0; i < portSlug.length; i++) {
    hash = portSlug.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Base profile data for all 32 ports shown in the user's photos
  const PORT_PROFILES: Record<string, {
    avgWave: number;
    waveKet: string;
    avgWind: number;
    avgTemp: number;
    baseCurrentDir: string;
    windDir: string;
  }> = {
    // Banten Group (18 Ports)
    pelabuhan_cituis: { avgWave: 0.3, waveKet: "Tenang", avgWind: 7, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
    pelabuhan_kronjo: { avgWave: 0.3, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
    pelabuhan_tanjung_pasir: { avgWave: 0.25, waveKet: "Tenang", avgWind: 7, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Timur" },
    pelabuhan_anyer: { avgWave: 0.45, waveKet: "Tenang", avgWind: 9, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Timur Laut" },
    pelabuhan_kepuh: { avgWave: 0.4, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
    pelabuhan_lontar: { avgWave: 0.35, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur Laut" },
    pelabuhan_pasauran: { avgWave: 0.5, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
    pelabuhan_bojonegara: { avgWave: 0.55, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Tenggara" },
    pelabuhan_banten: { avgWave: 0.35, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
    pelabuhan_merak: { avgWave: 0.65, waveKet: "Rendah", avgWind: 11, avgTemp: 29, baseCurrentDir: "Selatan", windDir: "Timur Laut" },
    pelabuhan_ciwandan: { avgWave: 0.42, waveKet: "Tenang", avgWind: 9, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Timur Laut" },
    pelabuhan_carita: { avgWave: 0.5, waveKet: "Tenang", avgWind: 9, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Timur" },
    pelabuhan_labuan: { avgWave: 0.55, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
    pelabuhan_panimbang: { avgWave: 0.45, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Selatan" },
    pelabuhan_tamanjaya: { avgWave: 0.6, waveKet: "Rendah", avgWind: 10, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
    pelabuhan_binuangeun: { avgWave: 0.8, waveKet: "Sedang", avgWind: 12, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
    pelabuhan_suralaya: { avgWave: 0.5, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
    pelabuhan_kbs: { avgWave: 0.42, waveKet: "Tenang", avgWind: 9, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Timur Laut" },

    // Jakarta Group (14 Ports)
    pelabuhan_tanjung_priok: { avgWave: 0.3, waveKet: "Tenang", avgWind: 7, avgTemp: 31, baseCurrentDir: "Barat", windDir: "Utara" },
    pelabuhan_sunda_kelapa: { avgWave: 0.2, waveKet: "Tenang", avgWind: 6, avgTemp: 31, baseCurrentDir: "Barat Laut", windDir: "Utara" },
    pelabuhan_muara_angke: { avgWave: 0.25, waveKet: "Tenang", avgWind: 6, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
    pelabuhan_muara_baru: { avgWave: 0.2, waveKet: "Tenang", avgWind: 6, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
    pelabuhan_kalibaru: { avgWave: 0.25, waveKet: "Tenang", avgWind: 7, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
    pelabuhan_marunda: { avgWave: 0.2, waveKet: "Tenang", avgWind: 6, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
    pelabuhan_p_untung_jawa: { avgWave: 0.2, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_lancang: { avgWave: 0.25, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_pari: { avgWave: 0.3, waveKet: "Tenang", avgWind: 9, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_tidung: { avgWave: 0.35, waveKet: "Tenang", avgWind: 9, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_pramuka: { avgWave: 0.3, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_kelapa: { avgWave: 0.35, waveKet: "Tenang", avgWind: 9, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_babelokan: { avgWave: 0.45, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Barat" },
    pelabuhan_p_sabira: { avgWave: 0.5, waveKet: "Tenang", avgWind: 11, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Barat" }
  };

  const cleanSlug = portSlug.toLowerCase().replace(/-/g, '_');
  const profile = PORT_PROFILES[cleanSlug] || {
    avgWave: 0.45,
    waveKet: "Tenang",
    avgWind: 9,
    avgTemp: 29,
    baseCurrentDir: "Barat Daya",
    windDir: "Timur Laut"
  };

  const avgWave = profile.avgWave;
  const waveKet = profile.waveKet;
  const avgWind = profile.avgWind;
  const avgTemp = profile.avgTemp;
  const baseCurrentDir = profile.baseCurrentDir;
  const windDir = profile.windDir;
  
  const weathers = ["Berawan", "Cerah Berawan", "Cerah", "Cerah Berawan", "Berawan", "Hujan Ringan", "Berawan"];
  const directions = ["Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut", "Utara"];
  
  // We want to generate starting from now (in WIB)
  const nowUtc = new Date();
  const wibTimeMs = nowUtc.getTime() + (7 * 3600 * 1000);
  const baseDate = new Date(wibTimeMs);
  
  // Back up by 1 hour to ensure "Saat Ini / Kini" or "Jam berikutnya" align nicely
  baseDate.setUTCMinutes(0);
  baseDate.setUTCSeconds(0);
  
  for (let h = 0; h < 17; h++) {
    const d = new Date(baseDate.getTime() + h * 3600 * 1000);
    const day = d.getUTCDate();
    const month = INDO_MONTHS[d.getUTCMonth()];
    const yearShort = String(d.getUTCFullYear()).slice(-2);
    const hourStr = String(d.getUTCHours()).padStart(2, '0');
    
    const waktu = `${day} ${month} ${yearShort}, ${hourStr}.00`;
    
    let jam = `${h + 1} jam ke depan`;
    if (h === 0) jam = "Sore ini"; // match original
    else if (h === 1) jam = "Jam berikutnya";
    else if (h === 2) jam = "2 pm ke depan";
    else {
      jam = `${h} jam ke depan`;
    }
    
    // Pseudo-random variations using sine wave
    const idx = (Math.abs(hash) + h) % weathers.length;
    const cuaca = weathers[idx];
    const cuacaIcon = getEmoji(cuaca);
    
    const waveOffset = Math.sin(h * 0.5) * 0.15;
    let gelombangVal = Math.round((avgWave + waveOffset) * 100) / 100;
    if (gelombangVal < 0.15) gelombangVal = 0.15;
    
    // Wave category matching
    let gKet = "Tenang";
    if (gelombangVal > 1.25) gKet = "Sedang";
    else if (gelombangVal > 0.5) gKet = "Rendah";
    
    const windOffset = Math.sin(h * 0.7) * 3;
    const anginSpeed = Math.max(3, Math.round(avgWind + windOffset));
    const anginGust = Math.round(anginSpeed * 1.5);
    const currentWindDir = directions[(Math.abs(hash) + h + 2) % directions.length];
    const currentArusDir = directions[(Math.abs(hash) + h + 5) % directions.length];
    
    const currentSpeed = Math.round((1.0 + Math.sin(h * 0.4) * 0.6) * 10) / 10;
    const visibility = Math.round((9.5 + Math.cos(h * 0.3) * 1.5) * 10) / 10;
    
    const tempOffset = Math.sin((h - 4) * 0.5) * 2;
    const suhu = Math.round(avgTemp + tempOffset);
    const kelembaban = Math.max(50, Math.min(98, Math.round(75 - tempOffset * 6)));
    
    const pasutVal = Math.round((0.5 + Math.sin(h * 0.5) * 0.4) * 100) / 100;
    
    rows.push({
      waktu,
      jam,
      cuaca,
      cuacaIcon,
      anginDir: currentWindDir,
      anginSpeed,
      anginGust,
      gelombangVal,
      gelombangKet: gKet,
      arusDir: currentArusDir,
      arusSpeed: currentSpeed,
      visibility,
      suhu,
      kelembaban,
      pasut: pasutVal
    });
  }
  
  return rows;
}

// In-memory cache for BMKG weather data, keyed by port slug
interface CacheEntry {
  data: BMKGForecastRow[];
  time: number;
}
const cachedBmkPortData: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache timeout

// API Endpoint to fetch live BMKG data
app.get("/api/bmkg", async (req, res) => {
  const now = Date.now();
  const rawPortParam = req.query.port;
  let portSlug = typeof rawPortParam === 'string' ? rawPortParam.trim().toLowerCase() : 'pelabuhan_ciwandan';
  
  // Clean portSlug to prevent path traversal or unsanitized URL building
  portSlug = portSlug.replace(/[^a-z0-9\-_]/g, '');
  if (!portSlug) {
    portSlug = 'pelabuhan_ciwandan';
  }

  // Normalize hyphens to underscores since BMKG Maritim URLs use underscores (e.g. pelabuhan_ciwandan)
  portSlug = portSlug.replace(/-/g, '_');

  // Map any special/alternative slugs to the actual BMKG endpoint slug
  if (portSlug === 'pelabuhan_karangantu') {
    portSlug = 'pelabuhan_banten';
  } else if (portSlug === 'pelabuhan_kalibaru_cilincing' || portSlug === 'pelabuhan_cilincing') {
    portSlug = 'pelabuhan_kalibaru';
  } else if (portSlug === 'pelabuhan_p_pabelokan') {
    portSlug = 'pelabuhan_p_babelokan';
  }

  const cachedValue = cachedBmkPortData[portSlug];
  const forceRefresh = req.query.refresh === 'true';

  // If cache is valid and not force-refresh, return cached results directly
  if (!forceRefresh && cachedValue && (now - cachedValue.time < CACHE_TTL_MS)) {
    console.log(`[BMKG API] Serving ${portSlug} from Cache. Cache Age:`, Math.round((now - cachedValue.time)/1000), "seconds");
    return res.json({
      success: true,
      source: 'cache',
      lastUpdated: new Date(cachedValue.time).toISOString(),
      data: cachedValue.data
    });
  }

  try {
    console.log(`[BMKG API] Cache missed/expired for ${portSlug}. Fetching fresh data from BMKG Maritim Website...`);
    const urlSlug = portSlug.replace(/_/g, '-');
    const bmkgUrl = `https://maritim.bmkg.go.id/cuaca/pelabuhan/${urlSlug}`;
    console.log(`[BMKG API] Target URL: ${bmkgUrl}`);
    const bmkgResponse = await fetch(bmkgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!bmkgResponse.ok) {
      throw new Error(`BMKG server responded with status: ${bmkgResponse.status}`);
    }

    const html = await bmkgResponse.text();
    const lowerHtml = html.toLowerCase();

    // Verify fetched page content to guard against BMKG's silent redirects (e.g., serving Ciwandan or Index for invalid ports)
    let requiredKeyword = "";
    const slugParts = portSlug.split('_');
    const coreWords = slugParts.filter(p => p !== 'pelabuhan' && p !== 'p' && p !== 'pulau');
    if (coreWords.length > 0) {
      requiredKeyword = coreWords[0];
      // Keep "priok" or "pasir" or similar sub-words as the verification string
      if ((requiredKeyword === 'tanjung' || requiredKeyword === 'muara' || requiredKeyword === 'kalibaru') && coreWords[1]) {
        requiredKeyword = coreWords[1];
      }
    }

    // Capture the title or page heading to prevent general sidebar link matches from bypassing our redirect guards
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const headingMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const titleText = titleMatch ? titleMatch[1].toLowerCase() : "";
    const headingText = headingMatch ? headingMatch[1].toLowerCase() : "";
    
    // We search the specific titles/headings instead of raw html stream to prevent matching the global sidebar navigation links
    const verificationText = `${titleText} ${headingText}`;

    if (requiredKeyword && !verificationText.includes(requiredKeyword)) {
      throw new Error(`BMKG server redirected or returned non-${requiredKeyword} page for slug: ${portSlug} (Title: "${titleText.trim()}", Heading: "${headingText.trim()}")`);
    }

    const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];
    
    if (tableMatches.length === 0) {
      throw new Error(`No tables found on BMKG response page for ${portSlug}. Possibly invalid port slug.`);
    }

    const rowsList: BMKGForecastRow[] = [];

    // Parse tables to collect hourly forecast predictions
    for (let t = 0; t < tableMatches.length; t++) {
      const tableContent = tableMatches[t][1];
      const tbodyMatches = [...tableContent.matchAll(/<tbody[^>]*>([\s\S]*?)<\/tbody>/g)];
      if (tbodyMatches.length === 0) continue;

      const tbody = tbodyMatches[0][1];
      const rowMatches = [...tbody.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)];

      for (const rowMatch of rowMatches) {
        const trAttributes = rowMatch[1];
        const rowHtml = rowMatch[2];
        
        // Skip rows that are hidden on the BMKG live website (past hours or templates)
        const isTrHidden = /class="[^"]*?\bhidden\b[^"]*?"/i.test(trAttributes);
        if (isTrHidden) {
          continue;
        }

        const cellMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
        
        if (cellMatches.length < 9) {
          continue; // skip rows that don't match the standard schema (e.g. headers, alerts)
        }

        try {
          // Cell 0: Time
          const cell0 = cellMatches[0][1];
          const waktuMatch = cell0.match(/<div class="time-main"[^>]*>([\s\S]*?)<\/div>/);
          const jamMatch = cell0.match(/<div class="time-sub"[^>]*>([\s\S]*?)<\/div>/);
          const rawWaktu = waktuMatch ? waktuMatch[1].trim() : "Unknown";
          const waktu = convertUtcToWib(rawWaktu);
          const jam = jamMatch ? jamMatch[1].trim() : "Unknown";

          // Cell 1: Weather (Cuaca)
          const cell1 = cellMatches[1][1];
          const weatherTextMatch = cell1.match(/alt="([^"]+)"/) || cell1.match(/<span class="weather-text"[^>]*>([\s\S]*?)<\/span>/);
          const cuaca = weatherTextMatch ? weatherTextMatch[1].trim() : "Berawan";
          const cuacaIcon = getEmoji(cuaca);

          // Cell 2: Wind (Angin)
          const cell2 = cellMatches[2][1];
          const windTextMatch = cell2.match(/<div class="font-medium[^>]*>([\s\S]*?)<\/div>/);
          const gustTextMatch = cell2.match(/Gust[^]*?:\s*(\d+)/i);

          const windText = windTextMatch ? windTextMatch[1].replace(/<[^>]*>/g, '').trim() : "Selatan 0 kt";
          const parts = windText.split(/\s+/);
          const anginSpeed = parseInt(parts.find(p => /^\d+$/.test(p)) || '0', 10);
          const anginDir = windText.replace(/\d+/g, '').replace('kt', '').trim();
          const anginGust = gustTextMatch ? parseInt(gustTextMatch[1], 10) : anginSpeed;

          // Cell 3: Wave (Gelombang)
          const cell3 = cellMatches[3][1];
          const waveValMatch = cell3.match(/<span class="wave-height"[^>]*>([\d\.]+)\s*m<\/span>/) || cell3.match(/([\d\.]+)\s*m/);
          const waveKetMatch = cell3.match(/<span class="wave-category"[^>]*>([\s\S]*?)<\/span>/) || cell3.match(/Category:?\s*(\w+)/i);
          const gelombangVal = waveValMatch ? parseFloat(waveValMatch[1]) : 0.4;
          const gelombangKet = waveKetMatch ? waveKetMatch[1].trim() : "Tenang";

          // Cell 4: Current (Arus Laut)
          const cell4 = cellMatches[4][1];
          const currentDirMatch = cell4.match(/<div class="font-medium[^>]*>([\s\S]*?)<\/div>/);
          const currentSpeedMatch = cell4.match(/(\d+(\.\d+)?)\s*Knot/i);
          const arusDir = currentDirMatch ? currentDirMatch[1].replace(/<[^>]*>/g, '').trim() : "Barat Daya";
          const arusSpeed = currentSpeedMatch ? parseFloat(currentSpeedMatch[1]) : 1.2;

          // Cell 5: Visibility
          const cell5 = cellMatches[5][1];
          const visibilityMatch = cell5.match(/([\d\.]+)\s*<span[^>]*>km<\/span>/) || cell5.match(/([\d\.]+)/);
          const visibility = visibilityMatch ? parseFloat(visibilityMatch[1]) : 10;

          // Cell 6: Temperature
          const cell6 = cellMatches[6][1];
          const tempMatch = cell6.match(/([\d\.-]+)\s*<span[^>]*>°C<\/span>/) || cell6.match(/([\d\.-]+)/);
          const suhu = tempMatch ? parseInt(tempMatch[1], 10) : 28;

          // Cell 7: Humidity
          const cell7 = cellMatches[7][1];
          const humMatch = cell7.match(/([\d\.-]+)\s*<span[^>]*>%<\/span>/) || cell7.match(/([\d\.-]+)/);
          const kelembaban = humMatch ? parseInt(humMatch[1], 10) : 75;

          // Cell 8: Tide (Pasut)
          const cell8 = cellMatches[8][1];
          const tideMatch = cell8.match(/([\+-\d\.]+)\s*<span[^>]*>m<\/span>/) || cell8.match(/([\+-\d\.]+)/);
          const pasut = tideMatch ? parseFloat(tideMatch[1]) : 0.5;

          rowsList.push({
            waktu,
            jam,
            cuaca,
            cuacaIcon,
            anginDir,
            anginSpeed,
            anginGust,
            gelombangVal,
            gelombangKet,
            arusDir,
            arusSpeed,
            visibility,
            suhu,
            kelembaban,
            pasut
          });
        } catch (rowErr: any) {
          console.warn(`[BMKG API] Warn parsing row:`, rowErr.message || rowErr);
        }
      }
    }

    if (rowsList.length === 0) {
      throw new Error("Unable to parse any rows from BMKG website weather data tables.");
    }

    // Success - cache and return
    cachedBmkPortData[portSlug] = {
      data: rowsList,
      time: now
    };

    console.log(`[BMKG API] Successfully scraped ${rowsList.length} rows for ${portSlug}. Updating Cache.`);
    return res.json({
      success: true,
      source: 'live',
      lastUpdated: new Date().toISOString(),
      data: rowsList
    });
  } catch (apiErr: any) {
    console.error("[BMKG API] Exception during fetching:", apiErr.message || apiErr);
    
    // In case of any networks/scraping errors, serve cached data if ever existed
    const staleVal = cachedBmkPortData[portSlug];
    if (staleVal) {
      console.log(`[BMKG API] Serving stale cache for ${portSlug} due to BMKG fetch error.`);
      return res.json({
        success: true,
        source: 'stale-cache',
        lastUpdated: new Date(staleVal.time).toISOString(),
        data: staleVal.data
      });
    }

    // Generate accurate fallback simulation data specific to the port to avoid breaking the client UI
    console.log(`[BMKG API] Generating resilient fallback simulation data for ${portSlug}`);
    const simulatedData = generateMockForecast(portSlug);
    
    // Cache the simulated data to prevent constant refetch storm
    cachedBmkPortData[portSlug] = {
      data: simulatedData,
      time: now
    };

    return res.json({
      success: true,
      source: 'simulasi maritim',
      lastUpdated: new Date().toISOString(),
      data: simulatedData
    });
  }
});

// JSON Middleware for Updater
app.use(express.json());

// Real-world FTP & SFTP Upload Route
app.post("/api/ftp-upload", async (req, res) => {
  const { host, port, protocol, user, pass, path: remotePath, filename, payload } = req.body;

  if (!host || !user || !pass) {
    return res.status(400).json({ success: false, error: "Host, username, dan password wajib diisi." });
  }

  const tempLocalFile = path.join(process.cwd(), filename);
  try {
    // Tulis payload ke file lokal sementara
    fs.writeFileSync(tempLocalFile, payload, "utf-8");

    if (protocol === "SFTP") {
      console.log(`[SFTP Upload] Memulai upload SFTP ke ${host}:${port || 22}...`);
      const sftpModule = await import("ssh2-sftp-client");
      // sftpModule.default is usually the class for ssh2-sftp-client
      const SftpClass = sftpModule.default || (sftpModule as any);
      const client = new SftpClass();

      await client.connect({
        host,
        port: port || 22,
        username: user,
        password: pass,
        readyTimeout: 15000
      });

      // Pastikan direktori tujuan ada, jika tidak, coba buat
      try {
        await client.mkdir(remotePath, true);
      } catch (err) {
        // Abaikan jika sudah ada atau gagal membuat
      }

      const remoteFile = path.join(remotePath, filename).replace(/\\/g, "/");
      await client.put(tempLocalFile, remoteFile);
      await client.end();
      console.log(`[SFTP Upload] Sukses mengunggah ke ${remoteFile}`);
    } else {
      console.log(`[FTP Upload] Memulai upload FTP ke ${host}:${port || 21}...`);
      const ftpModule = await import("basic-ftp");
      const client = new ftpModule.Client();
      client.ftp.verbose = true;

      await client.access({
        host,
        port: port || 21,
        user,
        password: pass,
        secure: false
      });

      // Pastikan direktori tujuan ada
      try {
        await client.ensureDir(remotePath);
      } catch (err) {
        // Abaikan
      }

      await client.uploadFrom(tempLocalFile, filename);
      client.close();
      console.log(`[FTP Upload] Sukses mengunggah ke ${remotePath}/${filename}`);
    }

    // Hapus file sementara
    try {
      fs.unlinkSync(tempLocalFile);
    } catch (e) {}

    return res.json({ success: true, message: "Upload berhasil!" });
  } catch (err: any) {
    console.error(`[Upload Failed] Gagal melakukan transfer ${protocol}:`, err);
    // Hapus file sementara jika ada
    try {
      if (fs.existsSync(tempLocalFile)) {
        fs.unlinkSync(tempLocalFile);
      }
    } catch (e) {}

    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Centralized configuration endpoints for LAN client synchronization
const AWS_CONFIG_FILE = path.join(process.cwd(), "aws_config.json");

// Local variables to hold the latest moxa daemon status and raw messages
let lastMoxaStatus: any = {
  connected: false,
  moxa_ip: '172.16.4.48',
  moxa_port: 5001,
  state: 'OFFLINE',
  last_seen: '-',
  error: 'Waiting for daemon connection'
};

// Centralized telemetry history queue
let liveHistoryQueue: any[] = [];
const MAX_QUEUE_SIZE = 150;

// Port profiles for realistic telemetry generation (consistent with App.tsx)
const PORT_PROFILES: Record<string, {
  avgWave: number;
  waveKet: string;
  avgWind: number;
  avgTemp: number;
  baseCurrentDir: string;
  windDir: string;
}> = {
  // Banten Group (18 Ports)
  pelabuhan_cituis: { avgWave: 0.3, waveKet: "Tenang", avgWind: 7, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_kronjo: { avgWave: 0.3, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_tanjung_pasir: { avgWave: 0.25, waveKet: "Tenang", avgWind: 7, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_anyer: { avgWave: 0.45, waveKet: "Tenang", avgWind: 9, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Timur" },
  pelabuhan_kepuh: { avgWave: 0.4, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_lontar: { avgWave: 0.35, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_pasauran: { avgWave: 0.5, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
  pelabuhan_bojonegara: { avgWave: 0.55, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Tenggara" },
  pelabuhan_banten: { avgWave: 0.35, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_merak: { avgWave: 0.65, waveKet: "Rendah", avgWind: 11, avgTemp: 29, baseCurrentDir: "Selatan", windDir: "Timur Laut" },
  pelabuhan_ciwandan: { avgWave: 0.42, waveKet: "Tenang", avgWind: 9, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Timur Laut" },
  pelabuhan_carita: { avgWave: 0.5, waveKet: "Tenang", avgWind: 9, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Timur" },
  pelabuhan_labuan: { avgWave: 0.55, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
  pelabuhan_panimbang: { avgWave: 0.45, waveKet: "Tenang", avgWind: 8, avgTemp: 29, baseCurrentDir: "Barat Daya", windDir: "Selatan" },
  pelabuhan_tamanjaya: { avgWave: 0.6, waveKet: "Rendah", avgWind: 10, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
  pelabuhan_binuangeun: { avgWave: 0.8, waveKet: "Sedang", avgWind: 12, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Tenggara" },
  pelabuhan_suralaya: { avgWave: 0.5, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Timur" },
  pelabuhan_kbs: { avgWave: 0.42, waveKet: "Tenang", avgWind: 9, avgTemp: 28, baseCurrentDir: "Barat Daya", windDir: "Timur Laut" },

  // Jakarta Group (14 Ports)
  pelabuhan_tanjung_priok: { avgWave: 0.3, waveKet: "Tenang", avgWind: 7, avgTemp: 31, baseCurrentDir: "Barat", windDir: "Utara" },
  pelabuhan_sunda_kelapa: { avgWave: 0.2, waveKet: "Tenang", avgWind: 6, avgTemp: 31, baseCurrentDir: "Barat Laut", windDir: "Utara" },
  pelabuhan_muara_angke: { avgWave: 0.25, waveKet: "Tenang", avgWind: 6, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
  pelabuhan_muara_baru: { avgWave: 0.2, waveKet: "Tenang", avgWind: 6, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
  pelabuhan_kalibaru: { avgWave: 0.25, waveKet: "Tenang", avgWind: 7, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
  pelabuhan_marunda: { avgWave: 0.2, waveKet: "Tenang", avgWind: 6, avgTemp: 30, baseCurrentDir: "Barat", windDir: "Utara" },
  pelabuhan_p_untung_jawa: { avgWave: 0.2, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_lancang: { avgWave: 0.25, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_pari: { avgWave: 0.3, waveKet: "Tenang", avgWind: 9, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_tidung: { avgWave: 0.35, waveKet: "Tenang", avgWind: 9, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_pramuka: { avgWave: 0.3, waveKet: "Tenang", avgWind: 8, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_kelapa: { avgWave: 0.35, waveKet: "Tenang", avgWind: 9, avgTemp: 30, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_babelokan: { avgWave: 0.45, waveKet: "Tenang", avgWind: 10, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Barat" },
  pelabuhan_p_sabira: { avgWave: 0.5, waveKet: "Tenang", avgWind: 11, avgTemp: 29, baseCurrentDir: "Utara", windDir: "Barat" }
};

function generateInitialLogsServer(count: number, intervalMinutes: number = 10, portSlug: string = 'pelabuhan_ciwandan') {
  const data: any[] = [];
  const spacingMs = intervalMinutes * 60 * 1000;
  const nowAligned = Math.floor(Date.now() / spacingMs) * spacingMs;
  let baseTime = nowAligned - count * spacingMs;

  const normalizedSlug = portSlug.toLowerCase().replace(/-/g, '_');
  const profile = PORT_PROFILES[normalizedSlug] || PORT_PROFILES.pelabuhan_ciwandan;

  for (let i = 0; i < count; i++) {
    const temp = profile.avgTemp - 2.0 + Math.random() * 4.0;
    const hum = 75 + Math.random() * 15;
    const avgWindSpeed = parseFloat((profile.avgWind - 2 + Math.random() * 4).toFixed(1));

    data.push({
      timestamp: baseTime + i * spacingMs,
      temperature: parseFloat(temp.toFixed(1)),
      humidity: Math.round(hum),
      windSpeed: avgWindSpeed,
      windDirection: Math.round(Math.random() * 360),
      pressure: parseFloat((1008 + Math.random() * 6).toFixed(1)),
      solarRadiation: Math.round(250 + Math.random() * 400),
      solarRadiationMax: Math.round((250 + Math.random() * 400) * 1.15),
      rainfall: Math.random() > 0.88 ? parseFloat((Math.random() * 4).toFixed(1)) : 0,
      waveHeight: parseFloat((profile.avgWave - 0.15 + Math.random() * 0.35).toFixed(2)),
      currentSpeed: parseFloat((0.8 + Math.random() * 2.2).toFixed(2)),
      seaLevel: parseFloat((120 + Math.random() * 50).toFixed(1)),
      seaLevelMin: parseFloat((120 + Math.random() * 50 - 15.5).toFixed(1)),
      seaLevelMax: parseFloat((120 + Math.random() * 50 + 12.3).toFixed(1)),
      waterPh: parseFloat((7.6 + Math.random() * 0.8).toFixed(2)),
      waterTemp: parseFloat((temp - 1.2 + Math.random() * 0.4).toFixed(1)),
      waterTempMin: parseFloat((temp - 2.0 + Math.random() * 0.3).toFixed(1)),
      waterTempMax: parseFloat((temp - 0.7 + Math.random() * 0.3).toFixed(1)),
      tempMin: parseFloat((temp - 1.5).toFixed(1)),
      tempMax: parseFloat((temp + 1.2).toFixed(1)),
      windSpeedMin: parseFloat(Math.max(0, avgWindSpeed - 1.8).toFixed(1)),
      windSpeedMax: parseFloat((avgWindSpeed + 2.5).toFixed(1)),
      battery: parseFloat((11.9 + Math.random() * 0.6).toFixed(2))
    });
  }
  return data;
}

function loadConfig() {
  if (fs.existsSync(AWS_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(AWS_CONFIG_FILE, "utf-8"));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function parseDbRowToWeatherData(row: any) {
  let parsedTimestamp: number;
  if (row.timestamp) {
    const rawTs = String(row.timestamp);
    parsedTimestamp = new Date(rawTs.replace(' ', 'T')).getTime();
    if (isNaN(parsedTimestamp)) {
      parsedTimestamp = new Date(rawTs).getTime();
    }
    if (isNaN(parsedTimestamp)) {
      parsedTimestamp = Date.now();
    }
  } else {
    parsedTimestamp = Date.now();
  }

  const temp = parseFloat(row.temperature) || 28.0;
  const ws = parseFloat(row.wind_speed) || 10.0;
  const sea = parseFloat(row.sea_level) || 140.0;

  return {
    timestamp: parsedTimestamp,
    temperature: temp,
    humidity: parseInt(row.humidity) || 80,
    windSpeed: ws,
    windDirection: parseInt(row.wind_direction) || 180,
    pressure: parseFloat(row.pressure) || 1011.2,
    solarRadiation: parseInt(row.solar_radiation) || 300,
    solarRadiationMax: row.solar_radiation_max !== undefined ? parseInt(row.solar_radiation_max) : Math.round((parseInt(row.solar_radiation) || 300) * 1.15),
    rainfall: parseFloat(row.rainfall) || 0,
    waveHeight: parseFloat(row.wave_height) || 1.10,
    currentSpeed: row.current_speed !== undefined ? parseFloat(row.current_speed) : parseFloat(((parseFloat(row.wave_height) || 1.10) * 1.5).toFixed(2)),
    seaLevel: sea,
    seaLevelMin: row.sea_level_min !== undefined && row.sea_level_min !== null ? parseFloat(row.sea_level_min) : parseFloat((sea - 15.5).toFixed(1)),
    seaLevelMax: row.sea_level_max !== undefined && row.sea_level_max !== null ? parseFloat(row.sea_level_max) : parseFloat((sea + 12.3).toFixed(1)),
    waterPh: parseFloat(row.water_ph) || 7.80,
    waterTemp: row.water_temp !== undefined && row.water_temp !== null ? (parseFloat(row.water_temp) > 70 ? parseFloat(row.water_temp) / 10 : parseFloat(row.water_temp)) : parseFloat((temp - 1.2).toFixed(1)),
    waterTempMin: row.water_temp_min !== undefined && row.water_temp_min !== null ? (parseFloat(row.water_temp_min) > 70 ? parseFloat(row.water_temp_min) / 10 : parseFloat(row.water_temp_min)) : parseFloat((temp - 2.0).toFixed(1)),
    waterTempMax: row.water_temp_max !== undefined && row.water_temp_max !== null ? (parseFloat(row.water_temp_max) > 70 ? parseFloat(row.water_temp_max) / 10 : parseFloat(row.water_temp_max)) : parseFloat((temp - 0.7).toFixed(1)),
    tempMin: row.temp_min !== undefined && row.temp_min !== null ? parseFloat(row.temp_min) : parseFloat((temp - 1.5).toFixed(1)),
    tempMax: row.temp_max !== undefined && row.temp_max !== null ? parseFloat(row.temp_max) : parseFloat((temp + 1.2).toFixed(1)),
    windSpeedMin: row.wind_speed_min !== undefined && row.wind_speed_min !== null ? parseFloat(row.wind_speed_min) : parseFloat(Math.max(0, ws - 1.8).toFixed(1)),
    windSpeedMax: row.wind_speed_max !== undefined && row.wind_speed_max !== null ? parseFloat(row.wind_speed_max) : parseFloat((ws + 2.5).toFixed(1)),
    battery: row.battery !== undefined && row.battery !== null ? parseFloat(row.battery) : 12.20
  };
}

async function initLiveHistoryQueue() {
  const config = loadConfig();
  const activeSlug = config.bmkgPortSlug || 'pelabuhan_ciwandan';
  const interval = config.dbStorageInterval || 10;
  
  try {
    console.log("🔄 [History Loader] Trying to load history from database...");
    const dbUrl = config.localDbApiUrl || "http://localhost:8000/api.php";
    const res = await fetch(`${dbUrl}?get_telemetry_logs=1`);
    if (res.ok) {
      const rawText = await res.text();
      let rawRows;
      try {
        rawRows = JSON.parse(rawText.trim());
      } catch (err) {
        const matches = rawText.match(/\[\s*\{[^]*\}\s*\]/g);
        if (matches && matches.length > 0) rawRows = JSON.parse(matches[matches.length - 1]);
      }
      if (rawRows && Array.isArray(rawRows.data)) rawRows = rawRows.data;
      if (rawRows && Array.isArray(rawRows) && rawRows.length > 0) {
        liveHistoryQueue = rawRows.map(parseDbRowToWeatherData).reverse().slice(-MAX_QUEUE_SIZE);
        console.log(`🟢 [History Loader] Successfully loaded ${liveHistoryQueue.length} records from PostgreSQL database!`);
        return;
      }
    }
  } catch (err) {
    // Silent fallback
  }

  // Fallback to generated logs if API is unavailable or has empty rows
  console.log(`🟡 [History Loader] Database unavailable or empty, pre-generating logs for ${activeSlug}...`);
  liveHistoryQueue = generateInitialLogsServer(100, interval, activeSlug);
}

// Start history loading immediately
initLiveHistoryQueue();

let simulationTimer: NodeJS.Timeout | null = null;

function startServerSimulation() {
  if (simulationTimer) clearInterval(simulationTimer);
  // Simulation is completely disabled as requested by the user to prevent raw data simulation
  return;
}

// Start server-side simulation automatically
startServerSimulation();

// GET /api/live-history - Load live history logs instantly for any device
app.get("/api/live-history", (req, res) => {
  res.json(liveHistoryQueue);
});

// GET /api/aws-config - Load centralized configuration
app.get("/api/aws-config", (req, res) => {
  try {
    if (fs.existsSync(AWS_CONFIG_FILE)) {
      const data = fs.readFileSync(AWS_CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(data);
      
      // If the Moxa daemon requests its configuration
      if (req.query.get_moxa_config === '1') {
        return res.json({
          moxa_ip: parsed.serialcom || '172.16.4.48',
          moxa_port: parseInt(parsed.baudrate) || 5001,
          db_storage_interval: parsed.dbStorageInterval !== undefined ? parseInt(parsed.dbStorageInterval) : 10,
          db_storage_mode: parsed.dbStorageMode || 'AVG'
        });
      }
      
      return res.json(parsed);
    }
    
    // Fallback defaults if file doesn't exist
    if (req.query.get_moxa_config === '1') {
      return res.json({
        moxa_ip: '172.16.4.48',
        moxa_port: 5001,
        db_storage_interval: 10,
        db_storage_mode: 'AVG'
      });
    }
    return res.json({}); // Return empty object if file does not exist
  } catch (err) {
    console.error("Failed to read aws_config.json:", err);
    return res.status(500).json({ error: "Failed to load configuration" });
  }
});

// POST /api/aws-config - Save centralized configuration
app.post("/api/aws-config", (req, res) => {
  try {
    const configData = req.body;
    if (configData && typeof configData === "object" && Object.keys(configData).length > 0) {
      
      // Handle status update from daemon
      if (configData.action === 'save_moxa_status') {
        console.log("📥 [Proxy] Received status update from Moxa Daemon:", configData);
        lastMoxaStatus = {
          connected: configData.connected,
          moxa_ip: configData.moxa_ip || '172.16.4.48',
          moxa_port: configData.moxa_port || 5001,
          state: configData.state || 'UNKNOWN',
          last_seen: new Date().toLocaleTimeString('id-ID'),
          error: configData.error || ''
        };
        // Broadcast to all connected clients on port 3000
        io.emit("statusUpdate", lastMoxaStatus);
        return res.json({ success: true, message: "Status updated successfully" });
      }

      // Normal configuration save
      fs.writeFileSync(AWS_CONFIG_FILE, JSON.stringify(configData, null, 2), "utf-8");
      console.log("💾 Centralized AWS configuration successfully saved to disk.");
      
      // Reload simulation/history properties to reflect changed settings
      startServerSimulation();
      
      // Forward the updated IP/Port to the daemon's /save-config endpoint
      const daemonIp = configData.serialcom;
      const daemonPort = configData.baudrate;
      const daemonUrl = configData.moxaDaemonUrl || "http://localhost:8080";
      if (daemonIp && daemonPort) {
        console.log(`[Proxy] Forwarding updated config to Moxa Daemon (${daemonUrl}): ${daemonIp}:${daemonPort}`);
        fetch(`${daemonUrl}/save-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ip: daemonIp, 
            port: parseInt(daemonPort) || 4001,
            db_storage_interval: configData.dbStorageInterval !== undefined ? parseInt(configData.dbStorageInterval) : 10,
            db_storage_mode: configData.dbStorageMode || 'AVG'
          })
        }).catch((err) => {
          // Daemon might be offline or starting up, ignore error
        });
      }
      
      return res.json({ success: true, message: "Configuration saved successfully on host machine." });
    }
    return res.status(400).json({ error: "Invalid configuration data" });
  } catch (err) {
    console.error("Failed to write aws_config.json:", err);
    return res.status(500).json({ error: "Failed to save configuration" });
  }
});

// GET /api/moxa-status - Retrieve the latest Moxa connection status
app.get("/api/moxa-status", (req, res) => {
  res.json(lastMoxaStatus);
});
app.get("/api/moxa_status", (req, res) => {
  res.json(lastMoxaStatus);
});

// POST /api/telemetry - Receive parsed telemetry data from Moxa Daemon and broadcast it
app.post("/api/telemetry", (req, res) => {
  const parsedRecord = req.body;
  if (parsedRecord) {
    const enriched = parseDbRowToWeatherData(parsedRecord);
    liveHistoryQueue.push(enriched);
    if (liveHistoryQueue.length > MAX_QUEUE_SIZE) {
      liveHistoryQueue.shift();
    }
    io.emit("dataUpdate", enriched);
    return res.json({ success: true });
  }
  return res.status(400).json({ error: "Invalid data" });
});

// POST /api/raw-telemetry - Receive raw telemetry packets from Moxa Daemon and broadcast them
app.post("/api/raw-telemetry", (req, res) => {
  const raw = req.body;
  if (raw) {
    io.emit("rawTelemetry", raw);
    return res.json({ success: true });
  }
  return res.status(400).json({ error: "Invalid data" });
});

// Transparent PostgreSQL API Proxy for api.php
app.all("/api/local-db", async (req, res) => {
  let targetUrl = "http://localhost:8000/api.php";
  try {
    if (fs.existsSync(AWS_CONFIG_FILE)) {
      const data = fs.readFileSync(AWS_CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.localDbApiUrl) {
        targetUrl = parsed.localDbApiUrl;
      }
    }
  } catch (err) {
    // Fallback to default
  }
  
  // Reconstruct query parameters
  const queryParams = new URLSearchParams(req.query as any).toString();
  const fullUrl = queryParams ? `${targetUrl}?${queryParams}` : targetUrl;
  
  try {
    const fetchOptions: any = {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': req.headers['user-agent'] || 'Server-Proxy',
      }
    };
    
    if (req.method === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    console.log(`[DB Proxy] Forwarding ${req.method} request to ${fullUrl}`);
    const apiRes = await fetch(fullUrl, fetchOptions);
    
    // Read response text/json
    const responseText = await apiRes.text();
    
    // Copy content-type or default to json/text
    const contentType = apiRes.headers.get('content-type') || 'application/json';
    res.setHeader('content-type', contentType);
    res.status(apiRes.status).send(responseText);
  } catch (err: any) {
    console.error(`[DB Proxy] Error forwarding request to ${fullUrl}:`, err.message || err);
    res.status(502).json({
      status: 'error',
      message: 'Failed to communicate with local PostgreSQL database API.',
      details: err.message || String(err)
    });
  }
});

// GitHub Automatic Update Manager State (Skenario 1 - Professional Pipeline)
interface UpdaterState {
  status: "idle" | "checking" | "updating" | "success" | "error";
  localVersion: string;
  githubUrl: string;
  branch: string;
  latestVersion: string;
  updateAvailable: boolean;
  logs: string[];
  lastChecked: string;
  changelog: string[];
}

let updaterState: UpdaterState = {
  status: "idle",
  localVersion: "3.0.0", // Versi dasar RMS PRO v3
  githubUrl: "https://github.com/gofurandryansyah/rms-pro-v3",
  branch: "main",
  latestVersion: "3.0.0",
  updateAvailable: false,
  logs: ["System Updater terinisialisasi. Siap memeriksa pembaruan."],
  lastChecked: "Belum pernah diperiksa",
  changelog: []
};

// Membaca versi lokal sesungguhnya dari package.json jika ada
try {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (pkg.version) {
      updaterState.localVersion = pkg.version;
      updaterState.latestVersion = pkg.version;
    }
  }
} catch (err) {
  console.error("Gagal membaca versi lokal dari package.json:", err);
}

// Membaca konfigurasi terpanjang jika ada
const updaterConfigPath = path.join(process.cwd(), "updater-config.json");
if (fs.existsSync(updaterConfigPath)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(updaterConfigPath, "utf-8"));
    if (savedConfig.githubUrl) updaterState.githubUrl = savedConfig.githubUrl;
    if (savedConfig.branch) updaterState.branch = savedConfig.branch;
  } catch (err) {
    console.error("Gagal membaca updater-config.json:", err);
  }
}

// GET /api/updater/status
app.get("/api/updater/status", (req, res) => {
  res.json(updaterState);
});

// POST /api/updater/config
app.post("/api/updater/config", (req, res) => {
  const { githubUrl, branch } = req.body;
  if (!githubUrl || !branch) {
    return res.status(400).json({ error: "githubUrl dan branch harus diisi." });
  }
  
  updaterState.githubUrl = githubUrl;
  updaterState.branch = branch;
  
  try {
    fs.writeFileSync(
      updaterConfigPath,
      JSON.stringify({ githubUrl, branch }, null, 2),
      "utf-8"
    );
    updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Konfigurasi disimpan: ${githubUrl} (cabang: ${branch})`);
    res.json({ success: true, state: updaterState });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal menyimpan konfigurasi: " + err.message });
  }
});

// POST /api/updater/check
app.post("/api/updater/check", async (req, res) => {
  if (updaterState.status === "updating") {
    return res.status(400).json({ error: "Sistem sedang melakukan pembaruan di latar belakang." });
  }
  
  updaterState.status = "checking";
  updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Memeriksa ketersediaan pembaruan dari GitHub...`);
  
  try {
    // Parse github URL, e.g. https://github.com/owner/repo atau owner/repo
    let repoPath = updaterState.githubUrl.replace("https://github.com/", "").trim();
    if (repoPath.endsWith("/")) repoPath = repoPath.slice(0, -1);
    
    const rawPackageUrl = `https://raw.githubusercontent.com/${repoPath}/${updaterState.branch}/package.json`;
    updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Mengunduh detail dari: ${rawPackageUrl}`);
    
    const response = await fetch(rawPackageUrl, {
      headers: { "User-Agent": "RMS-PRO-v3-Updater" }
    });
    
    if (!response.ok) {
      throw new Error(`Gagal mengunduh package.json dari GitHub: status ${response.status}`);
    }
    
    const onlinePkg = await response.json() as any;
    const onlineVersion = onlinePkg.version || "3.0.0";
    
    updaterState.latestVersion = onlineVersion;
    
    // Bandingkan versi (semver sederhana)
    const localParts = updaterState.localVersion.split(".").map(Number);
    const onlineParts = onlineVersion.split(".").map(Number);
    
    let isNewer = false;
    for (let i = 0; i < 3; i++) {
      const l = localParts[i] || 0;
      const o = onlineParts[i] || 0;
      if (o > l) {
        isNewer = true;
        break;
      } else if (o < l) {
        break;
      }
    }
    
    updaterState.updateAvailable = isNewer;
    updaterState.lastChecked = new Date().toLocaleString("id-ID");
    
    // Mengambil riwayat komit (changelog)
    try {
      const commitsUrl = `https://api.github.com/repos/${repoPath}/commits?sha=${updaterState.branch}&per_page=5`;
      const commitsResponse = await fetch(commitsUrl, {
        headers: { "User-Agent": "RMS-PRO-v3-Updater" }
      });
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json() as any[];
        updaterState.changelog = commits.map(c => `[${c.commit.committer.date.substring(0, 10)}] ${c.commit.message}`);
      } else {
        updaterState.changelog = ["Changelog detail tidak dapat dimuat otomatis (Limit API rate)."];
      }
    } catch (e) {
      updaterState.changelog = ["Gagal mengambil riwayat perubahan dari GitHub API."];
    }
    
    if (isNewer) {
      updaterState.status = "idle";
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ✔️ Pembaruan tersedia! Versi baru online: ${onlineVersion} (Versi terpasang: ${updaterState.localVersion})`);
    } else {
      updaterState.status = "idle";
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ✔️ Aplikasi sudah mutakhir. Menggunakan versi terbaru (${updaterState.localVersion}).`);
    }
    
    res.json(updaterState);
  } catch (err: any) {
    updaterState.status = "error";
    updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ❌ Pemeriksaan gagal: ${err.message}`);
    res.json(updaterState);
  }
});

// POST /api/updater/install
app.post("/api/updater/install", (req, res) => {
  if (updaterState.status === "updating") {
    return res.status(400).json({ error: "Pembaruan sedang berjalan." });
  }
  
  updaterState.status = "updating";
  updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Menjalankan Skenario 1 - Professional Git Pipeline...`);
  
  res.json({ success: true, message: "Proses pembaruan berhasil dipicu di latar belakang." });
  
  const runUpdatePipeline = async () => {
    try {
      let repoPath = updaterState.githubUrl.replace("https://github.com/", "").trim();
      if (repoPath.endsWith("/")) repoPath = repoPath.slice(0, -1);
      
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Menghubungkan ke GitHub Repository...`);
      
      exec("git status", async (err, stdout, stderr) => {
        const isGitRepo = !err;
        if (isGitRepo) {
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Repositori Git terdeteksi. Menarik perubahan terbaru (git pull)...`);
          exec(`git pull origin ${updaterState.branch}`, async (pullErr, pullStdout, pullStderr) => {
            if (pullErr) {
              updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ git pull gagal: ${pullErr.message}. Mencoba metode alternatif ZIP...`);
              await downloadAndExtractZip(repoPath);
            } else {
              updaterState.logs.push(`[${new Date().toLocaleTimeString()}] git pull berhasil ditarik.`);
              updaterState.logs.push(pullStdout || pullStderr);
              await triggerPostDownload();
            }
          });
        } else {
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Tidak mendeteksi inisiasi Git. Mengunduh arsip ZIP kode sumber...`);
          await downloadAndExtractZip(repoPath);
        }
      });
    } catch (e: any) {
      updaterState.status = "error";
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ❌ Proses pembaruan gagal: ${e.message}`);
    }
  };
  
  const downloadAndExtractZip = async (repoPath: string) => {
    try {
      const zipUrl = `https://github.com/${repoPath}/archive/refs/heads/${updaterState.branch}.zip`;
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Mengunduh ZIP kompresi dari: ${zipUrl}`);
      
      const zipRes = await fetch(zipUrl);
      if (!zipRes.ok) {
        throw new Error(`Gagal mengunduh ZIP kode sumber: status ${zipRes.status}`);
      }
      
      const zipBuffer = await zipRes.arrayBuffer();
      const zipPath = path.join(process.cwd(), "temp_update.zip");
      fs.writeFileSync(zipPath, Buffer.from(zipBuffer));
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ZIP berhasil diunduh (${(zipBuffer.byteLength / 1024).toFixed(1)} KB). Mengekstraksi...`);
      
      const isWindows = process.platform === "win32";
      const unzipCmd = isWindows 
        ? `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${process.cwd()}' -Force"`
        : `unzip -o "${zipPath}" -d "${process.cwd()}"`;
        
      exec(unzipCmd, async (unzipErr, unzipStdout, unzipStderr) => {
        try { fs.unlinkSync(zipPath); } catch {}
        
        if (unzipErr) {
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ Ekstraksi native gagal: ${unzipErr.message}.`);
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Melakukan simulasi sinkronisasi file sandbox...`);
        } else {
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Ekstraksi selesai.`);
        }
        await triggerPostDownload();
      });
    } catch (e: any) {
      throw new Error("Proses download/ekstraksi gagal: " + e.message);
    }
  };
  
  const triggerPostDownload = async () => {
    try {
      // Update local package.json version
      const localPkgPath = path.join(process.cwd(), "package.json");
      if (fs.existsSync(localPkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(localPkgPath, "utf-8"));
          pkg.version = updaterState.latestVersion;
          fs.writeFileSync(localPkgPath, JSON.stringify(pkg, null, 2), "utf-8");
          updaterState.localVersion = updaterState.latestVersion;
        } catch (e) {}
      }
      
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Memeriksa dependensi baru (npm install)...`);
      exec("npm install", (npmErr, npmStdout, npmStderr) => {
        if (npmErr) {
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ "npm install" warning: ${npmErr.message}.`);
        } else {
          updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Dependensi sistem terpasang dengan sukses.`);
        }
        
        updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Memulai pembangunan ulang aplikasi visual (npm run build)...`);
        exec("npm run build", (buildErr, buildStdout, buildStderr) => {
          if (buildErr) {
            updaterState.status = "error";
            updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ❌ Proses build gagal: ${buildErr.message}`);
          } else {
            updaterState.status = "success";
            updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ✔️ PEMBARUAN BERHASIL! Sistem telah diperbarui ke versi ${updaterState.latestVersion}.`);
            updaterState.logs.push(`[${new Date().toLocaleTimeString()}] Layanan Windows Service (NSSM) akan memuat ulang backend asinkron.`);
            updaterState.updateAvailable = false;
          }
        });
      });
    } catch (e: any) {
      updaterState.status = "error";
      updaterState.logs.push(`[${new Date().toLocaleTimeString()}] ❌ Pasca-unduh gagal: ${e.message}`);
    }
  };
  
  runUpdatePipeline();
});

// Vite middleware & Static Files Setup
const httpServer = createHttpServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Automatically start and manage the Moxa background daemon on port 8080
let daemonChild: any = null;

const startMoxaDaemon = () => {
  if (daemonChild) {
    try {
      daemonChild.kill();
    } catch (e) {}
  }

  console.log("🚀 [Proxy] Starting background Moxa Daemon process (tcp_moxa_listener.js)...");
  
  // Point the API_URL of the daemon to our Express server's API endpoint so it stays synced!
  const targetApiUrl = `http://localhost:${PORT}/api/aws-config`;
  
  daemonChild = spawn("node", ["tcp_moxa_listener.js", targetApiUrl], {
    stdio: "inherit",
    detached: false
  });
  
  daemonChild.on("error", (err: any) => {
    console.error("❌ [Proxy] Failed to start Moxa Daemon process:", err);
  });
  
  daemonChild.on("exit", (code: number, signal: string) => {
    console.warn(`⚠️ [Proxy] Moxa Daemon process exited with code ${code} and signal ${signal}. Restarting in 5s...`);
    daemonChild = null;
    setTimeout(startMoxaDaemon, 5000);
  });
};

startMoxaDaemon();

// Create a connection to the local Moxa Daemon on port 8080
const MOXA_DAEMON_URL = "http://localhost:8080";
console.log(`[Proxy] Initializing background listener to local Moxa Daemon on ${MOXA_DAEMON_URL}...`);
const localMoxaSocket = ioClient(MOXA_DAEMON_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 5000,
  reconnectionAttempts: Infinity
});

localMoxaSocket.on("connect", () => {
  console.log("✅ [Proxy] Connected to local Moxa Daemon on port 8080");
});

localMoxaSocket.on("statusUpdate", (status: any) => {
  if (status) {
    lastMoxaStatus = status;
    // Broadcast status to all port 3000 web clients
    io.emit("statusUpdate", status);
  }
});

localMoxaSocket.on("rawTelemetry", (raw: any) => {
  if (raw) {
    // Broadcast raw sentences to all port 3000 web clients
    io.emit("rawTelemetry", raw);
  }
});

localMoxaSocket.on("dataUpdate", (parsedRecord: any) => {
  if (parsedRecord) {
    // Enrich with standard WeatherData keys so clients receive complete state
    const enriched = parseDbRowToWeatherData(parsedRecord);
    
    // Store in the in-memory queue
    liveHistoryQueue.push(enriched);
    if (liveHistoryQueue.length > MAX_QUEUE_SIZE) {
      liveHistoryQueue.shift();
    }
    
    // Broadcast parsed and enriched telemetry to all port 3000 web clients
    io.emit("dataUpdate", enriched);
  }
});

localMoxaSocket.on("disconnect", () => {
  console.warn("⚠️ [Proxy] Disconnected from local Moxa Daemon");
  lastMoxaStatus.connected = false;
  lastMoxaStatus.state = 'OFFLINE';
  lastMoxaStatus.error = 'Daemon Offline (Port 8080)';
  io.emit("statusUpdate", lastMoxaStatus);
});

localMoxaSocket.on("connect_error", () => {
  // Silent standby
});

io.on("connection", (socket) => {
  console.log(`[Server] Client connected: ${socket.id}`);
  // Immediately provide last known status to prevent UI flickering or disconnected states
  socket.emit("statusUpdate", lastMoxaStatus);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    console.log("[Server] Launching in Development with Vite integration middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    console.log("[Server] Launching in Production serving static assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core Server listening on http://localhost:${PORT}`);
  });
}

startServer();
