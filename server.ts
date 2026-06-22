import express from "express";
import path from "path";
import fetch from "node-fetch";
import { createServer as createViteServer } from "vite";

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
  
  // Base parameters based on portSlug
  let avgWave = 0.4;
  let waveKet = "Tenang";
  let avgWind = 9;
  let avgTemp = 29;
  let baseCurrentDir = "Barat Daya";
  let windDir = "Timur Laut";
  
  const cleanSlug = portSlug.toLowerCase();
  
  if (cleanSlug.includes('merak')) {
    avgWave = 0.65;
    waveKet = "Rendah";
    avgWind = 11;
    avgTemp = 29;
    baseCurrentDir = "Selatan";
    windDir = "Timur Laut";
  } else if (cleanSlug.includes('bakauheni')) {
    avgWave = 0.85;
    waveKet = "Sedang";
    avgWind = 13;
    avgTemp = 28;
    baseCurrentDir = "Barat Daya";
    windDir = "Tenggara";
  } else if (cleanSlug.includes('priok') || cleanSlug.includes('jakarta')) {
    avgWave = 0.3;
    waveKet = "Tenang";
    avgWind = 7;
    avgTemp = 31;
    baseCurrentDir = "Barat";
    windDir = "Utara";
  } else if (cleanSlug.includes('sunda-kelapa')) {
    avgWave = 0.2;
    waveKet = "Tenang";
    avgWind = 6;
    avgTemp = 31;
    baseCurrentDir = "Barat Laut";
    windDir = "Utara";
  } else if (cleanSlug.includes('banten') || cleanSlug.includes('karangantu')) {
    avgWave = 0.35;
    waveKet = "Tenang";
    avgWind = 8;
    avgTemp = 29;
    baseCurrentDir = "Utara";
    windDir = "Timur";
  } else {
    // Ciwandan or Custom default
    avgWave = 0.45;
    waveKet = "Tenang";
    avgWind = 9;
    avgTemp = 29;
    baseCurrentDir = "Barat Daya";
    windDir = "Timur Laut";
  }
  
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
  let portSlug = typeof rawPortParam === 'string' ? rawPortParam.trim().toLowerCase() : 'pelabuhan-ciwandan';
  
  // Clean portSlug to prevent path traversal or unsanitized URL building
  portSlug = portSlug.replace(/[^a-z0-9\-]/g, '');
  if (!portSlug) {
    portSlug = 'pelabuhan-ciwandan';
  }

  const cachedValue = cachedBmkPortData[portSlug];

  // If cache is valid, return cached results directly
  if (cachedValue && (now - cachedValue.time < CACHE_TTL_MS)) {
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
    const bmkgUrl = `https://maritim.bmkg.go.id/cuaca/pelabuhan/${portSlug}`;
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

// Vite middleware & Static Files Setup
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core Server listening on http://localhost:${PORT}`);
  });
}

startServer();
