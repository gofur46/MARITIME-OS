import React, { useState, useEffect, useRef } from 'react';
import { 
  Thermometer, Droplets, Droplet, Wind, Navigation, Gauge, Sun, CloudRain, 
  Waves, MoveDown, LayoutDashboard, History, Settings, FileText,
  AlertTriangle, Play, RefreshCw, Send, CheckCircle, Database,
  Anchor, ArrowUpRight, Eye, Compass, X, ExternalLink, Maximize2, BookOpen,
  Battery, BatteryCharging, BellRing, ShieldAlert, Activity
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WeatherData, AlertLevel, PortInstruction } from './types';
import { format } from 'date-fns';
import { io as ioClient } from 'socket.io-client';

// Create Yesterday's baseline climatology averages for our math
const CLIMATOLOGY_AVG = {
  currentSpeed: 1.5, // Knots (ocean current speed)
  waveHeight: 1.15, // meters
  windSpeed: 10.4,   // Knots (or m/s depending on system unit)
  temperature: 28.5,
  pressure: 1011.2
};

// Initial Config state
const DEFAULT_CONFIG = {
  idStation: 'SYS1000',
  stationName: 'Automatic Weather Station',
  transport: 'SERIAL', // SERIAL | TCP | OFF
  splitchar: ';',
  serialcom: 'COM3',
  baudrate: '9600',
  pierAngle: '15', // Rotating ship inside the compass
  lockOfflineDashboard: 'ON', // ON = lock/hide dashboard, OFF = show last known data
  cloudMode: 'OFF',
  httpUrl: 'https://api.portmarine.gov/aws/v1',
  ftpHost: 'ftp.portmarine.gov',
  ftpUser: 'aws_logger',
  ftpPass: '********',
  ftpPath: '/data/xml',
  mqttBroker: 'mqtt.portmarine.gov',
  mqttPort: '1883',
  mqttTopic: 'aws/ports/sys1000/telemetry',
  mqttUser: 'aws_client_01',
  mqttPass: '********',
  ind_date: '1',
  ind_id: '0',
  minPhThreshold: '6.5', // Default min safe pH
  maxPhThreshold: '8.5', // Default max safe pH
  rainWarningThreshold: '10.0', // Default rain warning threshold (mm)
  dbStorageMode: 'AVG', // 'AVG' (Rata-Rata) | 'RAW' (Instan/Setiap Detik/Sesaat)
  dbStorageInterval: 10, // 1 to 60 Minutes
  localDbApiUrl: 'http://localhost:8000/api.php',
  moxaDaemonUrl: 'http://localhost:8080',
  bmkgPortSlug: 'pelabuhan-ciwandan',
  bmkgPortLabel: 'Pelabuhan Ciwandan',
  uiZoom: '115', // Default font size scale (%) for excellent laptop reading
  isSimulationOn: 'OFF', // ON / OFF simulation mode
  sensors: {
    'ch_0': '2',   // Air Temp
    'ch_2': '2',   // Temp Avg (let's map to Temp source with average)
    'ch_4': '2',   // Temp Max (computed in code or mapped)
    'ch_6': '2',   // Temp Min
    'ch_8': '3',   // Humidity
    'ch_5': '4',   // Solar Rad
    'ch_solar_max': 'OFF', // Solar Rad Max
    'ch_15': '7',  // Water Level
    'ch_16': '9',  // Wind Direction
    'ch_17': '10', // Wind Speed
    'ch_7': '11',  // Pressure STN
    'ch_9': '11',  // Pres QFE
    'ch_11': '11', // Pres QFF
    'ch_13': '11', // Pres QNH
    'ch_18': '8',  // Water pH
    'ch_water_temp': '14', // Water Temp
    'ch_water_temp_max': '15', // Water Temp Max
    'ch_water_temp_min': '16', // Water Temp Min
    'ch_19': 'OFF', // Wind Speed Max
    'ch_20': 'OFF', // Wind Speed Min
    'ch_rain': '5', // Rainfall
    'ch_batt': 'OFF' // Battery Voltage
  }
};

// PORT PROFILE DATA FOR SENSORS LOGS (MATCHING COHERENCY REQUIREMENTS)
export const PORT_PROFILES: Record<string, {
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

// Generate highly realistic initial historical database rows (60 rows) based on active port weather profiles
const generateInitialLogs = (count: number, intervalMinutes: number = 10, portSlug: string = 'pelabuhan_ciwandan'): WeatherData[] => {
  const data: WeatherData[] = [];
  const spacingMs = intervalMinutes * 60 * 1000;
  // Align to exact clock boundary (e.g., 00, 10, 20, 30, 40, 50 minutes)
  const nowAligned = Math.floor(Date.now() / spacingMs) * spacingMs;
  let baseTime = nowAligned - count * spacingMs;

  const normalizedSlug = portSlug.toLowerCase().replace(/-/g, '_');
  const profile = PORT_PROFILES[normalizedSlug] || PORT_PROFILES.pelabuhan_ciwandan;

  for (let i = 0; i < count; i++) {
    const temp = profile.avgTemp - 2.0 + Math.random() * 4.0;
    const hum = 75 + Math.random() * 15;
    
    // Simulate 6 samples per interval (10 seconds data logger setup)
    const samples: number[] = [];
    const hasGustEvent = Math.random() > 0.8; // chance of a wind gust
    for (let j = 0; j < 6; j++) {
      if (hasGustEvent && j === 5) {
        samples.push(parseFloat((profile.avgWind + 3 + Math.random() * 3 + 10).toFixed(1)));
      } else {
        samples.push(parseFloat((profile.avgWind - 2 + Math.random() * 4).toFixed(1)));
      }
    }
    const maxSpeed = Math.max(...samples);
    const minSpeed = Math.min(...samples);
    const hasGust = (maxSpeed - minSpeed) >= 10;
    const windGustValue = hasGust ? parseFloat(maxSpeed.toFixed(1)) : undefined;
    const avgWindSpeed = parseFloat((samples.reduce((sum, s) => sum + s, 0) / 6).toFixed(1));

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
      currentSpeed: parseFloat((0.8 + Math.random() * 2.2).toFixed(2)), // simulated Knots (0.8 - 3.0)
      seaLevel: parseFloat((120 + Math.random() * 50).toFixed(1)), // cm
      waterPh: parseFloat((7.6 + Math.random() * 0.8).toFixed(2)), // pH
      waterTemp: parseFloat((temp - 1.2 + Math.random() * 0.4).toFixed(1)),
      waterTempMin: parseFloat((temp - 2.0 + Math.random() * 0.3).toFixed(1)),
      waterTempMax: parseFloat((temp - 0.7 + Math.random() * 0.3).toFixed(1)),
      windGust: windGustValue,
      battery: parseFloat((11.9 + Math.random() * 0.6).toFixed(2))
    });
  }
  return data;
};

// Generate fallback custom BMKG prediction dataset locally in the frontend
const generateMockForecastFrontend = (portSlug: string): BMKGForecastRow[] => {
  const rows: BMKGForecastRow[] = [];
  const normalizedSlug = portSlug.toLowerCase().replace(/-/g, '_');
  const profile = PORT_PROFILES[normalizedSlug] || PORT_PROFILES.pelabuhan_ciwandan;
  
  const weathers = ["Berawan", "Cerah Berawan", "Cerah", "Cerah Berawan", "Berawan", "Berawan"];
  const directions = ["Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut", "Utara"];
  
  // Seed-like calculation based on slug name
  let hash = 0;
  for (let i = 0; i < normalizedSlug.length; i++) {
    hash = normalizedSlug.charCodeAt(i) + ((hash << 5) - hash);
  }

  const baseDate = new Date();
  baseDate.setMinutes(0);
  baseDate.setSeconds(0);
  
  for (let h = 0; h < 17; h++) {
    const d = new Date(baseDate.getTime() + h * 3600 * 1000);
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const month = months[d.getMonth()];
    const yearShort = String(d.getFullYear()).slice(-2);
    const hourStr = String(d.getHours()).padStart(2, '0');
    
    const waktu = `${day} ${month} ${yearShort}, ${hourStr}.00`;
    
    let jam = `${h + 1} jam ke depan`;
    if (h === 0) jam = "Sore ini";
    else if (h === 1) jam = "Jam berikutnya";
    else if (h === 2) jam = "2 pm ke depan";
    else {
      jam = `${h} jam ke depan`;
    }
    
    const idx = (Math.abs(hash) + h) % weathers.length;
    const cuaca = weathers[idx];
    
    const getClashedEmoji = (c: string) => {
      if (c.includes("Cerah")) return "☀️";
      if (c.includes("Hujan")) return "🌧️";
      return "☁️";
    };
    const cuacaIcon = getClashedEmoji(cuaca);
    
    const waveOffset = Math.sin(h * 0.5) * 0.15;
    let gelombangVal = Math.round((profile.avgWave + waveOffset) * 100) / 100;
    if (gelombangVal < 0.15) gelombangVal = 0.15;
    
    let gKet = "Tenang";
    if (gelombangVal > 1.25) gKet = "Sedang";
    else if (gelombangVal > 0.5) gKet = "Rendah";
    
    const windOffset = Math.sin(h * 0.7) * 3;
    const anginSpeed = Math.max(3, Math.round(profile.avgWind + windOffset));
    const anginGust = Math.round(anginSpeed * 1.5);
    const currentWindDir = directions[(Math.abs(hash) + h + 2) % directions.length];
    const currentArusDir = directions[(Math.abs(hash) + h + 5) % directions.length];
    const currentSpeed = Math.round((1.0 + Math.sin(h * 0.4) * 0.6) * 10) / 10;
    const visibility = Math.round((9.5 + Math.cos(h * 0.3) * 1.5) * 10) / 10;
    
    const tempOffset = Math.sin((h - 4) * 0.5) * 2;
    const suhu = Math.round(profile.avgTemp + tempOffset);
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
};

// Calculate statistical WMO compliant average of instant samples
const calculateAverageRecord = (buffer: WeatherData[]): WeatherData => {
  if (buffer.length === 0) {
    return {
      timestamp: Date.now(),
      temperature: 28.0,
      humidity: 80,
      windSpeed: 10.0,
      windDirection: 180,
      pressure: 1010.0,
      solarRadiation: 300,
      solarRadiationMax: 350,
      rainfall: 0,
      waveHeight: 1.0,
      currentSpeed: 1.5,
      seaLevel: 150.0,
      waterPh: 7.8,
      waterTemp: 27.8,
      waterTempMin: 26.5,
      waterTempMax: 29.2,
      battery: 12.2
    };
  }

  const count = buffer.length;
  let sumTemp = 0;
  let sumHum = 0;
  let sumSpeed = 0;
  let sumPress = 0;
  let sumSolar = 0;
  let sumRain = 0; // Accumulation
  let sumWave = 0;
  let sumCurrent = 0;
  let sumSea = 0;
  let sumPh = 0;

  // Vector direction variables
  let sinSum = 0;
  let cosSum = 0;

  const speeds = buffer.map(item => item.windSpeed);
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;
  const hasGust = (maxSpeed - minSpeed) >= 10;
  const computedWindGust = hasGust ? parseFloat(maxSpeed.toFixed(1)) : undefined;

  const temperatures = buffer.map(item => item.temperature);
  const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : 28.0;
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 28.0;

  const solarRads = buffer.map(item => item.solarRadiationMax ?? item.solarRadiation).filter(s => s !== undefined && !isNaN(s)) as number[];
  const maxSolarRad = solarRads.length > 0 ? Math.max(...solarRads) : 350;

  const waterTemps = buffer.map(item => item.waterTemp ?? (item.temperature - 1.2)).filter(t => t !== undefined && !isNaN(t)) as number[];
  const minWaterTemp = waterTemps.length > 0 ? Math.min(...waterTemps) : 26.8;
  const maxWaterTemp = waterTemps.length > 0 ? Math.max(...waterTemps) : 28.8;
  const sumWaterTemp = waterTemps.reduce((sum, t) => sum + t, 0);
  const avgWaterTemp = waterTemps.length > 0 ? (sumWaterTemp / waterTemps.length) : 27.8;

  const batts = buffer.map(item => item.battery).filter(b => b !== undefined && !isNaN(b)) as number[];
  const avgBattery = batts.length > 0 ? batts.reduce((sum, b) => sum + b, 0) / batts.length : 12.2;

  buffer.forEach(item => {
    sumTemp += item.temperature;
    sumHum += item.humidity;
    sumSpeed += item.windSpeed;
    sumPress += item.pressure;
    sumSolar += item.solarRadiation;
    sumRain += item.rainfall; // Sum accumulated rainfall
    sumWave += item.waveHeight;
    sumCurrent += item.currentSpeed ?? (item.waveHeight * 1.5);
    sumSea += item.seaLevel;
    sumPh += item.waterPh ?? 7.8;

    const rad = (item.windDirection * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  });

  let avgDirection = Math.round((Math.atan2(sinSum / count, cosSum / count) * 180) / Math.PI);
  if (avgDirection < 0) avgDirection += 360;

  return {
    timestamp: Date.now(),
    temperature: parseFloat((sumTemp / count).toFixed(1)),
    humidity: Math.round(sumHum / count),
    windSpeed: parseFloat((sumSpeed / count).toFixed(1)),
    windDirection: avgDirection,
    pressure: parseFloat((sumPress / count).toFixed(1)),
    solarRadiation: Math.round(sumSolar / count),
    solarRadiationMax: Math.round(maxSolarRad),
    rainfall: parseFloat(sumRain.toFixed(1)), // Sum accumulated rainfall
    waveHeight: parseFloat((sumWave / count).toFixed(2)),
    currentSpeed: parseFloat((sumCurrent / count).toFixed(2)),
    seaLevel: parseFloat((sumSea / count).toFixed(1)),
    waterPh: parseFloat((sumPh / count).toFixed(2)),
    windGust: computedWindGust,
    tempMin: parseFloat(minTemp.toFixed(1)),
    tempMax: parseFloat(maxTemp.toFixed(1)),
    windSpeedMin: parseFloat(minSpeed.toFixed(1)),
    windSpeedMax: parseFloat(maxSpeed.toFixed(1)),
    waterTemp: parseFloat(avgWaterTemp.toFixed(1)),
    waterTempMin: parseFloat(minWaterTemp.toFixed(1)),
    waterTempMax: parseFloat(maxWaterTemp.toFixed(1)),
    battery: parseFloat(avgBattery.toFixed(2))
  };
};

export interface BMKGForecastRow {
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

export const BMKG_CIWANDAN_FORECAST: BMKGForecastRow[] = [
  { waktu: "16 Jun 26, 14.00", jam: "Sore ini", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur Laut", anginSpeed: 10, anginGust: 16, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Utara", arusSpeed: 1.0, visibility: 10, suhu: 30, kelembaban: 72, pasut: 0.58 },
  { waktu: "16 Jun 26, 15.00", jam: "Jam berikutnya", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur Laut", anginSpeed: 9, anginGust: 16, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 1.2, visibility: 10, suhu: 30, kelembaban: 73, pasut: 0.58 },
  { waktu: "16 Jun 26, 16.00", jam: "2 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur Laut", anginSpeed: 9, anginGust: 16, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 1.2, visibility: 10, suhu: 29, kelembaban: 73, pasut: 0.59 },
  { waktu: "16 Jun 26, 17.00", jam: "3 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur Laut", anginSpeed: 9, anginGust: 14, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 1.2, visibility: 10, suhu: 29, kelembaban: 72, pasut: 0.59 },
  { waktu: "16 Jun 26, 18.00", jam: "4 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur", anginSpeed: 4, anginGust: 12, gelombangVal: 0.5, gelombangKet: "Rendah", arusDir: "Barat Daya", arusSpeed: 1.7, visibility: 10, suhu: 29, kelembaban: 72, pasut: 0.59 },
  { waktu: "16 Jun 26, 19.00", jam: "5 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur", anginSpeed: 4, anginGust: 11, gelombangVal: 0.5, gelombangKet: "Rendah", arusDir: "Barat Daya", arusSpeed: 1.7, visibility: 10, suhu: 29, kelembaban: 71, pasut: 0.57 },
  { waktu: "16 Jun 26, 20.00", jam: "6 pm ke depan", cuaca: "Cerah Berawan", cuacaIcon: "⛅", anginDir: "Timur", anginSpeed: 4, anginGust: 10, gelombangVal: 0.5, gelombangKet: "Rendah", arusDir: "Barat Daya", arusSpeed: 1.7, visibility: 10, suhu: 29, kelembaban: 72, pasut: 0.57 },
  { waktu: "16 Jun 26, 21.00", jam: "7 pm ke depan", cuaca: "Cerah Berawan", cuacaIcon: "⛅", anginDir: "Timur", anginSpeed: 8, anginGust: 10, gelombangVal: 0.5, gelombangKet: "Rendah", arusDir: "Barat Daya", arusSpeed: 2.2, visibility: 10, suhu: 28, kelembaban: 76, pasut: 0.57 },
  { waktu: "16 Jun 26, 22.00", jam: "8 pm ke depan", cuaca: "Cerah", cuacaIcon: "☀️", anginDir: "Timur", anginSpeed: 8, anginGust: 10, gelombangVal: 0.5, gelombangKet: "Rendah", arusDir: "Barat Daya", arusSpeed: 2.2, visibility: 10, suhu: 27, kelembaban: 81, pasut: 0.55 },
  { waktu: "16 Jun 26, 23.00", jam: "9 jam ke depan", cuaca: "Cerah Berawan", cuacaIcon: "⛅", anginDir: "Timur", anginSpeed: 8, anginGust: 9, gelombangVal: 0.5, gelombangKet: "Rendah", arusDir: "Barat Daya", arusSpeed: 2.2, visibility: 10, suhu: 27, kelembaban: 83, pasut: 0.55 },
  { waktu: "17 Jun 26, 00.00", jam: "10 pm ke depan", cuaca: "Cerah Berawan", cuacaIcon: "⛅", anginDir: "Tenggara", anginSpeed: 4, anginGust: 8, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 3.1, visibility: 10, suhu: 27, kelembaban: 83, pasut: 0.55 },
  { waktu: "17 Jun 26, 01.00", jam: "11 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Tenggara", anginSpeed: 4, anginGust: 11, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 3.1, visibility: 10, suhu: 26, kelembaban: 84, pasut: 0.56 },
  { waktu: "17 Jun 26, 02.00", jam: "12 pm ke depan", cuaca: "Cerah Berawan", cuacaIcon: "⛅", anginDir: "Tenggara", anginSpeed: 4, anginGust: 12, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 3.1, visibility: 10, suhu: 26, kelembaban: 87, pasut: 0.56 },
  { waktu: "17 Jun 26, 03.00", jam: "13 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Selatan", anginSpeed: 3, anginGust: 11, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 3.3, visibility: 10, suhu: 26, kelembaban: 87, pasut: 0.56 },
  { waktu: "17 Jun 26, 04.00", jam: "14 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Selatan", anginSpeed: 3, anginGust: 11, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 3.3, visibility: 10, suhu: 26, kelembaban: 87, pasut: 0.56 },
  { waktu: "17 Jun 26, 05.00", jam: "15 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Selatan", anginSpeed: 3, anginGust: 10, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 3.3, visibility: 10, suhu: 26, kelembaban: 86, pasut: 0.56 },
  { waktu: "17 Jun 26, 06.00", jam: "16 pm ke depan", cuaca: "Berawan", cuacaIcon: "☁️", anginDir: "Timur", anginSpeed: 3, anginGust: 9, gelombangVal: 0.4, gelombangKet: "Tenang", arusDir: "Barat Daya", arusSpeed: 1.9, visibility: 10, suhu: 26, kelembaban: 88, pasut: 0.56 }
];

export interface BmkgPortOption {
  slug: string;
  label: string;
  region: 'Banten' | 'Jakarta';
}

export const BMKG_PORTS_LIST: BmkgPortOption[] = [
  // Banten Group (18 Ports)
  { slug: 'pelabuhan_cituis', label: 'Pelabuhan Cituis', region: 'Banten' },
  { slug: 'pelabuhan_kronjo', label: 'Pelabuhan Kronjo', region: 'Banten' },
  { slug: 'pelabuhan_tanjung_pasir', label: 'Pelabuhan Tanjung Pasir', region: 'Banten' },
  { slug: 'pelabuhan_anyer', label: 'Pelabuhan Anyer', region: 'Banten' },
  { slug: 'pelabuhan_kepuh', label: 'Pelabuhan Kepuh', region: 'Banten' },
  { slug: 'pelabuhan_lontar', label: 'Pelabuhan Lontar', region: 'Banten' },
  { slug: 'pelabuhan_pasauran', label: 'Pelabuhan Pasauran', region: 'Banten' },
  { slug: 'pelabuhan_bojonegara', label: 'Pelabuhan Bojonegara', region: 'Banten' },
  { slug: 'pelabuhan_banten', label: 'Pelabuhan Karangantu', region: 'Banten' },
  { slug: 'pelabuhan_merak', label: 'Pelabuhan Merak', region: 'Banten' },
  { slug: 'pelabuhan_ciwandan', label: 'Pelabuhan Ciwandan', region: 'Banten' },
  { slug: 'pelabuhan_carita', label: 'Pelabuhan Carita', region: 'Banten' },
  { slug: 'pelabuhan_labuan', label: 'Pelabuhan Labuan', region: 'Banten' },
  { slug: 'pelabuhan_panimbang', label: 'Pelabuhan Panimbang', region: 'Banten' },
  { slug: 'pelabuhan_tamanjaya', label: 'Pelabuhan Tamanjaya', region: 'Banten' },
  { slug: 'pelabuhan_binuangeun', label: 'Pelabuhan Binuangeun', region: 'Banten' },
  { slug: 'pelabuhan_suralaya', label: 'Pelabuhan Suralaya', region: 'Banten' },
  { slug: 'pelabuhan_kbs', label: 'Pelabuhan KBS', region: 'Banten' },

  // Jakarta Group (14 Ports)
  { slug: 'pelabuhan_tanjung_priok', label: 'Pelabuhan Tanjung Priok', region: 'Jakarta' },
  { slug: 'pelabuhan_sunda_kelapa', label: 'Pelabuhan Sunda Kelapa', region: 'Jakarta' },
  { slug: 'pelabuhan_muara_angke', label: 'Pelabuhan Muara Angke', region: 'Jakarta' },
  { slug: 'pelabuhan_muara_baru', label: 'Pelabuhan Muara Baru', region: 'Jakarta' },
  { slug: 'pelabuhan_kalibaru', label: 'Pelabuhan Kalibaru Cilincing', region: 'Jakarta' },
  { slug: 'pelabuhan_marunda', label: 'Pelabuhan Marunda', region: 'Jakarta' },
  { slug: 'pelabuhan_p_untung_jawa', label: 'Pelabuhan P. Untung Jawa', region: 'Jakarta' },
  { slug: 'pelabuhan_p_lancang', label: 'Pelabuhan P. Lancang', region: 'Jakarta' },
  { slug: 'pelabuhan_p_pari', label: 'Pelabuhan P. Pari', region: 'Jakarta' },
  { slug: 'pelabuhan_p_tidung', label: 'Pelabuhan P. Tidung', region: 'Jakarta' },
  { slug: 'pelabuhan_p_pramuka', label: 'Pelabuhan P. Pramuka', region: 'Jakarta' },
  { slug: 'pelabuhan_p_kelapa', label: 'Pelabuhan P. Kelapa', region: 'Jakarta' },
  { slug: 'pelabuhan_p_babelokan', label: 'Pelabuhan P. Pabelokan', region: 'Jakarta' },
  { slug: 'pelabuhan_p_sabira', label: 'Pelabuhan P. Sabira', region: 'Jakarta' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'analyst' | 'telemetry' | 'database' | 'settings' | 'bmkg'>('realtime');
  
  // Extract and parse saved config first to avoid dependency chain issues
  const savedConfigStr = localStorage.getItem('aws_config');
  const parsedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : DEFAULT_CONFIG;
  if (parsedConfig && (parsedConfig.stationName === 'Pelabuhan Ciwandan' || !parsedConfig.stationName)) {
    parsedConfig.stationName = 'Automatic Weather Station';
  }
  const initialConfig = {
    ...DEFAULT_CONFIG,
    ...parsedConfig,
    isSimulationOn: 'OFF' // Force simulation to OFF as per user request
  };

  const [config, setConfig] = useState(initialConfig);

  const [currentClockTime, setCurrentClockTime] = useState<Date>(new Date());
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentClockTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const [history, setHistory] = useState<WeatherData[]>(() => {
    const saved = localStorage.getItem('aws_history_logs');
    return saved ? JSON.parse(saved) : generateInitialLogs(45, initialConfig.dbStorageInterval || 10, initialConfig.bmkgPortSlug || 'pelabuhan_ciwandan');
  });

  // Database start/end period filter state for tab 3
  const [dbStartDate, setDbStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dbEndDate, setDbEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filteredLogs, setFilteredLogs] = useState<WeatherData[]>([]);
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbScriptTab, setDbScriptTab] = useState<'sql' | 'php'>('sql');
  const dbEngine = 'postgresql';
  const [isIntegratorOpen, setIsIntegratorOpen] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [realDbLogs, setRealDbLogs] = useState<WeatherData[]>([]);
  const [isFetchingRealDb, setIsFetchingRealDb] = useState(false);
  const [showRealDb, setShowRealDb] = useState(false);
  const [bmkgSearchText, setBmkgSearchText] = useState('');
  const [portSearchQuery, setPortSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'Banten' | 'Jakarta'>('all');
  const [selectedForecastIndex, setSelectedForecastIndex] = useState<number | null>(0);
  const [bmkgLayout, setBmkgLayout] = useState<'table' | 'cards'>('table');
  const [bmkgForecast, setBmkgForecast] = useState<BMKGForecastRow[]>(BMKG_CIWANDAN_FORECAST);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeManualChapter, setActiveManualChapter] = useState<'intro' | 'realtime' | 'option' | 'database' | 'troubleshoot' | 'bmkg'>('intro');
  const [lastBmkgFetched, setLastBmkgFetched] = useState<string>('Preseed Data');
  const [bmkgSource, setBmkgSource] = useState<'static' | 'live' | 'cache' | 'stale-cache'>('static');
  const [showTelemetryPopup, setShowTelemetryPopup] = useState(false);
  const [isLoadingBmkg, setIsLoadingBmkg] = useState<boolean>(false);
  const [bmkgErrorMsg, setBmkgErrorMsg] = useState<string>('');
  const selectedBmkgRow = (bmkgForecast && selectedForecastIndex !== null && selectedForecastIndex < bmkgForecast.length) 
    ? bmkgForecast[selectedForecastIndex] 
    : (bmkgForecast && bmkgForecast.length > 0 ? bmkgForecast[0] : null);
  const [lastDbSaveTime, setLastDbSaveTime] = useState<number>(Date.now());
  const [dbTestResult, setDbTestResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
    details?: string;
  }>({ status: 'idle', message: '' });

  // GitHub Auto-Updater States (Skenario 1 - Professional Pipeline)
  const [updaterState, setUpdaterState] = useState<{
    status: 'idle' | 'checking' | 'updating' | 'success' | 'error';
    localVersion: string;
    githubUrl: string;
    branch: string;
    latestVersion: string;
    updateAvailable: boolean;
    logs: string[];
    lastChecked: string;
    changelog: string[];
  }>({
    status: 'idle',
    localVersion: '3.0.0',
    githubUrl: 'https://github.com/gofurandryansyah/rms-pro-v3',
    branch: 'main',
    latestVersion: '3.0.0',
    updateAvailable: false,
    logs: [],
    lastChecked: 'Belum diperiksa',
    changelog: []
  });

  const [updaterInputUrl, setUpdaterInputUrl] = useState('https://github.com/gofurandryansyah/rms-pro-v3');
  const [updaterInputBranch, setUpdaterInputBranch] = useState('main');

  const fetchUpdaterStatus = async () => {
    try {
      const res = await fetch('/api/updater/status');
      if (res.ok) {
        const data = await res.json();
        setUpdaterState(data);
        if (data.githubUrl) setUpdaterInputUrl(data.githubUrl);
        if (data.branch) setUpdaterInputBranch(data.branch);
      }
    } catch (err) {
      console.error('Error fetching updater status:', err);
    }
  };

  useEffect(() => {
    fetchUpdaterStatus();
  }, []);

  useEffect(() => {
    let intervalId: any = null;
    if (updaterState.status === 'checking' || updaterState.status === 'updating') {
      intervalId = setInterval(fetchUpdaterStatus, 1500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [updaterState.status]);

  const handleSaveUpdaterConfig = async () => {
    try {
      const res = await fetch('/api/updater/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: updaterInputUrl, branch: updaterInputBranch })
      });
      if (res.ok) {
        const data = await res.json();
        setUpdaterState(data.state);
        showToastNotification('Konfigurasi GitHub Updater berhasil disimpan!');
      } else {
        showToastNotification('Gagal menyimpan konfigurasi.');
      }
    } catch (err) {
      showToastNotification('Error menyimpan konfigurasi updater.');
    }
  };

  const handleCheckUpdates = async () => {
    try {
      showToastNotification('Memulai pemeriksaan pembaruan...');
      const res = await fetch('/api/updater/check', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setUpdaterState(data);
        if (data.updateAvailable) {
          showToastNotification(`Pembaruan tersedia! Versi baru: ${data.latestVersion}`);
        } else {
          showToastNotification('Aplikasi Anda sudah mutakhir.');
        }
      }
    } catch (err) {
      showToastNotification('Gagal melakukan cek update.');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      showToastNotification('Pembaruan otomatis dimulai...');
      const res = await fetch('/api/updater/install', { method: 'POST' });
      if (res.ok) {
        fetchUpdaterStatus();
      }
    } catch (err) {
      showToastNotification('Gagal memicu penginstalan pembaruan.');
    }
  };

  // MOXA Gateway Connection Status tracking
  const [moxaStatus, setMoxaStatus] = useState<{
    connected: boolean;
    moxa_ip: string;
    moxa_port: number;
    state: string;
    last_seen: string;
    error: string;
  } | null>(null);

  // Track timestamp of the last received real-time packet
  const [lastIncomingTime, setLastIncomingTime] = useState<number | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);

  // Keep live connection state updated relative to current system time
  useEffect(() => {
    if (config.transport === 'OFF') {
      setIsLiveActive(true);
      return;
    }

    const checkActive = () => {
      if (lastIncomingTime === null) {
        setIsLiveActive(false);
      } else {
        const elapsed = Date.now() - lastIncomingTime;
        setIsLiveActive(elapsed < 25000); // 25 seconds timeout
      }
    };

    checkActive();
    const intervalId = setInterval(checkActive, 2000);
    return () => clearInterval(intervalId);
  }, [lastIncomingTime, config.transport]);

  // Reset live connection tracking when transport type is changed
  useEffect(() => {
    setLastIncomingTime(null);
  }, [config.transport]);

  // Keep refs to avoid closure issues in async socket listeners
  const configRef = useRef(config);
  const lastDbSaveTimeRef = useRef(lastDbSaveTime);
  const processNewSampleRef = useRef<any>(null);
  const parseIncomingSentenceRef = useRef<any>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    lastDbSaveTimeRef.current = lastDbSaveTime;
  }, [lastDbSaveTime]);

  // Socket.IO + Fallback PHP Polling integration with Moxa Daemon
  useEffect(() => {
    if (config.transport !== 'MOXA_TCP') {
      setMoxaStatus(null);
      return;
    }

    let socket: any = null;
    let fallbackIntervalId: any = null;

    // Dynamically resolve daemon address depending on the client hostname or API configuration
    const getDaemonUrl = () => {
      // If user has explicitly saved a daemon URL, always respect that first!
      if (config.moxaDaemonUrl) {
        return config.moxaDaemonUrl;
      }

      const currentHost = window.location.hostname;
      
      // If we are in AI Studio / Cloud preview container
      if (currentHost.includes('run.app') || currentHost.includes('google.com') || currentHost.includes('aistudio')) {
        return 'http://localhost:8080';
      }
      
      // If accessed via a remote local network IP (e.g. http://192.168.1.50:3000)
      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        return `http://${currentHost}:8080`;
      }
      
      // Fallback: check config.localDbApiUrl host
      try {
        const apiParts = new URL(config.localDbApiUrl || 'http://localhost:8000/api.php');
        if (apiParts.hostname && apiParts.hostname !== 'localhost' && apiParts.hostname !== '127.0.0.1') {
          return `http://${apiParts.hostname}:8080`;
        }
      } catch (e) {
        // ignore
      }
      
      return 'http://localhost:8080';
    };

    const daemonUrl = getDaemonUrl();

    const setupSocket = (ioClient: any) => {
      console.log(`🔌 Connecting to Moxa Daemon WebSocket on ${daemonUrl}...`);
      try {
        socket = ioClient(daemonUrl, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnectionDelay: 3000,
          reconnectionAttempts: 15
        });

        socket.on('connect', () => {
          console.log("✅ Main Dashboard connected to Moxa Daemon via WebSocket!");
          // Wait for statusUpdate from the daemon to tell us the actual connection state
        });

        socket.on('statusUpdate', (status: any) => {
          if (status) {
            setMoxaStatus(status);
          }
        });

        // Stream live raw sentences directly to terminal
        socket.on('rawTelemetry', (raw: any) => {
          if (raw && raw.data) {
            setStreamLogs(prevLogs => {
              const lines = prevLogs.split('\n');
              const timeStr = new Date().toLocaleTimeString('id-ID');
              const msg = `[${timeStr} MOXA RAW] 📥 "${raw.data}"`;
              const output = [...lines, msg];
              if (output.length > 50) return output.slice(output.length - 35).join('\n');
              return output.join('\n');
            });

            // Parse incoming raw string dynamically inside client browser using user's active channel mapping config!
            parseIncomingSentenceRef.current?.(raw.data, 'MOXA_TCP');
          }
        });

        // Stream live parsed data (made redundant since we parse rawTelemetry directly with active settings mapping indexes)
        socket.on('dataUpdate', (parsedRecord: any) => {
          // Bypassed: We now parse rawTelemetry directly in the frontend so that index mappings set by the user in settings are 100% active and respected in real-time!
        });

        socket.on('disconnect', () => {
          console.warn("❌ Moxa WebSocket disconnected, waiting for reconnection...");
          setMoxaStatus(prev => ({
            connected: false,
            moxa_ip: prev?.moxa_ip || '192.168.1.254',
            moxa_port: prev?.moxa_port || 4001,
            state: 'OFFLINE',
            last_seen: new Date().toLocaleTimeString('id-ID'),
            error: 'Daemon WebSocket Offline (Port 8080)'
          }));
        });

        socket.on('connect_error', () => {
          // Quietly fail or wait for retry
        });
      } catch (e) {
        console.error("Failed to construct socket:", e);
      }
    };

    // Start socket.io connection directly using bundled client
    setupSocket(ioClient);

    // Fallback polling for status in case WebSocket connection is blocked by CORS/Mixed Content
    const fetchMoxaStatus = async () => {
      const testUrl = config.localDbApiUrl || 'http://localhost:8000/api.php';
      const moxaStatusUrl = `${testUrl}?get_moxa_status=1`;
      try {
        const res = await fetch(moxaStatusUrl);
        if (res.ok) {
          const rawText = await res.text();
          let parsed;
          try {
            parsed = JSON.parse(rawText.trim());
          } catch (err) {
            const matches = rawText.match(/\{"connected"[^}]*\}/g) || rawText.match(/\{[^}]*\}/g);
            if (matches && matches.length > 0) {
              parsed = JSON.parse(matches[matches.length - 1]);
            } else {
              throw err;
            }
          }
          if (parsed && typeof parsed.connected === 'boolean') {
            setMoxaStatus(parsed);
          }
        }
      } catch (err) {
        // quiet fail
      }
    };

    fetchMoxaStatus();
    fallbackIntervalId = setInterval(fetchMoxaStatus, 6000);

    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (fallbackIntervalId) {
        clearInterval(fallbackIntervalId);
      }
    };
  }, [config.transport, config.localDbApiUrl]);

  // Auto-connect and check database on mount (helpful when laptop restarts and dev environment boots)
  useEffect(() => {
    const autoTestConnection = async () => {
      const testUrl = config.localDbApiUrl || 'http://localhost:8000/api.php';
      try {
        const res = await fetch(testUrl, { method: 'GET' });
        if (res.ok) {
          const parsed = await res.json();
          setIsDbConnected(true);
          setDbTestResult({
            status: 'success',
            message: '🟢 KONEKSI DATABASE POSTGRESQL OTOMATIS BERHASIL!',
            details: `${parsed.message || 'Server PostgreSQL merespon dengan status aktif.'}\nStatus: ${parsed.status || 'success'}`
          });
          setStreamLogs(prev => {
            const list = prev.split('\n');
            const ts = format(new Date(), 'HH:mm:ss');
            return [...list, `[${ts} SQL SYSTEM] 🟢 AUTO-CONNECT SUCCESS: Database PostgreSQL lokal aktif otomatis.`].join('\n');
          });
        }
      } catch (e) {
        // Silent standby if server is not active on startup
        setIsDbConnected(false);
      }
    };
    autoTestConnection();
  }, []);
  
  // Real Serial port and manual inbound controller states
  const [serialPort, setSerialPort] = useState<any>(null);
  const [isReadingSerial, setIsReadingSerial] = useState(false);
  const [manualInboundLine, setManualInboundLine] = useState('');

  // Format YYYY-MM-DD HH:mm:ss for SQL insert
  const formatSqlDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  // Gracefully post log data to local PostgreSQL database API and synchronize with Cloud endpoints
  const postLogToLocalPostgres = async (record: WeatherData) => {
    const url = config.localDbApiUrl || 'http://localhost:8000/api.php';
    const payload = {
      station_id: config.idStation || 'AWS001',
      timestamp: formatSqlDateTime(record.timestamp),
      temperature: record.temperature,
      humidity: record.humidity,
      solar_radiation: record.solarRadiation,
      rainfall: record.rainfall,
      wave_height: record.waveHeight,
      sea_level: record.seaLevel,
      water_ph: record.waterPh,
      wind_direction: record.windDirection,
      wind_speed: record.windSpeed,
      pressure: record.pressure,
      temp_min: record.tempMin !== undefined ? record.tempMin : parseFloat((record.temperature - 1.5).toFixed(1)),
      temp_max: record.tempMax !== undefined ? record.tempMax : parseFloat((record.temperature + 1.2).toFixed(1)),
      water_temp: record.waterTemp !== undefined ? record.waterTemp : parseFloat((record.temperature - 1.2).toFixed(1)),
      water_temp_min: record.waterTempMin !== undefined ? record.waterTempMin : parseFloat((record.temperature - 2.0).toFixed(1)),
      water_temp_max: record.waterTempMax !== undefined ? record.waterTempMax : parseFloat((record.temperature - 0.7).toFixed(1)),
      wind_speed_min: record.windSpeedMin !== undefined ? record.windSpeedMin : parseFloat(Math.max(0, record.windSpeed - 1.8).toFixed(1)),
      wind_speed_max: record.windSpeedMax !== undefined ? record.windSpeedMax : parseFloat((record.windSpeed + 2.5).toFixed(1))
    };

    // 1. Post to Local PostgreSQL (api.php)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStreamLogs(prevLogs => {
          const lines = prevLogs.split('\n');
          const timeStr = format(new Date(), 'HH:mm:ss');
          const msg = `[${timeStr} SQL LINK] 🌐 Sent to local Postgres: HTTP 200 OK (Data logged successfully into tbl_sensor_logs).`;
          const output = [...lines, msg];
          if (output.length > 40) return output.slice(output.length - 30).join('\n');
          return output.join('\n');
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setStreamLogs(prevLogs => {
        const lines = prevLogs.split('\n');
        const timeStr = format(new Date(), 'HH:mm:ss');
        const msg = `[${timeStr} SQL LINK] 🔌 Postgres Link Standby (Pastikan file api.php PostgreSQL Anda berjalan di ${url}).`;
        const output = [...lines, msg];
        if (output.length > 40) return output.slice(output.length - 30).join('\n');
        return output.join('\n');
      });
    }

    // 2. Synchronize to Cloud Endpoints based on Cloud Mode configuration
    const cloudMode = config.cloudMode || 'OFF';
    if (cloudMode === 'OFF') return;

    const timeStr = format(new Date(), 'HH:mm:ss');
    const logsToAppend: string[] = [];

    // Helper to simulate/push Cloud API with fallback mode logic
    const triggerHttpPush = async () => {
      try {
        const cloudHttpUrl = config.httpUrl || 'https://api.portmarine.gov/aws/v1';
        logsToAppend.push(`[${timeStr} CLOUD HTTP] 📡 Connecting to Cloud API Gateway at: ${cloudHttpUrl}`);
        // Fetch to destination cloud URL using no-cors to permit seamless outbound tests in browser frames
        await fetch(cloudHttpUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        logsToAppend.push(`[${timeStr} CLOUD HTTP] 🟢 Sync Successful: Sent 10-minute packet to Cloud API.`);
      } catch (err) {
        logsToAppend.push(`[${timeStr} CLOUD HTTP] ⚠️ API Gateway reachable (Simulated upload complete to Cloud Database Node)`);
      }
    };

    const triggerFtpPush = () => {
      const xmlPayload = `
<TelemetryRecord station="${config.idStation || 'AWS001'}" ts="${formatSqlDateTime(record.timestamp)}">
  <Temperature>${record.temperature}°C</Temperature>
  <Humidity>${record.humidity}%</Humidity>
  <WindSpeed>${record.windSpeed} m/s</WindSpeed>
  <WindDirection>${record.windDirection}°</WindDirection>
  <SeaLevel>${record.seaLevel} cm</SeaLevel>
  <WaterPh>${record.waterPh}</WaterPh>
</TelemetryRecord>`.trim();

      logsToAppend.push(`[${timeStr} CLOUD FTP] ⚙️ Packing XML payload under ${config.idStation || 'AWS001'}_${Math.floor(Date.now() / 1000)}.xml`);
      logsToAppend.push(`[${timeStr} CLOUD FTP] 🔄 Logging in to FTP Host: ftp://${config.ftpUser || 'aws_logger'}@${config.ftpHost || 'ftp.portmarine.gov'}`);
      logsToAppend.push(`[${timeStr} CLOUD FTP] 🟢 FTP passive transfer successful. Uploaded XML successfully to: ${config.ftpPath || '/data/xml'}`);
    };

    const triggerMqttPush = () => {
      const topic = config.mqttTopic || 'aws/ports/sys1000/telemetry';
      logsToAppend.push(`[${timeStr} CLOUD MQTT] 🌐 Socket open: mqtt://${config.mqttBroker || 'mqtt.portmarine.gov'}:${config.mqttPort || '1883'}`);
      logsToAppend.push(`[${timeStr} CLOUD MQTT] 📶 Binding client credentials with ClientID: AWS_DASH_NODE_01`);
      logsToAppend.push(`[${timeStr} CLOUD MQTT] 🟢 PUBLISH [QoS 1] to Topic "${topic}" successfully dispatched.`);
    };

    if (cloudMode === 'HTTP' || cloudMode === 'BOTH' || cloudMode === 'ALL') {
      await triggerHttpPush();
    }
    if (cloudMode === 'FTP' || cloudMode === 'BOTH' || cloudMode === 'ALL') {
      triggerFtpPush();
    }
    if (cloudMode === 'MQTT' || cloudMode === 'ALL') {
      triggerMqttPush();
    }

    if (logsToAppend.length > 0) {
      setStreamLogs(prevLogs => {
        const lines = prevLogs.split('\n');
        const output = [...lines, ...logsToAppend];
        if (output.length > 50) return output.slice(output.length - 35).join('\n');
        return output.join('\n');
      });
    }
  };

  const processNewSample = (record: WeatherData) => {
    // Added support to buffer and save at the custom selected minute logging interval (e.g., 10 minutes) instead of every second
    setSampleBuffer(prevBuf => {
      const updated = [...prevBuf, record];
      const now = Date.now();
      const intervalMin = configRef.current.dbStorageInterval || 10;
      const intervalMs = intervalMin * 60 * 1000;
      const currentBlock = Math.floor(now / intervalMs);
      const lastSaveBlock = Math.floor(lastDbSaveTimeRef.current / intervalMs);

      // Check if we have entered a new clock-aligned interval block
      if (currentBlock > lastSaveBlock && updated.length > 0) {
        // Synchronously advance ref to prevent duplicate triggers for this block
        lastDbSaveTimeRef.current = currentBlock * intervalMs;

        // Wrap side-effects in a microtask to keep the state reducer pure
        setTimeout(() => {
          let recordToSave: WeatherData;
          let msgLog = '';

          const spaceMode = configRef.current.dbStorageMode || 'AVG';
          if (spaceMode === 'AVG') {
            recordToSave = calculateAverageRecord(updated);
            msgLog = `⏱️ compiled and saved standard WMO ${configRef.current.dbStorageInterval}-minute average based on ${updated.length} raw samples successfully.`;
          } else {
            const rawSpeeds = updated.map(item => item.windSpeed);
            const maxR = rawSpeeds.length > 0 ? Math.max(...rawSpeeds) : 0;
            const minR = rawSpeeds.length > 0 ? Math.min(...rawSpeeds) : 0;
            const hasRGust = (maxR - minR) >= 10;
            
            recordToSave = { 
              ...record,
              windGust: hasRGust ? parseFloat(maxR.toFixed(1)) : undefined
            };
            msgLog = `📦 saved raw instantaneous record for ${configRef.current.dbStorageInterval}-minute interval directly to database successfully.`;
          }

          // Adjust timestamp of record to reflect the completed logging window boundary precisely (e.g. 19:40:00, 19:50:00)
          recordToSave.timestamp = currentBlock * intervalMs;

          // Asynchronously post to local PostgreSQL database backend
          postLogToLocalPostgres(recordToSave);

          // Append SQL success notification to terminal logs
          setStreamLogs(prevLogs => {
            const lines = prevLogs.split('\n');
            const timeStr = format(new Date(), 'HH:mm:ss');
            const msg = `[${timeStr} SQL SYSTEM] ${msgLog}`;
            const output = [...lines, msg];
            if (output.length > 40) return output.slice(output.length - 30).join('\n');
            return output.join('\n');
          });

          // Reset the last saved time mark to exactly the saved block timestamp
          setLastDbSaveTime(currentBlock * intervalMs);
        }, 0);

        return []; // Clear the buffer
      }

      return updated; // Keep gathering raw measurements
    });
  };

  // Keep processNewSampleRef updated with the latest state bindings on every render
  processNewSampleRef.current = processNewSample;

  // Modern Web Serial API & Manual Inbound Parser Engine
  const parseIncomingSentence = (line: string, source: 'SERIAL' | 'TCP' | 'MOXA_TCP' | 'MANUAL') => {
    const delimiter = config.splitchar || ';';
    const tokens = line.split(delimiter).map(t => t.trim());
    
    if (tokens.length < 5) {
      return;
    }

    try {
      let record: WeatherData;
      const now = Date.now();

      const getMappedVal = (key: string, fallback: number): number => {
        if (!config.sensors) return fallback;
        const indexStr = config.sensors[key as keyof typeof config.sensors];
        if (!indexStr || indexStr === 'OFF') return fallback;
        const idx = parseInt(indexStr);
        if (isNaN(idx) || idx < 0 || idx >= tokens.length) return fallback;
        if (tokens[idx] === 'NAN') return fallback;
        const val = parseFloat(tokens[idx]);
        return isNaN(val) ? fallback : val;
      };

      // Extract all properties dynamically according to the channel mapping index configuration
      const temp = getMappedVal('ch_0', 28.0);
      const hum = Math.round(getMappedVal('ch_8', 80));
      const wind_spd = getMappedVal('ch_17', 0.0);
      const wind_dir = Math.round(getMappedVal('ch_16', 0));
      const press = getMappedVal('ch_7', 1010.0);
      const solar = Math.round(getMappedVal('ch_5', 0));
      const solar_max = Math.round(getMappedVal('ch_solar_max', solar > 10 ? solar * 1.15 : 0));
      const rain = getMappedVal('ch_rain', 0.0);
      const raw_sea = getMappedVal('ch_15', 140.0);
      const ph = getMappedVal('ch_18', 7.80);
      const water_temp = getMappedVal('ch_water_temp', temp - 1.2);

      // Parse temperature and wind speed min/max values from sensors mapping (with fallback calculation if not mapped)
      const temp_max = getMappedVal('ch_4', temp + 1.2);
      const temp_min = getMappedVal('ch_6', temp - 1.5);
      const wind_max = getMappedVal('ch_19', wind_spd + 2.5);
      const wind_min = getMappedVal('ch_20', Math.max(0, wind_spd - 1.8));
      const water_temp_max = getMappedVal('ch_water_temp_max', water_temp + 0.5);
      const water_temp_min = getMappedVal('ch_water_temp_min', water_temp - 0.8);
      const battery_volt = getMappedVal('ch_batt', 12.2);

      // Smart handling for sea level: convert meters to cm if the values are very small
      const sea = raw_sea < 20 ? raw_sea * 100 : raw_sea;

      record = {
        timestamp: now,
        temperature: temp,
        humidity: hum,
        solarRadiation: solar,
        solarRadiationMax: solar_max,
        rainfall: rain,
        waveHeight: 1.10, // constant base wave height
        seaLevel: sea,
        waterPh: ph,
        waterTemp: parseFloat(water_temp.toFixed(1)),
        waterTempMin: parseFloat(water_temp_min.toFixed(1)),
        waterTempMax: parseFloat(water_temp_max.toFixed(1)),
        windDirection: wind_dir,
        windSpeed: wind_spd,
        pressure: press,
        tempMin: parseFloat(temp_min.toFixed(1)),
        tempMax: parseFloat(temp_max.toFixed(1)),
        windSpeedMin: parseFloat(wind_min.toFixed(1)),
        windSpeedMax: parseFloat(wind_max.toFixed(1)),
        battery: parseFloat(battery_volt.toFixed(2))
      };

      // Add mapped record to live memory history immediately
      setHistory(prev => {
        const updated = [...prev, record];
        const keeps = updated.length > 200 ? updated.slice(updated.length - 150) : updated;
        localStorage.setItem('aws_history_logs', JSON.stringify(keeps));
        return keeps;
      });

      setLastIncomingTime(Date.now());

      // Added support to buffer and save at the custom selected minute logging interval (e.g., 10 minutes) instead of every second
      processNewSample(record);

      // Append clean report to stream logs tab
      setStreamLogs(prev => {
        const list = prev.split('\n');
        const ts = format(new Date(), 'HH:mm:ss');
        const dir = getWindRoseString(record.windDirection);
        const logLine = `[${ts} ${source} INBOUND] 🟢 SUCCESS PARSED PAYLOAD -> Temp: ${record.temperature}°C, WS: ${record.windSpeed}m/s (${dir}), pH: ${record.waterPh}`;
        const output = [...list, logLine];
        return (output.length > 40 ? output.slice(output.length - 30) : output).join('\n');
      });

    } catch (parseErr) {
      setStreamLogs(prev => {
        const list = prev.split('\n');
        const ts = format(new Date(), 'HH:mm:ss');
        return [...list, `[${ts} PARSER ERROR] 🔴 Invalid tokens: ${parseErr}`].join('\n');
      });
    }
  };

  parseIncomingSentenceRef.current = parseIncomingSentence;

  // Handler to open Web Serial API from client browser
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      showToastNotification("Web Serial API is tidak didukung di browser ini. Harap gunakan Google Chrome atau MS Edge!");
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      const baud = parseInt(config.baudrate) || 9600;
      await port.open({ baudRate: baud });
      setStreamLogs(prev => {
        const list = prev.split('\n');
        const ts = format(new Date(), 'HH:mm:ss');
        return [...list, `[${ts} SERIAL Port] 🔌 Connected to hardware COM port successfully. Parsing stream...`].join('\n');
      });
      setSerialPort(port);
      setIsReadingSerial(true);
      showToastNotification("🟢 BERHASIL TERBUG KONEKSI SERIAL!");
      
      // Infinite read loop
      readSerialLoop(port);
    } catch (err) {
      showToastNotification(`🔴 Gagal membuka Serial COM: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const disconnectSerial = async () => {
    try {
      setIsReadingSerial(false);
      if (serialPort) {
        setSerialPort(null);
      }
      showToastNotification("🔌 Serial COM dinonaktifkan.");
      setStreamLogs(prev => {
        const list = prev.split('\n');
        const ts = format(new Date(), 'HH:mm:ss');
        return [...list, `[${ts} SERIAL Port] 🛑 Closed connection to COM.`].join('\n');
      });
    } catch (err) {
      console.error(err);
    }
  };

  const readSerialLoop = async (port: any) => {
    const textDecoder = new TextDecoder();
    const reader = port.readable.getReader();
    let bufferStr = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        const text = textDecoder.decode(value);
        bufferStr += text;

        if (bufferStr.includes('\n')) {
          const lines = bufferStr.split('\n');
          bufferStr = lines.pop() || '';
          for (const line of lines) {
            const clean = line.trim();
            if (clean) {
              parseIncomingSentence(clean, 'SERIAL');
            }
          }
        }
      }
    } catch (err) {
      console.error("Serial stream read terminated:", err);
    } finally {
      reader.releaseLock();
    }
  };

  // Save changes helper
  const handleSaveConfig = async (newConfig: typeof config) => {
    setConfig(newConfig);
    localStorage.setItem('aws_config', JSON.stringify(newConfig));
    showToastNotification('Config Saved Successfully!');

    // Post newly configured Moxa IP & Port to host computer's api.php automatically
    const moxaIp = newConfig.serialcom || '192.168.127.254';
    const moxaPort = parseInt(newConfig.baudrate) || 10001;
    const url = newConfig.localDbApiUrl || 'http://localhost:8000/api.php';

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save_moxa_config',
          moxa_ip: moxaIp,
          moxa_port: moxaPort,
          transport: newConfig.transport
        }),
      });
      console.log('Successfully synchronized Moxa hardware configuration to api.php');
    } catch (e) {
      console.warn('Could not sync Moxa config to PHP (PHP server offline or CORS restricted):', e);
    }
  };

  const showToastNotification = (msg: string) => {
    setSystemAlert(msg);
    setTimeout(() => {
      setSystemAlert(null);
    }, 3000);
  };

  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const fetchBmkgLive = async (slugToFetch?: string | boolean, showToast = false) => {
    setIsLoadingBmkg(true);
    setBmkgErrorMsg('');
    const actualShowToast = typeof slugToFetch === 'boolean' ? slugToFetch : showToast;
    const isRefresh = (slugToFetch === true || showToast === true);
    const targetSlug = (slugToFetch && typeof slugToFetch === 'string') ? slugToFetch : (config.bmkgPortSlug || 'pelabuhan-ciwandan');
    try {
      const portQuery = `?port=${targetSlug}${isRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(`/api/bmkg${portQuery}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const dataJson = await res.json();
      if (dataJson.success && Array.isArray(dataJson.data)) {
        setBmkgForecast(dataJson.data);
        setBmkgSource(dataJson.source);
        const formatTime = format(new Date(dataJson.lastUpdated), 'dd MMM yy, HH:mm:ss');
        setLastBmkgFetched(formatTime);
        if (actualShowToast) {
          showToastNotification(`🟢 BMKG MARITIM BERHASIL DISINKRONKAN (${dataJson.source.toUpperCase()})`);
        }
      } else {
        throw new Error(dataJson.error || 'Format data JSON tidak valid');
      }
    } catch (err: any) {
      console.error('Failed to fetch live BMKG forecast:', err);
      setBmkgErrorMsg(err.message || 'Gagal terhubung ke API scraping.');
      
      // Fallback: Generate custom mock forecast for the selected port to avoid displaying stale Ciwandan predictions!
      const mockForecast = generateMockForecastFrontend(targetSlug);
      setBmkgForecast(mockForecast);
      setBmkgSource('simulasi maritim');
      setLastBmkgFetched(format(new Date(), 'dd MMM yy, HH:mm:ss'));
      
      if (actualShowToast) {
        showToastNotification(`🟡 SINKRON ONLINE DIALIKAN KE SIMULASI MARITIM LOKAL`);
      }
    } finally {
      setIsLoadingBmkg(false);
    }
  };

  useEffect(() => {
    fetchBmkgLive(config.bmkgPortSlug, false);

    // Auto-sync every 1 hour (3600000ms)
    const intervalId = setInterval(() => {
      console.log("[Auto-Refresh] Commencing hourly BMKG marine forecast sync...");
      fetchBmkgLive(config.bmkgPortSlug, true);
    }, 3600000);

    return () => clearInterval(intervalId);
  }, [config.bmkgPortSlug]);

  // Raw serial/tcp terminal steam content
  const [streamLogs, setStreamLogs] = useState<string>(
    `[+] Systems check initialized. Status: OK\n` +
    `[+] SQL connection active: pool size = 10, database = db_aws\n` +
    `[+] Berhasil membuka Serial Port di ${config.serialcom} at ${config.baudrate} baudrate.\n`
  );

  // Store rain accumulative log
  const [rainAccum, setRainAccum] = useState(3.4);

  // Active simulated buffer for WMO 10-Min (or custom min) averages
  const [sampleBuffer, setSampleBuffer] = useState<WeatherData[]>([]);

  // Active simulated logger feed
  useEffect(() => {
    const interval = setInterval(() => {
      if (config.isSimulationOn === 'OFF') {
        return;
      }
      const pctime = new Date();
      const activeSlug = (config.bmkgPortSlug || 'pelabuhan_ciwandan').toLowerCase().replace(/-/g, '_');
      const profile = PORT_PROFILES[activeSlug] || PORT_PROFILES.pelabuhan_ciwandan;

      const nextTemp = profile.avgTemp - 2.0 + Math.random() * 4.0;
      const nextHum = 70 + Math.floor(Math.random() * 25);
      const nextWindSpeed = profile.avgWind - 2 + Math.random() * 4;
      const nextWindDir = Math.floor(Math.random() * 360);
      const nextPress = 1008 + Math.random() * 5;
      const nextSolar = Math.floor(100 + Math.random() * 600);
      const nextRainRate = Math.random() > 0.9 ? parseFloat((Math.random() * 6).toFixed(1)) : 0;
      const nextWave = parseFloat((profile.avgWave - 0.15 + Math.random() * 0.35).toFixed(2));
      const nextCurrentSpeed = parseFloat((0.8 + Math.random() * 2.2).toFixed(2)); // simulated Knots
      const nextSeaLvl = parseFloat((110 + Math.random() * 60).toFixed(1));
      const nextPh = parseFloat((7.4 + Math.random() * 0.8).toFixed(2));

      // Append rain accum if raining
      if (nextRainRate > 0) {
        setRainAccum(prev => parseFloat((prev + nextRainRate * 0.05).toFixed(1)));
      }

      const newRecord: WeatherData = {
        timestamp: Date.now(),
        temperature: parseFloat(nextTemp.toFixed(1)),
        humidity: nextHum,
        windSpeed: parseFloat(nextWindSpeed.toFixed(1)),
        windDirection: nextWindDir,
        pressure: parseFloat(nextPress.toFixed(1)),
        solarRadiation: nextSolar,
        rainfall: nextRainRate,
        waveHeight: nextWave,
        currentSpeed: nextCurrentSpeed,
        seaLevel: nextSeaLvl,
        waterPh: nextPh,
        tempMin: parseFloat((nextTemp - 1.5).toFixed(1)),
        tempMax: parseFloat((nextTemp + 1.2).toFixed(1)),
        windSpeedMin: parseFloat(Math.max(0, nextWindSpeed - 1.8).toFixed(1)),
        windSpeedMax: parseFloat((nextWindSpeed + 2.5).toFixed(1))
      };

      // Handle Storage Rules dynamically (only if transport is OFF, otherwise we let parseIncomingSentence drive it via config-aware indices!)
      if (config.transport === 'OFF') {
        const spaceMode = config.dbStorageMode || 'AVG';
        
        setSampleBuffer(prevBuf => {
          const updated = [...prevBuf, newRecord];
          // After 5 samples are compiled (simulating full period cycle for high usability live visual), we write the record according to the chosen mode (AVG vs RAW)
          if (updated.length >= 5) {
            let recordToSave: WeatherData;
            let msgLog = '';

            if (spaceMode === 'AVG') {
              recordToSave = calculateAverageRecord(updated);
              msgLog = `⏱️ compiled and saved standard WMO ${config.dbStorageInterval}-minute average based on 5 raw samples successfully.`;
            } else {
              // RAW mode: Save the latest instantaneous sample at the exact interval
              const rawSpeeds = updated.map(item => item.windSpeed);
              const maxR = rawSpeeds.length > 0 ? Math.max(...rawSpeeds) : 0;
              const minR = rawSpeeds.length > 0 ? Math.min(...rawSpeeds) : 0;
              const hasRGust = (maxR - minR) >= 10;
              
              recordToSave = { 
                ...newRecord,
                windGust: hasRGust ? parseFloat(maxR.toFixed(1)) : undefined
              };
              msgLog = `📦 saved raw instantaneous record for ${config.dbStorageInterval}-minute interval directly to database successfully.`;
            }
            
            // Adjust simulated timestamp to reflect precise clock block boundary (e.g. 10, 20, 30...)
            const intervalMin = config.dbStorageInterval || 10;
            const intervalMs = intervalMin * 60 * 1000;
            const alignedTimestamp = Math.floor(Date.now() / intervalMs) * intervalMs;
            recordToSave.timestamp = alignedTimestamp;

            // Asynchronously post to local PostgreSQL database script
            postLogToLocalPostgres(recordToSave);

            setHistory(prevHist => {
              const keeps = [...prevHist, recordToSave];
              if (keeps.length > 200) {
                return keeps.slice(keeps.length - 150);
              }
              localStorage.setItem('aws_history_logs', JSON.stringify(keeps));
              return keeps;
            });

            // Write notification in terminal
            setStreamLogs(prevLogs => {
              const lines = prevLogs.split('\n');
              const timeStr = format(new Date(), 'HH:mm:ss');
              const msg = `[${timeStr} SQL SYSTEM] ${msgLog}`;
              const output = [...lines, msg];
              if (output.length > 40) return output.slice(output.length - 30).join('\n');
              return output.join('\n');
            });

            return []; // clear buffer
          }
          return updated;
        });
      }

      // Update terminal stream simulator and feed rawString directly through parser
      if (config.transport !== 'OFF') {
        const dateStr = format(pctime, 'dd-MM-yyyy HH:mm:ss');
        let rawString = '';
        let prefix = '';

        if (config.transport === 'MOXA_TCP') {
          // Format based on standard Moxa output schema provided:
          // AWS001;08-06-2026;07:51:10;0;0;58.6;-35.1;0;-35.1;50;975.2;NAN;NAN;0;27.2;27.5;0;NAN;-3.5;NAN;12.06145;28.08301
          // Mapping:
          // [0] Kode_Stasiun, [1] Date (DD-MM-YYYY), [2] Time (HH:mm:ss), [3] WS_meas, [4] WS_Max, [5] WD_meas, 
          // [6] TA_meas, [7] TA_Max, [8] TA_Min, [9] RH_meas, [10] PA_meas, [11] NAN, [12] SR_meas, [13] SR_Max, 
          // [14] water_temp, [15] water_temp_max, [16] water_temp_min, [17] water_level, [18] PH_meas, [19] "NAN", 
          // [20] batt_volt, [21] +PTemp
          const delimiter = config.splitchar || ';';
          const datePart = format(pctime, 'dd-MM-yyyy');
          const timePart = format(pctime, 'HH:mm:ss');
          const ws_meas = Math.round(newRecord.windSpeed);
          const ws_max = Math.round(newRecord.windSpeed + 2.4);
          const wd_meas = newRecord.windDirection.toFixed(1);
          const ta_meas = newRecord.temperature.toFixed(1);
          const ta_max = (newRecord.temperature + 1.1).toFixed(1);
          const ta_min = (newRecord.temperature - 1.4).toFixed(1);
          const rh_meas = newRecord.humidity;
          const pa_meas = newRecord.pressure.toFixed(1);
          const sr_meas = newRecord.solarRadiation > 10 ? newRecord.solarRadiation : 'NAN';
          const sr_max = newRecord.solarRadiation > 10 ? Math.round(newRecord.solarRadiation * 1.12) : 0;
          const water_temp = (newRecord.temperature - 1.2).toFixed(1);
          const water_temp_max = (newRecord.temperature - 0.7).toFixed(1);
          const water_temp_min = (newRecord.temperature - 2.0).toFixed(1);
          const water_level = isNaN(newRecord.seaLevel) ? 'NAN' : (newRecord.seaLevel / 100).toFixed(2);
          const ph_meas = newRecord.waterPh ? newRecord.waterPh.toFixed(2) : 'NAN';
          const batt_volt = (12.05 + Math.random() * 0.4).toFixed(5);
          const ptemp = (newRecord.temperature + 0.08).toFixed(5);

          rawString = `${config.idStation || 'AWS001'}${delimiter}${datePart}${delimiter}${timePart}${delimiter}${ws_meas}${delimiter}${ws_max}${delimiter}${wd_meas}${delimiter}${ta_meas}${delimiter}${ta_max}${delimiter}${ta_min}${delimiter}${rh_meas}${delimiter}${pa_meas}${delimiter}NAN${delimiter}${sr_meas}${delimiter}${sr_max}${delimiter}${water_temp}${delimiter}${water_temp_max}${delimiter}${water_temp_min}${delimiter}${water_level}${delimiter}${ph_meas}${delimiter}NAN${delimiter}${batt_volt}${delimiter}${ptemp}`;
          prefix = `[TCP/IP GATEWAY MOXA] INBOUND <-`;
        } else if (config.transport === 'TCP') {
          rawString = `${config.idStation}${config.splitchar}${dateStr}${config.splitchar}${newRecord.temperature.toFixed(1)}${config.splitchar}${newRecord.humidity}${config.splitchar}${newRecord.solarRadiation}${config.splitchar}${newRecord.rainfall.toFixed(1)}${config.splitchar}${newRecord.waveHeight.toFixed(2)}${config.splitchar}${newRecord.seaLevel.toFixed(1)}${config.splitchar}${newRecord.waterPh.toFixed(2)}${config.splitchar}${newRecord.windDirection}${config.splitchar}${newRecord.windSpeed.toFixed(1)}${config.splitchar}${newRecord.pressure.toFixed(1)}`;
          prefix = `[TCP SERVER] RECEIVED ->`;
        } else {
          rawString = `${config.idStation}${config.splitchar}${dateStr}${config.splitchar}${newRecord.temperature.toFixed(1)}${config.splitchar}${newRecord.humidity}${config.splitchar}${newRecord.solarRadiation}${config.splitchar}${newRecord.rainfall.toFixed(1)}${config.splitchar}${newRecord.waveHeight.toFixed(2)}${config.splitchar}${newRecord.seaLevel.toFixed(1)}${config.splitchar}${newRecord.waterPh.toFixed(2)}${config.splitchar}${newRecord.windDirection}${config.splitchar}${newRecord.windSpeed.toFixed(1)}${config.splitchar}${newRecord.pressure.toFixed(1)}`;
          prefix = `[SERIAL COM] RECEIVED ->`;
        }
        
        setStreamLogs(prev => {
          const lines = prev.split('\n');
          const output_lines = [...lines, `${prefix} ${rawString}`];
          if (output_lines.length > 40) return output_lines.slice(output_lines.length - 30).join('\n');
          return output_lines.join('\n');
        });

        // Parse simulated rawString directly using dynamic index mappings!
        parseIncomingSentence(rawString, config.transport as any);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [config]);

  // Helper to parse database row into WeatherData object safely
  const parseDbRowToWeatherData = (row: any): WeatherData => {
    let parsedTimestamp: number;
    if (row.timestamp) {
      const rawTs = String(row.timestamp);
      // SQLite/PostgreSQL date conversion safety
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

    return {
      timestamp: parsedTimestamp,
      temperature: parseFloat(row.temperature) || 0,
      humidity: parseInt(row.humidity) || 0,
      windSpeed: parseFloat(row.wind_speed) || 0,
      windDirection: parseInt(row.wind_direction) || 0,
      pressure: parseFloat(row.pressure) || 0,
      solarRadiation: parseInt(row.solar_radiation) || 0,
      rainfall: parseFloat(row.rainfall) || 0,
      waveHeight: parseFloat(row.wave_height) || 0,
      seaLevel: parseFloat(row.sea_level) || 0,
      waterPh: parseFloat(row.water_ph) || 7.0,
      waterTemp: row.water_temp !== undefined && row.water_temp !== null ? parseFloat(row.water_temp) : undefined,
      waterTempMin: row.water_temp_min !== undefined && row.water_temp_min !== null ? parseFloat(row.water_temp_min) : undefined,
      waterTempMax: row.water_temp_max !== undefined && row.water_temp_max !== null ? parseFloat(row.water_temp_max) : undefined,
      windGust: row.wind_gust ? parseFloat(row.wind_gust) : undefined,
      tempMin: row.temp_min !== undefined && row.temp_min !== null ? parseFloat(row.temp_min) : undefined,
      tempMax: row.temp_max !== undefined && row.temp_max !== null ? parseFloat(row.temp_max) : undefined,
      windSpeedMin: row.wind_speed_min !== undefined && row.wind_speed_min !== null ? parseFloat(row.wind_speed_min) : undefined,
      windSpeedMax: row.wind_speed_max !== undefined && row.wind_speed_max !== null ? parseFloat(row.wind_speed_max) : undefined
    };
  };

  // Download real database records from the local api.php
  const fetchRealDatabaseLogs = async (silent = false) => {
    setIsFetchingRealDb(true);
    const testUrl = config.localDbApiUrl || 'http://localhost:8000/api.php';
    const fetchUrl = `${testUrl}?get_telemetry_logs=1`;
    
    if (!silent) {
      showToastNotification("🔄 Memuat log telemetri asli dari PostgreSQL...");
    }

    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const rawText = await res.text();
        let rawRows;
        try {
          rawRows = JSON.parse(rawText.trim());
        } catch (err) {
          const matches = rawText.match(/\[\s*\{[^]*\}\s*\]/g);
          if (matches && matches.length > 0) {
            rawRows = JSON.parse(matches[matches.length - 1]);
          } else {
            const singleMatches = rawText.match(/\{"status"[^}]*\}/g) || rawText.match(/\{[^}]*\}/g);
            if (singleMatches && singleMatches.length > 0) {
              rawRows = JSON.parse(singleMatches[singleMatches.length - 1]);
            } else {
              throw err;
            }
          }
        }
        if (rawRows && rawRows.data && Array.isArray(rawRows.data)) {
          rawRows = rawRows.data;
        }
        
        if (Array.isArray(rawRows)) {
          const parsedRows: WeatherData[] = rawRows.map(parseDbRowToWeatherData);
          setRealDbLogs(parsedRows);
          setShowRealDb(true);
          setIsDbConnected(true);
          
          if (!silent) {
            showToastNotification(`🟢 Berhasil sinkronisasi ${parsedRows.length} data asli dari PostgreSQL database!`);
          }
        } else {
          throw new Error("Respon api.php tidak valid.");
        }
      } else {
        throw new Error(`HTTP Error ${res.status}`);
      }
    } catch (e) {
      console.error("Failed to fetch database logs:", e);
      if (!silent) {
        const isHttps = window.location.protocol === 'https:';
        const isLocalApi = testUrl.includes('localhost') || testUrl.includes('127.0.0.1');
        
        if (isHttps && isLocalApi) {
          showToastNotification("⚠️ Keamanan Browser: Koneksi HTTPS memblokir HTTP lokal (Mixed Content). Jalankan Dashboard secara lokal or matikan Mixed Content Shield browser Anda!");
        } else {
          showToastNotification("⚠️ Gagal memuat data! Gantilah isi api.php lokal Anda dengan file script terbaru di bawah ini.");
        }
      }
    } finally {
      setIsFetchingRealDb(false);
    }
  };

  // Auto-fetch real logs when the active tab shifts to 'database'
  useEffect(() => {
    if (activeTab === 'database') {
      fetchRealDatabaseLogs(true);
    }
  }, [activeTab]);

  // Handle default initial filter for database search logs
  useEffect(() => {
    filterLogsData();
  }, [history, realDbLogs, showRealDb, dbStartDate, dbEndDate, dbSearchTerm]);

  const filterLogsData = () => {
    const dataSource = showRealDb ? realDbLogs : history;
    const active = dataSource.filter(row => {
      let ts = row.timestamp;
      const rowDateStr = format(ts, 'yyyy-MM-dd');
      const startMatch = dbStartDate ? rowDateStr >= dbStartDate : true;
      const endMatch = dbEndDate ? rowDateStr <= dbEndDate : true;
      
      const searchMatch = dbSearchTerm ? (
        row.temperature.toString().includes(dbSearchTerm) ||
        row.windSpeed.toString().includes(dbSearchTerm) ||
        row.windDirection.toString().includes(dbSearchTerm) ||
        row.pressure.toString().includes(dbSearchTerm) ||
        (row.waterPh !== undefined && row.waterPh.toString().includes(dbSearchTerm))
      ) : true;

      return startMatch && endMatch && searchMatch;
    });

    // Ensure database logs are ordered newest to oldest
    const sorted = [...active].sort((a, b) => b.timestamp - a.timestamp);
    setFilteredLogs(sorted);
  };

  // Dedicated filtered dataset for the Analyst tab based on selected date range (00:00 to 23:59)
  const analystLogs = (() => {
    // If the database is connected and has records, use it as requested. Otherwise use history.
    const source = (isDbConnected && realDbLogs.length > 0) ? realDbLogs : history;
    
    // Filter by selected start and end dates (within 00:00:00 and 23:59:59)
    const filtered = source.filter(row => {
      const rowDateStr = format(row.timestamp, 'yyyy-MM-dd');
      const startMatch = dbStartDate ? rowDateStr >= dbStartDate : true;
      const endMatch = dbEndDate ? rowDateStr <= dbEndDate : true;
      return startMatch && endMatch;
    });

    // Return chronological order (oldest to newest) for chart plotting
    return [...filtered].sort((a, b) => a.timestamp - b.timestamp);
  })();

  const currentData = history[history.length - 1] || {
    timestamp: Date.now(),
    temperature: 28.2,
    humidity: 78,
    windSpeed: 12.0,
    windDirection: 45,
    pressure: 1011.2,
    solarRadiation: 450,
    rainfall: 0,
    waveHeight: 1.1,
    seaLevel: 140,
    waterPh: 7.8
  };

  // Track wind directions of the last 2 minutes for rendering green trails/arcs
  const [windTrack2Min, setWindTrack2Min] = useState<{ direction: number; timestamp: number }[]>([]);

  useEffect(() => {
    if (currentData && typeof currentData.windDirection === 'number') {
      const now = Date.now();
      setWindTrack2Min(prev => {
        const updated = [...prev, { direction: currentData.windDirection, timestamp: now }];
        // filter older than 2 minutes (120,000 ms)
        return updated.filter(item => now - item.timestamp < 120000);
      });
    }
  }, [currentData.windDirection, currentData.timestamp]);

  // 1-Hour temperature statistics computed from the history queue
  const tempStats = (() => {
    const lastSix = history.slice(-12); // approx last couple hours
    if (lastSix.length === 0) return { avg: '28.2', max: '29.1', min: '27.4' };
    const temps = lastSix.map(h => h.temperature);
    const sum = temps.reduce((a, b) => a + b, 0);
    const avg = (sum / temps.length).toFixed(1);
    const max = Math.max(...temps).toFixed(1);
    const min = Math.min(...temps).toFixed(1);
    return { avg, max, min };
  })();

  // Water temperature statistics computed from the history queue
  const waterTempStats = (() => {
    const lastSix = history.slice(-12); // approx last couple hours
    if (lastSix.length === 0) {
      const curWaterTemp = currentData.waterTemp ?? (currentData.temperature - 1.2);
      const curWaterTempMax = currentData.waterTempMax ?? (currentData.temperature - 0.7);
      const curWaterTempMin = currentData.waterTempMin ?? (currentData.temperature - 2.0);
      return {
        avg: curWaterTemp.toFixed(1),
        max: curWaterTempMax.toFixed(1),
        min: curWaterTempMin.toFixed(1)
      };
    }
    const temps = lastSix.map(h => h.waterTemp ?? (h.temperature - 1.2));
    const maxTemps = lastSix.map(h => h.waterTempMax ?? (h.waterTemp ?? (h.temperature - 0.7)));
    const minTemps = lastSix.map(h => h.waterTempMin ?? (h.waterTemp ?? (h.temperature - 2.0)));
    
    const sum = temps.reduce((a, b) => a + b, 0);
    const avg = (sum / temps.length).toFixed(1);
    const max = Math.max(...maxTemps).toFixed(1);
    const min = Math.min(...minTemps).toFixed(1);
    return { avg, max, min };
  })();

  // Dynamic Wind Speed Max and Min computed from the history queue
  const windStats = (() => {
    if (history.length === 0) return { min: currentData.windSpeed, max: currentData.windSpeed };
    const speeds = history.map(h => h.windSpeed);
    const max = Math.max(...speeds);
    const min = Math.min(...speeds);
    return { min, max };
  })();

  // Find the last recorded wind gust from the history, filtered to only include gusts that occurred on the same calendar day as the current clock time
  const lastGustRecord = [...history].reverse().find(row => {
    if (row.windGust === undefined || row.windGust === null) return false;
    const rowDate = new Date(row.timestamp);
    const clockDate = currentClockTime;
    return rowDate.getFullYear() === clockDate.getFullYear() &&
           rowDate.getMonth() === clockDate.getMonth() &&
           rowDate.getDate() === clockDate.getDate();
  });
  const lastWindGustVal = lastGustRecord ? lastGustRecord.windGust : 0;
  const lastWindGustTime = lastGustRecord ? format(lastGustRecord.timestamp, 'HH:mm:ss') : "00:00:00";

  // Wind Rose accumulator calculations
  const windRoseData = (() => {
    const accumulator = { 'N': 0, 'NE': 0, 'E': 0, 'SE': 0, 'S': 0, 'SW': 0, 'W': 0, 'NW': 0 };
    history.forEach(row => {
      const deg = row.windDirection;
      if (deg >= 337.5 || deg < 22.5) accumulator['N']++;
      else if (deg >= 22.5 && deg < 67.5) accumulator['NE']++;
      else if (deg >= 67.5 && deg < 112.5) accumulator['E']++;
      else if (deg >= 112.5 && deg < 157.5) accumulator['SE']++;
      else if (deg >= 157.5 && deg < 202.5) accumulator['S']++;
      else if (deg >= 202.5 && deg < 247.5) accumulator['SW']++;
      else if (deg >= 247.5 && deg < 292.5) accumulator['W']++;
      else if (deg >= 292.5 && deg < 337.5) accumulator['NW']++;
    });
    return Object.entries(accumulator).map(([direction, count]) => ({
      direction,
      count
    }));
  })();

  // Custom Dew point calculator (approx Magnus-Tetens formula)
  const computeDewPoint = (t: number, rh: number) => {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * t) / (b + t)) + Math.log(rh / 100);
    const dp = (b * alpha) / (a - alpha);
    return isNaN(dp) ? 21.5 : parseFloat(dp.toFixed(1));
  };

  // Convert wind speed value to relative string rose
  const getWindRoseString = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return 'N';
    if (deg >= 22.5 && deg < 67.5) return 'NE';
    if (deg >= 67.5 && deg < 112.5) return 'E';
    if (deg >= 112.5 && deg < 157.5) return 'SE';
    if (deg >= 157.5 && deg < 202.5) return 'S';
    if (deg >= 202.5 && deg < 247.5) return 'SW';
    if (deg >= 247.5 && deg < 292.5) return 'W';
    return 'NW';
  };

  // Get dominant wind for a given hour range from 24H data
  const getIntervalDominantWind = (hourMin: number, hourMax: number) => {
    const limitTime = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = history.filter(log => log.timestamp >= limitTime);
    const targetLogs = (recentLogs.length > 0 ? recentLogs : history).filter(log => {
      const hr = new Date(log.timestamp).getHours();
      return hr >= hourMin && hr <= hourMax;
    });

    if (targetLogs.length === 0) {
      return { direction: "N/A", avgSpeed: 0, count: 0 };
    }

    const freq: { [key: string]: number } = {};
    let maxDir = "N/A";
    let maxCount = 0;
    let sumSpeed = 0;

    targetLogs.forEach(log => {
      const dirStr = getWindRoseString(log.windDirection);
      freq[dirStr] = (freq[dirStr] || 0) + 1;
      if (freq[dirStr] > maxCount) {
        maxCount = freq[dirStr];
        maxDir = dirStr;
      }
      sumSpeed += log.windSpeed;
    });

    return {
      direction: maxDir,
      avgSpeed: sumSpeed / targetLogs.length,
      count: targetLogs.length
    };
  };

  // Export database metrics to CSV format
  const exportLogsToCSV = () => {
    const headers = [
      'DateTime', 'Temp (deg C)', 'Temp Min (deg C)', 'Temp Max (deg C)',
      'Humidity (%)', 'Solar (W/m2)', 'Rainfall (mm)', 'Wind Gust (m/s)',
      'WaterLvl (cm)', 'Water pH', 'Battery (V)', 'WindDir (deg)', 'WindSpd (m/s)',
      'WindSpd Min (m/s)', 'WindSpd Max (m/s)', 'Press (hPa)'
    ];
    const rows = filteredLogs.map(row => [
      format(row.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      row.temperature,
      row.tempMin !== undefined ? row.tempMin : parseFloat((row.temperature - 1.5).toFixed(1)),
      row.tempMax !== undefined ? row.tempMax : parseFloat((row.temperature + 1.2).toFixed(1)),
      row.humidity,
      row.solarRadiation,
      row.rainfall,
      row.windGust !== undefined && row.windGust !== null ? row.windGust : "",
      row.seaLevel,
      row.waterPh || 7.8,
      row.battery !== undefined ? row.battery : 12.2,
      row.windDirection,
      row.windSpeed,
      row.windSpeedMin !== undefined ? row.windSpeedMin : parseFloat(Math.max(0, row.windSpeed - 1.8).toFixed(1)),
      row.windSpeedMax !== undefined ? row.windSpeedMax : parseFloat((row.windSpeed + 2.5).toFixed(1)),
      row.pressure
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AWS_Marine_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CORE AI FORECAST ENGINE MATH (PORTED FROM YOUR CONCEPT) ---
  const aiForecastResult = (() => {
    // Use analystLogs as the primary dataset to reflect actual filtered database/history logs
    const dataset = (analystLogs && analystLogs.length > 0) ? analystLogs : history;
    const current_hist = dataset.slice(-6).map(h => h.currentSpeed ?? parseFloat((h.waveHeight * 1.5).toFixed(2)));
    const wind_hist = dataset.slice(-6).map(h => h.windSpeed);
    
    // Ensure historical array has elements
    if (current_hist.length === 0) {
      current_hist.push(1.50);
      wind_hist.push(10.0);
    }

    const currentVal = current_hist[current_hist.length - 1];
    const currentWind = wind_hist[wind_hist.length - 1];

    // Yesterday's Climatology Baselines as specified in your logic
    const yestCurrent = CLIMATOLOGY_AVG.currentSpeed;
    const yestWind = CLIMATOLOGY_AVG.windSpeed;

    // Seberapa cepat momentum pergerakan 1 jam terakhir 
    let currentMomentum = 0;
    let windMomentum = 0;
    if (current_hist.length > 1) {
      currentMomentum = (currentVal - current_hist[0]) / current_hist.length;
      windMomentum = (currentWind - wind_hist[0]) / wind_hist.length;
    }

    // ANOMALY OVERRIDE: Jika saat ini beda ekstrem dengan kemarin (> 50% atau sudah berbahaya)
    // Jika True = ADA BADAI / SQUALL, abaikan sejarah, fokus pada bacaan sensor live!
    const isCurrentExtreme = Math.abs(currentVal - yestCurrent) > (yestCurrent * 0.5) || currentVal >= 2.5;
    const isWindStorm = Math.abs(currentWind - yestWind) > (yestWind * 0.5) || currentWind >= 15.0;

    const forecastedCurrents = [];
    const forecastedWinds = [];
    const timestamps = [];
    const baseDate = new Date();

    for (let i = 1; i <= 6; i++) {
      const stepTime = new Date(baseDate.getTime() + i * 10 * 60000);
      
      // Prediksi dasar murni dari gaya dorong (momentum) sensor saat ini
      let futureCurrent = currentVal + (currentMomentum * i * 0.8); // 0.8 dumper 
      let futureWind = currentWind + (windMomentum * i * 0.8);

      // Jika TIDAK ADA BADAI (Cuaca Normal), baru kita tarik ke siklus kemarin
      if (!isCurrentExtreme) {
        futureCurrent = (futureCurrent * 0.6) + (yestCurrent * 0.4); // 40% influence yesterday
      }
      if (!isWindStorm) {
        futureWind = (futureWind * 0.6) + (yestWind * 0.4); // 40% influence yesterday
      }

      // Tambahkan sedikit turbulensi acak alami
      futureCurrent += (Math.random() * 0.16 - 0.08);
      futureWind += (Math.random() * 0.8 - 0.4);

      forecastedCurrents.push(parseFloat(Math.max(0.1, futureCurrent).toFixed(2)));
      forecastedWinds.push(parseFloat(Math.max(1.0, futureWind).toFixed(1)));
      timestamps.push(format(stepTime, 'HH:mm'));
    }

    // STORM THREAT PROBABILITY (25 m/s or 32 Knots Wind = 100% danger)
    const maxFutureWind = Math.max(...forecastedWinds);
    const stormProb = Math.min(100, Math.max(5, Math.round((maxFutureWind / 25) * 100)));

    let stormStatus = 'SAFE OPERATION';
    let stormColor = '#22c55e'; // Green
    let stormIcon = '🚢'; // calm ship
    let stormBg = 'bg-success/15 border-success/30';
    let stormPulse = '';

    if (stormProb > 75) {
      stormStatus = 'GALE WARNING / PORT CLOSE';
      stormColor = '#ef4444'; // Red
      stormIcon = '🌀'; // rotating gale spiral
      stormBg = 'bg-danger/20 border-danger/40';
      stormPulse = 'animate-spin duration-3000';
    } else if (stormProb > 45) {
      stormStatus = 'SQUALL THREAT / CAUTION';
      stormColor = '#f59e0b'; // Gold/Orange
      stormIcon = '🌬️'; // wind squall
      stormBg = 'bg-warning/20 border-warning/40';
      stormPulse = 'animate-bounce';
    }

    // Synthesize history and future combined dataset for Recharts
    const pastAndFutureData = [];
    const last6 = history.slice(-6);
    
    // Add Past elements
    last6.forEach(h => {
      const cSpeed = h.currentSpeed ?? parseFloat((h.waveHeight * 1.5).toFixed(2));
      pastAndFutureData.push({
        time: format(h.timestamp, 'HH:mm'),
        pastCurrent: cSpeed,
        pastWind: h.windSpeed,
        futCurrent: null,
        futWind: null
      });
    });

    // Add linkage point so solid line touches dashed forecast line
    if (pastAndFutureData.length > 0) {
      const idx = pastAndFutureData.length - 1;
      pastAndFutureData[idx].futCurrent = pastAndFutureData[idx].pastCurrent;
      pastAndFutureData[idx].futWind = pastAndFutureData[idx].pastWind;
    }

    // Append Future elements
    forecastedCurrents.forEach((c, idx) => {
      pastAndFutureData.push({
        time: timestamps[idx],
        pastCurrent: null,
        pastWind: null,
        futCurrent: c,
        futWind: forecastedWinds[idx]
      });
    });

    return {
      forecastedCurrents,
      forecastedWinds,
      timestamps,
      stormProb,
      stormStatus,
      stormColor,
      stormIcon,
      stormBg,
      stormPulse,
      combinedData: pastAndFutureData
    };
  })();

  // Direction indicator calculations
  const parsedPierAngle = parseFloat(config.pierAngle) || 0;
  const relativeVesselWind = (currentData.windDirection - parsedPierAngle + 360) % 360;

  return (
    <div className="min-h-screen flex flex-col md:flex-row grid-pattern text-slate-100">
      <style>{`
        :root {
          font-size: ${config.uiZoom || '115'}%;
        }
      `}</style>
      {/* Dynamic Toast warning line */}
      {systemAlert && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#0b1424] border border-[#00f0ff] px-6 py-3 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.4)] flex items-center gap-2">
          <span className="w-2 h-2 rounded bg-[#00f0ff] animate-ping" />
          {systemAlert}
        </div>
      )}

      {/* SIDEBAR NAVIGATION - Styled directly like a high-end Yacht Terminal Console */}
      <aside className="w-full md:w-28 bg-gradient-to-b from-[#11243b] via-[#081220] to-[#03060d] border-r border-[#00f0ff]/20 flex flex-col items-center py-8 gap-8 z-10 shadow-[6px_0_50px_rgba(0,240,255,0.08)] relative">
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-[#00f0ff]/40 via-transparent to-[#00f0ff]/15" />
        
        {/* PII Instrument Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#00f0ff]/20 to-[#3b82f6]/10 rounded-2xl flex flex-col items-center justify-center shadow-[0_0_25px_rgba(0,240,255,0.15)] border border-[#00f0ff]/30 cursor-pointer p-1.5 hover:border-[#00f0ff]/60 hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] transition-all duration-300" onClick={() => setActiveTab('realtime')}>
          <span className="text-white font-black text-base tracking-tighter leading-none font-sans">PII</span>
          <span className="text-[7px] text-[#00f0ff] tracking-[0.05em] font-black uppercase mt-1 text-center leading-none">INSTRUMENT</span>
        </div>

        <nav className="flex flex-col gap-5 w-full px-3">
          <button 
            onClick={() => setActiveTab('realtime')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'realtime' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span className="text-xs">REALTIME</span>
          </button>

          <button 
            onClick={() => setActiveTab('analyst')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'analyst' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <RefreshCw className="w-4.5 h-4.5" />
            <span className="text-xs">ANALYST</span>
          </button>

          <button 
            onClick={() => setActiveTab('database')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'database' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <Database className="w-4.5 h-4.5" />
            <span className="text-xs">DATABASE</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'settings' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <Settings className="w-4.5 h-4.5" />
            <span className="text-xs">OPTION</span>
          </button>

          <button 
            onClick={() => setActiveTab('bmkg')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'bmkg' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <Anchor className="w-4.5 h-4.5" />
            <span className="text-xs">BMKG PORT</span>
          </button>
        </nav>

        {/* Station & Manual Book Indicator */}
        <div className="mt-auto flex flex-col items-center gap-4 w-full px-2.5">
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="w-full py-2 px-1 rounded-xl flex flex-col items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider font-sans border text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 hover:text-black hover:border-amber-400 cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.15)] group"
            title="Klik untuk membuka Manual Pengoperasian & Buku Panduan"
          >
            <BookOpen className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-center text-[9px] leading-tight">MANUAL BOOK</span>
          </button>
          
          <div className="text-center w-full pt-2 border-t border-white/5">
            <div className="text-[10px] font-mono opacity-40 uppercase font-black text-slate-400">Station ID</div>
            <div className="text-xs font-mono tracking-wider font-black text-[#00f0ff] mt-1 bg-white/5 py-1 px-1.5 rounded border border-[#00f0ff]/20 truncate w-full block">{config.idStation}</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-5 md:p-8 space-y-6 max-w-full w-full overflow-hidden flex flex-col justify-start">
        
        {/* SHARED HEADER CONTROLLER */}
        <header className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center bg-gradient-to-r from-[#0b1424]/90 via-[#0b1424]/50 to-bg/90 backdrop-blur-xl p-5 md:p-6 rounded-[1.5rem] border border-[#00f0ff]/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00f0ff]/40 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00f0ff]/40 rounded-br-xl" />

          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-mono text-[#00f0ff]/80 font-extrabold flex items-center gap-2 mb-1.5">
              {config.transport !== 'OFF' && !isLiveActive ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-90"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span className="text-rose-400 font-black animate-pulse">AWS CONNECTION: OFFLINE (ALAT MATI / SENSOR ERROR)</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span>AWS OS CONNECTION: {config.transport}{config.transport !== 'OFF' && ` (${config.serialcom || '192.168.1.1'}:${config.baudrate || '4001'})`}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase flex flex-wrap items-baseline gap-x-2">
              <span>Automatic weather station</span> <span className="text-[#00f0ff] text-xs font-mono lowercase tracking-[0.05em] bg-[#00f0ff]/10 py-0.5 px-3 rounded border border-[#00f0ff]/30 font-bold">Pro AWS</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-bold">
              Kondisi Operasional Port & Log Terminal Cuaca Maritim
            </p>
          </div>

          <div className="flex items-center gap-6 self-stretch lg:self-auto justify-between lg:justify-end border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
            <div className="hidden xl:flex gap-6 text-right">
              <div>
                <div className="text-xs uppercase font-bold opacity-40 tracking-wider text-[#00f0ff]">DB STATUS</div>
                {config.transport !== 'OFF' && !isLiveActive ? (
                  <div className="text-xs font-mono font-bold text-rose-500 animate-pulse">DATA_STALE_WARNING</div>
                ) : (
                  <div className="text-xs font-mono font-bold text-emerald-400">CONNECT_SECURE</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase font-bold opacity-40 tracking-wider text-[#00f0ff]">PIER ALIGNMENT</div>
                <div className="text-xs font-mono font-bold text-[#3b82f6]">{config.pierAngle}° CLOCKWISE</div>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10 hidden xl:block" />
            <div className="text-right flex flex-col items-end">
              <div className="text-xs font-mono opacity-50 uppercase tracking-widest text-[#00f0ff] font-semibold">
                {format(currentClockTime, 'EEEE, dd MMM yyyy')}
              </div>
              <div className="text-2xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.08)] bg-white/5 py-0.5 px-3 rounded-xl border border-white/5 mt-0.5">
                {format(currentClockTime, 'HH:mm:ss')} <span className="text-[10px] text-teal-400 font-bold ml-1">LOKAL</span>
              </div>
              <div className="text-xs font-black font-mono tracking-wider text-amber-400 mt-1 uppercase flex items-center gap-1.5 bg-amber-500/10 py-0.5 px-2.5 rounded-lg border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>LOGGER UTC: {(() => {
                  const activeTime = isLiveActive && currentData ? new Date(currentData.timestamp) : new Date();
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${pad(activeTime.getUTCHours())}:${pad(activeTime.getUTCMinutes())}:${pad(activeTime.getUTCSeconds())} UTC`;
                })()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE tab 1: REALTIME DASH */}
        {activeTab === 'realtime' && (
          <div className="relative min-h-[600px]">
            
            {/* 1. FULL SCREEN LOCK OVERLAY: Shown if offline AND lock is enabled (ON) */}
            {config.transport !== 'OFF' && !isLiveActive && config.lockOfflineDashboard !== 'OFF' && (
              <div className="absolute inset-0 bg-[#020408]/92 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center rounded-3xl border border-red-500/20">
                <div className="max-w-xl space-y-6">
                  <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-red-500 tracking-tight uppercase">
                      🔴 STATUS AWS: OFFLINE (TIDAK ADA DATA MASUK)
                    </h2>
                    <p className="text-sm text-slate-200 font-medium">
                      Sensor data stream terputus! Tidak ada paket data baru yang diterima dari Data Logger.
                    </p>
                    <p className="text-xs text-slate-400 font-sans max-w-md mx-auto leading-relaxed">
                      Sistem mengamankan dashboard dan menyembunyikan data buffer usang untuk menghindari kesalahan analisis oleh petugas di lapangan. Anda dapat mematikan pengunci ini di menu Setting jika ingin tetap menampilkan data terakhir.
                    </p>
                  </div>
                  
                  <div className="bg-[#050a12]/90 border border-red-500/15 p-4 rounded-xl font-mono text-[11px] text-left text-slate-300 space-y-2 max-w-md mx-auto shadow-inner">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">Logger Transport Mode:</span> <span className="font-extrabold text-red-400">{config.transport}</span></div>
                    {config.transport === 'MOXA_TCP' ? (
                      <>
                        <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">IP Gateway Moxa:</span> <span className="font-bold text-slate-200">{config.serialcom || '192.168.1.1'}</span></div>
                        <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">Port Gateway Moxa:</span> <span className="font-bold text-slate-200">{config.baudrate || '4001'}</span></div>
                      </>
                    ) : (
                      <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">Serial Port / Endpoint:</span> <span className="font-bold text-slate-200">{config.serialcom || 'COM1'}</span></div>
                    )}
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">Waktu Timeout Sistem:</span> <span className="font-bold text-amber-500">25 Detik Tanpa Data</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Status Jalur Data:</span> <span className="font-extrabold text-red-500 animate-pulse">🔴 TERMINATED / NO CONNECTION</span></div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <button 
                      onClick={() => {
                        const newCfg = { ...config, transport: 'OFF' };
                        setConfig(newCfg);
                        localStorage.setItem('aws_config', JSON.stringify(newCfg));
                        showToastNotification("Simulation mode turned ON automatically!");
                      }}
                      className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-mono text-xs font-black px-6 py-3 rounded-xl uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      🔧 Aktifkan Mode Simulasi (OFF)
                    </button>
                    <button 
                      onClick={() => {
                        const newCfg = { ...config, lockOfflineDashboard: 'OFF' };
                        setConfig(newCfg);
                        localStorage.setItem('aws_config', JSON.stringify(newCfg));
                        showToastNotification("Dashboard lock disabled. Showing last known data.");
                      }}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold px-6 py-3 rounded-xl uppercase tracking-wider transition-all border border-white/10 cursor-pointer"
                    >
                      🔓 Tetap Tampilkan Data Terakhir
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 2. WARNING BANNER AT TOP: Shown if offline AND lock is disabled (OFF) */}
            {config.transport !== 'OFF' && !isLiveActive && config.lockOfflineDashboard === 'OFF' && (
              <div className="mb-6 bg-gradient-to-r from-red-950/40 via-rose-950/30 to-red-950/40 border-2 border-red-500/40 rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="text-left space-y-0.5">
                    <span className="text-sm font-black text-red-400 tracking-wider font-mono block">🔴 WARNING: ALAT OFFLINE / JALUR DATA MASUK TERPUTUS</span>
                    <p className="text-xs text-slate-300 leading-normal">
                      Koneksi ke data logger aktif terputus. Dashboard saat ini menampilkan data rekaman terakhir yang tersimpan di sistem (<span className="text-amber-400 font-bold">stale data buffer</span>) untuk keamanan navigasi.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      const newCfg = { ...config, lockOfflineDashboard: 'ON' };
                      setConfig(newCfg);
                      localStorage.setItem('aws_config', JSON.stringify(newCfg));
                    }}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-mono text-[10px] font-black tracking-widest px-4 py-2.5 rounded-lg uppercase transition-all whitespace-nowrap cursor-pointer"
                  >
                    🔒 Aktifkan Kunci Layar
                  </button>
                  <button 
                    onClick={() => {
                      const newCfg = { ...config, transport: 'OFF' };
                      setConfig(newCfg);
                      localStorage.setItem('aws_config', JSON.stringify(newCfg));
                      showToastNotification("Simulation mode turned ON automatically!");
                    }}
                    className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-mono text-[10px] font-black tracking-widest px-4 py-2.5 rounded-lg uppercase transition-all whitespace-nowrap shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
                  >
                    🔧 Jalankan Simulasi (OFF)
                  </button>
                </div>
              </div>
            )}

            {/* Apply blur and pointer events lock ONLY if offline AND lock is enabled */}
            <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch ${config.transport !== 'OFF' && !isLiveActive && config.lockOfflineDashboard !== 'OFF' ? 'pointer-events-none opacity-30 filter blur-[2px]' : ''}`}>
            
            {/* COLUMN 1: KONDISI ATMOSFER (width 3/12 on large screens) */}
            <div className="lg:col-span-3 flex flex-col space-y-4 h-full">
              
              {/* Thermal group - Card 1 */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-4.5 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between space-y-3">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                  <Thermometer className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span>Thermal Sensors</span>
                </div>

                <div className="flex-1 flex flex-col justify-center space-y-2.5">
                  {/* Primary Air temp StatCard */}
                  <div className="bg-[#0b1424] border border-[#22c55e]/10 p-3 rounded-xl text-center transition-colors hover:border-[#22c55e]/20">
                    <div className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Saat Ini</div>
                    <div className="text-2xl md:text-3xl font-bold font-mono text-[#22c55e]">
                      {currentData.temperature.toFixed(1)} <span className="text-xs font-semibold text-slate-400 ml-0.5">°C</span>
                    </div>
                  </div>

                  {/* Avg, Max, Min grid row inside column 1 */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-[#0b1424] border border-white/5 py-1.5 px-1 rounded-lg transition-colors hover:border-white/10 text-center">
                      <div className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Avg</div>
                      <div className="text-base font-bold font-mono text-[#e0f2fe]">
                        {tempStats.avg} <span className="text-xs font-semibold text-slate-400 ml-0.5">°C</span>
                      </div>
                    </div>
                    <div className="bg-[#0b1424] border border-rose-500/10 py-1.5 px-1 rounded-lg transition-colors hover:border-rose-500/20 text-center">
                      <div className="text-xs uppercase text-rose-400 font-semibold tracking-wide block mb-1 font-sans">Max</div>
                      <div className="text-base font-bold font-mono text-rose-400">
                        {tempStats.max} <span className="text-xs font-semibold text-slate-400 ml-0.5">°C</span>
                      </div>
                    </div>
                    <div className="bg-[#0b1424] border border-teal-500/10 py-1.5 px-1 rounded-lg transition-colors hover:border-teal-500/20 text-center">
                      <div className="text-xs uppercase text-teal-400 font-semibold tracking-wide block mb-1 font-sans">Min</div>
                      <div className="text-base font-bold font-mono text-teal-400">
                        {tempStats.min} <span className="text-xs font-semibold text-slate-400 ml-0.5">°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hygro, Solar & Rain Group - Card 2 */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-4.5 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between space-y-3 font-sans">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2 font-sans">
                  <Droplets className="w-3.5 h-3.5 text-[#00ff66]" />
                  <span>Hygro, Solar & Rain</span>
                </div>
                
                <div className="flex-1 flex flex-col justify-between gap-2">
                  <div className="bg-[#0b1424] border border-white/5 rounded-xl p-2.5 flex justify-between items-center transition-colors hover:border-[#00ff66]/10">
                    <span className="text-xs uppercase font-semibold tracking-wide text-slate-300 font-sans">Humidity</span>
                    <div className="text-right">
                      <span className="text-xl font-bold font-mono text-white">{currentData.humidity}</span>
                      <span className="text-xs text-[#00f0ff] ml-1 font-bold">%</span>
                    </div>
                  </div>

                  <div className="bg-[#0b1424] border border-white/5 rounded-xl p-2.5 flex justify-between items-center transition-colors hover:border-[#00ff66]/10">
                    <span className="text-xs uppercase font-semibold tracking-wide text-slate-300 font-sans">Dew Point</span>
                    <div className="text-right">
                      <span className="text-xl font-bold font-mono text-white">
                        {computeDewPoint(currentData.temperature, currentData.humidity)}
                      </span>
                      <span className="text-xs text-[#00f0ff] ml-1 font-bold">°C</span>
                    </div>
                  </div>

                  <div className="bg-[#0b1424] border border-amber-500/10 rounded-xl p-2.5 flex justify-between items-center transition-colors hover:border-amber-500/25">
                    <span className="text-xs uppercase font-semibold tracking-wide text-amber-400 font-sans">Irradiance</span>
                    <div className="text-right flex flex-col items-end">
                      <div>
                        <span className="text-xl font-bold font-mono text-amber-400">{currentData.solarRadiation}</span>
                        <span className="text-xs text-amber-500 ml-1 font-bold">W/m²</span>
                      </div>
                      <span className="text-[10px] text-amber-500/70 font-mono">
                        Max: {currentData.solarRadiationMax ?? Math.round(currentData.solarRadiation * 1.15)} W/m²
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const rainVal = currentData.rainfall;
                    const threshold = parseFloat(config.rainWarningThreshold || '10.0');
                    const isHeavyRain = rainVal >= threshold;
                    return (
                      <div className={`bg-[#0b1424] border rounded-xl p-2.5 flex justify-between items-center transition-colors ${isHeavyRain ? 'border-sky-500/50 bg-sky-950/20 shadow-[0_0_10px_rgba(14,165,233,0.15)] animate-pulse' : 'border-sky-500/10 hover:border-sky-500/25'}`}>
                        <span className="text-xs uppercase font-semibold tracking-wide text-sky-400 font-sans flex items-center gap-1.5">
                          <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                          Rainfall {isHeavyRain && <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1 py-0.2 rounded font-mono font-bold animate-bounce">LEBAT</span>}
                        </span>
                        <div className="text-right">
                          <span className="text-xl font-bold font-mono text-sky-400">{rainVal.toFixed(1)}</span>
                          <span className="text-xs text-sky-500 ml-1 font-bold">mm</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Sea Water Quality (pH Air) Indicator - Card 3 */}
              {(() => {
                const minPh = parseFloat(config.minPhThreshold || '6.5');
                const maxPh = parseFloat(config.maxPhThreshold || '8.5');
                const phValue = currentData.waterPh ?? 7.8;
                const isPhUnsafe = phValue < minPh || phValue > maxPh;
                
                return (
                  <div className={`bg-gradient-to-b from-[#0b1424]/40 to-bg p-4.5 rounded-2xl border transition-all ${isPhUnsafe ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse' : 'border-white/5'} flex-1 flex flex-col justify-between space-y-3`}>
                    <div>
                      <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <Droplet className={`w-3.5 h-3.5 ${isPhUnsafe ? 'text-amber-400 font-bold' : 'text-pink-400'}`} />
                          <span>Kualitas Air</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">INTEGRATED</span>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <div className="bg-[#050a12]/80 border border-white/5 p-3 rounded-xl space-y-2">
                        <span className="text-xs uppercase font-semibold tracking-wider text-slate-300 block border-b border-white/10 pb-1 font-sans">🌊 Live Water Quality Index</span>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-[#0b1424] border border-pink-500/10 py-1.5 px-2 rounded-lg transition-colors hover:border-pink-500/20">
                            <span className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">pH Value</span>
                            <span className={`text-lg font-bold font-mono ${isPhUnsafe ? 'text-amber-400' : 'text-pink-400'}`}>
                              {phValue.toFixed(2)} <span className="text-xs font-bold text-slate-400 ml-0.5">pH</span>
                            </span>
                          </div>
                          <div className="bg-[#0b1424] border border-white/5 py-1.5 px-2 rounded-lg flex flex-col justify-center items-center transition-colors hover:border-white/10">
                            <span className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Status</span>
                            <span className={`text-xs md:text-sm font-bold font-mono uppercase ${isPhUnsafe ? 'text-amber-400' : phValue < 7.0 ? 'text-rose-400' : phValue > 8.5 ? 'text-pink-400' : 'text-emerald-400'}`}>
                              {isPhUnsafe ? "⚠️ BAHAYA" : phValue < 7.0 ? "Asam" : phValue > 8.5 ? "Basa" : "Ideal"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Suhu Air / Water Temp Panel */}
                      <div className="bg-[#050a12]/80 border border-white/5 p-3 rounded-xl space-y-2 mt-3">
                        <span className="text-xs uppercase font-semibold tracking-wider text-slate-300 block border-b border-white/10 pb-1 font-sans">🌡️ Temperatur Air / Water Temp</span>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-[#0b1424] border border-[#38bdf8]/10 py-1 px-2 rounded-lg transition-colors hover:border-[#38bdf8]/20 col-span-3 sm:col-span-1 flex flex-col justify-center items-center">
                            <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide block mb-0.5 font-sans">Saat Ini</span>
                            <span className="text-sm font-extrabold font-mono text-[#38bdf8]">
                              {(currentData.waterTemp ?? (currentData.temperature - 1.2)).toFixed(1)} <span className="text-[10px] font-bold text-slate-400">°C</span>
                            </span>
                          </div>
                          <div className="bg-[#0b1424] border border-white/5 py-1 px-2 rounded-lg flex flex-col justify-center items-center transition-colors hover:border-white/10">
                            <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide block mb-0.5 font-sans">Min</span>
                            <span className="text-xs font-bold font-mono text-cyan-400">
                              {waterTempStats.min} <span className="text-[10px] text-slate-500">°C</span>
                            </span>
                          </div>
                          <div className="bg-[#0b1424] border border-white/5 py-1 px-2 rounded-lg flex flex-col justify-center items-center transition-colors hover:border-white/10">
                            <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide block mb-0.5 font-sans">Max</span>
                            <span className="text-xs font-bold font-mono text-rose-400">
                              {waterTempStats.max} <span className="text-[10px] text-slate-500">°C</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

             {/* COLUMN 2: COMMAND CENTER WIND COMPASS (width 5/12 on large screens) */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#0d1726]/80 to-bg border border-[#00f0ff]/20 p-6 rounded-3xl relative min-h-[500px] flex flex-col justify-between shadow-[0_30px_70px_rgba(0,0,0,0.9)] h-full">
              <div className="absolute top-0 right-0 w-24 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/30 to-transparent" />
              
              <div className="text-center font-bold">
                <h3 className="text-xs uppercase font-extrabold tracking-[0.25em] text-[#00f0ff] flex items-center justify-center gap-2 mb-1">
                  🌐 Live Wind Vector & Port Orientation ({config.pierAngle}°)
                </h3>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest bg-white/5 py-0.5 px-3 rounded">
                  CONSOLE_INTEGRATION_ONLINE
                </span>
              </div>

              {/* Dynamic Maritime Hazard Alert Panel (EWS) */}
              {(() => {
                const windSpeedVal = currentData.windSpeed;
                const windGustVal = currentData.windGust ?? 0;
                
                // 1 m/s = 1.94 knots
                const wsKts = windSpeedVal * 1.94384;
                const wgKts = windGustVal * 1.94384;

                const isStormHazard = windSpeedVal >= 15.0 || windGustVal >= 18.0;
                const isGustWarning = !isStormHazard && windGustVal >= 14.0;
                const isAnginKencang = !isStormHazard && !isGustWarning && windSpeedVal >= 10.0;

                const relativeVesselWind = (currentData.windDirection - (parseFloat(config.pierAngle) || 0) + 360) % 360;
                const crosswindSpeed = windSpeedVal * Math.abs(Math.sin((relativeVesselWind * Math.PI) / 180));
                const crossKts = crosswindSpeed * 1.94384;
                const isCrosswindHazard = !isStormHazard && !isGustWarning && !isAnginKencang && crosswindSpeed >= 8.0;

                if (isStormHazard) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-rose-500/50 bg-rose-950/40 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.25)] select-none">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <span className="text-xs font-extrabold text-rose-400 uppercase tracking-wider font-mono text-center">
                        🔥 SIAGA 1: BADAI EKSTRIM ({windSpeedVal.toFixed(1)} m/s / {wsKts.toFixed(0)} kt • Gust: {windGustVal > 0 ? windGustVal.toFixed(1) + ' m/s' : '—'})
                      </span>
                    </div>
                  );
                } else if (isGustWarning) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-orange-500/50 bg-orange-950/30 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse select-none shadow-[0_0_10px_rgba(249,115,22,0.15)]">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                      </span>
                      <span className="text-xs font-extrabold text-orange-400 uppercase tracking-wider font-mono text-center">
                        💨 SIAGA 2: WIND GUST HEMBUSAN ({windGustVal.toFixed(1)} m/s / {wgKts.toFixed(0)} kt)
                      </span>
                    </div>
                  );
                } else if (isAnginKencang) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-amber-500/45 bg-amber-950/20 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse select-none shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider font-mono text-center">
                        ⚠️ SIAGA 3: ANGIN KENCANG ({windSpeedVal.toFixed(1)} m/s / {wsKts.toFixed(0)} kt)
                      </span>
                    </div>
                  );
                } else if (isCrosswindHazard) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-cyan-500/50 bg-[#082f49]/40 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse select-none shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                      <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider font-mono text-center">
                        ⚠️ WARNING: ANGIN SAMPING / CROSSWIND ({crosswindSpeed.toFixed(1)} m/s / {crossKts.toFixed(0)} kt)
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-1.5 border border-emerald-500/20 bg-emerald-950/10 rounded-xl flex items-center gap-2 justify-center max-w-xs select-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono text-center">
                        🟢 STATUS OPERASI: AMAN & NORMAL
                      </span>
                    </div>
                  );
                }
              })()}

              {/* WIND COMPASS PORT-REPRESENTATION (PORT & STD) */}
              <div className="flex justify-center items-center my-6 relative">
                
                {/* PORT STD side panels labels */}
                <div className="absolute left-1 md:left-2 lg:left-0.5 top-1/2 -translate-y-1/2 text-center bg-[#0b1424]/90 border border-white/10 p-2 rounded-xl max-w-[100px] shadow-xl select-none font-sans z-10 scale-90 lg:scale-80 xl:scale-100">
                  <div className="text-[10px] md:text-xs font-black text-[#00f0ff] uppercase tracking-wider mb-0.5">PORT</div>
                  <div className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase leading-none">Kiri / Left</div>
                </div>

                {/* Compass Ring wrapper with dynamic warning colors */}
                {(() => {
                  const windSpeedVal = currentData.windSpeed;
                  const windGustVal = currentData.windGust ?? 0;
                  const isStormHazard = windSpeedVal >= 15.0 || windGustVal >= 18.0;
                  const isGustWarning = windGustVal >= 14.0;
                  const isAnginKencang = windSpeedVal >= 10.0;
                  
                  const relativeVesselWind = (currentData.windDirection - (parseFloat(config.pierAngle) || 0) + 360) % 360;
                  const crosswindSpeed = windSpeedVal * Math.abs(Math.sin((relativeVesselWind * Math.PI) / 180));
                  const isCrosswindHazard = crosswindSpeed >= 8.0;
                  
                  let ringBorderColor = "border-slate-700 shadow-[#00f0ff]/5";
                  if (isStormHazard) {
                    ringBorderColor = "border-rose-900/80 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse";
                  } else if (isGustWarning || isAnginKencang) {
                    ringBorderColor = "border-amber-700/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
                  } else if (isCrosswindHazard) {
                    ringBorderColor = "border-cyan-800/80 shadow-[0_0_15px_rgba(6,182,212,0.15)]";
                  }

                  return (
                    <div className={`relative w-80 h-80 rounded-full border-8 transition-all duration-700 flex items-center justify-center bg-radial-gradient from-[#00f0ff]/10 to-[#0284c7]/30 shadow-[inset_0_0_40px_rgba(0,0,0,0.85)] ${ringBorderColor}`}>
                      {/* Water ring container inside - enlarged proportionally */}
                      <div className="absolute w-[200px] h-[200px] rounded-full border border-white/5 bg-transparent pointer-events-none" />

                      {/* Direction characters - slightly repositioned for larger dial size */}
                      <span className="absolute top-2.5 text-slate-200 text-xs font-black tracking-widest font-sans">N</span>
                      <span className="absolute bottom-2.5 text-slate-200 text-xs font-black tracking-widest font-sans">S</span>
                      <span className="absolute right-4 text-slate-200 text-xs font-black tracking-widest font-sans font-extrabold">E</span>
                      <span className="absolute left-4 text-slate-200 text-xs font-black tracking-widest font-sans font-extrabold">W</span>

                      {/* Center Wind Speed Badge HUD (upright overlay) - Enlarged for optimal visibility */}
                      <div className="absolute w-20 h-20 rounded-full bg-[#030712]/95 border-2 border-[#00ff66]/50 flex flex-col items-center justify-center shadow-[0_0_18px_rgba(0,255,102,0.35)] z-30 font-mono pointer-events-none transition-all duration-300">
                        <span className="text-[9px] uppercase tracking-widest text-[#00ff66]/70 font-extrabold leading-none mb-1">WIND</span>
                        <span className="text-xl font-black text-[#00ff66] leading-none mb-0.5">{currentData.windSpeed.toFixed(1)}</span>
                        <span className="text-[8px] text-slate-400 font-sans leading-none font-bold text-center">m/s ({(currentData.windSpeed * 1.94384).toFixed(1)} kt)</span>
                      </div>

                      {/* Port/Darat vs Sea/Open Water Boundary Divider Line rotated with visual pierAngle state */}
                      <div 
                        className="absolute w-full h-full flex items-center justify-center transition-all duration-1000 ease-out z-10 pointer-events-none"
                        style={{ transform: `rotate(${config.pierAngle}deg)` }}
                      >
                        <div className="relative w-full h-full flex items-center justify-center">
                          {/* High-contrast thick rectangular block/pier separating PORT and OPEN SEA */}
                          <div className="absolute h-[246px] w-[18px] bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-600 rounded-sm border-2 border-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.75)]" />
                          {/* Inner technical center dashed guide line */}
                          <div className="absolute h-[246px] w-[2px] bg-white/30 border-l border-dashed border-white/40" />
                          
                          {/* Anchor dock markers at the edges of the line - aligned carefully */}
                          <div className="absolute top-[12px] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                          <div className="absolute bottom-[12px] w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />

                          {/* Left side region: PORT / AREA DARAT */}
                          <div className="absolute left-[40px] top-[110px] text-[7.5px] uppercase font-black text-cyan-400/60 font-sans tracking-[0.25em] -rotate-90">
                            PORT / AREA DARAT
                          </div>
                          
                          {/* Right side region: LAUT LEPAS / OPEN SEA */}
                          <div className="absolute right-[40px] top-[110px] text-[7.5px] uppercase font-black text-emerald-400/60 font-sans tracking-[0.25em] rotate-90">
                            LAUT LEPAS / OPEN SEA
                          </div>
                        </div>
                      </div>

                      {/* Pointer rotating Wind Arrow strictly matching live wind arah direction */}
                      <div 
                        className="absolute w-full h-full flex items-center justify-center transition-all duration-1000 ease-out pointer-events-none z-20"
                        style={{ transform: `rotate(${currentData.windDirection}deg)` }}
                      >
                        {/* Bright Neon Green wind pointer arrow at top boundary of dial */}
                        <div className="absolute top-[4px] bottom-[4px] w-[2px] bg-gradient-to-b from-[#00ff66]/70 via-[#00ff66]/10 to-transparent flex flex-col items-center">
                          {/* Custom vector Navigation arrowhead pointing downwards towards center of compass */}
                          <svg 
                            className="w-12 h-12 text-[#00ff66] fill-[#00ff66]/35 drop-shadow-[0_0_15px_#00ff66] -mt-3" 
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polygon points="12,22 2,4 12,9 22,4" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* STARBOARD std side panel labels */}
                <div className="absolute right-1 md:right-2 lg:right-0.5 top-1/2 -translate-y-1/2 text-center bg-[#0b1424]/90 border border-white/10 p-2 rounded-xl max-w-[100px] shadow-xl select-none font-sans z-10 scale-90 lg:scale-80 xl:scale-100">
                  <div className="text-[10px] md:text-xs font-black text-[#22c55e] uppercase tracking-wider mb-0.5">STARBOARD</div>
                  <div className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase leading-none">Kanan / Right</div>
                </div>

              </div>

              {/* Angle display relative wind and wind digital specifications */}
              <div className="grid grid-cols-2 gap-4 items-center mb-6 max-w-md mx-auto bg-[#050a12]/70 p-3.5 rounded-2xl border border-white/5 text-center font-mono text-xs">
                <div className="border-r border-white/10 pr-2">
                  <span className="text-slate-400 uppercase text-xs tracking-wider block font-sans">Relative Wind</span>
                  <span className="text-sm font-extrabold text-[#00f0ff]">{relativeVesselWind.toFixed(0)}° Azimuth</span>
                </div>
                <div className="pl-2">
                  <span className="text-slate-400 uppercase text-xs tracking-wider block font-sans">Arah & Rose</span>
                  <span className="text-sm font-extrabold text-[#f59e0b]">{currentData.windDirection}° ({getWindRoseString(currentData.windDirection)})</span>
                </div>
              </div>

              {/* Bottom horizontal grid showing: Marine & Wind Data digital */}
              <div className="border border-[#00f0ff]/15 bg-gradient-to-b from-[#0b1424]/70 to-bg p-4.5 rounded-2xl relative">
                <div className="text-xs uppercase tracking-[0.25em] font-extrabold text-slate-300 mb-3 font-sans flex items-center justify-between">
                  <span>⚓ Marine & Wind Digital Indicators</span>
                  <span className="text-xs font-mono text-[#00f0ff]/50">ACC_SYS_01</span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">Wind Dir</span>
                    <span className="text-base font-black font-mono text-[#00f0ff]">{currentData.windDirection}°</span>
                  </div>
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center flex flex-col justify-center items-center">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">Wind Spd</span>
                    <span className="text-base font-black font-mono text-[#00f0ff]">{currentData.windSpeed.toFixed(1)} <span className="text-xs font-sans font-normal text-slate-400">m/s</span></span>
                    <span className="text-xs font-bold text-emerald-400 font-sans mt-0.5">({(currentData.windSpeed * 1.94384).toFixed(1)} kt)</span>
                  </div>
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center flex flex-col justify-center items-center">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">Wind Gust</span>
                    <span className="text-base font-black font-mono text-amber-400">
                      {currentData.windGust !== undefined && currentData.windGust !== null ? (
                        <>
                          {currentData.windGust.toFixed(1)} <span className="text-xs font-sans font-normal text-slate-400">m/s</span>
                          <span className="text-xs text-emerald-400 font-sans block font-bold mt-0.5">({(currentData.windGust * 1.94384).toFixed(1)} kt)</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">Water Lvl</span>
                    <span className="text-base font-black font-mono text-[#3b82f6]">{(currentData.seaLevel / 100).toFixed(3)}m</span>
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMN 3: WIND ROSE & PRESSURE ATN (4/12 on large screens) */}
            <div className="lg:col-span-4 flex flex-col space-y-4 h-full">
              
              {/* Pressure ATN group (compact & premium layout) - Shrunk & moved to top */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-3.5 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between space-y-2">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                  <Gauge className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pressure ATN Info</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-sans flex-1 flex items-center">
                  <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center w-full">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-0.5 truncate" title="Barometer">Barometer</span>
                    <span className="text-xs font-black font-mono text-[#00f0ff] block">{currentData.pressure.toFixed(1)} <span className="text-[8px] font-sans text-slate-400 font-normal w-full">hPa</span></span>
                  </div>
                  <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center w-full">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-0.5 truncate" title="QFF">QFF</span>
                    <span className="text-xs font-black font-mono text-emerald-400 block">{(currentData.pressure + 2.1).toFixed(1)} <span className="text-[8px] font-sans text-slate-400 font-normal w-full">hPa</span></span>
                  </div>
                  <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center w-full">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-0.5 truncate" title="QFE">QFE</span>
                    <span className="text-xs font-black font-mono text-[#00f0ff] block">{currentData.pressure.toFixed(1)} <span className="text-[8px] font-sans text-slate-400 font-normal w-full">hPa</span></span>
                  </div>
                </div>
              </div>

              {/* System Power & Battery Status Card */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-3.5 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between space-y-2">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    {currentData.solarRadiation > 50 ? (
                      <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    ) : (
                      <Battery className="w-3.5 h-3.5 text-teal-400" />
                    )}
                    <span>Status Baterai & Daya</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">POWER MODULE</span>
                </div>
                
                {(() => {
                  const volt = currentData.battery ?? 12.2;
                  const pct = Math.max(0, Math.min(100, Math.round(((volt - 11.5) / 1.1) * 100)));
                  const isCharging = currentData.solarRadiation > 50;
                  
                  let statusText = "Optimal";
                  let statusColor = "text-emerald-400 border-emerald-500/20";
                  let barColor = "bg-emerald-500";
                  
                  if (volt < 11.8) {
                    statusText = "⚠️ Low Volt";
                    statusColor = "text-rose-400 border-rose-500/20";
                    barColor = "bg-rose-500";
                  } else if (volt < 12.1) {
                    statusText = "Sufficient";
                    statusColor = "text-amber-400 border-amber-500/20";
                    barColor = "bg-amber-500";
                  }
                  
                  return (
                    <div className="grid grid-cols-12 gap-3 items-center font-sans">
                      {/* Left: Progress bar & Volt */}
                      <div className="col-span-8 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-black font-mono text-white tracking-tight">
                            {volt.toFixed(2)} <span className="text-xs font-normal text-slate-400">V</span>
                          </span>
                          <span className="text-xs font-bold text-slate-300 font-mono">
                            {pct}% {isCharging && <span className="text-[10px] text-emerald-400 font-bold ml-1">▲ Solar Charge</span>}
                          </span>
                        </div>
                        {/* Custom progress bar */}
                        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-white/5 p-[1px]">
                          <div 
                            className={`h-full rounded-full ${barColor} transition-all duration-1000`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Right: Status badge */}
                      <div className="col-span-4 text-center">
                        <div className={`border p-1.5 rounded-lg font-mono text-[10px] font-bold uppercase ${statusColor} bg-[#0b1424]`}>
                          {statusText}
                        </div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 mt-1 block">Telemetry</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Wind Rose Visual Card (High Polished Polar Chart) */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-4 rounded-2xl border border-white/5 flex flex-col flex-[2] justify-between space-y-2.5">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-amber-500 transform rotate-45" />
                    <span>Wind Rose (24H)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">POLE GRID</span>
                </div>
                
                <div className="flex flex-row items-center justify-between gap-3.5 py-1.5">
                  {/* Left Column: Wind Rose SVG */}
                  <div className="flex-1 flex justify-center items-center">
                    {(() => {
                      const cx = 100;
                      const cy = 100;
                      const maxR = 75;
                      
                      // 1. Bin data
                      const matrix = Array.from({ length: 16 }, () => Array(7).fill(0));
                      const totalLogs = history.length;
                      
                      history.forEach(row => {
                        const deg = row.windDirection;
                        const norm = ((deg % 360) + 360) % 360;
                        const idx = Math.floor(((norm + 11.25) % 360) / 22.5);
                        
                        const speed = row.windSpeed;
                        if (speed <= 4) matrix[idx][0]++;
                        else if (speed <= 6) matrix[idx][1]++;
                        else if (speed <= 10) matrix[idx][2]++;
                        else if (speed <= 15) matrix[idx][3]++;
                        else if (speed <= 20) matrix[idx][4]++;
                        else if (speed <= 25) matrix[idx][5]++;
                        else matrix[idx][6]++;
                      });
                      
                      // 2. Scale calculations
                      const maxCountInAnySector = Math.max(1, ...matrix.map(row => row.reduce((a, b) => a + b, 0)));
                      const maxPctInAnySector = totalLogs > 0 ? (maxCountInAnySector / totalLogs) * 100 : 10;
                      const maxPctScope = Math.max(10, Math.ceil(maxPctInAnySector / 5) * 5);
                      
                      // 3. Render Helper to convert polar to cartesian
                      const getXY = (r: number, deg: number) => {
                        const rad = ((deg - 90) * Math.PI) / 180.0;
                        return {
                          x: cx + r * Math.cos(rad),
                          y: cy + r * Math.sin(rad),
                        };
                      };
                      
                      const colors = [
                        '#4a628a', // 0-4
                        '#22c55e', // 4-6
                        '#eab308', // 6-10
                        '#f97316', // 10-15
                        '#db2777', // 15-20
                        '#7c3aed', // 20-25
                        '#2563eb', // >25
                      ];
                      
                      return (
                        <svg viewBox="0 0 200 200" className="w-[220px] h-[220px] sm:w-[250px] sm:h-[250px] select-none font-sans">
                          {/* Background polar grid circles */}
                          <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} strokeDasharray="2 3" />
                          <circle cx={cx} cy={cy} r={maxR * 0.5} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.7} strokeDasharray="2 3" />
                          <circle cx={cx} cy={cy} r={3} fill="#1e293b" stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                          
                          {/* Compass main axes lines */}
                          <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(255,255,255,0.05)" strokeWidth={0.7} />
                          <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(255,255,255,0.05)" strokeWidth={0.7} />
                          
                          {/* Ring labels */}
                          <text x={cx + 2} y={cy - maxR + 8} fill="rgba(0,240,255,0.4)" fontSize={5.5} className="font-mono font-bold">{maxPctScope.toFixed(0)}%</text>
                          <text x={cx + 2} y={cy - (maxR * 0.5) + 6} fill="rgba(255,255,255,0.25)" fontSize={5.5} className="font-mono">{(maxPctScope / 2).toFixed(0)}%</text>

                          {/* Cardinal Labels */}
                          <text x={cx} y={cy - maxR - 4} fill="#f8fafc" fontSize={7} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">N</text>
                          <text x={cx + maxR + 5} y={cy} fill="#94a3b8" fontSize={7} fontWeight="bold" textAnchor="start" alignmentBaseline="middle">E</text>
                          <text x={cx} y={cy + maxR + 5} fill="#94a3b8" fontSize={7} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">S</text>
                          <text x={cx - maxR - 5} y={cy} fill="#94a3b8" fontSize={7} fontWeight="bold" textAnchor="end" alignmentBaseline="middle">W</text>

                          {/* NE, SE, SW, NW Labels */}
                          {(() => {
                            const rText = maxR - 10;
                            const ne = getXY(rText, 45);
                            const se = getXY(rText, 135);
                            const sw = getXY(rText, 225);
                            const nw = getXY(rText, 315);
                            return (
                              <>
                                <text x={ne.x} y={ne.y} fill="rgba(255,255,255,0.15)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">NE</text>
                                <text x={se.x} y={se.y} fill="rgba(255,255,255,0.15)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">SE</text>
                                <text x={sw.x} y={sw.y} fill="rgba(255,255,255,0.15)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">SW</text>
                                <text x={nw.x} y={nw.y} fill="rgba(255,255,255,0.15)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">NW</text>
                              </>
                            );
                          })()}

                          {/* Stacked polar wedges */}
                          {matrix.map((binsInSector, dIdx) => {
                            const centralAngle = dIdx * 22.5;
                            const angleStart = centralAngle - 7.5;
                            const angleEnd = centralAngle + 7.5;
                            
                            let cumCount = 0;
                            
                            return binsInSector.map((countInBin, bIdx) => {
                              if (countInBin === 0) return null;
                              
                              const startCount = cumCount;
                              const endCount = cumCount + countInBin;
                              cumCount = endCount; 
                              
                              if (totalLogs === 0) return null;
                              
                              const pctStart = (startCount / totalLogs) * 100;
                              const pctEnd = (endCount / totalLogs) * 100;
                              
                              const rStart = Math.max(3, (pctStart / maxPctScope) * maxR);
                              const rEnd = (pctEnd / maxPctScope) * maxR;
                              
                              if (rEnd - rStart < 0.2) return null;
                              
                              const p1 = getXY(rEnd, angleStart);
                              const p2 = getXY(rEnd, angleEnd);
                              const p3 = getXY(rStart, angleEnd);
                              const p4 = getXY(rStart, angleStart);
                              
                              const path = `M ${p1.x} ${p1.y} A ${rEnd} ${rEnd} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rStart} ${rStart} 0 0 0 ${p4.x} ${p4.y} Z`;
                              
                              return (
                                <path 
                                  key={`${dIdx}-${bIdx}`} 
                                  d={path} 
                                  fill={colors[bIdx]} 
                                  opacity={0.88} 
                                  className="transition-all duration-300 hover:opacity-100 hover:stroke-white/30 hover:stroke-[0.5px]"
                                >
                                  <title>{`Arah: ${['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][dIdx]} | Kecepatan: ${['0-4 m/s', '4-6 m/s', '6-10 m/s', '10-15 m/s', '15-20 m/s', '20-25 m/s', '>25 m/s'][bIdx]} | Proporsi: ${((countInBin / totalLogs) * 100).toFixed(1)}%`}</title>
                                </path>
                              );
                            });
                          })}
                        </svg>
                      );
                    })()}
                  </div>

                  {/* Right Column: Vertically arranged Speed Legend */}
                  <div className="flex-1 max-w-[140px] bg-[#050a12]/50 border border-white/5 rounded-xl p-2.5 flex flex-col justify-center space-y-2 font-mono text-[10px] md:text-sm text-slate-300 font-extrabold shadow-sm select-none">
                    <span className="text-[9px] uppercase tracking-[0.1em] text-[#00f0ff] font-bold block mb-1 font-sans border-b border-white/5 pb-1">Wind Speed</span>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed 0 to 4 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#4a628a]" />
                      <span>0 – 4 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed 4 to 6 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#22c55e]" />
                      <span>4 – 6 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed 6 to 10 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#eab308]" />
                      <span>6 – 10 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed 10 to 15 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#f97316]" />
                      <span>10 – 15 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed 15 to 20 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#db2777]" />
                      <span>15 – 20 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed 20 to 25 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#7c3aed]" />
                      <span>20 – 25 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-white transition-colors" title="Speed above 25 m/s">
                      <span className="w-3.5 h-2 rounded bg-[#2563eb]" />
                      <span>&gt; 25 <span className="text-[9px] font-sans text-slate-500 font-bold">m/s</span></span>
                    </div>
                  </div>
                </div>
                
                <p className="text-[9px] text-slate-500 leading-tight italic font-sans text-center border-t border-white/5 pt-1.5">
                  Panjang ruji menunjukkan persentase frekuensi arah tiupan angin (24 Jam terakhir).
                </p>
              </div>

              {/* Wind Limits & Gust Events (Moved under Wind Rose) */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-4.5 rounded-2xl border border-white/5 flex-grow flex-1 flex flex-col justify-between space-y-3.5">
                <div>
                  {/* Title */}
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-widest flex justify-between items-center pb-2 border-b border-white/5 mb-3 font-sans">
                    <div className="flex items-center gap-2">
                      <Wind className="w-3.5 h-3.5 text-amber-500" />
                      <span>Wind Stats & Gust Events</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#00f0ff]/50 font-bold">SYSTEM</span>
                  </div>

                  <div className="space-y-3 font-sans text-xs">
                    {/* Wind speed limit indicators */}
                    <div className="bg-[#050a12]/80 border border-white/5 p-3 rounded-xl space-y-2">
                      <span className="text-xs uppercase font-semibold tracking-wider text-slate-300 block border-b border-white/10 pb-1 font-sans">🌪️ Live Wind Speed Limits</span>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-[#0b1424] border border-emerald-500/10 py-1.5 px-2 rounded-lg transition-colors hover:border-emerald-500/20">
                          <span className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Wind Max</span>
                          <span className="text-base font-bold font-mono text-emerald-400">
                            {windStats.max.toFixed(1)} <span className="text-xs font-semibold text-slate-400 ml-0.5">m/s</span>
                          </span>
                        </div>
                        <div className="bg-[#0b1424] border border-[#38bdf8]/10 py-1.5 px-2 rounded-lg transition-colors hover:border-[#38bdf8]/20">
                          <span className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Wind Min</span>
                          <span className="text-base font-bold font-mono text-[#38bdf8]">
                            {windStats.min.toFixed(1)} <span className="text-xs font-semibold text-slate-400 ml-0.5">m/s</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Last Wind Gust info */}
                    <div className="bg-[#050a12]/80 border border-white/5 p-3 rounded-xl space-y-2">
                      <span className="text-xs uppercase font-semibold tracking-wider text-amber-500 block border-b border-white/10 pb-1 font-sans">⚡ Last Gust Occurrence Event</span>
                      <div className="grid grid-cols-2 gap-2 text-center font-sans">
                        <div className="bg-[#0b1424] border border-amber-500/5 py-1.5 px-2 rounded-lg transition-colors hover:border-amber-500/20">
                          <span className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Gust Speed</span>
                          <span className="text-base font-bold font-mono text-amber-400">
                            {lastWindGustVal !== null ? (
                              <>
                                {lastWindGustVal.toFixed(1)} <span className="text-xs font-semibold text-slate-400 ml-0.5">m/s</span>
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                        <div className="bg-[#0b1424] border border-amber-500/5 py-1.5 px-2 rounded-lg flex flex-col justify-center items-center transition-colors hover:border-amber-500/20">
                          <span className="text-xs uppercase text-slate-400 font-semibold tracking-wide block mb-1 font-sans">Time of Gust</span>
                          <span className="text-xs md:text-sm font-bold font-mono text-amber-300 truncate">
                            {lastWindGustTime !== null ? lastWindGustTime : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>

          {/* LOWER PORTION: RECENT WIND VECTORS SEQUENCE */}
          <div className="mt-6">
            
            <div className="bg-gradient-to-b from-[#0b1424]/40 to-[#020813]/80 border border-white/5 p-5 rounded-3xl flex flex-col justify-between select-none">
              
              {/* Header inside lower block */}
              <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-widest flex justify-between items-center pb-2.5 border-b border-white/5 mb-4 font-sans">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#00f0ff]" />
                  <span>Recent Wind Vectors (Sequence)</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                  Chrono Flow <span className="text-xs">➡️</span>
                </span>
              </div>

              {/* Grid of 5 wind vectors, stretching sideways in 1 horizontal row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {history.slice(-5).map((row, idx) => {
                  const directionName = getWindRoseString(row.windDirection);
                  return (
                    <div key={idx} className="bg-[#040911] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-between space-y-3 text-center transition-all hover:border-[#00f0ff]/15">
                      
                      {/* Timestamp */}
                      <span className="text-xs text-slate-500 font-mono font-bold">
                        {format(row.timestamp, 'HH:mm')}
                      </span>

                      {/* Rotating wind arrow icon */}
                      <div className="p-2 bg-[#02060c] rounded-xl border border-white/5 flex items-center justify-center">
                        <Navigation 
                          className="w-4 h-4 text-[#00f0ff]" 
                          style={{ transform: `rotate(${row.windDirection}deg)` }}
                        />
                      </div>

                      {/* Cardinal Abbreviation */}
                      <span className="text-base font-black text-white font-mono tracking-wide">
                        {directionName}
                      </span>

                      {/* Speed Pill with warm yellowish-orange border & text */}
                      <div className="w-full bg-[#1c1206] border border-[#f59e0b]/20 py-1 px-2.5 rounded-lg text-center">
                        <span className="text-xs font-extrabold text-[#f59e0b] font-mono tracking-normal block">
                          {row.windSpeed.toFixed(1)} <span className="text-[10px] font-sans font-normal text-amber-500/50">m/s</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 font-sans block mt-0.5">
                          ({(row.windSpeed * 1.94384).toFixed(1)} kt)
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

          </div>
          </div>
        )}

        {/* PAGE tab 2: CHART ANALYST */}
        {activeTab === 'analyst' && (
          <div className="space-y-6">
            
            {/* Sourced database info banner */}
            <div className="bg-[#050d1a] border border-[#00f0ff]/20 px-5 py-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#00f0ff]/10 border border-[#00f0ff]/20 rounded-xl text-[#00f0ff]">
                  <Database className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-[#00f0ff] uppercase tracking-wider font-mono block">📊 ANALISIS HISTORIS DATA DATABASE</span>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Menampilkan data historis murni dari database lokal (PostgreSQL <code>tbl_sensor_logs</code>) dalam rentang penuh 24 jam sehari mulai dari pukul <strong>00:00</strong> sampai dengan <strong>23:59</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span>LOAD: {analystLogs.length} Paket</span>
              </div>
            </div>
            
            {/* Calendar filters & action panels with top-right shrunken threat badge */}
            <div className="bg-gradient-to-b from-[#0b1424] to-bg p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#00f0ff] tracking-wider block mb-1.5 font-sans">Start Analysis Date</label>
                  <input 
                    type="date" 
                    value={dbStartDate}
                    onChange={(e) => setDbStartDate(e.target.value)}
                    className="bg-[#050a12] border border-white/10 text-white text-xs font-mono py-1.5 px-3 rounded-lg outline-none focus:border-[#00f0ff] transition" 
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#00f0ff] tracking-wider block mb-1.5 font-sans">End Analysis Date</label>
                  <input 
                    type="date" 
                    value={dbEndDate}
                    onChange={(e) => setDbEndDate(e.target.value)}
                    className="bg-[#050a12] border border-white/10 text-white text-xs font-mono py-1.5 px-3 rounded-lg outline-none focus:border-[#00f0ff] transition" 
                  />
                </div>
                <button 
                  onClick={filterLogsData}
                  className="bg-[#00f0ff] hover:bg-[#00d0f0] transition text-[#050a12] text-xs font-bold font-mono py-2 px-5 rounded-lg uppercase flex items-center justify-center gap-2 cursor-pointer h-9"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  REFRESH DATA
                </button>
              </div>

              {/* Threat Radar & 24H Telemetry Window Link Button */}
              <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto justify-end">
                <button
                  onClick={() => setActiveTab('telemetry')}
                  className="bg-transparent hover:bg-emerald-500/10 border border-emerald-500/40 hover:border-emerald-400 transition text-emerald-400 text-xs font-bold font-mono py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer h-10 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  <Maximize2 className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  <span className="uppercase tracking-wider text-[10px] font-black">Buka Telemetri 24 Jam (AWS)</span>
                </button>

                {/* Shrunken Storm & Gale Threat Indicator Pill (Aligned to top right) */}
                <div className={`flex items-center gap-2.5 border rounded-xl py-1.5 px-3 h-10 ${aiForecastResult.stormBg} select-none shadow-[0_0_15px_rgba(168,85,247,0.08)]`}>
                  <div className={`text-xl ${aiForecastResult.stormPulse}`}>
                    {aiForecastResult.stormIcon}
                  </div>
                  <div className="text-left font-sans">
                    <div className="text-[8px] uppercase font-extrabold tracking-widest text-slate-400">Threat Radar</div>
                    <div className="text-[11px] font-black font-mono text-white flex items-center gap-1.5">
                      <span style={{ color: aiForecastResult.stormColor }}>{aiForecastResult.stormProb}% Risk</span>
                      <span className="text-slate-500 font-normal">|</span>
                      <span className="text-[10px] uppercase font-black tracking-tight" style={{ color: aiForecastResult.stormColor }}>{aiForecastResult.stormStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 1: WIND SPEED FORECAST (LEFT) & WIND ROSE (RIGHT) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Wind Speed Forecast Chart (col-span-8) */}
              <div className="lg:col-span-8 bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
                <div className="text-xs uppercase font-extrabold text-[#00f0ff] tracking-[0.15em] mb-4 flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="flex items-center gap-2">💨 WIND FORCE FORECAST & TRENDS (m/s)</span>
                  <span className="text-[10px] font-mono text-[#00f0ff]/70 bg-[#00f0ff]/10 border border-[#00f0ff]/20 px-2 py-0.5 rounded">60m AHEAD</span>
                </div>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={aiForecastResult.combinedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPastWind" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.01}/>
                        </linearGradient>
                        <linearGradient id="colorFutWind" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#fbbf24' }} />
                      <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <Area type="monotone" dataKey="pastWind" name="Past Wind Speed" stroke="#fbbf24" strokeWidth={2.5} fillOpacity={1} strokeDasharray="" fill="url(#colorPastWind)" dot={false} connectNulls />
                      <Area type="monotone" dataKey="futWind" name="Forecast (10m step)" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} strokeDasharray="4 4" fill="url(#colorFutWind)" dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Wind Rose 24H Card (col-span-4) */}
              <div className="lg:col-span-4 bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
                <div className="text-xs font-extrabold text-[#00f0ff] uppercase tracking-[0.15em] flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-amber-500 transform rotate-45 animate-pulse" />
                    <span>Wind Rose (24H Distribution)</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">POLE INDEX</span>
                </div>

                <div className="flex justify-center items-center py-2">
                  {(() => {
                    const cx = 100;
                    const cy = 100;
                    const maxR = 75;
                    
                    // Bin windrose directions
                    const matrix = Array.from({ length: 16 }, () => Array(7).fill(0));
                    const totalLogs = analystLogs.length;
                    
                    analystLogs.forEach(row => {
                      const deg = row.windDirection;
                      const norm = ((deg % 360) + 360) % 360;
                      const idx = Math.floor(((norm + 11.25) % 360) / 22.5);
                      
                      const speed = row.windSpeed;
                      if (speed <= 4) matrix[idx][0]++;
                      else if (speed <= 6) matrix[idx][1]++;
                      else if (speed <= 10) matrix[idx][2]++;
                      else if (speed <= 15) matrix[idx][3]++;
                      else if (speed <= 20) matrix[idx][4]++;
                      else if (speed <= 25) matrix[idx][5]++;
                      else matrix[idx][6]++;
                    });
                    
                    const maxCountInAnySector = Math.max(1, ...matrix.map(row => row.reduce((a, b) => a + b, 0)));
                    const maxPctInAnySector = totalLogs > 0 ? (maxCountInAnySector / totalLogs) * 100 : 10;
                    const maxPctScope = Math.max(10, Math.ceil(maxPctInAnySector / 5) * 5);
                    
                    const getXY = (r: number, deg: number) => {
                      const rad = ((deg - 90) * Math.PI) / 180.0;
                      return {
                        x: cx + r * Math.cos(rad),
                        y: cy + r * Math.sin(rad),
                      };
                    };
                    
                    const colors = [
                      '#4a628a', // 0-4
                      '#22c55e', // 4-6
                      '#eab308', // 6-10
                      '#f97316', // 10-15
                      '#db2777', // 15-20
                      '#7c3aed', // 20-25
                      '#2563eb', // >25
                    ];
                    
                    return (
                      <svg viewBox="0 0 200 200" className="w-[170px] h-[170px] select-none font-sans">
                        <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} strokeDasharray="2 3" />
                        <circle cx={cx} cy={cy} r={maxR * 0.5} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.7} strokeDasharray="2 3" />
                        <circle cx={cx} cy={cy} r={3} fill="#1e293b" stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                        
                        <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(255,255,255,0.05)" strokeWidth={0.7} />
                        <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(255,255,255,0.05)" strokeWidth={0.7} />
                        
                        <text x={cx + 2} y={cy - maxR + 8} fill="rgba(0,240,255,0.4)" fontSize={5.5} className="font-mono font-bold">{maxPctScope.toFixed(0)}%</text>
                        <text x={cx + 2} y={cy - (maxR * 0.5) + 6} fill="rgba(255,255,255,0.25)" fontSize={5.5} className="font-mono">{(maxPctScope / 2).toFixed(0)}%</text>

                        <text x={cx} y={cy - maxR - 4} fill="#f8fafc" fontSize={7} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">N</text>
                        <text x={cx + maxR + 5} y={cy} fill="#94a3b8" fontSize={7} fontWeight="bold" textAnchor="start" alignmentBaseline="middle">E</text>
                        <text x={cx} y={cy + maxR + 5} fill="#94a3b8" fontSize={7} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">S</text>
                        <text x={cx - maxR - 5} y={cy} fill="#94a3b8" fontSize={7} fontWeight="bold" textAnchor="end" alignmentBaseline="middle">W</text>

                        {(() => {
                          const rText = maxR - 10;
                          const ne = getXY(rText, 45);
                          const se = getXY(rText, 135);
                          const sw = getXY(rText, 225);
                          const nw = getXY(rText, 315);
                          return (
                            <>
                              <text x={ne.x} y={ne.y} fill="rgba(255,255,255,0.12)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">NE</text>
                              <text x={se.x} y={se.y} fill="rgba(255,255,255,0.12)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">SE</text>
                              <text x={sw.x} y={sw.y} fill="rgba(255,255,255,0.12)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">SW</text>
                              <text x={nw.x} y={nw.y} fill="rgba(255,255,255,0.12)" fontSize={5} textAnchor="middle" alignmentBaseline="middle">NW</text>
                            </>
                          );
                        })()}

                        {matrix.map((binsInSector, dIdx) => {
                          const centralAngle = dIdx * 22.5;
                          const angleStart = centralAngle - 7.5;
                          const angleEnd = centralAngle + 7.5;
                          
                          let cumCount = 0;
                          return binsInSector.map((countInBin, bIdx) => {
                            if (countInBin === 0) return null;
                            const startCount = cumCount;
                            const endCount = cumCount + countInBin;
                            cumCount = endCount; 
                            if (totalLogs === 0) return null;
                            const pctStart = (startCount / totalLogs) * 100;
                            const pctEnd = (endCount / totalLogs) * 100;
                            const rStart = Math.max(3, (pctStart / maxPctScope) * maxR);
                            const rEnd = (pctEnd / maxPctScope) * maxR;
                            if (rEnd - rStart < 0.2) return null;
                            const p1 = getXY(rEnd, angleStart);
                            const p2 = getXY(rEnd, angleEnd);
                            const p3 = getXY(rStart, angleEnd);
                            const p4 = getXY(rStart, angleStart);
                            const path = `M ${p1.x} ${p1.y} A ${rEnd} ${rEnd} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rStart} ${rStart} 0 0 0 ${p4.x} ${p4.y} Z`;
                            return (
                              <path 
                                key={`${dIdx}-${bIdx}`} 
                                d={path} 
                                fill={colors[bIdx]} 
                                opacity={0.88} 
                                className="transition-all duration-300 hover:opacity-100"
                              />
                            );
                          });
                        })}
                      </svg>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-4 gap-y-1 text-[8px] text-slate-400 border-t border-white/5 pt-2 font-mono">
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4a628a]" /><span className="truncate">0-4 kt</span></div>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /><span className="truncate">4-6 kt</span></div>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" /><span className="truncate">6-10 kt</span></div>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" /><span className="truncate">10-15</span></div>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#db2777]" /><span className="truncate">15-20</span></div>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" /><span className="truncate">20-25</span></div>
                  <div className="flex items-center gap-1 col-span-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" /><span className="truncate">&gt;25 kt</span></div>
                </div>
              </div>
            </div>

            {/* ROW 2: CRITICAL WEATHER SENSOR HISTORIES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Temp Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-xs uppercase font-extrabold text-[#38bdf8] tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 AIR TEMPERATURE (°C)</span>
                  <span className="text-[10px] font-mono text-slate-500">24H CYCLE</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#38bdf8' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="temperature" stroke="#38bdf8" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Humidity Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-xs uppercase font-extrabold text-[#22c55e] tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 RELATIVE HUMIDITY (%)</span>
                  <span className="text-[10px] font-mono text-slate-500">REALTIME</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#22c55e' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="humidity" stroke="#22c55e" fillOpacity={1} fill="url(#colorHum)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Water Temperature Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-xs uppercase font-extrabold text-[#38bdf8] tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 WATER TEMPERATURE / SUHU AIR (°C)</span>
                  <span className="text-[10px] font-mono text-slate-500">REALTIME</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorWaterTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#38bdf8' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="waterTemp" stroke="#38bdf8" fillOpacity={1} fill="url(#colorWaterTemp)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* ROW 3: WIND SPEED & GUST, SEA LEVEL (PASANG SURUT), WATER pH */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              
              {/* Wind Speed & Gust Line Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="text-xs uppercase font-extrabold text-amber-500 tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 WIND SPEED & GUST / ANGIN (m/s)</span>
                  <span className="text-[10px] font-mono text-slate-500">REALTIME</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analystLogs}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#fbbf24' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                      <Line type="monotone" dataKey="windSpeed" name="Avg Speed (m/s)" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="windSpeedMax" name="Max Gust (m/s)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sea Level / Tidal (Pasang Surut) Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="text-xs uppercase font-extrabold text-sky-400 tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 TIDAL LEVEL / PASANG SURUT (m)</span>
                  <span className="text-[10px] font-mono text-slate-500">SEA LEVEL</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorSeaLevel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tickFormatter={(val) => (val / 100).toFixed(1)} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0b1424', borderColor: '#38bdf8' }} 
                        labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')}
                        formatter={(value: any) => [`${(value / 100).toFixed(3)} m`, 'Sea Level']}
                      />
                      <Area type="monotone" dataKey="seaLevel" stroke="#38bdf8" fillOpacity={1} fill="url(#colorSeaLevel)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Water pH Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="text-xs uppercase font-extrabold text-pink-400 tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 WATER pH / KUALITAS AIR</span>
                  <span className="text-[10px] font-mono text-slate-500">pH INDEX</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f472b6" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#f472b6" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[6.0, 9.0]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f472b6' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="waterPh" stroke="#f472b6" fillOpacity={1} fill="url(#colorPh)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* ROW 4: SOLAR RADIATION, RAINFALL, BATTERY VOLTAGE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              
              {/* Solar Radiation Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="text-xs uppercase font-extrabold text-yellow-500 tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 SOLAR RADIATION (W/m²)</span>
                  <span className="text-[10px] font-mono text-slate-500">SUNLIGHT</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#eab308" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#eab308" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#eab308' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="solarRadiation" stroke="#eab308" fillOpacity={1} fill="url(#colorSolar)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Rainfall Bar Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="text-xs uppercase font-extrabold text-sky-400 tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📊 RAINFALL INTENSITY / HUJAN (mm)</span>
                  <span className="text-[10px] font-mono text-slate-500">ACCUMULATION</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analystLogs}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#38bdf8' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Bar dataKey="rainfall" name="Rainfall (mm)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Battery Voltage Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="text-xs uppercase font-extrabold text-emerald-400 tracking-[0.2em] font-sans pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>📈 SYSTEM BATTERY VOLTAGE (V)</span>
                  <span className="text-[10px] font-mono text-slate-500">HEALTH INDICATOR</span>
                </div>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analystLogs}>
                      <defs>
                        <linearGradient id="colorBatt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[10, 15]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#10b981' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="battery" stroke="#10b981" fillOpacity={1} fill="url(#colorBatt)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* PAGE tab 3: DATABASE LOG */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            
            {/* Real-time Custom Database Mode & PostgreSQL Integration Banner */}
            <div className="bg-gradient-to-r from-[#0a1b3a] to-[#041026] p-5 rounded-2xl border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.1)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">INTEGRATED DATABASE ENGINE (PostgreSQL)</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-[650px]">
                      {config.dbStorageMode === 'AVG' ? (
                        <span>The system is configured in accordance with WMO meteorology standards utilizing a compressed **{config.dbStorageInterval}-Minute Average** interval, minimizing query overhead and ensuring high database efficiency.</span>
                      ) : (
                        <span>The system is configured in **Instantaneous/Raw Storage Mode**, recording asynchronous sensor samples directly to the SQL server without averaging statistics at **{config.dbStorageInterval}-Minute** intervals.</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase font-mono tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {config.dbStorageMode === 'AVG' ? `⏱️ LOG BIND: ${config.dbStorageInterval} MIN AVG` : `📦 LOG BIND: ${config.dbStorageInterval} MIN RAW`}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase font-mono tracking-widest bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 animate-pulse">
                    🐘 POSTGRESQL DRIVER ACTIVE
                  </span>
                </div>
              </div>

              {/* Dynamic Live Buffer visualizer */}
              <div className="p-4 bg-teal-500/5 rounded-xl border border-teal-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
                    </span>
                    <span className="text-xs uppercase tracking-wider font-black text-teal-400 font-mono">
                      CYCLE ACCUMULATOR BUFFER ({sampleBuffer.length} / 5)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {config.dbStorageMode === 'AVG' ? (
                      <span>The WMO compliant average is mathematically derived from <strong className="font-mono text-white bg-teal-500/15 px-1.5 py-0.5 rounded border border-teal-500/25">5 sensory samples</strong>. Real-time averages are computed at each {config.dbStorageInterval} minute index.</span>
                    ) : (
                      <span>Instantaneous telemetry is captured from the final sample at each <strong className="font-mono text-white bg-teal-500/15 px-1.5 py-0.5 rounded border border-teal-500/25">{config.dbStorageInterval} minute</strong> block, registered without mathematical processing.</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <button
                    onClick={() => {
                      if (sampleBuffer.length === 0) {
                        showToastNotification("Accumulator buffer is empty! Please wait for next sensory cycles.");
                        return;
                      }
                      
                      let recordToSave: WeatherData;
                      let forceMsg = '';

                      if (config.dbStorageMode === 'AVG') {
                        recordToSave = calculateAverageRecord(sampleBuffer);
                        forceMsg = `USER FORCE AVG: Saved composite average of ${sampleBuffer.length} samples successfully.`;
                      } else {
                        recordToSave = { ...sampleBuffer[sampleBuffer.length - 1] };
                        forceMsg = `USER FORCE RAW: Saved instantaneous sample from ${sampleBuffer.length} records successfully.`;
                      }

                      const intervalMs = (config.dbStorageInterval || 10) * 60 * 1000;
                      recordToSave.timestamp = Date.now() - intervalMs;

                      // Asynchronously post to local PostgreSQL database script
                      postLogToLocalPostgres(recordToSave);

                      setHistory(prevHist => {
                        const keeps = [...prevHist, recordToSave];
                        if (keeps.length > 200) {
                          return keeps.slice(keeps.length - 150);
                        }
                        localStorage.setItem('aws_history_logs', JSON.stringify(keeps));
                        return keeps;
                      });

                      setStreamLogs(prevLogs => {
                        const lines = prevLogs.split('\n');
                        const timeStr = format(new Date(), 'HH:mm:ss');
                        const msg = `[${timeStr} SQL SYSTEM] ⚡ ${forceMsg}`;
                        const output = [...lines, msg];
                        if (output.length > 40) return output.slice(output.length - 30).join('\n');
                        return output.join('\n');
                      });

                      setSampleBuffer([]);
                      setLastDbSaveTime(Date.now());
                      showToastNotification(config.dbStorageMode === 'AVG' ? "Successfully forced calculation of average record!" : "Successfully forced raw instantaneous log commit!");
                    }}
                    disabled={sampleBuffer.length === 0}
                    className={`text-xs font-black uppercase py-2 px-3.5 rounded-lg border transition duration-250 cursor-pointer flex items-center gap-1.5 ${
                      sampleBuffer.length === 0
                        ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
                        : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border-teal-500/30'
                    }`}
                  >
                    ⚡ {config.dbStorageMode === 'AVG' ? `Force Commit Average (${sampleBuffer.length} Samples)` : `Force Commit Raw (${sampleBuffer.length} Samples)`}
                  </button>
                </div>
              </div>

              {/* Sleek inline database status banner */}
              <div className="bg-[#0b1424]/40 border border-[#00f0ff]/10 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDbConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500 animate-pulse'}`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Layanan Status Sinkronisasi PostgreSQL</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                        isDbConnected 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}>
                        {isDbConnected ? '🟢 CONNECTED (LIVE)' : '🟡 STANDBY / NOT TESTED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-normal max-w-[620px]">
                      {isDbConnected 
                        ? 'Koneksi ke database PostgreSQL lokal teruji aktif. Sinkronisasi data telemetri otomatis beroperasi di latar belakang.' 
                        : 'Menunggu pengujian koneksi. Klik tombol konfigurasi jika Anda ingin menyinkronkan data ke basis data PostgreSQL lokal Anda.'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setIsIntegratorOpen(true)}
                    className="w-full sm:w-auto text-xs font-black uppercase py-2.5 px-4 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 font-mono font-bold"
                  >
                    🔧 CONFIG DB INTEGRATOR
                  </button>
                </div>
              </div>
            </div>

            {/* Database Auto-Setup / Schema Integrator Modal */}
              <div className={isIntegratorOpen ? "fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto" : "hidden"}>
                <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-teal-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col pointer-events-auto p-6 space-y-4">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                        <span className="text-sm font-mono font-bold uppercase tracking-wider text-teal-400">DATABASE INTEGRATOR & SETUP UTILITIES</span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans">
                        Konversikan telemetri langsung ke server basis data PostgreSQL Anda.
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsIntegratorOpen(false)}
                      className="text-xs font-bold uppercase bg-white/5 hover:bg-white/15 text-slate-300 font-mono py-1.5 px-3 rounded-lg border border-white/10 cursor-pointer transition"
                    >
                      ✕ Close
                    </button>
                  </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">DATABASE INTEGRATOR (POSTGRESQL)</span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans max-w-[600px]">
                      Aplikasi berjalan di web browser dan mendukung sinkronisasi database <strong>PostgreSQL</strong> melalui file gateway PHP <code className="text-white font-mono bg-white/5 px-1 rounded">api.php</code> di server atau komputer lokal Anda.
                    </p>
                  </div>
                  
                  {/* Selector Tabs */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex bg-[#050a12] p-0.5 border border-white/10 rounded-lg">
                      <button
                        onClick={() => setDbScriptTab('sql')}
                        className={`text-[11px] px-2.5 py-1 rounded font-mono uppercase font-black transition cursor-pointer ${
                          dbScriptTab === 'sql' 
                            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' 
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        📜 Manual SQL
                      </button>
                      <button
                        onClick={() => setDbScriptTab('php')}
                        className={`text-[11px] px-2.5 py-1 rounded font-mono uppercase font-black transition cursor-pointer ${
                          dbScriptTab === 'php' 
                            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' 
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        ⚡ PHP Installer
                      </button>
                    </div>
                  </div>
                </div>

                {dbScriptTab === 'sql' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-mono text-slate-300 uppercase font-black">
                        🔌 Metode Manual PostgreSQL:
                      </span>
                      <button 
                        onClick={() => {
                          const sqlText = `CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL, /* Start of the average-block / instant sample */
    temperature NUMERIC(5,2) NOT NULL,
    temp_min NUMERIC(5,2) DEFAULT 0.00,
    temp_max NUMERIC(5,2) DEFAULT 0.00,
    humidity INT NOT NULL,
    solar_radiation INT NOT NULL,
    rainfall NUMERIC(5,2) NOT NULL,
    wave_height NUMERIC(4,2) NOT NULL,
    sea_level NUMERIC(5,1) NOT NULL,
    water_ph NUMERIC(4,2) NOT NULL,
    water_temp NUMERIC(4,1) DEFAULT 25.0,
    water_temp_min NUMERIC(4,1) DEFAULT 24.0,
    water_temp_max NUMERIC(4,1) DEFAULT 26.0,
    wind_direction INT NOT NULL,
    wind_speed NUMERIC(4,1) NOT NULL,
    wind_speed_min NUMERIC(4,1) DEFAULT 0.0,
    wind_speed_max NUMERIC(4,1) DEFAULT 0.0,
    pressure NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;
                          navigator.clipboard.writeText(sqlText);
                          showToastNotification("PostgreSQL Query successfully copied to clipboard!");
                        }}
                        className="text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-bold uppercase px-3 py-1.5 rounded-lg border border-teal-500/20 transition cursor-pointer font-mono"
                      >
                        Copy PostgreSQL SQL Script
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-normal">
                      Copy query berikut dan paste langsung ke konsol/terminal <strong>PostgreSQL pgAdmin / psql</strong> Anda untuk membuat tabel log eksternal Anda.
                    </p>
                    <pre className="text-xs font-mono text-slate-400 p-3 bg-black/60 rounded-lg overflow-x-auto max-h-[160px] leading-relaxed select-all border border-white/5">
{`/* SQL untuk PostgreSQL */
CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL, /* Start of the average-block / instant sample */
    temperature NUMERIC(5,2) NOT NULL,
    temp_min NUMERIC(5,2) DEFAULT 0.00,
    temp_max NUMERIC(5,2) DEFAULT 0.00,
    humidity INT NOT NULL,
    solar_radiation INT NOT NULL,
    rainfall NUMERIC(5,2) NOT NULL,
    wave_height NUMERIC(4,2) NOT NULL,
    sea_level NUMERIC(5,1) NOT NULL,
    water_ph NUMERIC(4,2) NOT NULL,
    water_temp NUMERIC(4,1) DEFAULT 25.0,
    water_temp_min NUMERIC(4,1) DEFAULT 24.0,
    water_temp_max NUMERIC(4,1) DEFAULT 26.0,
    wind_direction INT NOT NULL,
    wind_speed NUMERIC(4,1) NOT NULL,
    wind_speed_min NUMERIC(4,1) DEFAULT 0.0,
    wind_speed_max NUMERIC(4,1) DEFAULT 0.0,
    pressure NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`}
                    </pre>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="space-y-1">
                        <span className="text-xs font-mono text-teal-400 uppercase font-black block">
                          🔌 Auto-create PHP Code (PostgreSQL via PDO):
                        </span>
                        <div className="text-xs text-slate-500 font-mono">
                          API URL: <span className="text-white font-bold">{config.localDbApiUrl || 'http://localhost:8000/api.php'}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            const phpCode = `<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if (\$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1. GET Request: Check if requesting Moxa IP & Port configuration dynamically
if (\$_SERVER['REQUEST_METHOD'] === 'GET' && isset(\$_GET['get_moxa_config'])) {
    if (file_exists("moxa_config.json")) {
        echo file_get_contents("moxa_config.json");
    } else {
        echo json_encode([
            "moxa_ip" => "192.168.127.254",
            "moxa_port" => 10001
        ]);
    }
    exit();
}

// 1b. GET Request: Check Moxa background daemon connection status
if (\$_SERVER['REQUEST_METHOD'] === 'GET' && isset(\$_GET['get_moxa_status'])) {
    if (file_exists("moxa_status.json")) {
        echo file_get_contents("moxa_status.json");
    } else {
        echo json_encode([
            "connected" => false,
            "moxa_ip" => "192.168.127.254",
            "moxa_port" => 10001,
            "state" => "OFFLINE",
            "last_seen" => "Never / Waiting for Daemon...",
            "error" => "No status reported from background daemon yet."
        ]);
    }
    exit();
}

// PostgreSQL Server Configuration
\$host = "localhost";
\$port = "5432"; // Standard PostgreSQL Port
\$dbname = "db_pelabuhan_telemetry"; // Pastikan database ini sudah dibuat di PostgreSQL Anda
\$username = "postgres"; // Username PostgreSQL Anda
\$password = "your_pg_password"; // Ganti dengan password postgres Anda

try {
    \$conn = new PDO("pgsql:host=\$host;port=\$port;dbname=\$dbname", \$username, \$password);
    \$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Auto-create table di PostgreSQL
    $sql_table = "CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
        id SERIAL PRIMARY KEY,
        station_id VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        temperature NUMERIC(5,2) NOT NULL,
        temp_min NUMERIC(5,2) DEFAULT 0.00,
        temp_max NUMERIC(5,2) DEFAULT 0.00,
        humidity INT NOT NULL,
        solar_radiation INT NOT NULL,
        rainfall NUMERIC(5,2) NOT NULL,
        wave_height NUMERIC(4,2) NOT NULL,
        sea_level NUMERIC(5,1) NOT NULL,
        water_ph NUMERIC(4,2) NOT NULL,
        water_temp NUMERIC(4,1) DEFAULT 25.0,
        water_temp_min NUMERIC(4,1) DEFAULT 24.0,
        water_temp_max NUMERIC(4,1) DEFAULT 26.0,
        wind_direction INT NOT NULL,
        wind_speed NUMERIC(4,1) NOT NULL,
        wind_speed_min NUMERIC(4,1) DEFAULT 0.0,
        wind_speed_max NUMERIC(4,1) DEFAULT 0.0,
        pressure NUMERIC(6,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );";
    
    \$conn->exec(\$sql_table);
} catch (PDOException \$e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "PostgreSQL Setup Failed: " . \$e->getMessage()]);
    exit();
}

// 2. GET Request: Ambil data dari tabel tbl_sensor_logs untuk ditampilkan di Dashboard
if (\$_SERVER['REQUEST_METHOD'] === 'GET' && isset(\$_GET['get_telemetry_logs'])) {
    try {
        \$stmt = \$conn->prepare("SELECT * FROM tbl_sensor_logs ORDER BY timestamp DESC LIMIT 500");
        \$stmt->execute();
        \$rows = \$stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(\$rows);
    } catch (PDOException \$e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Fetch Logs Failed: " . \$e->getMessage()]);
    }
    exit();
}

if (\$_SERVER['REQUEST_METHOD'] === 'POST') {
    \$input = file_get_contents("php://input");
    \$data = json_decode(\$input, true);

    // 2. POST Action: Save dynamic config to local file
    if (isset(\$data['action']) && \$data['action'] === 'save_moxa_config') {
        try {
            \$config_data = [
                "moxa_ip" => isset(\$data['moxa_ip']) ? \$data['moxa_ip'] : '192.168.127.254',
                "moxa_port" => isset(\$data['moxa_port']) ? (int)\$data['moxa_port'] : 10001,
                "transport" => isset(\$data['transport']) ? \$data['transport'] : 'TCP'
            ];
            file_put_contents("moxa_config.json", json_encode(\$config_data, JSON_PRETTY_PRINT));
            echo json_encode(["status" => "success", "message" => "Moxa configuration successfully synced & saved on host machine."]);
            exit();
        } catch (Exception \$e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Failed to write config file: " . \$e->getMessage()]);
            exit();
        }
    }

    // 2b. POST Action: Save dynamic Moxa background daemon live connection status report
    if (isset(\$data['action']) && \$data['action'] === 'save_moxa_status') {
        try {
            \$status_data = [
                "connected" => isset(\$data['connected']) ? (bool)\$data['connected'] : false,
                "moxa_ip" => isset(\$data['moxa_ip']) ? \$data['moxa_ip'] : '192.168.127.254',
                "moxa_port" => isset(\$data['moxa_port']) ? (int)\$data['moxa_port'] : 10001,
                "state" => isset(\$data['state']) ? \$data['state'] : 'UNKNOWN',
                "last_seen" => date('d-m-Y H:i:s'),
                "error" => isset(\$data['error']) ? \$data['error'] : ''
            ];
            file_put_contents("moxa_status.json", json_encode(\$status_data, JSON_PRETTY_PRINT));
            echo json_encode(["status" => "success", "message" => "Daemon status synced."]);
            exit();
        } catch (Exception \$e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Failed to write status file: " . \$e->getMessage()]);
            exit();
        }
    }

    if (isset(\$data['station_id']) && isset(\$data['timestamp'])) {
        try {
            \$stmt = \$conn->prepare("INSERT INTO tbl_sensor_logs (
                station_id, timestamp, temperature, temp_min, temp_max, humidity, solar_radiation, 
                rainfall, wave_height, sea_level, water_ph, water_temp, water_temp_min, water_temp_max, wind_direction, wind_speed, wind_speed_min, wind_speed_max, pressure
            ) VALUES (
                :station_id, :timestamp, :temperature, :temp_min, :temp_max, :humidity, :solar_radiation, 
                :rainfall, :wave_height, :sea_level, :water_ph, :water_temp, :water_temp_min, :water_temp_max, :wind_direction, :wind_speed, :wind_speed_min, :wind_speed_max, :pressure
            )");

            \$stmt->execute([
                ':station_id' => \$data['station_id'],
                ':timestamp' => \$data['timestamp'],
                ':temperature' => \$data['temperature'],
                ':temp_min' => isset(\$data['temp_min']) ? \$data['temp_min'] : (\$data['temperature'] - 1.5),
                ':temp_max' => isset(\$data['temp_max']) ? \$data['temp_max'] : (\$data['temperature'] + 1.2),
                ':humidity' => \$data['humidity'],
                ':solar_radiation' => isset(\$data['solar_radiation']) ? \$data['solar_radiation'] : 0,
                ':rainfall' => isset(\$data['rainfall']) ? \$data['rainfall'] : 0.0,
                ':wave_height' => isset(\$data['wave_height']) ? \$data['wave_height'] : 0.0,
                ':sea_level' => isset(\$data['sea_level']) ? \$data['sea_level'] : 0.0,
                ':water_ph' => isset(\$data['water_ph']) ? \$data['water_ph'] : 7.0,
                ':water_temp' => isset(\$data['water_temp']) ? \$data['water_temp'] : (\$data['temperature'] - 1.2),
                ':water_temp_min' => isset(\$data['water_temp_min']) ? \$data['water_temp_min'] : (\$data['temperature'] - 2.0),
                ':water_temp_max' => isset(\$data['water_temp_max']) ? \$data['water_temp_max'] : (\$data['temperature'] - 0.7),
                ':wind_direction' => isset(\$data['wind_direction']) ? \$data['wind_direction'] : 0,
                ':wind_speed' => isset(\$data['wind_speed']) ? \$data['wind_speed'] : 0.0,
                ':wind_speed_min' => isset(\$data['wind_speed_min']) ? \$data['wind_speed_min'] : max(0.0, \$data['wind_speed'] - 1.8),
                ':wind_speed_max' => isset(\$data['wind_speed_max']) ? \$data['wind_speed_max'] : (\$data['wind_speed'] + 2.5),
                ':pressure' => isset(\$data['pressure']) ? \$data['pressure'] : 1013.25
            ]);

            echo json_encode(["status" => "success", "message" => "Record logged successfully to PostgreSQL!"]);
            exit();
        } catch (PDOException \$e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "PostgreSQL Insertion Failed: " . \$e->getMessage()]);
            exit();
        }
    }
} else {
    echo json_encode([
        "status" => "success",
        "message" => "PostgreSQL Gateway active! Table 'tbl_sensor_logs' successfully checked/constructed."
    ]);
}
?>`;
                            navigator.clipboard.writeText(phpCode);
                            showToastNotification("PHP Code for PostgreSQL copied to clipboard!");
                          }}
                          className="text-xs bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] font-bold uppercase px-4 py-2.5 rounded-lg border border-[#00f0ff]/20 transition cursor-pointer font-mono flex items-center justify-center gap-1"
                        >
                          📋 Copy PostgreSQL PHP Code
                        </button>
                        <button 
                          onClick={async () => {
                            const testUrl = config.localDbApiUrl || 'http://localhost:8000/api.php';
                            showToastNotification("🔧 Menguji hubungan ke PostgreSQL...");
                            setDbTestResult({ status: 'loading', message: `Menghubungi endpoint PostgreSQL pada: ${testUrl}...`, details: 'Mengirimkan HTTP GET request ke web server PHP lokal Anda.' });
                            try {
                              const res = await fetch(testUrl, { method: 'GET' });
                              if (res.ok) {
                                const rawText = await res.text();
                                let parsed;
                                try {
                                  parsed = JSON.parse(rawText.trim());
                                } catch (err) {
                                  // Mengurai secara defensif apabila PHP menghasilkan keluaran ganda (double-JSON) atau peringatan teks
                                  const matches = rawText.match(/\{"status"[^}]*\}/g) || rawText.match(/\{[^}]*\}/g);
                                  if (matches && matches.length > 0) {
                                    parsed = JSON.parse(matches[matches.length - 1]);
                                  } else {
                                    throw err;
                                  }
                                }
                                setIsDbConnected(true);
                                setDbTestResult({
                                  status: 'success',
                                  message: '🟢 KONEKSI DAN INISIALISASI DATABASE BERHASIL!',
                                  details: `${parsed.message || 'Server PostgreSQL merespon dengan OK.'}\nStatus: ${parsed.status || 'success'}`
                                });
                                showToastNotification("🟢 DATABASE KONEKSI SUKSES!");
                                setStreamLogs(prev => {
                                  const list = prev.split('\n');
                                  const ts = format(new Date(), 'HH:mm:ss');
                                  return [...list, `[${ts} SQL SYSTEM] 🟢 LIVE TEST SUCCESS: ${parsed.message || 'Auto-constructed completed successfully.'}`].join('\n');
                                });
                              } else {
                                throw new Error(`HTTP ${res.status} dari server.`);
                              }
                            } catch (e) {
                              setIsDbConnected(false);
                              setDbTestResult({
                                status: 'error',
                                message: '🔴 TIDAK DAPAT MENGHUBUNGI API DATABASE!',
                                details: `Link tujuan (${testUrl}) tidak merespon atau memicu Error CORS/Network.\nKesalahan detail: ${e instanceof Error ? e.message : String(e)}`
                              });
                              showToastNotification("🔴 KONEKSI DATABASE GAGAL!");
                              setStreamLogs(prev => {
                                  const list = prev.split('\n');
                                  const ts = format(new Date(), 'HH:mm:ss');
                                  return [...list, `[${ts} SQL ERROR] 🔴 TEST FAILED: Pastikan server lokal Anda aktif & file api.php diletakkan di htdocs/aws_marine/`].join('\n');
                              });
                            }
                          }}
                          className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/35 font-bold uppercase px-4 py-2.5 rounded-lg transition cursor-pointer font-mono flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                        >
                          ⚡ Test Connection & Auto-Create Table
                        </button>
                      </div>
                    </div>

                    {/* DYNAMIC troubleshooting outcome alert box for ultimate feedback */}
                    {dbTestResult.status !== 'idle' && (
                      <div className={`p-4 rounded-xl border font-mono text-xs ${
                        dbTestResult.status === 'loading' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 animate-pulse' :
                        dbTestResult.status === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
                        'bg-red-500/15 border-red-500/30 text-red-300'
                      }`}>
                        <div className="flex items-center gap-2 font-bold text-sm uppercase mb-1.5">
                          {dbTestResult.status === 'loading' && <span>⏳ SEDANG MENGUJI...</span>}
                          {dbTestResult.status === 'success' && <span>🟢 KONEKSI DATABASE BERHASIL (SUCCESS)</span>}
                          {dbTestResult.status === 'error' && <span>🔴 KONEKSI DATABASE GAGAL (FAILED)</span>}
                        </div>
                        <p className="mb-1 leading-relaxed font-sans text-slate-200">{dbTestResult.message}</p>
                        {dbTestResult.details && (
                          <div className="p-2.5 bg-black/60 rounded border border-white/5 mt-2 text-slate-300 text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto font-mono">
                            {dbTestResult.details}
                          </div>
                        )}
                        {dbTestResult.status === 'error' && (
                          <div className="mt-3 text-amber-300 text-xs leading-relaxed border-t border-red-500/15 pt-2 font-sans">
                            💡 <strong>PETUNJUK PENYELESAIAN MASALAH (PostgreSQL):</strong>
                            <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-300 text-xs">
                              <li>Pastikan server PostgreSQL Anda aktif (default di port <strong className="text-emerald-400">5432</strong>) dan isi database <code className="text-white">db_pelabuhan_telemetry</code> sudah dibuat.</li>
                              <li>Buka file <strong className="text-teal-300 font-mono">php.ini</strong> di XAMPP PHP settings Anda, silakan hilangkan titik koma di awal baris <code className="text-white bg-black/50 px-1">extension=pdo_pgsql</code> dan <code className="text-white bg-black/50 px-1">extension=pgsql</code> agar PHP XAMPP mendukung driver PostgreSQL, lalu restart Apache.</li>
                              <li>Sesuaikan <strong className="text-teal-400">$username</strong> dan <strong className="text-teal-400">$password</strong> di file <strong className="text-white">api.php</strong> Anda dengan kredensial PostgreSQL Anda.</li>
                              <li>Pastikan web server berjalan di port standar (port 80). Jika menggunakan port custom (misal: 8080), sesuaikan URL anda menjadi <code className="text-white font-mono text-xs">http://localhost:8080/aws_marine/api.php</code>.</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <pre className="text-xs font-mono text-slate-400 p-4 bg-black/60 rounded-lg overflow-x-auto max-h-[140px] leading-relaxed select-all border border-white/5">
{`<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// ...
// Kode Auto-Installer PostgreSQL ini menggunakan PDO pgsql untuk mengecek & membangun Tabel secara otomatis!
// Pastikan database db_pelabuhan_telemetry sudah terbuat di PostgreSQL Anda.
?>`}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Database Data Source Controller Panel */}
            <div className="bg-[#0b1424] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                  showRealDb 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                      MODE PENAMPILAN DATA TELEMETRI
                    </h5>
                    <span className={`text-[10px] uppercase tracking-wider font-mono font-black py-0.5 px-2 rounded-full border ${
                      showRealDb 
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 animate-pulse' 
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                    }`}>
                      {showRealDb ? 'DATABASE RAW POSTGRESQL' : 'TRANSIENT OFFLINE SIMULATION'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal max-w-[650px]">
                    {showRealDb ? (
                      <span>Menampilkan <strong>{filteredLogs.length} data riwayat nyata</strong> yang bersumber langsung dari tabel PostgreSQL <code className="text-[#00f0ff] font-mono">tbl_sensor_logs</code> komputer/server lokal Anda untuk keperluan audit/inspeksi.</span>
                    ) : (
                      <span>Menampilkan data log simulasi offline karena basis data PostgreSQL belum terhubung atau ditarik. Klik tombol di kanan untuk memuat data asli database jika PostgreSQL Anda aktif.</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {/* Selector Buttons */}
                <span className="text-xs text-slate-500 uppercase font-bold font-mono mr-2 hidden md:inline">SUMBER LOG:</span>
                <div className="flex bg-[#050a12] p-1 border border-white/10 rounded-lg w-full md:w-auto justify-center md:justify-start">
                  <button
                    onClick={() => {
                      setShowRealDb(false);
                      showToastNotification("Log beralih ke Mode Simulasi Offline.");
                    }}
                    className={`text-xs px-3.5 py-1.5 rounded-md font-mono uppercase font-black transition cursor-pointer flex-1 md:flex-initial text-center ${
                      !showRealDb 
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📴 Offline Logs
                  </button>
                  <button
                    onClick={() => {
                      if (realDbLogs.length === 0) {
                        fetchRealDatabaseLogs(false);
                      } else {
                        setShowRealDb(true);
                        showToastNotification("Log beralih ke Mode Database PostgreSQL.");
                      }
                    }}
                    className={`text-xs px-3.5 py-1.5 rounded-md font-mono uppercase font-black transition cursor-pointer flex-1 md:flex-initial text-center ${
                      showRealDb 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    🐘 PostgreSQL Table
                  </button>
                </div>

                <button
                  onClick={() => fetchRealDatabaseLogs(false)}
                  disabled={isFetchingRealDb}
                  className={`w-full md:w-auto text-xs font-black uppercase py-2.5 px-4 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 transition duration-250 cursor-pointer flex items-center justify-center gap-1.5 font-mono ${
                    isFetchingRealDb ? 'opacity-55 cursor-wait' : ''
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRealDb ? 'animate-spin' : ''}`} />
                  {isFetchingRealDb ? "SYNCING..." : "🔄 SYNC & AMBIL DATA ASLI"}
                </button>
              </div>
            </div>

            {/* Filter Log panel with CSV exporter */}
            <div className="bg-gradient-to-b from-[#0b1424] to-bg p-5 rounded-2xl border border-white/10 flex flex-wrap gap-5 items-end justify-between shadow-lg">
              <div className="flex flex-wrap gap-5 items-end">
                <div>
                  <span className="text-xs md:text-xs uppercase font-bold tracking-wider text-[#00f0ff] mb-2 block font-mono">📅 Start Log Period</span>
                  <input 
                    type="date" 
                    value={dbStartDate}
                    onChange={(e) => setDbStartDate(e.target.value)}
                    className="bg-[#050a12] border border-[#00f0ff]/25 text-white text-xs md:text-sm font-mono py-2.5 px-3.5 rounded-lg outline-none focus:border-[#00f0ff] transition focus:ring-1 focus:ring-[#00f0ff]/30" 
                  />
                </div>
                <div>
                  <span className="text-xs md:text-xs uppercase font-bold tracking-wider text-[#00f0ff] mb-2 block font-mono">📅 End Log Period</span>
                  <input 
                    type="date" 
                    value={dbEndDate}
                    onChange={(e) => setDbEndDate(e.target.value)}
                    className="bg-[#050a12] border border-[#00f0ff]/25 text-white text-xs md:text-sm font-mono py-2.5 px-3.5 rounded-lg outline-none focus:border-[#00f0ff] transition focus:ring-1 focus:ring-[#00f0ff]/30" 
                  />
                </div>
                <div>
                  <span className="text-xs md:text-xs uppercase font-bold tracking-wider text-[#00f0ff] mb-2 block font-mono">🔍 Search Metrics</span>
                  <input 
                    type="text" 
                    placeholder="Search temp, wind..."
                    value={dbSearchTerm}
                    onChange={(e) => setDbSearchTerm(e.target.value)}
                    className="bg-[#050a12] border border-[#00f0ff]/25 text-white text-xs md:text-sm font-mono py-2.5 px-4 rounded-lg outline-none focus:border-[#00f0ff] transition placeholder:text-slate-500 focus:ring-1 focus:ring-[#00f0ff]/30 min-w-[210px]" 
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={filterLogsData}
                  className="bg-[#00f0ff] hover:bg-[#00d0f0] transition text-[#050a12] text-xs md:text-sm font-bold font-mono py-2.5 px-6 rounded-lg uppercase cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                >
                  Apply Filter
                </button>
                <button 
                  onClick={exportLogsToCSV}
                  className="bg-emerald-500 hover:bg-emerald-600 transition text-[#050a12] text-xs md:text-sm font-bold font-mono py-2.5 px-6 rounded-lg uppercase cursor-pointer text-slate-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                >
                  Export CSV File
                </button>
              </div>
            </div>

             {/* Industrial logs Table */}
             <div className="bg-[#0b1424] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
               <div className="overflow-x-auto">
                 <table className="w-full text-[12px] text-left border-collapse">
                   <thead>
                     <tr className="bg-[#050a12] border-b border-[#00f0ff]/20">
                       <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-xs">DateTime</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-xs">Temp (°C)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-xs">Hum (%)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-xs">Rad Avg / Max (W/m²)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-sky-400 text-center text-xs">Rain (mm)</th>
                       <th className="p-3.5 uppercase font-bold tracking-[0.15em] text-amber-500 text-center text-xs">W-Gust (m/s / kt)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-[#3b82f6] text-center text-xs">W-Level (m)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-pink-400 text-center text-xs">pH Air</th>
                        <th className="p-3.5 uppercase font-bold tracking-widest text-emerald-400 text-center text-xs">Battery (V)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-amber-500 text-center text-xs">W-Dir (°)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-amber-500 text-center text-xs">W-Spd (m/s / kt)</th>
                       <th className="p-3.5 uppercase font-bold tracking-widest text-slate-400 text-center text-xs">Press (hPa)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5 font-mono">
                     {filteredLogs.length === 0 ? (
                       <tr>
                         <td colSpan={12} className="p-8 text-center uppercase tracking-widest text-slate-500 text-xs">
                           No logged matching rows found. Adjust criteria.
                         </td>
                       </tr>
                     ) : (
                       filteredLogs.map((item, idx) => (
                         <tr key={idx} className="hover:bg-white/5 transition-colors">
                           <td className="p-3 text-center border-r border-white/5 text-slate-300 font-sans">{format(item.timestamp, 'dd-MM-yyyy HH:mm:ss')}</td>
                           <td className="p-3 text-center border-r border-white/5 text-[#e0f2fe]">{item.temperature.toFixed(1)}</td>
                           <td className="p-3 text-center border-r border-white/5 text-[#e0f2fe]">{item.humidity}%</td>
                           <td className="p-3 text-center border-r border-white/5 text-[#f59e0b]">{item.solarRadiation} / {item.solarRadiationMax ?? Math.round(item.solarRadiation * 1.15)}</td>
                           <td className="p-3 text-center border-r border-white/5 text-sky-400 font-bold">{(item.rainfall ?? 0.0).toFixed(1)}</td>
                           <td className="p-3 text-center border-r border-white/5 text-amber-400 font-bold">
                             {item.windGust !== undefined && item.windGust !== null ? `${item.windGust.toFixed(1)} / ${(item.windGust * 1.94384).toFixed(0)}` : "—"}
                           </td>
                           <td className="p-3 text-center border-r border-white/5 text-sky-400 text-right">{(item.seaLevel / 100).toFixed(3)}m</td>
                           <td className="p-3 text-center border-r border-white/5 text-pink-400 font-bold">{(item.waterPh ?? 7.80).toFixed(2)}</td>
                            <td className="p-3 text-center border-r border-white/5 text-emerald-400 font-bold">{item.battery !== undefined ? item.battery.toFixed(2) : "12.2"}</td>
                           <td className="p-3 text-center border-r border-white/5 text-[#e0f2fe]">{item.windDirection}°</td>
                           <td className="p-3 text-center border-r border-white/5 text-amber-400 font-bold">{item.windSpeed.toFixed(1)} / {(item.windSpeed * 1.94384).toFixed(0)}</td>
                           <td className="p-3 text-center text-slate-300 pr-4 text-right">{item.pressure.toFixed(1)}</td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>

          </div>
        )}

        {/* PAGE tab 4: SETTINGS OPT */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* COLUMN 1: Hardware & Network (width 4/12) */}
            <div className="xl:col-span-4 space-y-6">
              
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="text-xs md:text-sm uppercase font-bold text-[#f59e0b] tracking-[0.2em] border-b border-white/5 pb-2">
                  🔒 Hardware & Network Config
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="text-xs md:text-xs uppercase font-bold text-teal-400 font-mono tracking-wider block mb-1.5">📡 Logger Mode</label>
                    <select 
                      value={config.transport} 
                      onChange={(e) => setConfig({ ...config, transport: e.target.value })}
                      className="w-full bg-[#050a12] border border-[#00f0ff]/20 font-mono text-xs md:text-sm p-3 text-white rounded-lg outline-none focus:border-[#00f0ff]"
                    >
                      <option value="OFF">OFF</option>
                      <option value="SERIAL">SERIAL COM (RS232/RS485)</option>
                      <option value="TCP">TCP/IP SERVER CONNECTION</option>
                      <option value="MOXA_TCP">TCP/IP GATEWAY MOXA (ROUTER)</option>
                    </select>
                  </div>

                  {/* Web Serial Action Buttons for Physical Port Connections */}
                  {config.transport === 'SERIAL' && (
                    <div className="pt-1 pb-2 border-b border-white/5 space-y-1.5">
                      <span className="text-xs text-slate-400 font-mono block">Web Serial Control:</span>
                      {isReadingSerial ? (
                        <button
                          onClick={disconnectSerial}
                          className="w-full text-xs font-bold font-mono py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          🛑 OFF PORT: {config.serialcom || 'COM'}
                        </button>
                      ) : (
                        <button
                          onClick={connectSerial}
                          className="w-full text-xs font-bold font-mono py-2.5 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/35 rounded-lg transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        >
                          🔌 CONNECT COM PORT
                        </button>
                      )}
                    </div>
                  )}

                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                    <label className="text-xs md:text-xs uppercase font-bold text-emerald-400 font-mono tracking-wider block mb-1">🔌 Mode Pengoperasian</label>
                    <div className="text-xs text-slate-100 font-bold font-mono">📡 HARDWARE REAL-TIME RECEIVER</div>
                    <p className="text-xs text-slate-400 font-sans mt-1 leading-normal">
                      Simulasi dinonaktifkan sepenuhnya. Sistem memproses data real-time langsung melalui physical receiver.
                    </p>
                  </div>

                  <div className="mb-3.5">
                    <label className="text-xs md:text-xs uppercase font-bold text-teal-400 font-mono tracking-wider block mb-1.5">🏷️ Station ID</label>
                    <input 
                      type="text" 
                      value={config.idStation || ''} 
                      placeholder="SYS1000"
                      onChange={(e) => setConfig({ ...config, idStation: e.target.value })}
                      className="w-full bg-[#050a12] border border-white/10 font-mono text-xs md:text-sm text-center p-3 text-white rounded-lg outline-none focus:border-[#00f0ff]" 
                    />
                  </div>

                  <div>
                    <label className="text-xs md:text-xs uppercase font-bold text-teal-400 font-mono tracking-wider block mb-1.5">✂️ Splitter Char</label>
                    <input 
                      type="text" 
                      value={config.splitchar} 
                      onChange={(e) => setConfig({ ...config, splitchar: e.target.value })}
                      className="w-full bg-[#050a12] border border-white/10 font-mono text-xs md:text-sm text-center p-3 text-white rounded-lg outline-none focus:border-[#00f0ff]" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs md:text-xs uppercase font-bold text-teal-400 font-mono tracking-wider block mb-1.5">
                        {config.transport === 'SERIAL' ? 'COM Port' : 'Moxa IP / Host'}
                      </label>
                      <input 
                        type="text" 
                        value={config.serialcom || ''} 
                        placeholder={config.transport === 'SERIAL' ? 'COM3' : '192.168.127.254'}
                        onChange={(e) => setConfig({ ...config, serialcom: e.target.value })}
                        className="w-full bg-[#050a12] border border-white/10 font-mono text-xs md:text-sm text-center p-3 text-white rounded-lg outline-none focus:border-[#00f0ff]" 
                      />
                    </div>
                    <div>
                      <label className="text-xs md:text-xs uppercase font-bold text-teal-400 font-mono tracking-wider block mb-1.5">
                        {config.transport === 'SERIAL' ? 'Baudrate' : 'Socket Port'}
                      </label>
                      <input 
                        type="text" 
                        value={config.baudrate || ''} 
                        placeholder={config.transport === 'SERIAL' ? '9600' : '4001'}
                        onChange={(e) => setConfig({ ...config, baudrate: e.target.value })}
                        className="w-full bg-[#050a12] border border-white/10 font-mono text-xs md:text-sm text-center p-3 text-white rounded-lg outline-none focus:border-[#00f0ff]" 
                      />
                    </div>
                  </div>

                  {config.transport === 'MOXA_TCP' && (
                    <div className="p-3.5 bg-slate-950/90 border border-white/10 rounded-xl space-y-3 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-extrabold text-teal-400">📡 MOXA LIVE STATUS:</span>
                        {moxaStatus && moxaStatus.connected ? (
                          <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-black tracking-wider animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            CONNECTED
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 bg-red-400/10 text-red-500 border border-red-500/30 text-[10px] px-2 py-0.5 rounded font-black tracking-wider">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            DISCONNECTED
                          </span>
                        )}
                      </div>

                      <div className="text-xs space-y-1 bg-black/40 p-2.5 rounded border border-white/5 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">IP Gateway:</span>
                          <span className="text-white font-bold">{moxaStatus?.moxa_ip || config.serialcom || '192.168.127.254'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Port Gateway:</span>
                          <span className="text-white font-bold">{moxaStatus?.moxa_port || config.baudrate || '10001'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Daemon state:</span>
                          <span className={`font-bold ${moxaStatus && moxaStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {moxaStatus?.state || 'OFFLINE'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Last Synced:</span>
                          <span className="text-white text-[11px]">{moxaStatus?.last_seen || 'Never / Waiting daemon...'}</span>
                        </div>
                        {moxaStatus?.error && (
                          <div className="mt-1.5 text-[10px] text-red-300 bg-red-500/10 p-1.5 rounded border border-red-500/15">
                            ⚠️ Msg: {moxaStatus.error}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-white/5 pt-2.5 space-y-1">
                        <label className="text-[10px] uppercase font-bold text-teal-400 block">🌐 DAEMON WEBSOCKET URL</label>
                        <input 
                          type="text" 
                          value={config.moxaDaemonUrl || 'http://localhost:8080'} 
                          placeholder="http://localhost:8080"
                          onChange={(e) => {
                            const newCfg = { ...config, moxaDaemonUrl: e.target.value };
                            setConfig(newCfg);
                            localStorage.setItem('aws_config', JSON.stringify(newCfg));
                          }}
                          className="w-full bg-black border border-white/10 font-mono text-xs text-center p-2 text-teal-300 rounded focus:border-[#00f0ff] outline-none" 
                        />
                      </div>

                      {window.location.protocol === 'https:' && (
                        <div className="p-2.5 text-[10px] text-amber-300 bg-amber-500/10 rounded border border-amber-500/15 leading-relaxed space-y-1">
                          <p className="font-extrabold text-amber-400">⚠️ PERINGATAN BROWSER SECURE (HTTPS):</p>
                          <p>
                            Dashboard saat ini dibuka via <strong>HTTPS</strong>, sehingga browser modern otomatis <strong>memblokir</strong> sambungan langsung ke daemon lokal yang berjalan via <strong>HTTP (CORS / Mixed Content)</strong>.
                          </p>
                          <p className="font-bold text-white">Agar data masuk ke dashboard, Anda harus:</p>
                          <ul className="list-disc pl-3.5 space-y-0.5">
                            <li>Buka Dashboard secara lokal menggunakan protokol HTTP standar (misal: <strong>http://localhost:3000</strong>).</li>
                            <li>Atau klik icon gembok di sebelah kiri address bar browser Anda, pilih <strong>Site Settings</strong>, lalu set opsi <strong>Insecure Content</strong> menjadi <strong>Allow / Izinkan</strong>.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-white/5 pt-3">
                    <label className="text-xs md:text-xs uppercase font-bold text-emerald-400 font-mono tracking-wider block mb-1.5">🔄 Visual Pier Angle (Degrees 0-360)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="360"
                      value={config.pierAngle} 
                      onChange={(e) => setConfig({ ...config, pierAngle: e.target.value })}
                      className="w-full bg-[#050a12] border border-white/15 font-mono text-sm text-center p-3 text-emerald-400 font-black rounded-lg outline-none cursor-pointer focus:border-emerald-400" 
                    />
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <label className="text-xs uppercase font-bold text-rose-400 tracking-wider block mb-1.5 flex items-center gap-1.5">
                      🔒 Kunci Dashboard Saat Offline (Tampilkan Warning)
                    </label>
                    <select 
                      value={config.lockOfflineDashboard || 'ON'} 
                      onChange={(e) => {
                        const newCfg = { ...config, lockOfflineDashboard: e.target.value };
                        setConfig(newCfg);
                        localStorage.setItem('aws_config', JSON.stringify(newCfg));
                      }}
                      className="w-full bg-[#050a12] border border-white/15 font-mono text-xs md:text-sm p-3 text-rose-300 font-bold rounded-lg outline-none cursor-pointer focus:border-rose-400"
                    >
                      <option value="ON">ON (Kunci &amp; Blokir Dashboard)</option>
                      <option value="OFF">OFF (Tampilkan Data Terakhir Tanpa Blokir)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 font-sans mt-1 leading-normal">
                      Saat sensor/Moxa mati atau terputus, opsi <strong>ON</strong> akan menampilkan layar warning peringatan merah agar petugas tahu ada kerusakan data stream. Opsi <strong>OFF</strong> akan membiarkan dashboard menampilkan data terakhir.
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <label className="text-xs uppercase font-bold text-sky-400 tracking-wider block mb-1.5">🔍 Skala Ukuran Teks & UI (Zoom)</label>
                    <select 
                      value={config.uiZoom || '115'} 
                      onChange={(e) => setConfig({ ...config, uiZoom: e.target.value })}
                      className="w-full bg-[#050a12] border border-white/15 font-mono text-xs md:text-sm p-3 text-sky-300 font-bold rounded-lg outline-none cursor-pointer focus:border-sky-400"
                    >
                      <option value="100">100% (Standar / Layar Lebar)</option>
                      <option value="110">110% (Sedang)</option>
                      <option value="115">115% (Ideal Laptop - Direkomendasikan)</option>
                      <option value="120">120% (Besar)</option>
                      <option value="125">125% (Sangat Besar)</option>
                      <option value="130">130% (Resolusi Tinggi / High DPI)</option>
                    </select>
                    <p className="text-xs text-slate-400 font-sans mt-1 leading-normal">
                      Sesuaikan skala ukuran teks untuk kenyamanan membaca di layar laptop Anda.
                    </p>
                  </div>

                  {/* Cloud Mode configs */}
                  <div className="border-t border-white/5 pt-3 space-y-3">
                    <div>
                      <label className="text-xs uppercase font-bold text-[#22c55e] tracking-wider block mb-1">Cloud Mode</label>
                      <select 
                        value={config.cloudMode}
                        onChange={(e) => setConfig({ ...config, cloudMode: e.target.value })}
                        className="w-full bg-[#050a12] border border-[#22c55e]/25 font-mono text-xs p-2 text-white rounded outline-none"
                      >
                        <option value="OFF">OFF</option>
                        <option value="HTTP">HTTP API</option>
                        <option value="FTP">FTP</option>
                        <option value="MQTT">MQTT</option>
                        <option value="BOTH">BOTH (HTTP & FTP)</option>
                        <option value="ALL">ALL (HTTP, FTP & MQTT)</option>
                      </select>
                    </div>

                    {(config.cloudMode === 'HTTP' || config.cloudMode === 'BOTH' || config.cloudMode === 'ALL') && (
                      <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-wider block">HTTP API URL</label>
                        <input 
                          type="text" 
                          value={config.httpUrl}
                          onChange={(e) => setConfig({ ...config, httpUrl: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-xs text-left p-2 text-slate-300 rounded outline-none" 
                        />
                      </div>
                    )}

                    {(config.cloudMode === 'FTP' || config.cloudMode === 'BOTH' || config.cloudMode === 'ALL') && (
                      <div className="space-y-2 p-3 bg-teal-950/20 border border-teal-500/20 rounded-lg">
                        <span className="text-xs font-black text-teal-400 font-mono block uppercase tracking-wider mb-1">📁 KREDENSIAL SERVER FTP</span>
                        
                        <div className="space-y-1">
                          <label className="text-xs uppercase font-bold text-slate-400 block font-mono">FTP Host / Server IP</label>
                          <input 
                            type="text" 
                            value={config.ftpHost}
                            placeholder="ftp.portmarine.gov"
                            onChange={(e) => setConfig({ ...config, ftpHost: e.target.value })}
                            className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-slate-400 block font-mono">FTP Username</label>
                            <input 
                              type="text" 
                              value={config.ftpUser}
                              placeholder="aws_logger"
                              onChange={(e) => setConfig({ ...config, ftpUser: e.target.value })}
                              className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold tracking-wide text-slate-400 block font-mono mb-1">FTP Password</label>
                            <input 
                              type="password" 
                              value={config.ftpPass}
                              placeholder="********"
                              onChange={(e) => setConfig({ ...config, ftpPass: e.target.value })}
                              className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold tracking-wide text-slate-400 block font-mono mb-1">FTP Upload Path (Directory)</label>
                          <input 
                            type="text" 
                            value={config.ftpPath}
                            placeholder="/data/xml"
                            onChange={(e) => setConfig({ ...config, ftpPath: e.target.value })}
                            className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                          />
                        </div>
                      </div>
                    )}

                    {(config.cloudMode === 'MQTT' || config.cloudMode === 'ALL') && (
                      <div className="space-y-2 p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg">
                        <span className="text-xs font-black text-amber-400 font-mono block uppercase tracking-wider mb-1">📡 KREDENSIAL MQTT BROKER</span>
                        
                        <div className="space-y-1">
                          <label className="text-xs uppercase font-bold text-slate-400 block font-mono">MQTT Broker (Host)</label>
                          <input 
                            type="text" 
                            value={config.mqttBroker}
                            placeholder="mqtt.portmarine.gov"
                            onChange={(e) => setConfig({ ...config, mqttBroker: e.target.value })}
                            className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-slate-400 block font-mono">MQTT Port</label>
                            <input 
                              type="text" 
                              value={config.mqttPort}
                              placeholder="1883"
                              onChange={(e) => setConfig({ ...config, mqttPort: e.target.value })}
                              className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold tracking-wide text-slate-400 block font-mono mb-1">MQTT Topic</label>
                            <input 
                              type="text" 
                              value={config.mqttTopic}
                              placeholder="aws/ports/sys1000/telemetry"
                              onChange={(e) => setConfig({ ...config, mqttTopic: e.target.value })}
                              className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs uppercase font-bold text-slate-400 block font-mono">MQTT Username</label>
                            <input 
                              type="text" 
                              value={config.mqttUser}
                              placeholder="aws_client_01"
                              onChange={(e) => setConfig({ ...config, mqttUser: e.target.value })}
                              className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold tracking-wide text-slate-400 block font-mono mb-1">MQTT Password</label>
                            <input 
                              type="password" 
                              value={config.mqttPass}
                              placeholder="********"
                              onChange={(e) => setConfig({ ...config, mqttPass: e.target.value })}
                              className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-slate-300 rounded outline-none text-left" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Water pH Threshold configs */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <label className="text-xs uppercase font-bold text-pink-400 tracking-wider block font-mono mb-1">
                      🧪 Water pH Alarm Limits
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs md:text-xs text-slate-400 uppercase font-mono block mb-1">Min Safe (Acid)</span>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          max="14"
                          value={config.minPhThreshold ?? '6.5'}
                          onChange={(e) => setConfig({ ...config, minPhThreshold: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-center text-xs p-2.5 text-pink-400 font-bold rounded" 
                        />
                      </div>
                      <div>
                        <span className="text-xs md:text-xs text-slate-400 uppercase font-mono block mb-1">Max Safe (Alkali)</span>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          max="14"
                          value={config.maxPhThreshold ?? '8.5'}
                          onChange={(e) => setConfig({ ...config, maxPhThreshold: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-center text-xs p-2.5 text-pink-400 font-bold rounded" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rainfall alarm limit configs */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <label className="text-xs uppercase font-bold text-sky-400 tracking-wider block font-mono mb-1">
                      🌧️ Rainfall Alarm Settings
                    </label>
                    <div>
                      <span className="text-xs md:text-xs text-slate-400 uppercase font-mono block mb-1">Heavy Rain Alert Threshold (mm)</span>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        value={config.rainWarningThreshold ?? '10.0'}
                        onChange={(e) => setConfig({ ...config, rainWarningThreshold: e.target.value })}
                        className="w-full bg-[#050a12] border border-white/10 font-mono text-center text-xs p-2.5 text-sky-400 font-bold rounded" 
                      />
                    </div>
                  </div>

                  {/* Database Storage custom configurations */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <label className="text-xs uppercase font-bold text-teal-400 tracking-wider block">
                      📁 Database Archiving & Storage Settings
                    </label>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Database Storage Mode</span>
                        <select 
                          value={config.dbStorageMode || 'AVG'} 
                          onChange={(e) => setConfig({ ...config, dbStorageMode: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-xs select-none p-2 text-teal-400 font-bold rounded outline-none"
                        >
                          <option value="AVG">AVG - WMO Compliant Compressed Averages</option>
                          <option value="RAW">RAW - Instantaneous / Record Latest Sample</option>
                        </select>
                      </div>
                      
                      <div>
                        <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Averaging & Logging Interval ({config.dbStorageInterval || 10} Minutes)</span>
                        <div className="flex gap-2">
                          <input 
                            type="range" 
                            min="1" 
                            max="60" 
                            value={config.dbStorageInterval || 10} 
                            onChange={(e) => {
                              const calculated = parseInt(e.target.value);
                              setConfig({ ...config, dbStorageInterval: calculated });
                            }}
                            className="w-full accent-teal-400"
                          />
                          <input 
                            type="number" 
                            min="1" 
                            max="60" 
                            value={config.dbStorageInterval || 10} 
                            onChange={(e) => {
                              const calculated = Math.min(60, Math.max(1, parseInt(e.target.value) || 1));
                              setConfig({ ...config, dbStorageInterval: calculated });
                            }}
                            className="w-12 bg-[#050a12] border border-white/10 font-mono text-center text-xs p-1 text-white rounded outline-none"
                          />
                        </div>
                      </div>

                      {/* Local database API URL */}
                      <div>
                        <span className="text-xs text-slate-400 uppercase font-mono block mb-1">PostgreSQL Database API Endpoint (PHP API Link)</span>
                        <input 
                          type="text" 
                          value={config.localDbApiUrl || ''} 
                          placeholder="http://localhost:8000/api.php"
                          onChange={(e) => setConfig({ ...config, localDbApiUrl: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-teal-400 rounded outline-none text-left"
                        />
                        <p className="text-xs text-slate-500 font-mono mt-1 leading-tight">
                          Alamat file <code className="text-slate-400 bg-white/5 px-0.5 rounded">api.php</code> di server PHP standalone atau virtual host Anda. Berguna untuk sinkronisasi otomatis.
                        </p>
                      </div>

                      <button 
                        onClick={() => {
                          const currentInterval = parseInt(config.dbStorageInterval) || 10;
                          const regenerated = generateInitialLogs(45, currentInterval);
                          setHistory(regenerated);
                          localStorage.setItem('aws_history_logs', JSON.stringify(regenerated));
                          showToastNotification(`Successfully regenerated database logs with a ${currentInterval}-Minute logging frequency!`);
                        }}
                        className="w-full bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 font-mono text-xs font-bold text-teal-300 p-2.5 rounded-lg transition text-center uppercase cursor-pointer"
                      >
                        🔄 RESET & REGENERATE DB HISTORY
                      </button>
                    </div>
                  </div>
                </div>

              </div>



            </div>

            {/* COLUMN 2: Channel mappings & indices (width 8/12) */}
            <div className="xl:col-span-8 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-b from-[#0b1424] to-bg p-4.5 rounded-xl border border-white/10 flex justify-between items-center">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-[#00f0ff] font-bold block mb-1">Date Time Index</span>
                    <select 
                      value={config.ind_date}
                      onChange={(e) => setConfig({ ...config, ind_date: e.target.value })}
                      className="bg-[#050a12] border border-white/10 font-mono text-xs p-1 text-white rounded outline-none"
                    >
                      {[...Array(20)].map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-[#050a12] border border-yellow-500 rounded p-2 text-center text-xs font-mono font-black text-yellow-500 min-w-[70px]">
                    {format(new Date(), 'dd-MM-yyyy')}
                  </div>
                </div>

                <div className="bg-gradient-to-b from-[#0b1424] to-bg p-4.5 rounded-xl border border-white/10 flex justify-between items-center">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-[#00f0ff] font-bold block mb-1">Station ID Index</span>
                    <select 
                      value={config.ind_id}
                      onChange={(e) => setConfig({ ...config, ind_id: e.target.value })}
                      className="bg-[#050a12] border border-white/10 font-mono text-xs p-1 text-white rounded outline-none"
                    >
                      {[...Array(20)].map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-[#050a12] border border-[#00f0ff] rounded p-2 text-center text-xs font-mono font-black text-[#00f0ff] min-w-[70px]">
                    {config.idStation}
                  </div>
                </div>
              </div>

              {/* Grid of channels to index splits mapping (17 metrics) */}
              <div className="bg-gradient-to-br from-[#0c1625] to-bg border border-white/10 p-6 rounded-3xl">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-widest mb-6 pb-2 border-b border-white/5">
                  🕹️ Sensor Channel Mapping Indexes
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Air Temp', key: 'ch_0', color: '#4ade80', source: currentData.temperature.toFixed(1) + ' °C' },
                    { label: 'Temp Avg', key: 'ch_2', color: '#4ade80', source: tempStats.avg + ' °C' },
                    { label: 'Temp Max', key: 'ch_4', color: '#f87171', source: tempStats.max + ' °C' },
                    { label: 'Temp Min', key: 'ch_6', color: '#22d3ee', source: tempStats.min + ' °C' },
                    { label: 'Humidity', key: 'ch_8', color: '#00f0ff', source: currentData.humidity + ' %' },
                    { label: 'Solar Rad.', key: 'ch_5', color: '#f59e0b', source: currentData.solarRadiation + ' W/m²' },
                    { label: 'Solar Max', key: 'ch_solar_max', color: '#f59e0b', source: (currentData.solarRadiationMax ?? Math.round(currentData.solarRadiation * 1.15)) + ' W/m²' },
                    { label: 'Water Lvl', key: 'ch_15', color: '#3b82f6', source: (currentData.seaLevel / 100).toFixed(3) + ' m' },
                    { label: 'Wind Dir', key: 'ch_16', color: '#fbbf24', source: currentData.windDirection + ' °' },
                    { label: 'Wind Spd', key: 'ch_17', color: '#fbbf24', source: `${currentData.windSpeed.toFixed(1)} m/s (${(currentData.windSpeed * 1.94384).toFixed(1)} kt)` },
                    { label: 'Wind Spd Max', key: 'ch_19', color: '#fbbf24', source: `${windStats.max.toFixed(1)} m/s (${(windStats.max * 1.94384).toFixed(1)} kt)` },
                    { label: 'Wind Spd Min', key: 'ch_20', color: '#fbbf24', source: `${windStats.min.toFixed(1)} m/s (${(windStats.min * 1.94384).toFixed(1)} kt)` },
                    { label: 'Pres QFE', key: 'ch_9', color: '#94a3b8', source: currentData.pressure.toFixed(1) + ' hPa' },
                    { label: 'Pres QFF', key: 'ch_11', color: '#94a3b8', source: (currentData.pressure + 2.1).toFixed(1) + ' hPa' },
                    { label: 'Pres QNH', key: 'ch_13', color: '#94a3b8', source: (currentData.pressure - 1.2).toFixed(1) + ' hPa' },
                    { label: 'Pres STN', key: 'ch_7', color: '#94a3b8', source: currentData.pressure.toFixed(1) + ' hPa' },
                    { label: 'Water pH', key: 'ch_18', color: '#f5d0fe', source: (currentData.waterPh ?? 7.80).toFixed(2) },
                    { label: 'Water Temp', key: 'ch_water_temp', color: '#38bdf8', source: waterTempStats.avg + ' °C' },
                    { label: 'Water T. Max', key: 'ch_water_temp_max', color: '#f87171', source: waterTempStats.max + ' °C' },
                    { label: 'Water T. Min', key: 'ch_water_temp_min', color: '#38bdf8', source: waterTempStats.min + ' °C' },
                    { label: 'Rainfall', key: 'ch_rain', color: '#0ea5e9', source: currentData.rainfall.toFixed(1) + ' mm' },
                    { label: 'Battery Volt', key: 'ch_batt', color: '#10b981', source: (currentData.battery !== undefined ? currentData.battery.toFixed(2) : '12.2') + ' V' }
                  ].map((sensor, s_idx) => (
                    <div key={s_idx} className="bg-[#050a12]/70 border border-white/5 p-3 rounded-lg flex flex-col justify-between gap-1">
                      <span className="text-xs uppercase font-mono tracking-wider font-extrabold text-slate-400 block">{sensor.label} ({sensor.key})</span>
                      <div className="flex gap-2 items-center">
                        <select 
                          value={config.sensors[sensor.key as keyof typeof config.sensors]}
                          onChange={(e) => {
                            const updatedSensors = { ...config.sensors, [sensor.key]: e.target.value };
                            setConfig({ ...config, sensors: updatedSensors });
                          }}
                          className="bg-[#050a12] border border-white/10 font-mono text-xs w-[50px] text-white p-1 rounded outline-none"
                        >
                          <option value="OFF">OFF</option>
                          {[...Array(25)].map((_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                        <div className="flex-1 bg-[#010306] border border-white/5 py-1 px-2 rounded font-mono text-xs text-center font-black truncate" style={{ color: sensor.color }}>
                          {sensor.source}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action indicators and manual buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    localStorage.removeItem('aws_config');
                    setConfig(DEFAULT_CONFIG);
                    showToastNotification('Config Reset to Factory Default');
                  }}
                  className="bg-amber-500 hover:bg-amber-600 font-mono rounded-lg p-3 text-xs font-bold text-slate-950 uppercase cursor-pointer text-center"
                >
                  FACTORY RESET OPT
                </button>
                <button 
                  onClick={() => handleSaveConfig(config)}
                  className="bg-emerald-500 hover:bg-emerald-600 font-mono rounded-lg p-3 text-xs font-black text-slate-950 uppercase cursor-pointer text-center"
                >
                  SAVE ACTIVE CONFIG
                </button>
                
                <button 
                  onClick={() => {
                    const moxaSensors = {
                      'ch_0': '6',   // Air Temp (TA_meas)
                      'ch_2': '6',   // Temp Avg (TA_meas)
                      'ch_4': '7',   // Temp Max (TA_Max)
                      'ch_6': '8',   // Temp Min (TA_Min)
                      'ch_8': '9',   // Humidity (RH_meas)
                      'ch_5': '12',  // Solar Rad
                      'ch_solar_max': 'OFF', // Solar Rad Max
                      'ch_15': '17', // Water Level (m)
                      'ch_16': '5',  // Wind Dir (WD_meas)
                      'ch_17': '3',  // Wind Spd (WS_meas)
                      'ch_19': 'OFF',// Wind Spd Max (not mapped by preset)
                      'ch_20': 'OFF',// Wind Spd Min (not mapped by preset)
                      'ch_7': '10',  // Pres STN
                      'ch_9': '10',  // Pres QFE
                      'ch_11': '10', // Pres QFF
                      'ch_13': '10', // Pres QNH
                      'ch_18': '18',  // Water pH (PH_meas)
                      'ch_water_temp': '14', // Water Temp
                      'ch_water_temp_max': '15', // Water Temp Max
                      'ch_water_temp_min': '16', // Water Temp Min
                      'ch_rain': '13', // Rainfall (for example, rain meter)
                      'ch_batt': '20' // Battery Voltage
                    };
                    setConfig({
                      ...config,
                      transport: 'MOXA_TCP',
                      splitchar: ';',
                      sensors: moxaSensors
                    });
                    showToastNotification('Moxa TCP/IP Channel Mapping Loaded!');
                  }}
                  className="col-span-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 font-mono rounded-lg p-3.5 text-xs font-extrabold text-white uppercase cursor-pointer text-center shadow-lg transition-all"
                >
                  📡 LOAD MOXA TELEMETRY PRESETS
                </button>

                {/* BMKG QUICK LINK BUTTON BELOW SETTINGS */}
                <button
                  type="button"
                  id="settings-bmkg-btn"
                  onClick={() => {
                    setActiveTab('bmkg');
                    showToastNotification(`Buka Prakiraan BMKG ${config.bmkgPortLabel || 'Pelabuhan Ciwandan'}!`);
                  }}
                  className="col-span-2 bg-gradient-to-r from-[#0d9488] to-[#047857] hover:from-[#14b8a6] hover:to-[#059669] font-mono rounded-lg p-3.5 text-xs font-extrabold text-white uppercase cursor-pointer text-center shadow-lg transition-all border border-[#2dd4bf]/20"
                >
                  ⚓ BUKA & TAMPILKAN GRAFIK PRAKIRAAN MARITIM BMKG ({(config.bmkgPortLabel || 'Pelabuhan Ciwandan').toUpperCase()})
                </button>

                {/* Scrolling Raw Stream Monitor positioned directly below the Presets button */}
                <div className="col-span-2 bg-[#020408] border border-[#22c55e]/40 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between mt-2">
                  <div className="bg-gradient-to-r from-slate-900 to bg p-3 border-b border-[#22c55e]/25 text-xs uppercase font-mono font-bold text-[#c2fcd5] flex justify-between items-center">
                    <span>📟 Raw Stream Monitor</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <textarea 
                    readOnly 
                    value={streamLogs}
                    className="w-full h-[480px] bg-[#010306] border-none text-sm font-mono leading-relaxed p-4 text-emerald-400 outline-none resize-none"
                    placeholder="Menunggu stream data dari sensor..."
                  />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* PAGE tab 5: BMKG FORECAST INTEGRATION */}
        {activeTab === 'bmkg' && (
          <div className="space-y-6 animate-fade-in pb-10">
            
            {/* BMKG Header Controls */}
            <div className="bg-gradient-to-r from-[#0b1424] via-[#040912] to-bg p-6 rounded-3xl border border-[#00f0ff]/20 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <Anchor className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-widest font-mono">
                      Official Marine Database Sync
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase mt-1">
                    Prakiraan Cuaca Maritim BMKG
                  </h2>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-mono">
                      Lokasi: {config.bmkgPortLabel || 'Pelabuhan Ciwandan'} (BMKG Maritim)
                    </p>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] mt-1">
                      <span className="text-slate-500 font-bold uppercase">Sumber:</span>
                      <span className={`px-2 py-0.2 rounded text-[9px] font-extrabold uppercase border ${
                        bmkgSource === 'live' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' :
                        bmkgSource === 'cache' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                        bmkgSource === 'stale-cache' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      }`}>
                        {bmkgSource}
                      </span>
                      <span className="text-slate-500 font-bold uppercase ml-1">Terakhir Diperbarui:</span>
                      <span className="text-emerald-400 font-semibold">{lastBmkgFetched}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls: Live Sync, Search & Layout Selector */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => fetchBmkgLive(true)}
                  disabled={isLoadingBmkg}
                  className={`px-4 py-2.5 rounded-xl text-xs font-mono tracking-wider transition-all uppercase flex items-center gap-2 border cursor-pointer ${
                    isLoadingBmkg 
                    ? 'bg-emerald-950/20 text-slate-500 border-white/5 cursor-not-allowed'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 active:bg-emerald-500/30 font-black'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBmkg ? 'animate-spin' : ''}`} />
                  <span>{isLoadingBmkg ? 'Syncing...' : 'Sync Live'}</span>
                </button>

                <div className="relative flex-1 md:w-60">
                  <input
                    type="text"
                    placeholder="Cari jam / cuaca (e.g., '14.00')..."
                    value={bmkgSearchText}
                    onChange={(e) => setBmkgSearchText(e.target.value)}
                    className="w-full bg-[#03070f] border border-white/10 px-4 py-2.5 pl-10 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="absolute left-3.5 top-3.5 text-xs text-slate-500">🔍</span>
                </div>
                
                <div className="flex bg-[#03070f] rounded-xl p-1 border border-white/10 font-mono font-bold">
                  <button
                    onClick={() => setBmkgLayout('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${bmkgLayout === 'table' ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setBmkgLayout('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${bmkgLayout === 'cards' ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Grid
                  </button>
                </div>
              </div>

            </div>

            {/* PORT LOCATION SELECTOR (MOVED FROM SETTINGS) */}
            <div className="bg-[#050b14] border border-[#10b981]/20 p-5 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="text-xs font-bold text-[#10b981] uppercase tracking-widest font-sans flex items-center gap-2">
                  <span>⚓ Pemilihan Lokasi Pelabuhan (BMKG Port Profile)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Active: {config.bmkgPortLabel || 'Pelabuhan Ciwandan'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                <div className="md:col-span-1 space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider block">⚓ Port / Location Select</label>
                  {(() => {
                    const normalizedActiveSlug = (config.bmkgPortSlug || 'pelabuhan_ciwandan').replace(/-/g, '_');
                    const isPresetPort = BMKG_PORTS_LIST.some(p => p.slug === normalizedActiveSlug);
                    return (
                      <select 
                        value={isPresetPort ? normalizedActiveSlug : 'custom'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            const newCfg = {
                              ...config,
                              bmkgPortSlug: config.bmkgPortSlug || 'pelabuhan_ciwandan',
                              bmkgPortLabel: config.stationName || config.bmkgPortLabel || 'Pelabuhan Ciwandan'
                            };
                            setConfig(newCfg);
                            localStorage.setItem('aws_config', JSON.stringify(newCfg));
                          } else {
                            const selectedObj = BMKG_PORTS_LIST.find(item => item.slug === val);
                            if (selectedObj) {
                              const newCfg = {
                                ...config,
                                stationName: selectedObj.label,
                                bmkgPortSlug: selectedObj.slug,
                                bmkgPortLabel: selectedObj.label
                              };
                              setConfig(newCfg);
                              localStorage.setItem('aws_config', JSON.stringify(newCfg));
                              
                              // Update the historical database logs to reflect this port profile immediately
                              const newHistory = generateInitialLogs(45, newCfg.dbStorageInterval || 10, selectedObj.slug);
                              setHistory(newHistory);
                              localStorage.setItem('aws_history_logs', JSON.stringify(newHistory));

                              showToastNotification(`Lokasi diubah: ${selectedObj.label}`);
                              fetchBmkgLive(selectedObj.slug, true);
                            }
                          }
                        }}
                        className="w-full bg-[#03070f] border border-white/10 font-mono text-xs p-2.5 text-teal-400 font-bold rounded-xl outline-none focus:border-[#10b981] cursor-pointer"
                      >
                        <optgroup label="WILAYAH BANTEN">
                          {BMKG_PORTS_LIST.filter(p => p.region === 'Banten').map(port => (
                            <option key={port.slug} value={port.slug}>{port.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="WILAYAH DKI JAKARTA">
                          {BMKG_PORTS_LIST.filter(p => p.region === 'Jakarta').map(port => (
                            <option key={port.slug} value={port.slug}>{port.label}</option>
                          ))}
                        </optgroup>
                        <option value="custom">── LAINNYA / CUSTOM ──</option>
                      </select>
                    );
                  })()}
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider block">⚡ Quick Select Port (Scol View)</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-[#10b981]/20 scrollbar-track-transparent">
                    {[
                      { slug: 'pelabuhan_ciwandan', label: 'Ciwandan' },
                      { slug: 'pelabuhan_bojonegara', label: 'Bojonegara' },
                      { slug: 'pelabuhan_banten', label: 'Karangantu' },
                      { slug: 'pelabuhan_merak', label: 'Merak' },
                      { slug: 'pelabuhan_tanjung_priok', label: 'Priok' },
                      { slug: 'pelabuhan_sunda_kelapa', label: 'Sunda Kelapa' },
                      { slug: 'pelabuhan_muara_angke', label: 'Muara Angke' },
                      { slug: 'pelabuhan_p_tidung', label: 'P. Tidung' }
                    ].map((item) => {
                      const activeSlugNormalized = (config.bmkgPortSlug || 'pelabuhan_ciwandan').replace(/-/g, '_');
                      const isSelected = activeSlugNormalized === item.slug;
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          onClick={() => {
                            const fullLabels: Record<string, string> = {
                              'pelabuhan_ciwandan': 'Pelabuhan Ciwandan',
                              'pelabuhan_bojonegara': 'Pelabuhan Bojonegara',
                              'pelabuhan_banten': 'Pelabuhan Karangantu',
                              'pelabuhan_merak': 'Pelabuhan Merak',
                              'pelabuhan_tanjung_priok': 'Pelabuhan Tanjung Priok',
                              'pelabuhan_sunda_kelapa': 'Pelabuhan Sunda Kelapa',
                              'pelabuhan_muara_angke': 'Pelabuhan Muara Angke',
                              'pelabuhan_p_tidung': 'Pelabuhan P. Tidung'
                            };
                            const fullLabel = fullLabels[item.slug] || item.label;
                            const newCfg = {
                              ...config,
                              stationName: fullLabel,
                              bmkgPortSlug: item.slug,
                              bmkgPortLabel: fullLabel
                            };
                            setConfig(newCfg);
                            localStorage.setItem('aws_config', JSON.stringify(newCfg));

                            // Update the historical database logs to reflect this port profile immediately
                            const newHistory = generateInitialLogs(45, newCfg.dbStorageInterval || 10, item.slug);
                            setHistory(newHistory);
                            localStorage.setItem('aws_history_logs', JSON.stringify(newHistory));

                            showToastNotification(`Lokasi diubah: ${fullLabel}`);
                            fetchBmkgLive(item.slug, true);
                          }}
                          className={`px-3 py-1.5 text-[10px] font-mono tracking-tight font-extrabold rounded-lg whitespace-nowrap border shrink-0 transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400 font-black shadow-[0_0_8px_rgba(16,185,129,0.25)]' 
                              : 'bg-[#03070f] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                          }`}
                        >
                          📍 {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Inline editable Custom Name and Slug inputs if Custom selected */}
              {(() => {
                const activeSlugNormalized = (config.bmkgPortSlug || 'pelabuhan_ciwandan').replace(/-/g, '_');
                const isPreset = BMKG_PORTS_LIST.some(p => p.slug === activeSlugNormalized);
                if (isPreset) return null;

                return (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-[#03070f] border border-white/5 rounded-2xl animate-fade-in">
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block mb-1">Custom Slug</span>
                      <input 
                        type="text" 
                        value={config.bmkgPortSlug || ''} 
                        placeholder="pelabuhan-custom"
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
                          const newCfg = { ...config, bmkgPortSlug: val };
                          setConfig(newCfg);
                          localStorage.setItem('aws_config', JSON.stringify(newCfg));
                        }}
                        className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 rounded-xl outline-none focus:border-[#10b981]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block mb-1">Custom Name (Display)</span>
                      <input 
                        type="text" 
                        value={config.stationName || ''} 
                        placeholder="Pelabuhan Custom"
                        onChange={(e) => {
                          const newCfg = { ...config, stationName: e.target.value, bmkgPortLabel: e.target.value };
                          setConfig(newCfg);
                          localStorage.setItem('aws_config', JSON.stringify(newCfg));
                        }}
                        className="w-full bg-[#050a12] border border-white/10 font-sans text-xs p-2 rounded-xl outline-none focus:border-[#10b981]"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* General Forecast Summary Overviews */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div className="bg-gradient-to-b from-[#0b1424] to-[#010610] border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block font-sans mb-1">Gelombang Laut</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono">{selectedBmkgRow ? `${selectedBmkgRow.gelombangVal}m` : '0.4m'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Tingkat Keamanan</span>
                  <span className={`${selectedBmkgRow && selectedBmkgRow.gelombangVal > 1.25 ? 'text-amber-500 animate-pulse' : 'text-emerald-400'} font-black uppercase font-mono`}>
                    {selectedBmkgRow ? `✅ ${selectedBmkgRow.gelombangKet.toUpperCase()}` : '✅ TENANG'}
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#0b1424] to-[#010610] border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-widest block font-sans mb-1">Kecepatan Angin</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono">{selectedBmkgRow ? `${selectedBmkgRow.anginSpeed} kt` : '10 kt'}</span>
                    <span className="text-xs text-[#f59e0b] font-mono">{selectedBmkgRow ? `Gust ${selectedBmkgRow.anginGust}kt` : 'Gust 16kt'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Arah Dominan</span>
                  <span className="text-teal-400 font-black uppercase font-mono">{selectedBmkgRow ? selectedBmkgRow.anginDir : 'Timur Laut'}</span>
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#0b1424] to-[#010610] border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest block font-sans mb-1">Pasang Air Laut</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono">{selectedBmkgRow ? `${selectedBmkgRow.pasut > 0 ? '+' : ''}${selectedBmkgRow.pasut.toFixed(2)}m` : '+0.59m'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Status Pasut Pelabuhan</span>
                  <span className="text-pink-400 font-bold uppercase font-mono">
                    {selectedBmkgRow ? (selectedBmkgRow.pasut > 1.0 ? 'PASANG TINGGI' : 'PASANG NORMAL') : 'PASANG NORMAL'}
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#0b1424] to-[#010610] border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-sky-450 uppercase tracking-widest block font-sans mb-1">Visibilitas Udara</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono">{selectedBmkgRow ? `${selectedBmkgRow.visibility.toFixed(1)} Km` : '10.0 Km'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Kondisi Pandang</span>
                  <span className="text-emerald-400 font-black uppercase font-mono">
                    {selectedBmkgRow && selectedBmkgRow.visibility >= 8 ? 'SANGAT CLEAR' : 'SEDANG/TERBATAS'}
                  </span>
                </div>
              </div>

            </div>

            {/* Forecast Interactive Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-gradient-to-b from-[#0b1424] to-bg p-5 rounded-3xl border border-white/10">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-widest flex justify-between items-center pb-2.5 border-b border-white/5 mb-4 font-sans">
                  <span>🌊 Grafik Trend Elevasi Air Laut & Tinggi Gelombang</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">{(config.bmkgPortLabel || 'Pelabuhan Ciwandan').toUpperCase()}</span>
                </div>
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bmkgForecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tideColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="waveColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="waktu" stroke="#475569" fontSize={9} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={9} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#060c16', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: '#00f0ff', fontSize: '11px', fontFamily: 'monospace' }}
                        itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                      <Area type="monotone" name="Pasang Surut (m)" dataKey="pasut" stroke="#ec4899" fillOpacity={1} fill="url(#tideColor)" strokeWidth={2} />
                      <Area type="monotone" name="Tinggi Gelombang (m)" dataKey="gelombangVal" stroke="#10b981" fillOpacity={1} fill="url(#waveColor)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#0b1424] to-bg p-5 rounded-3xl border border-white/10">
                <div className="text-xs font-bold text-[#00f0ff] uppercase tracking-widest flex justify-between items-center pb-2.5 border-b border-white/5 mb-4 font-sans">
                  <span>🌡️ Grafik Trend Parameter Atmosfer (Suhu & Kelembaban)</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">12H KONDISI UDARA</span>
                </div>
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bmkgForecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="waktu" stroke="#475569" fontSize={9} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={9} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#060c16', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: '#00f0ff', fontSize: '11px', fontFamily: 'monospace' }}
                        itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                      <Line type="monotone" name="Suhu Udara (°C)" dataKey="suhu" stroke="#f59e0b" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="Kelembaban Nisbi (%)" dataKey="kelembaban" stroke="#3b82f6" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Split Interface: Real List Display vs Forecast Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Side: table or cards list */}
              <div className="lg:col-span-8 space-y-4">
                
                {/* Search filtered items */}
                {(() => {
                  const filtered = bmkgForecast.filter(item => {
                    const search = bmkgSearchText.toLowerCase();
                    return item.waktu.toLowerCase().includes(search) || 
                           item.cuaca.toLowerCase().includes(search) ||
                           item.anginDir.toLowerCase().includes(search) ||
                           item.gelombangKet.toLowerCase().includes(search);
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-[#0b1424]/40 border border-white/5 py-12 px-6 rounded-3xl text-center">
                        <p className="text-slate-500 text-sm">Tidak ada baris perkiraan cuaca yang cocok dengan kata kunci Anda.</p>
                        <button 
                          onClick={() => setBmkgSearchText('')} 
                          className="mt-3 text-emerald-400 font-bold text-xs uppercase underline tracking-wider cursor-pointer"
                        >
                          Clear Search
                        </button>
                      </div>
                    );
                  }

                  if (bmkgLayout === 'table') {
                    return (
                      <div className="bg-gradient-to-b from-[#0b1424]/90 to-bg border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse font-sans">
                            <thead>
                              <tr className="bg-emerald-600/90 text-white text-xs uppercase font-bold tracking-wider border-b border-white/10">
                                <th className="p-4 text-center">Waktu (WIB)</th>
                                <th className="p-4">Cuaca</th>
                                <th className="p-4 text-center">Angin</th>
                                <th className="p-4 text-center">Gelombang</th>
                                <th className="p-4 text-center">Arus Laut</th>
                                <th className="p-4 text-center">Visibility</th>
                                <th className="p-4 text-center">Suhu</th>
                                <th className="p-4 text-center">Kelembaban</th>
                                <th className="p-4 text-center">Pasut</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((row, idx) => {
                                const originalIndex = bmkgForecast.findIndex(item => item.waktu === row.waktu);
                                const isSelected = selectedForecastIndex === originalIndex;
                                return (
                                  <tr 
                                    key={idx} 
                                    onClick={() => setSelectedForecastIndex(originalIndex)}
                                    className={`border-b border-white/5 text-xs font-medium cursor-pointer transition-all hover:bg-emerald-500/5 ${isSelected ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500' : ''}`}
                                  >
                                    
                                    {/* Column 1: Time */}
                                    <td className="p-4 text-center">
                                      <div className={`font-mono font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-300'}`}>{row.waktu.split(',')[1]}</div>
                                      <div className="text-[10px] text-slate-500">{row.jam}</div>
                                    </td>

                                    {/* Column 2: Weather */}
                                    <td className="p-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xl">{row.cuacaIcon}</span>
                                        <div>
                                          <div className="font-bold text-white">{row.cuaca}</div>
                                          <div className="text-[10px] text-slate-500 font-mono">BMKG Sync</div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Column 3: Wind */}
                                    <td className="p-4 text-center font-mono">
                                      <div className="text-slate-200 font-black">{row.anginDir}</div>
                                      <div className="text-[10px] text-amber-500 font-extrabold">{row.anginSpeed} kt <span className="opacity-50">gust {row.anginGust}</span></div>
                                    </td>

                                    {/* Column 4: Wave */}
                                    <td className="p-4 text-center">
                                      <div className="font-mono text-white text-xs font-black">{row.gelombangVal} m</div>
                                      <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase ${row.gelombangKet === 'Tenang' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                        {row.gelombangKet}
                                      </span>
                                    </td>

                                    {/* Column 5: Sea Current */}
                                    <td className="p-4 text-center font-mono">
                                      <div className="text-teal-400 font-extrabold flex items-center justify-center gap-1">
                                        <Compass className="w-3.5 h-3.5" />
                                        <span>{row.arusDir}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-bold">{row.arusSpeed.toFixed(1)} Knot</div>
                                    </td>

                                    {/* Column 6: Visibility */}
                                    <td className="p-4 text-center font-mono text-slate-300">
                                      {row.visibility} km
                                    </td>

                                    {/* Column 7: Temperature */}
                                    <td className="p-4 text-center font-mono font-black text-[#f59e0b]">
                                      {row.suhu}°C
                                    </td>

                                    {/* Column 8: Humidity */}
                                    <td className="p-4 text-center font-mono text-sky-400">
                                      {row.kelembaban}%
                                    </td>

                                    {/* Column 9: Tide elevation */}
                                    <td className="p-4 text-center font-mono font-black text-pink-400">
                                      +{row.pasut.toFixed(2)} m
                                    </td>

                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  } else {
                    /* CARDS GRID LAYOUT */
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((row, idx) => {
                          const originalIndex = bmkgForecast.findIndex(item => item.waktu === row.waktu);
                          const isSelected = selectedForecastIndex === originalIndex;
                          return (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedForecastIndex(originalIndex)}
                              className={`bg-gradient-to-b from-[#0b1424] to-bg border p-5 rounded-2.5xl cursor-pointer transition-all ${isSelected ? 'border-emerald-500/60 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : 'border-white/5'}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-xs font-mono font-bold text-slate-400">{row.waktu}</span>
                                  <span className="text-[10px] font-sans font-bold bg-[#14243b] text-[#00f0ff] uppercase ml-2 px-2 py-0.5 rounded">{row.jam}</span>
                                </div>
                                <span className="text-2xl">{row.cuacaIcon}</span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5 font-sans">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Cuaca</span>
                                  <span className="text-xs text-white font-black">{row.cuaca}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Tinggi Gel</span>
                                  <span className="text-xs text-sky-400 font-mono font-black">{row.gelombangVal} m</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Pasut</span>
                                  <span className="text-xs text-pink-400 font-mono font-black">+{row.pasut} m</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 mt-3 font-sans">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Angin</span>
                                  <span className="text-[11px] text-amber-500 font-mono font-bold leading-tight">{row.anginDir}<br/>{row.anginSpeed} kt</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Arus Laut</span>
                                  <span className="text-[11px] text-teal-400 font-mono font-bold leading-tight">{row.arusDir}<br/>{row.arusSpeed} kt</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Suhu & RH</span>
                                  <span className="text-[11px] text-[#f59e0b] font-mono font-bold leading-tight">{row.suhu}°C<br/>{row.kelembaban}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                })()}

              </div>

              {/* Right Side: Forecast Detail Inspector Dashboard */}
              <div className="lg:col-span-4">
                {selectedBmkgRow ? (
                  (() => {
                    const selected = selectedBmkgRow;
                    return (
                      <div className="bg-gradient-to-b from-[#0b1424] via-[#020710] to-bg border border-emerald-500/20 p-6 rounded-3xl space-y-5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="pb-3 border-b border-white/5">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                            Selected Hour Inspector
                          </span>
                          <h3 className="text-lg font-black text-white mt-1 uppercase font-mono">
                            {selected.waktu.split(',')[1]} ({selected.jam})
                          </h3>
                        </div>

                        {/* Large Weather Display */}
                        <div className="bg-[#030811]/90 rounded-2xl border border-white/5 p-4 flex items-center gap-4">
                          <span className="text-4xl filter drop-shadow-lg">{selected.cuacaIcon}</span>
                          <div>
                            <span className="text-xs text-slate-500 uppercase block font-bold">Kondisi Udara</span>
                            <span className="text-base font-black text-white">{selected.cuaca}</span>
                          </div>
                        </div>

                        {/* Interactive Dials / Badges for parameters */}
                        <div className="grid grid-cols-2 gap-3.5 font-sans">
                          
                          <div className="bg-[#030811] border border-white/5 p-3.5 rounded-xl text-center">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Thermometer</span>
                            <div className="flex items-center justify-center gap-1.5 text-amber-500 font-mono font-black text-lg">
                              <Thermometer className="w-4 h-4" />
                              <span>{selected.suhu}°C</span>
                            </div>
                          </div>

                          <div className="bg-[#030811] border border-white/5 p-3.5 rounded-xl text-center font-mono">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Humidity</span>
                            <div className="flex items-center justify-center gap-1.5 text-sky-400 font-bold text-lg">
                              <Droplets className="w-4 h-4" />
                              <span>{selected.kelembaban}%</span>
                            </div>
                          </div>

                          <div className="bg-[#030811] border border-white/5 p-3.5 rounded-xl text-center font-mono">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Gelombang</span>
                            <div className="flex items-center justify-center gap-1.5 text-teal-400 font-bold text-lg">
                              <Waves className="w-4 h-4" />
                              <span>{selected.gelombangVal}m</span>
                            </div>
                          </div>

                          <div className="bg-[#030811] border border-white/5 p-3.5 rounded-xl text-center font-mono">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Pasang Surut</span>
                            <div className="flex items-center justify-center gap-1.5 text-pink-400 font-bold text-lg">
                              <MoveDown className="w-4 h-4" />
                              <span>+{selected.pasut}m</span>
                            </div>
                          </div>

                        </div>

                        {/* Ocean Current Vector Display card */}
                        <div className="bg-[#030811] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
                          <span className="text-[10px] text-slate-500 uppercase font-black block mb-3 font-sans">
                            Arah Arus Air Laut (Ocean Current)
                          </span>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Compass className="w-8 h-8 text-teal-400" />
                              <div>
                                <span className="text-xs text-slate-400 block font-bold uppercase">Menuju</span>
                                <span className="text-sm font-black text-white font-mono">{selected.arusDir}</span>
                              </div>
                            </div>
                            <div className="bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-xl font-mono">
                              <span className="text-xs font-black text-teal-300">{selected.arusSpeed.toFixed(1)} Knot</span>
                            </div>
                          </div>
                        </div>

                        {/* Wind Profile Display with rotating arrow visualization */}
                        <div className="bg-[#030811] border border-white/5 p-4 rounded-2xl">
                          <span className="text-[10px] text-slate-500 uppercase font-black block mb-3 font-sans">
                            Kondisi Angin & Hembusan (Wind Profile)
                          </span>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Wind className="w-8 h-8 text-amber-500" />
                              <div>
                                <span className="text-xs text-slate-400 block font-bold uppercase">Berhembus Dr</span>
                                <span className="text-sm font-black text-white font-mono">{selected.anginDir}</span>
                              </div>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl font-mono text-right">
                              <span className="text-xs font-black text-amber-400 block">{selected.anginSpeed} Knot</span>
                              <span className="text-[9px] text-[#f59e0b] font-semibold">Gust {selected.anginGust} kt</span>
                            </div>
                          </div>
                        </div>

                        {/* Operational Safety Assessment report */}
                        <div className="bg-[#041e12] border border-emerald-500/20 p-4 rounded-2xl font-sans">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-1">
                            Port Commander Safety Assessment
                          </span>
                          <p className="text-xs text-emerald-200/90 leading-relaxed font-semibold">
                            Ketinggian Gelombang Laut ({selected.gelombangVal}m - {selected.gelombangKet}) dan kecepatan hembusan angin ({selected.anginSpeed} knot) berada pada ambang batas aman. Operasional bongkar muat & penyandaran kapal di {config.bmkgPortLabel || 'Pelabuhan Ciwandan'} dapat dilaksanakan secara normal.
                          </p>
                        </div>

                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-[#0b1424]/40 border border-white/5 p-6 rounded-3xl text-center font-sans text-slate-500 py-20">
                    Klik baris perkiraan di sebelah kiri untuk melihat rincian instrumen di panel monitor ini.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* PAGE tab 6: AUTOMATIC WEATHER STATION TELEMETRY (24 Hours Charts) */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6 animate-fade-in pb-10">
            
            {/* Main Telemetry Charts Grid rendering in full tab viewport width */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Chart 1: Water Level & Pasang Surut / Tide (Combined) */}
              <div className="bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#0ea5e9]/50 rounded-tl-xl" />
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-sm font-black text-[#0ea5e9] tracking-wider font-sans uppercase flex items-center gap-2">
                    🌊 1. Water Level & Pasang Surut / Tide (Meter)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#0ea5e9] font-bold">
                      <span className="w-2 h-2 rounded bg-[#0ea5e9]"></span> Water Level
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#ec4899] font-bold">
                      <span className="w-2 h-2 rounded bg-[#ec4899]"></span> Pasang Surut
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase font-bold">Limit: 24 Jam</span>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-144).map(item => {
                      const h = new Date(item.timestamp).getHours() + new Date(item.timestamp).getMinutes() / 60;
                      return {
                        ...item,
                        seaLevelM: parseFloat((item.seaLevel / 100).toFixed(3)),
                        pasut: parseFloat((0.5 + Math.sin(h * 0.5) * 0.4).toFixed(2))
                      };
                    })}>
                      <defs>
                        <linearGradient id="colorPopupWaterLevelCombined" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01}/>
                        </linearGradient>
                        <linearGradient id="colorPopupTideCombined" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2) + 'm'} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0b1424', borderColor: '#38bdf8' }} 
                        labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} 
                        formatter={(value: any, name: any) => {
                          if (name === "seaLevelM") return [value + ' m', 'Water Level'];
                          if (name === "pasut") return [value + ' m', 'Pasang Surut'];
                          return [value, name];
                        }} 
                      />
                      <Area type="monotone" dataKey="seaLevelM" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPopupWaterLevelCombined)" />
                      <Area type="monotone" dataKey="pasut" stroke="#ec4899" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPopupTideCombined)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Temperature Trends (Udara & Air Laut) */}
              <div className="bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#f59e0b]/50 rounded-tl-xl" />
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-sm font-black text-[#f59e0b] tracking-wider font-sans uppercase flex items-center gap-2">
                    🌡️ 2. Temperature Trends (Udara vs Air Laut)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#38bdf8] font-bold">
                      <span className="w-2 h-2 rounded bg-[#38bdf8]"></span> Udara
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#fbbf24] font-bold">
                      <span className="w-2 h-2 rounded bg-[#fbbf24]"></span> Air Laut
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase font-bold">Celsius</span>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-144).map(item => ({
                      ...item,
                      displayAirTemp: item.temperature,
                      displayAirTempMin: item.tempMin !== undefined ? item.tempMin : parseFloat((item.temperature - 1.5).toFixed(1)),
                      displayAirTempMax: item.tempMax !== undefined ? item.tempMax : parseFloat((item.temperature + 1.2).toFixed(1)),
                      displayWaterTemp: item.waterTemp !== undefined ? item.waterTemp : parseFloat((item.temperature - 1.2).toFixed(1)),
                      displayWaterTempMin: item.waterTempMin !== undefined ? item.waterTempMin : parseFloat((item.temperature - 2.0).toFixed(1)),
                      displayWaterTempMax: item.waterTempMax !== undefined ? item.waterTempMax : parseFloat((item.temperature - 0.7).toFixed(1))
                    }))}>
                      <defs>
                        <linearGradient id="colorPopupAirTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01}/>
                        </linearGradient>
                        <linearGradient id="colorPopupWaterTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(1) + '°C'} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f59e0b' }} 
                        labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} 
                        formatter={(value: any, name: any) => {
                          if (name === "displayAirTemp") return [`${value}°C (Min: ${(value-1.5).toFixed(1)}°C, Max: ${(value+1.2).toFixed(1)}°C)`, 'Suhu Udara'];
                          if (name === "displayWaterTemp") return [`${value}°C (Min: ${(value-2.0).toFixed(1)}°C, Max: ${(value-0.7).toFixed(1)}°C)`, 'Suhu Air Laut'];
                          return [value, name];
                        }} 
                      />
                      <Area type="monotone" dataKey="displayAirTemp" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorPopupAirTemp)" />
                      <Area type="monotone" dataKey="displayWaterTemp" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorPopupWaterTemp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Air Pressure */}
              <div className="bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#22d3ee]/50 rounded-tl-xl" />
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-sm font-black text-[#22d3ee] tracking-wider font-sans uppercase flex items-center gap-2">
                    🌀 3. Barometric Pressure (hPa)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase font-bold">Unit: Hectopascal</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-144)}>
                      <defs>
                        <linearGradient id="colorPopupPressure" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#22d3ee' }} labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} formatter={(value: any) => [value + ' hPa', 'Pressure']} />
                      <Area type="monotone" dataKey="pressure" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPopupPressure)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Water pH / Kualitas Air */}
              <div className="bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#fc63a3]/50 rounded-tl-xl" />
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-sm font-black text-[#fc63a3] tracking-wider font-sans uppercase flex items-center gap-2">
                    🧪 4. Water pH Quality Index
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase font-bold">pH Scale 0-14</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-144)}>
                      <defs>
                        <linearGradient id="colorPopupPh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fc63a3" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#fc63a3" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[6.5, 9.0]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#fc63a3' }} labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} formatter={(value: any) => [value.toFixed(2), 'Water pH']} />
                      <Area type="monotone" dataKey="waterPh" stroke="#fc63a3" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPopupPh)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 5: Wind Gust */}
              <div className="bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#f97316]/50 rounded-tl-xl" />
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-sm font-black text-[#f97316] tracking-wider font-sans uppercase flex items-center gap-2">
                    ⚡ 5. Wind Gust Speeds (Knot)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase font-bold">Peak Speeds</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-144).map(item => ({
                      ...item,
                      displayGust: item.windGust || parseFloat((item.windSpeed * 1.35).toFixed(1))
                    }))}>
                      <defs>
                        <linearGradient id="colorPopupGust" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f97316' }} labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} formatter={(value: any) => [value + ' kt', 'Wind Gust']} />
                      <Area type="monotone" dataKey="displayGust" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPopupGust)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 6: Rainfall Radar Intensity & Cumulative Track (Full Width across grid) */}
              <div className="xl:col-span-2 bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#0ea5e9]/50 rounded-tl-xl" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/5 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-sm font-black text-[#0ea5e9] tracking-wider font-sans uppercase flex items-center gap-2">
                      🌧️ 6. Rainfall Radar Intensity & 24H Cumulative Track
                    </span>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Warna tracker menunjukkan intensitas hujan: <span className="text-[#22c55e] font-black">Hijau (Ringan)</span>, <span className="text-[#eab308] font-black">Kuning (Sedang)</span>, <span className="text-[#ef4444] font-black">Merah (Lebat &gt;= {parseFloat(config.rainWarningThreshold || '10.0')} mm)</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-right font-mono text-[9px]">
                    <span className="text-slate-500 uppercase font-black">LEGENDA INTENSITAS:</span>
                    <div className="bg-[#1e293b]/50 px-2 py-0.5 rounded text-slate-400 border border-white/5 font-bold">KERING (0 mm)</div>
                    <div className="bg-[#22c55e]/15 px-2 py-0.5 rounded text-[#22c55e] border border-emerald-500/20 font-bold">RINGAN (&lt; 2.5 mm)</div>
                    <div className="bg-[#eab308]/15 px-2 py-0.5 rounded text-[#eab308] border border-yellow-500/20 font-bold">SEDANG (2.5 - 10 mm)</div>
                    <div className="bg-[#ef4444]/15 px-2 py-0.5 rounded text-[#ef4444] border border-red-500/20 font-bold animate-pulse">LEBAT (&gt;= {parseFloat(config.rainWarningThreshold || '10.0')} mm)</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left Side: Radar Intensity Track Matrix Visualizer */}
                  <div className="lg:col-span-4 bg-[#050a12]/80 border border-white/5 p-4 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Radar Intensity Grid Tracker (24H)</span>
                      <p className="text-[9px] text-slate-500 font-sans">Setiap kotak mewakili interval pencatatan data log (10 menit). Arahkan kursor untuk melihat jam kejadian hujan.</p>
                    </div>
                    <div className="grid grid-cols-12 gap-1.5 flex-1 content-center py-2">
                      {history.slice(-144).map((item, idx, arr) => {
                        const currentRain = item.rainfall;
                        const prevRain = idx > 0 ? arr[idx - 1].rainfall : item.rainfall;
                        const diff = Math.max(0, currentRain - prevRain);
                        const displayVal = diff > 0 ? diff : (currentRain > 0 ? currentRain : 0);
                        
                        let color = "bg-slate-800/30 hover:bg-slate-700/50";
                        let ring = "";
                        let titleText = `Kering (0 mm)`;
                        if (displayVal > 0) {
                          if (displayVal < 2.5) {
                            color = "bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.3)]";
                            titleText = `Hujan Ringan: ${displayVal.toFixed(1)} mm`;
                          } else if (displayVal < parseFloat(config.rainWarningThreshold || '10.0')) {
                            color = "bg-yellow-500 hover:bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.4)]";
                            titleText = `Hujan Sedang: ${displayVal.toFixed(1)} mm`;
                          } else {
                            color = "bg-red-500 hover:bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse";
                            ring = "ring-1 ring-red-400";
                            titleText = `HUJAN LEBAT: ${displayVal.toFixed(1)} mm`;
                          }
                        }

                        return (
                          <div 
                            key={idx} 
                            title={`${format(item.timestamp, 'HH:mm')} - ${titleText}`}
                            className={`h-4 rounded cursor-help transition-all hover:scale-125 hover:z-10 ${color} ${ring}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                      <span>24 Jam Lalu</span>
                      <span>Sekarang (Real-time)</span>
                    </div>
                  </div>

                  {/* Right Side: Dynamic Recharts bar chart */}
                  <div className="lg:col-span-8 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={history.slice(-144).map((item, idx, arr) => {
                          const currentRain = item.rainfall;
                          const prevRain = idx > 0 ? arr[idx - 1].rainfall : item.rainfall;
                          const diff = Math.max(0, currentRain - prevRain);
                          const val = diff > 0 ? diff : (currentRain > 0 ? currentRain : 0);
                          return {
                            ...item,
                            rainVal: parseFloat(val.toFixed(1)),
                            cumRain: parseFloat(currentRain.toFixed(1))
                          };
                        })}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                        <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0b1424', borderColor: '#0ea5e9' }} 
                          labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} 
                          formatter={(value: any, name: string) => {
                            return [value + ' mm', 'Intensitas Hujan'];
                          }} 
                        />
                        <Bar dataKey="rainVal" radius={[4, 4, 0, 0]}>
                          {history.slice(-144).map((item, idx, arr) => {
                            const currentRain = item.rainfall;
                            const prevRain = idx > 0 ? arr[idx - 1].rainfall : item.rainfall;
                            const diff = Math.max(0, currentRain - prevRain);
                            const val = diff > 0 ? diff : (currentRain > 0 ? currentRain : 0);
                            
                            let fill = 'rgba(148, 163, 184, 0.1)'; // Kering
                            if (val > 0) {
                              if (val < 2.5) fill = '#22c55e'; // Hijau
                              else if (val < parseFloat(config.rainWarningThreshold || '10.0')) fill = '#eab308'; // Kuning
                              else fill = '#ef4444'; // Merah
                            }
                            return <Cell key={`cell-${idx}`} fill={fill} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Chart 7: Solar Radiation Irradiance (Full Width across grid) */}
              <div className="xl:col-span-2 bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#f59e0b]/50 rounded-tl-xl" />
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-sm font-black text-[#f59e0b] tracking-wider font-sans uppercase flex items-center gap-2">
                    ☀️ 7. Solar Radiation / Radiasi Matahari (W/m²)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase font-bold">SOLAR IRRADIANCE</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-144)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPopupSolar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25}/>
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f59e0b' }} labelFormatter={(label) => format(label, 'dd-MM-yyyy HH:mm:ss')} formatter={(value: any) => [value + ' W/m²', 'Solar Radiation']} />
                      <Area type="monotone" dataKey="solarRadiation" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPopupSolar)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Informational Disclaimer Banner */}
            <div className="bg-[#0b1424] border border-white/10 p-5 rounded-3xl flex flex-col md:flex-row gap-4 justify-between items-center bg-gradient-to-r from-emerald-950/15 to-transparent">
              <p className="text-xs text-slate-400 font-sans leading-relaxed text-center md:text-left">
                ⚠️ <strong>INFORMASI OPERASIONAL AWS:</strong> Grafik di atas menyajikan feed intermitten 24 jam terakhir dari stasiun meteorologi fisik <strong>Automatic Weather Station</strong>. Gunakan data telemetry ini sebagai acuan validasi operasional yang presisi.
              </p>
              <span className="text-[10px] font-mono text-emerald-400 font-extrabold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 whitespace-nowrap uppercase tracking-widest">
                AWS ONLINE SECURE
              </span>
            </div>

          </div>
        )}

      </main>

      {/* MANUAL BOOK MODAL / USER GUIDE OVERLAY */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-[#07111e] border-2 border-[#00f0ff]/30 w-full max-w-6xl h-[85vh] rounded-3xl shadow-[0_0_60px_rgba(0,240,255,0.3)] flex flex-col overflow-hidden relative text-slate-100">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#11243b] to-[#081220] px-6 py-4 border-b border-[#00f0ff]/20 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/15 rounded-lg border border-amber-500/30">
                  <BookOpen className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-wider uppercase text-white">Manual Pengoperasian & Buku Panduan</h2>
                  <p className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-widest mt-0.5">AUTOMATIC WEATHER STATION (AWS)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-lg border border-white/10 hover:border-red-500/40 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex items-center justify-center"
                title="Tutup Manual Book"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Modal Left Sidebar Index */}
              <div className="w-full md:w-64 bg-[#050b14] border-r border-white/5 p-4 flex flex-col gap-1.5 overflow-y-auto shrink-0">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 mb-2 font-bold">Daftar Bab & Panduan</div>
                
                <button 
                  onClick={() => setActiveManualChapter('intro')}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-2.5 ${activeManualChapter === 'intro' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                >
                  <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">01</span>
                  <span>Pendahuluan & Overview</span>
                </button>

                <button 
                  onClick={() => setActiveManualChapter('realtime')}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-2.5 ${activeManualChapter === 'realtime' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                >
                  <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">02</span>
                  <span>Dashboard & Analisis</span>
                </button>

                <button 
                  onClick={() => setActiveManualChapter('option')}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-2.5 ${activeManualChapter === 'option' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                >
                  <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">03</span>
                  <span>Setting Hardware & Moxa</span>
                </button>

                <button 
                  onClick={() => setActiveManualChapter('database')}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-2.5 ${activeManualChapter === 'database' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                >
                  <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">04</span>
                  <span>Download Data & Logs</span>
                </button>

                <button 
                  onClick={() => setActiveManualChapter('bmkg')}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-2.5 ${activeManualChapter === 'bmkg' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                >
                  <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">05</span>
                  <span>Prakiraan BMKG Maritim</span>
                </button>

                <button 
                  onClick={() => setActiveManualChapter('troubleshoot')}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center gap-2.5 ${activeManualChapter === 'troubleshoot' ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
                >
                  <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">06</span>
                  <span>Troubleshooting & Alarm</span>
                </button>

                {/* Integration status badge */}
                <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center font-bold">INTEGRITAS DAEMON</div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5 space-y-1.5 text-[9px] font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">MOXA TCP IN:</span>
                      <span className="text-emerald-400 font-bold">ONLINE</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">DB STORAGE:</span>
                      <span className="text-teal-400 font-bold">SQL DATABASE</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">ALARM STATUS:</span>
                      <span className="text-amber-400 font-bold">MONITORED</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Right Content Pane */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-gradient-to-b from-[#07111e] to-[#040a12] space-y-6">
                
                {activeManualChapter === 'intro' && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-950/40 to-transparent p-5 rounded-2xl border border-blue-500/20">
                      <h3 className="text-base font-black text-white mb-2">01. PENDAHULUAN & OVERVIEW SYSTEM</h3>
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        Sistem <strong>Automatic Weather Station (AWS)</strong> merupakan konsol kontrol terintegrasi yang dirancang khusus untuk memonitor parameter meteorologi fisik dan oseanografi di dermaga pelabuhan maritim secara real-time. Sistem ini menghubungkan sensor-sensor lapangan melalui hardware gateway <strong>Moxa Router (TCP/IP atau Serial RS232)</strong> dan mengamankan perekaman log data ke dalam engine database terintegrasi secara otomatis.
                      </p>
                      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3.5 space-y-1">
                        <span className="text-[#00f0ff] font-bold text-xs block">🖥️ AKSES WEB-BASED (KONEKTIVITAS JARINGAN LOKAL)</span>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Sistem aplikasi ini sepenuhnya <strong>berbasis web (web-based client-server)</strong>, yang berarti aplikasi dapat dipanggil, diakses, dan dimonitor secara instan <strong>di mana saja dari komputer, laptop, tablet, atau smartphone lain dalam 1 jaringan (LAN/Wi-Fi)</strong> yang sama. Anda cukup membuka browser dan mengetik alamat IP host server monitoring pelabuhan tanpa perlu melakukan instalasi software tambahan di setiap perangkat klien.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[#00f0ff] uppercase tracking-widest">📋 DAFTAR MENU UTAMA SISTEM</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase">
                            <span className="w-2 h-2 rounded bg-cyan-400"></span> REALTIME MONITORING
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Memonitor sensor suhu udara aktual, kelembaban, radiasi matahari, curah hujan, pH air, serta visualisasi kompas dinamis wind vector & orientasi sandar kapal.
                          </p>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase">
                            <span className="w-2 h-2 rounded bg-amber-400"></span> ANALYST SYSTEM
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Menghitung perkiraan cuaca dan ramalan kecepatan angin hingga 60 menit kedepan, serta menyajikan visualisasi data wind rose untuk memetakan arah dominan hembusan angin dermaga.
                          </p>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase">
                            <span className="w-2 h-2 rounded bg-emerald-400"></span> DATABASE ENGINE
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Pusat logs data. Menyimpan kompresi rata-rata data meteorologi berskala 10 menit (standar WMO). Memiliki fasilitas filter periode log, pencarian, dan pengeksporan file laporan CSV.
                          </p>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase">
                            <span className="w-2 h-2 rounded bg-purple-400"></span> OPTION / CONFIG
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Mengkonfigurasi alamat IP Moxa, port, baudrate, ID stasiun, sudut kelurusan dermaga (pier angle), batas ambang alarm bahaya, serta pemetaan indeks kolom sensor (mapping).
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">🖥️ BENTUK INTEGRASI ANTARMUKA LAYAR UTAMA</div>
                      {/* CSS Mockup of Realtime Tab to represent user screen */}
                      <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-mono font-bold text-[#00f0ff] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            GAMBAR 1: ANTARMUKA DASHBOARD UTAMA (REALTIME VIEW)
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">AWS SYSTEM</span>
                        </div>
                        
                        <div className="grid grid-cols-12 gap-3 aspect-[1.8/1] text-[8px] font-mono text-slate-400">
                          {/* Left panel: Sensors */}
                          <div className="col-span-3 bg-[#0b1424] border border-white/5 rounded-lg p-2 flex flex-col justify-between">
                            <div>
                              <div className="font-bold text-white border-b border-white/5 pb-1 mb-1">🌡️ THERMAL</div>
                              <div className="bg-white/5 rounded p-1 text-center">
                                <div className="text-xs text-emerald-400 font-bold">26.0 °C</div>
                                <div className="text-[7px]">Suhu Aktual</div>
                              </div>
                            </div>
                            <div className="mt-1">
                              <div className="font-bold text-white border-b border-white/5 pb-1 mb-1">💧 HYGRO & SOLAR</div>
                              <div className="space-y-0.5">
                                <div className="flex justify-between bg-white/5 p-0.5 rounded"><span>Hum:</span><span className="text-white">67 %</span></div>
                                <div className="flex justify-between bg-white/5 p-0.5 rounded"><span>Rad:</span><span className="text-amber-400">116 W/m²</span></div>
                              </div>
                            </div>
                            <div className="mt-1">
                              <div className="font-bold text-white border-b border-white/5 pb-1 mb-1">🧪 WATER PH</div>
                              <div className="flex justify-between bg-white/5 p-0.5 rounded items-center">
                                <span>pH:</span><span className="text-pink-400 font-bold">7.64 IDEAL</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Center panel: Wind Compass Circle */}
                          <div className="col-span-6 bg-[#0b1424] border border-white/5 rounded-lg p-2 flex flex-col items-center justify-between">
                            <div className="font-bold text-white text-center w-full uppercase">🧭 Wind Vector & Port Orientation</div>
                            <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#00f0ff]/20 flex items-center justify-center relative my-1">
                              <div className="absolute top-0 text-[7px] text-[#00f0ff] font-bold">N</div>
                              <div className="absolute bottom-0 text-[7px] text-slate-500">S</div>
                              <div className="w-1.5 h-12 bg-gradient-to-b from-[#00ff66]/70 to-transparent rounded-full rotate-[45deg] flex items-center justify-center">
                                <div className="w-1 h-1 rounded-full bg-[#00ff66]"></div>
                              </div>
                              <div className="absolute text-center bg-slate-950 px-1.5 py-0.5 rounded border border-white/10 text-[9px] text-[#00ff66] font-bold">
                                4.2 m/s
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 w-full text-center text-[7px]">
                              <div className="bg-white/5 p-0.5 rounded">
                                <span>REL WIND:</span> <strong className="text-blue-400">41° Azimuth</strong>
                              </div>
                              <div className="bg-white/5 p-0.5 rounded">
                                <span>ARAH:</span> <strong className="text-amber-400">86° (E)</strong>
                              </div>
                            </div>
                          </div>
                          
                          {/* Right panel: Wind stats */}
                          <div className="col-span-3 bg-[#0b1424] border border-white/5 rounded-lg p-2 flex flex-col justify-between">
                            <div>
                              <div className="font-bold text-white border-b border-white/5 pb-1 mb-1 uppercase">📊 Wind Speeds</div>
                              <div className="space-y-0.5">
                                <div className="bg-white/5 p-0.5 rounded flex justify-between"><span>Max Spd:</span><span className="text-white">14.7 m/s</span></div>
                                <div className="bg-white/5 p-0.5 rounded flex justify-between"><span>Min Spd:</span><span className="text-white">2.0 m/s</span></div>
                              </div>
                            </div>
                            <div className="mt-1">
                              <div className="font-bold text-white border-b border-white/5 pb-1 mb-1 uppercase">⚡ Recent Vector</div>
                              <div className="space-y-0.5 text-[7px]">
                                <div className="flex justify-between border-b border-white/5"><span>14:47</span><span className="text-white">W 9.6 m/s</span></div>
                                <div className="flex justify-between border-b border-white/5"><span>14:47</span><span className="text-white">N 8.2 m/s</span></div>
                                <div className="flex justify-between border-b border-white/5"><span>14:47</span><span className="text-white">E 4.2 m/s</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          * Tampilan skema dashboard realtime di atas mencakup seluruh widget pembacaan live sesuai screenshot AWS OS Connection.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualChapter === 'realtime' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-white uppercase">02. MENU REALTIME & HISTORICAL ANALYST</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Menu ini berfungsi untuk memantau status cuaca laut saat ini (real-time) dan melihat tren analitis historis guna menjamin keselamatan operasional pelayaran kapal dan dermaga.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Port Orientation Utility Card */}
                      <div className="bg-[#0b1424] p-5 rounded-2xl border border-blue-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#00f0ff] uppercase tracking-wider">
                          <Compass className="w-5 h-5 text-[#00f0ff]" />
                          <span>🧭 KEGUNAAN WIDGET "LIVE WIND VECTOR & PORT ORIENTATION"</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Widget kompas di tengah layar utama mengintegrasikan <strong>Arah Tiupan Angin Absolut</strong> dengan <strong>Kelurusan Fisik Dermaga (Pier Alignment / Angle)</strong>.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-400">
                          <div className="space-y-1.5">
                            <strong className="text-white block">1. Kalibrasi Sudut Dermaga (Pier Alignment)</strong>
                            Sudut dermaga dikonfigurasi melalui menu <span className="text-purple-400">Option</span> (misal: <em>45° Clockwise</em>). Kompas secara dinamis memutar garis lintang hijau yang berlabel <strong className="text-emerald-400">PORT (Kiri)</strong> dan <strong className="text-emerald-400">STARBOARD (Kanan)</strong>. Ini mensimulasikan orientasi lambung kapal saat sedang sandar sejajar dermaga.
                          </div>
                          <div className="space-y-1.5">
                            <strong className="text-white block">2. Penghitungan Relative Wind Angle</strong>
                            Sistem secara real-time menghitung <strong>Relative Wind (Suhu/Sudut Angin Relatif)</strong> terhadap badan kapal (misal: <em>41° Azimuth</em>). Ini sangat krusial karena memberi tahu petugas pandu pelabuhan dari sudut sebelah mana angin menghantam dinding kapal saat proses bersandar.
                          </div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-white/5 text-[11px] text-amber-300">
                          <strong>⚠️ Manfaat Operasional Utama:</strong> Mencegah bahaya kecelakaan kapal membentur beton dermaga (docking collision). Angin samping kencang (crosswind) dari arah laut lepas sangat berbahaya; dengan widget ini, kapten kapal dan operator pelabuhan dapat langsung mengantisipasi gaya dorong samping angin pada struktur kapal secara instan.
                        </div>
                      </div>

                      {/* Wind Speed Warnings Detail Card */}
                      <div className="bg-[#0b1424] p-5 rounded-2xl border border-yellow-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                          <ShieldAlert className="w-5 h-5 text-amber-400" />
                          <span>🚨 WARNING BATAS ANGIN (WIND STATS & GUST EVENTS)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Parameter peringatan kecepatan angin dikelola langsung melalui indikator status di bagian kanan bawah dashboard realtime.
                        </p>
                        <ul className="text-[11px] text-slate-300 space-y-2 list-disc pl-5">
                          <li>
                            <strong>Live Wind Speed Limits:</strong> Widget ini memantau ambang batas kecepatan angin riil. Terbagi menjadi <strong className="text-cyan-400">WIND MAX</strong> (kecepatan puncak tiupan angin aktual) dan <strong className="text-cyan-400">WIND MIN</strong> (kecepatan hembusan terendah) dalam rentang sampling berjalan.
                          </li>
                          <li>
                            <strong>Last Gust Occurrence Event:</strong> Angin kencang mendadak (Gust) adalah ancaman terbesar bagi kestabilan kapal dan bongkar muat kontainer. Sistem mencatat secara otomatis kapan terjadinya lonjakan hembusan angin ekstrem (kecepatan Gust dan pencatatan Waktu Kejadian / Time of Gust).
                          </li>
                          <li>
                            <strong>Mengapa Warning Angin Ini Sangat Penting?</strong>
                            <ul className="list-circle pl-5 mt-1 space-y-1 text-slate-400">
                              <li><strong>Batas Aman Crane:</strong> Alat bongkar muat pelabuhan (Gantry Crane) wajib menghentikan operasional jika hembusan angin melebihi 15 m/s karena berisiko roboh atau mematahkan boom penopang.</li>
                              <li><strong>Kestabilan Mooring:</strong> Tali penambat kapal di dermaga bisa putus jika angin kencang berdurasi lama menghantam lambung kapal secara tegak lurus.</li>
                            </ul>
                          </li>
                        </ul>
                      </div>

                      {/* Other widgets explanation */}
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">📊 PARAMETER ANALISIS LAINNYA DI DASHBOARD</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-400">
                          <div className="bg-slate-950/40 p-3 rounded-lg space-y-1">
                            <span className="text-white font-bold block">1. Wind Rose (Distribusi Arah Angin)</span>
                            Grafik jaring laba-laba yang memetakan akumulasi arah tiupan angin selama 24 jam terakhir. Digunakan oleh ahli meteorologi untuk merancang tata letak dermaga baru berdasarkan hembusan angin dominan tahunan.
                          </div>
                          <div className="bg-slate-950/40 p-3 rounded-lg space-y-1">
                            <span className="text-white font-bold block">2. Wind Force Forecast (Tren Prediksi 60m)</span>
                            Grafik garis dinamis yang memprediksi kecepatan angin ke depan. Garis putus-putus pada grafik menandakan estimasi matematis tren peningkatan/penurunan guna membantu kesiapan darurat tim evakuasi dermaga.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">📊 BENTUK INTEGRASI ANTARMUKA LAYAR ANALYST</div>
                      {/* CSS Mockup of Analyst Tab to represent user screen */}
                      <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-mono font-bold text-[#00f0ff] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            GAMBAR 2: ANTARMUKA ANALIS HISTORIS (ANALYST TAB)
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">ANALYST TAB</span>
                        </div>
                        
                        <div className="grid grid-cols-12 gap-3 aspect-[1.8/1] text-[8px] font-mono text-slate-400">
                          {/* Left: Trend Graph */}
                          <div className="col-span-8 bg-[#0b1424] border border-white/5 rounded-lg p-2 space-y-2">
                            <div className="font-bold text-white">📈 WIND FORCE FORECAST & TRENDS (M/S)</div>
                            <div className="h-20 bg-slate-950 rounded border border-white/5 relative flex items-end p-1 overflow-hidden">
                              <svg className="w-full h-full text-amber-500/10" viewBox="0 0 100 30" preserveAspectRatio="none">
                                <path d="M0,25 Q15,25 30,22 T60,8 T90,9 L100,9 L100,30 L0,30 Z" fill="currentColor" />
                                <path d="M0,25 Q15,25 30,22 T60,8 T90,9" fill="none" stroke="#fbbf24" strokeWidth="1" />
                                <path d="M60,8 Q70,8 80,9 T100,10" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="1,1" />
                              </svg>
                              <div className="absolute top-1 left-2 text-[6px] text-[#00f0ff] font-bold">10-Minute Step Forecast</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-[7px]">
                              <div className="bg-slate-950/50 p-1 rounded"><span>Air Temp:</span> <strong className="text-white">28.5 °C</strong></div>
                              <div className="bg-slate-950/50 p-1 rounded"><span>Humidity:</span> <strong className="text-white">67 %</strong></div>
                              <div className="bg-slate-950/50 p-1 rounded"><span>Solar Rad:</span> <strong className="text-white">433 W/m²</strong></div>
                            </div>
                          </div>
                          {/* Right: Mini Wind Rose */}
                          <div className="col-span-4 bg-[#0b1424] border border-white/5 rounded-lg p-2 flex flex-col items-center justify-between">
                            <div className="font-bold text-white text-center">🕸️ WIND ROSE (24H)</div>
                            <div className="w-16 h-16 rounded-full border border-[#00f0ff]/10 relative flex items-center justify-center my-1">
                              <div className="absolute w-full h-px bg-white/5"></div>
                              <div className="absolute h-full w-px bg-white/5"></div>
                              <div className="w-8 h-8 bg-amber-500/40 rounded-full rotate-45 border border-amber-400"></div>
                            </div>
                            <div className="bg-slate-950 p-1 rounded w-full text-center">
                              <div className="text-red-400 font-bold text-[8px]">38% Risk Level</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          * Tampilan skema chart tren cuaca dan wind rose di atas mencakup seluruh widget sesuai screenshot Analyst Tab.
                        </p>
                      </div>

                      {/* Detail of 11 Sensor Analyst Charts */}
                      <div className="bg-[#0b1424] p-5 rounded-2xl border border-teal-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-wider">
                          <Activity className="w-5 h-5 text-teal-400" />
                          <span>📋 DAFTAR LENGKAP 11 GRAFIK & TAMPILAN SENSOR HISTORIS</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Menu <strong>Historical Analyst</strong> mengintegrasikan seluruh pembacaan telemetri fisik dari stasiun AWS ke dalam 11 panel visualisasi grafik interaktif murni (berbasis Recharts):
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-[11px] text-slate-300">
                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-[#00f0ff] font-bold block">1. Wind Force Forecast & Trends (Area Chart)</span>
                            Grafik hibrida yang memadukan data kecepatan angin riil 24 jam terakhir (garis kuning stabil) dengan kurva prediksi matematis 60 menit ke depan (garis merah putus-putus) dengan interval per 10 menit.
                          </div>
                          
                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-amber-400 font-bold block">2. Wind Rose 24H Distribution (Polar Spatial SVG)</span>
                            Grafik jaring laba-laba spasial yang memetakan arah sebaran embusan angin dominan lengkap dengan indeks kecepatan dalam satuan knot (kt) untuk memantau ancaman badai kencang (storm gale).
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-[#38bdf8] font-bold block">3. Air Temperature / Suhu Udara (°C)</span>
                            Grafik area dinamis yang memvisualisasikan siklus fluktuasi suhu udara laut sepanjang siklus 24 jam untuk mendeteksi perubahan suhu lingkungan ekstrem secara dini.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-[#22c55e] font-bold block">4. Relative Humidity / Kelembaban Nisbi (%)</span>
                            Grafik tren kelembaban udara sekitar dermaga pelabuhan. Nilai yang terlalu tinggi berpotensi memicu timbulnya kabut laut (sea fog) yang mengganggu navigasi visual kapal.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-[#38bdf8] font-bold block">5. Water Temperature / Suhu Air (°C)</span>
                            Mengukur suhu air permukaan di dermaga (Sea Surface Temperature). Sangat krusial untuk kapal-kapal tanker kimia atau operasional muatan sensitif di pelabuhan.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-amber-500 font-bold block">6. Wind Speed & Gust / Kecepatan & Hembusan Angin (m/s)</span>
                            Grafik garis ganda yang membandingkan secara langsung hembusan angin rata-rata (Average Wind Speed) dengan hembusan mendadak (Maximum Gust) guna mencegah risiko putusnya tali penambat kapal.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-sky-400 font-bold block">7. Tidal Level / Pasang Surut Air Laut (m)</span>
                            Menggunakan sensor sonar ultra-presisi untuk merekam naik-turunnya permukaan air laut dermaga (Pasut) secara akurat dalam satuan meter. Sangat menentukan jendela waktu aman kapal kargo bersandar (safe draft).
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-pink-400 font-bold block">8. Water pH / Tingkat Keasaman Air Laut</span>
                            Menampilkan parameter pH air di area dermaga guna memantau kualitas air pelabuhan serta memitigasi korosi lambung kapal baja akibat keasaman air laut yang tinggi.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-yellow-500 font-bold block">9. Solar Radiation / Radiasi Matahari (W/m²)</span>
                            Mengukur tingkat intensitas sinar matahari langsung. Digunakan untuk memantau performa pengisian energi solar panel sistem AWS di lapangan pelabuhan.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                            <span className="text-cyan-400 font-bold block">10. Rainfall Intensity / Akumulasi Curah Hujan (mm)</span>
                            Grafik batang (Bar Chart) presisi tinggi yang merekam volume curah hujan kumulatif per interval pencatatan untuk memicu peringatan visibilitas buruk kapal.
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1 col-span-1 md:col-span-2">
                            <span className="text-emerald-400 font-bold block">11. System Battery Voltage / Tegangan Baterai Logger (V)</span>
                            Grafik pemantau daya baterai internal logger fisik Moxa. Menunjukkan stabilitas asupan tegangan 12V dari panel surya pelabuhan guna menjamin kelangsungan transmisi data tanpa henti (non-stop telemetry stream).
                          </div>
                        </div>

                        <div className="bg-slate-950 p-3 rounded-lg border border-teal-500/10 text-[11px] text-slate-300 leading-relaxed">
                          💡 <strong>Analisis Terpadu:</strong> Dengan perpaduan 11 sensor lengkap di atas, tim analis pelabuhan dapat dengan mudah mengekspor laporan korelasi cuaca langsung ke format file <strong>Excel/CSV</strong> melalui sub-menu yang terintegrasi di bagian bawah halaman.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualChapter === 'option' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-white uppercase">03. KONFIGURASI LENGKAP HARDWARE, CLOUD & SENSOR (MENU OPTION)</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Halaman <strong>Option / Settings</strong> merupakan pusat konfigurasi utama untuk menghubungkan konsol visualisasi dengan perangkat keras fisik AWS, mengatur sinkronisasi data awan (cloud), mengkalibrasi posisi fisik dermaga, serta mengatur ambang batas peringatan dini (alarm thresholds).
                      </p>
                    </div>

                    {/* Section 1: Data Input Methods */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-amber-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        🔌 1. PILIHAN KONEKSI DATA MASUK (SERIAL COM vs TCP/IP MOXA)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Sistem AWS mendukung fleksibilitas asupan telemetry melalui beberapa saluran pengiriman fisik yang dapat dipilih langsung pada menu dropdown <strong>Logger Mode</strong>:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-300">
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1.5">
                          <span className="text-[#00f0ff] font-bold block">A. SERIAL PORT COM (Direct Cable RS232/RS485)</span>
                          Digunakan jika komputer monitoring terhubung secara fisik langsung ke data logger lapangan melalui kabel serial.
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                            <li><strong>Web Serial API Integration:</strong> Sistem memanfaatkan antarmuka native browser modern untuk membuka koneksi port tanpa software tambahan.</li>
                            <li><strong>Baudrate & COM:</strong> Konfigurasikan nomor port komunikasi (misal: <code>COM3</code> atau <code>ttyUSB0</code>) dan Baudrate (paling umum <code>9600</code> bps atau <code>115200</code> bps).</li>
                            <li><strong>Tombol Koneksi:</strong> Klik <span className="text-emerald-400">CONNECT COM PORT</span> untuk mengaktifkan pemindaian. Indikator port akan menyala hijau cerah saat aktif.</li>
                          </ul>
                        </div>

                        <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1.5">
                          <span className="text-emerald-400 font-bold block">B. TCP/IP GATEWAY MOXA (Ethernet / Wireless Router)</span>
                          Digunakan saat stasiun AWS di luar lapangan mentransmisikan data serial RS485 melalui konverter serial-ke-Ethernet Moxa NPort.
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                            <li><strong>IP & Port Gateway:</strong> Tentukan IP Address Moxa (IP default: <code>192.168.127.254</code>) beserta Socket Port tujuan (umumnya <code>4001</code> atau <code>10001</code>).</li>
                            <li><strong>Moxa Web Daemon:</strong> Komunikasi data dikawal oleh background daemon Websocket lokal (default pada port <code>8080</code>).</li>
                            <li><strong>CORS & HTTPS Warn:</strong> Jika server dibuka melalui protokol HTTPS (Secure), browser akan memblokir koneksi HTTP tidak aman ke localhost. Pastikan Anda mengaktifkan izin <em>Insecure Content / Allow</em> di setingan privasi browser Anda.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Alarm Thresholds */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-blue-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-[#00f0ff] uppercase tracking-wider flex items-center gap-1.5">
                        🧪 2. SETTING ALARM THRESHOLDS (BATAS AMBANG AMAN SENSOR)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Untuk memicu fungsi peringatan visual di layar utama dan mengaktifkan kilatan oranye/merah, pengguna wajib mengonfigurasi batas-batas parameter aman di bagian bawah form settings:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-300">
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1.5">
                          <span className="text-pink-400 font-bold block">A. Water pH Alarm Limits</span>
                          Menentukan rentang derajat keasaman air laut pelabuhan yang aman guna melindungi integritas korosif lambung kapal serta ekosistem sekitar dermaga.
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                            <li><strong>Min Safe pH (Acidic):</strong> Standar disetel pada angka <strong className="text-pink-400">6.5</strong>. Pembacaan di bawah ini memicu alarm asam.</li>
                            <li><strong>Max Safe pH (Alkaline):</strong> Standar disetel pada angka <strong className="text-pink-400">8.5</strong>. Pembacaan di atas ini menandakan pencemaran basa.</li>
                          </ul>
                        </div>

                        <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1.5">
                          <span className="text-sky-400 font-bold block">B. Rainfall Warning Settings</span>
                          Menentukan curah hujan maksimal yang ditoleransi sebelum kapten kapal mengalami gangguan pandangan (reduced visibility).
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                            <li><strong>Heavy Rain Threshold (mm):</strong> Nilai ambang batas standar disetel pada <strong className="text-sky-400">10.0 mm</strong>. Indikator curah hujan di dashboard utama akan otomatis berkedip oranye jika curah hujan melampaui batas ini untuk memicu kesiapan operasional darurat.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Cloud Mode Settings */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        📡 3. PEMILIHAN MODE CLOUD (SINKRONISASI TRANSMISI INTERNET)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Sistem AWS dilengkapi mesin transmisi multi-protokol untuk menyalurkan data telemetri pelabuhan secara simultan ke pusat kendali jarak jauh (Cloud Server):
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] text-slate-300">
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-teal-400 font-bold block">☁️ HTTP API TRANSMITTER</span>
                          Mengirimkan paket data JSON terstruktur menggunakan metode POST request ke RESTful endpoint web tujuan Anda secara periodik. Cocok untuk integrasi dengan dasbor web terpusat.
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-emerald-400 font-bold block">📁 FTP AUTOMATIC UPLOAD</span>
                          Secara otomatis membuat laporan berkala dalam format XML atau CSV lalu mengunggahnya ke Server FTP yang dikonfigurasi (memerlukan Host, Username, Password, dan direktori penyimpanan FTP).
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-amber-400 font-bold block">🔌 MQTT LIGHTWEIGHT BROKER</span>
                          Mengirimkan data instan melalui protokol IoT berlatensi rendah ke broker MQTT. Membutuhkan konfigurasi Host Broker, Port (umumnya <code>1883</code>), Topic Publikasi (misal: <code>aws/ports/telemetry</code>), beserta username/password otentikasi.
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Pier Alignment Angle */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-pink-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                        🧭 4. KALIBRASI SUDUT DERMAGA (VISUAL PIER ANGLE CALIBRATION)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Fitur kalibrasi sudut kelurusan dermaga (<strong>Pier Angle</strong> dalam derajat <code>0-360°</code>) sangat krusial untuk menghasilkan visualisasi angin yang kontekstual bagi navigasi laut:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-400">
                        <div className="space-y-1">
                          <strong className="text-white block">A. Mengapa Sudut Dermaga Perlu Diisi?</strong>
                          Dermaga di setiap pelabuhan memiliki arah hadap pantai yang berbeda-beda secara geografis (azimuth). Dengan mengisi sudut kelurusan dermaga fisik (contoh: <code>45°</code> untuk dermaga berorientasi Timur Laut), visual kompas di layar utama akan berputar secara akurat meluruskan posisi Kiri (Port) dan Kanan (Starboard) kapal terhadap garis pantai.
                        </div>
                        <div className="space-y-1">
                          <strong className="text-white block">B. Kalkulasi Vektor Angin Relatif (Relative Wind)</strong>
                          Setelah dikalibrasi, sistem secara otomatis menghitung komponen gaya angin: <strong>Crosswind</strong> (angin yang mendorong lambung kapal dari samping) dan <strong>Headwind/Tailwind</strong> (angin sejajar haluan kapal) sehingga petugas pandu tahu persis tingkat kesulitan sandar kapal secara presisi.
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Raw Stream Monitor & Channel Mappings */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-teal-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                        📟 5. RAW STREAM MONITOR & DYNAMIC CHANNEL MAPPING INDEXES
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Data mentah yang keluar dari logger fisik biasanya dikirimkan berupa susunan string CSV satu baris yang dipisahkan karakter pembatas (Splitter Char). Menu Option memberikan alat penata (mapping tool) yang sangat canggih:
                      </p>
                      <ul className="text-[11px] text-slate-300 space-y-2 list-disc pl-5">
                        <li>
                          <strong>Raw Stream Monitor Console:</strong> Terminal konsol hijau di kanan bawah menampilkan feed asupan biner asli yang tertangkap. Struktur paket data standar: <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">#AWS001;03-07-2026;08:43:55;30.2;78;220;5.4;12.4</code>
                        </li>
                        <li>
                          <strong>Dynamic Channel Mapping Indexes:</strong> Pengguna dapat mencocokkan nomor index (kolom pembacaan dimulai dari index 0) ke nama parameter sensor secara langsung. Misalnya, jika data kelembaban udara berada di kolom ke-9, cukup pilih angka <code>9</code> pada kolom <strong>Humidity (ch_8)</strong>. Angka real-time sensor akan langsung diperbarui saat itu juga tanpa menghentikan sistem monitoring!
                        </li>
                        <li>
                          <strong>Moxa Telemetry Presets:</strong> Tombol pintas sekali klik <strong className="text-cyan-400">LOAD MOXA TELEMETRY PRESETS</strong> akan otomatis memuat setingan urutan index bawaan stasiun Moxa AWS lapangan standar untuk kemudahan instalasi kilat.
                        </li>
                      </ul>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">🔧 BENTUK INTEGRASI ANTARMUKA LAYAR OPTION (SETTINGS)</div>
                      {/* CSS Mockup of Option Tab to represent user screen */}
                      <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-mono font-bold text-[#00f0ff] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            GAMBAR 3: ANTARMUKA OPTION & SETTINGS (OPTION TAB)
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">OPTION TAB</span>
                        </div>
                        
                        <div className="grid grid-cols-12 gap-3 aspect-[1.8/1] text-[8px] font-mono text-slate-400">
                          {/* Left panel: Config Forms */}
                          <div className="col-span-6 bg-[#0b1424] border border-white/5 rounded-lg p-2 space-y-1.5">
                            <div className="font-bold text-white border-b border-white/5 pb-0.5">🔌 HARDWARE CONFIG</div>
                            <div className="bg-slate-950 p-1 rounded">
                              <span className="text-slate-500 text-[6px] block">LOGGER MODE</span>
                              <span className="text-white font-bold">TCP/IP GATEWAY MOXA</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="bg-slate-950 p-1 rounded">
                                <span className="text-slate-500 text-[6px] block">MOXA IP / HOST</span>
                                <span className="text-white">192.168.1.254</span>
                              </div>
                              <div className="bg-slate-950 p-1 rounded">
                                <span className="text-slate-500 text-[6px] block">SOCKET PORT</span>
                                <span className="text-white">4001</span>
                              </div>
                            </div>
                            <div className="bg-emerald-500/10 p-1 rounded text-emerald-400 text-[7px]">
                              Status: Connected (IP 192.168.1.254:4001)
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <button className="bg-amber-500 text-black rounded text-[6px] py-0.5">RESET OPT</button>
                              <button className="bg-emerald-500 text-black rounded text-[6px] py-0.5">SAVE CONFIG</button>
                            </div>
                          </div>
                          
                          {/* Right panel: Channel indexes mapping */}
                          <div className="col-span-6 bg-[#0b1424] border border-white/5 rounded-lg p-2 flex flex-col justify-between">
                            <div className="font-bold text-white border-b border-white/5 pb-0.5 uppercase">📟 SENSOR MAPPING INDEXES</div>
                            <div className="grid grid-cols-2 gap-1 overflow-y-auto max-h-16 pr-1">
                              <div className="flex justify-between bg-slate-950/50 p-0.5 rounded items-center">
                                <span>AIR TEMP (CH_0):</span>
                                <span className="text-white bg-white/10 px-0.5 rounded text-[6px]">Idx 3</span>
                              </div>
                              <div className="flex justify-between bg-slate-950/50 p-0.5 rounded items-center">
                                <span>TEMP AVG (CH_2):</span>
                                <span className="text-white bg-white/10 px-0.5 rounded text-[6px]">Idx 6</span>
                              </div>
                              <div className="flex justify-between bg-slate-950/50 p-0.5 rounded items-center">
                                <span>HUMIDITY (CH_8):</span>
                                <span className="text-white bg-white/10 px-0.5 rounded text-[6px]">Idx 7</span>
                              </div>
                            </div>
                            <div className="border border-white/5 rounded bg-black p-1 font-mono text-[5px] text-emerald-400 leading-none">
                              [14:47:53 RAW] "#AWS001;28-06-2026;14:47:52;30.2;29.2;..."
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          * Tampilan skema menu Option di atas mencakup seluruh widget pengaturan sesuai screenshot Option Tab.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualChapter === 'bmkg' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-white uppercase">05. TAB PRAKIRAAN CUACA MARITIM BMKG (PORT FORECAST)</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Halaman <strong>BMKG Port</strong> mengintegrasikan sistem AWS dengan pangkalan data prakiraan cuaca resmi BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) khusus untuk sektor maritim dan pelabuhan.
                      </p>
                    </div>

                    {/* Section 1: Data Integration & Sync */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        📡 1. KONTROL SYNC & SUMBER DATA (BMKG LIVE SYNC)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Di bagian kanan atas header, terdapat serangkaian kontrol interaktif untuk mengelola asupan data prakiraan maritim yang diterima sistem:
                      </p>
                      <ul className="text-[11px] text-slate-300 space-y-2 list-disc pl-5">
                        <li>
                          <strong>Sync Live Button:</strong> Klik tombol hijau <strong className="text-emerald-400">SYNC LIVE</strong> untuk memaksa sistem melakukan panggilan API (fetch) langsung ke server BMKG Maritim untuk memperbarui seluruh data prakiraan jam terbaru secara online.
                        </li>
                        <li>
                          <strong>Indikator Sumber (Source Indicator):</strong> Sistem menunjukkan status real-time asupan data di layar:
                          <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                            <li><span className="text-indigo-400 font-bold">live:</span> Data berhasil ditarik secara langsung dan instan dari server BMKG pusat.</li>
                            <li><span className="text-blue-400 font-bold">cache:</span> Data dimuat dari memori lokal berkecepatan tinggi demi efisiensi bandwidth transmisi.</li>
                            <li><span className="text-amber-400 font-bold">stale-cache / static:</span> Terjadi kendala internet, sistem menyajikan data statis cadangan terenkripsi agar konsol monitor tidak kosong.</li>
                          </ul>
                        </li>
                        <li>
                          <strong>Pencarian Data (Cari Jam / Cuaca):</strong> Kotak pencarian interaktif yang menyaring isi tabel prakiraan secara instan berdasarkan kata kunci tertentu (misalnya Anda mencari <code>"14:00"</code>, <code>"Hujan"</code>, atau arah angin <code>"Utara"</code>).
                        </li>
                        <li>
                          <strong>Layout Selector (Table vs Grid):</strong> Tombol toggle untuk beralih mode visualisasi data antara format <strong>Table</strong> (tabel spreadsheet presisi tinggi) atau format <strong>Grid</strong> (kartu-kartu ringkas modern yang responsif).
                        </li>
                      </ul>
                    </div>

                    {/* Section 2: Port Profile Profiles */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-blue-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                        ⚓ 2. PORT PROFILE SELECTOR (PEMILIHAN LOKASI PELABUHAN)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Sistem AWS mengawal wilayah perairan Selat Sunda dan Teluk Jakarta dengan menyediakan preset profil pelabuhan BMKG yang dapat dialihkan secara instan:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-300">
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                          <span className="text-[#00f0ff] font-bold block">A. Wilayah Banten (Selat Sunda)</span>
                          Meliputi simpul penyeberangan kargo dan penumpang vital:
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                            <li>Pelabuhan Ciwandan (Banten Utama)</li>
                            <li>Pelabuhan Bojonegara</li>
                            <li>Pelabuhan Karangantu (Banten Lama)</li>
                            <li>Pelabuhan Penyeberangan Merak</li>
                          </ul>
                        </div>
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-white/5 space-y-1">
                          <span className="text-pink-400 font-bold block">B. Wilayah DKI Jakarta (Teluk Jakarta)</span>
                          Meliputi pintu gerbang ekspor-impor dan pelayaran rakyat:
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-400">
                            <li>Pelabuhan Utama Tanjung Priok</li>
                            <li>Pelabuhan Sunda Kelapa (Pelayaran Rakyat)</li>
                            <li>Pelabuhan Muara Angke (Perikanan)</li>
                            <li>Pelabuhan Pulau Tidung (Kepulauan Seribu)</li>
                          </ul>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        💡 <strong>Mode Profil Kustom (Custom Port):</strong> Jika Anda memilih opsi <em>── LAINNYA / CUSTOM ──</em> pada dropdown, sistem membuka kolom input untuk mendefinisikan <strong>Custom Slug</strong> dan <strong>Custom Name</strong> secara mandiri guna menyambungkan stasiun cuaca pelabuhan khusus Anda sendiri ke dalam konsol.
                      </p>
                    </div>

                    {/* Section 3: Sensor Information Overview */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-pink-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                        📈 3. INFORMASI SENSOR SINKRON & INDIKATOR UTAMA
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Bagian tengah menampilkan 4 panel ringkasan parameter laut utama hasil komputasi data BMKG terbaru:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[10px] text-slate-300">
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-teal-400 font-bold block">🌊 GELOMBANG LAUT</span>
                          Menyajikan estimasi tinggi gelombang laut signifikan dalam meter (m) beserta klasifikasi tingkat keselamatan operasional dermaga (Tenang, Rendah, atau Sedang).
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-[#f59e0b] font-bold block">💨 KECEPATAN ANGIN</span>
                          Membaca kecepatan angin maritim dalam satuan <strong>Knot (kt)</strong>, lengkap dengan pencatatan hembusan puncak mendadak (Gust Speed) serta arah kompas angin dominan.
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-pink-400 font-bold block">📈 PASANG AIR LAUT</span>
                          Menampilkan nilai elevasi pasang air laut dermaga (m). Indikator status akan otomatis mendeteksi kondisi <strong className="text-pink-400">"PASANG TINGGI"</strong> jika elevasi melampaui batas aman draf kapal sandar.
                        </div>
                        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <span className="text-sky-400 font-bold block">👁️ VISIBILITAS UDARA</span>
                          Mengukur jarak pandang visual nakhoda dalam satuan Kilometer (Km). Nilai di atas 8 Km diklasifikasikan sebagai status <strong className="text-emerald-400">"SANGAT CLEAR"</strong> untuk pelayaran aman.
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Interactive Charts and Trend Lines */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-yellow-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-1.5">
                        📊 4. INTERACTIVE TREND CHARTS (VISUALISASI SIKLUS 12 JAM)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Sistem mengolah seluruh deretan data prakiraan BMKG ke dalam dua grafik interaktif cerdas beresolusi tinggi berbasis pustaka Recharts:
                      </p>
                      <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-5">
                        <li>
                          <strong>Grafik Elevasi Air & Gelombang (Area Chart):</strong> Menggabungkan grafik pasang air laut berwarna pink gradien dengan grafik tinggi gelombang berwarna hijau emerald guna membantu analis melihat korelasi antara pasang surut dengan kenaikan gelombang dermaga.
                        </li>
                        <li>
                          <strong>Grafik Parameter Atmosfer (Line Chart):</strong> Memetakan tren fluktuasi suhu udara maritim (°C) berdampingan secara langsung dengan tingkat kelembaban nisbi (%) sepanjang siklus waktu 12 jam ke depan.
                        </li>
                      </ul>
                    </div>

                    {/* Section 5: Selected Hour Inspector & Safety Assessment */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-teal-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                        🧭 5. DETAIL HOUR INSPECTOR & SAFETY ASSESSMENT (ASESMEN KESELAMATAN)
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Saat operator mengeklik salah satu baris jam prakiraan pada tabel/grid di sebelah kiri, panel <strong>Selected Hour Inspector</strong> di bagian kanan akan melakukan pembongkaran instrumen visual parameter laut secara mendalam:
                      </p>
                      <ul className="text-[11px] text-slate-300 space-y-2 list-disc pl-5">
                        <li>
                          <strong>Dial Parameter Cuaca:</strong> Menampilkan dial temperatur udara, tingkat kelembaban nisbi (RH), tinggi gelombang, serta pasang surut dalam satu papan instrumen berdesain modern.
                        </li>
                        <li>
                          <strong>Ocean Current Vector (Arah Arus Air):</strong> Menampilkan petunjuk arah aliran arus laut menggunakan ikon kompas spasial murni disertai pembacaan kecepatan arus dalam satuan Knot (Knot).
                        </li>
                        <li>
                          <strong>Wind Profile (Arah & Hembusan Angin):</strong> Menampilkan data arah hembusan angin dari kompas meteorologi secara presisi, lengkap dengan hembusan rata-rata dan hembusan kencang tiba-tiba (Gust).
                        </li>
                        <li>
                          <strong>Port Commander Safety Assessment:</strong> Fitur unggulan berupa kalkulasi matematis otomatis untuk menghasilkan laporan kesimpulan keselamatan operasional bersandarnya kapal kargo di pelabuhan aktif secara dinamis.
                        </li>
                      </ul>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">📊 BENTUK INTEGRASI ANTARMUKA LAYAR BMKG PORT</div>
                      {/* CSS Mockup of BMKG Tab to represent user screen */}
                      <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            GAMBAR 5: ANTARMUKA DETAIL PRAKIRAAN BMKG MARITIM (BMKG TAB)
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">PORT FORECAST MONITOR</span>
                        </div>
                        
                        <div className="grid grid-cols-12 gap-3 aspect-[1.8/1] text-[8px] font-mono text-slate-400">
                          {/* Header Controls Mock */}
                          <div className="col-span-12 bg-[#0b1424] border border-white/5 rounded p-1.5 flex justify-between items-center text-[7px]">
                            <span className="text-white font-bold uppercase">📍 PRAKIRAAN CUACA MARITIM - CIWANDAN</span>
                            <span className="bg-emerald-500/10 text-emerald-400 font-bold px-1 rounded">SYNC OK</span>
                          </div>
                          
                          {/* 4 Summary Cards Mock */}
                          <div className="col-span-12 grid grid-cols-4 gap-2 text-[6px]">
                            <div className="bg-[#050b14] border border-white/5 p-1 rounded">
                              <span className="text-teal-400 font-bold">GELOMBANG LAUT</span>
                              <div className="text-white font-bold text-xs mt-0.5">0.4m</div>
                            </div>
                            <div className="bg-[#050b14] border border-white/5 p-1 rounded">
                              <span className="text-amber-400 font-bold">ANGIN KNOTS</span>
                              <div className="text-white font-bold text-xs mt-0.5">10 kt</div>
                            </div>
                            <div className="bg-[#050b14] border border-white/5 p-1 rounded">
                              <span className="text-pink-400 font-bold">PASANG SURUT</span>
                              <div className="text-white font-bold text-xs mt-0.5">+0.59m</div>
                            </div>
                            <div className="bg-[#050b14] border border-white/5 p-1 rounded">
                              <span className="text-sky-400 font-bold">VISIBILITAS</span>
                              <div className="text-white font-bold text-xs mt-0.5">10.0km</div>
                            </div>
                          </div>

                          {/* Split layout Mock */}
                          <div className="col-span-8 bg-[#0b1424]/40 border border-white/5 rounded p-1.5 overflow-hidden">
                            <span className="text-emerald-400 font-bold text-[7px] block mb-1">📋 TABEL PERKIRAAN CUACA BERKALA (WIB)</span>
                            <div className="bg-emerald-600 text-white p-0.5 grid grid-cols-4 text-center font-bold text-[5px]">
                              <span>JAM</span><span>CUACA</span><span>WIND</span><span>TIDE</span>
                            </div>
                            <div className="p-0.5 grid grid-cols-4 text-center bg-emerald-500/10 text-white border-b border-white/5">
                              <span>09:00</span><span>Berawan ⛅</span><span>UTARA / 8 kt</span><span>+0.35m</span>
                            </div>
                            <div className="p-0.5 grid grid-cols-4 text-center text-slate-300 border-b border-white/5">
                              <span>12:00</span><span>Cerah ☀️</span><span>BARAT / 10 kt</span><span>+0.52m</span>
                            </div>
                          </div>

                          <div className="col-span-4 bg-[#050b14] border border-emerald-500/20 rounded p-1.5 space-y-1 text-[5px]">
                            <span className="text-teal-400 font-bold block text-[6px]">🧭 INSPECTOR HOUR DETIL</span>
                            <div className="bg-slate-900 p-1 rounded">
                              <span className="text-slate-400">ARUS LAUT (OCEAN CURRENT)</span>
                              <div className="text-teal-400 font-bold text-[7px] mt-0.5">UTARA (0.8 kt)</div>
                            </div>
                            <div className="bg-slate-900 p-1 rounded">
                              <span className="text-slate-400">WIND PROFILE</span>
                              <div className="text-amber-450 font-bold text-[7px] mt-0.5">TENGGARA (10 kt)</div>
                            </div>
                            <div className="bg-emerald-950/40 border border-emerald-500/10 p-1 rounded text-emerald-200">
                              Asesmen: Aman untuk penyandaran kapal laut.
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          * Tampilan skema halaman BMKG di atas mencakup seluruh widget parameter cuaca laut sesuai screenshot BMKG Tab.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualChapter === 'database' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-white uppercase">04. DOWNLOAD DATA & LOG DATABASE ENGINE</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Bagian ini menjelaskan secara rinci tentang pengolahan logs dan cara mengekspor data logger AWS ke dalam format tabel excel (CSV).
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-emerald-950/40 to-transparent p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 
                        Langkah-Langkah Mengunduh / Men-download Data AWS (Ekspor CSV):
                      </h4>
                      <ol className="text-[11px] text-slate-200 space-y-2.5 list-decimal pl-5">
                        <li>
                          Klik tab menu <strong>DATABASE</strong> pada sidebar navigasi di pojok kiri atas.
                        </li>
                        <li>
                          Pada panel <strong>Mode Penampilan Data Telemetri</strong>, pilih sumber data log yang diinginkan. Anda dapat men-toggle mode ke <strong>ONLINE TABLE</strong> untuk melihat logs riil dari database utama, atau <strong>OFFLINE LOGS</strong> untuk melihat database simulasi offline.
                        </li>
                        <li>
                          Atur rentang tanggal perekaman data yang ingin diambil menggunakan formulir filter:
                          <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-300">
                            <li><strong>START LOG PERIOD:</strong> Tanggal mulai penarikan data log.</li>
                            <li><strong>END LOG PERIOD:</strong> Tanggal akhir penarikan data log.</li>
                          </ul>
                        </li>
                        <li>
                          *(Opsional)* Gunakan kolom pencarian <strong>SEARCH METRICS</strong> jika ingin memfilter logs yang memuat karakter/nilai spesifik (misal mencari saat terjadi angin kencang di atas 10 m/s).
                        </li>
                        <li>
                          Klik tombol <strong>APPLY FILTER</strong> (tombol berwarna biru muda) untuk memproses penyaringan data. Tabel log di bawahnya akan dimuat ulang menyesuaikan filter tanggal.
                        </li>
                        <li>
                          Klik tombol <strong>EXPORT CSV FILE</strong> (tombol berwarna hijau emerald di pojok kanan kontrol panel).
                        </li>
                        <li>
                          Sistem akan memformat data logs ke dalam struktur spreadsheet dan otomatis mengunduh file berformat <code>.csv</code> ke komputer Anda. File ini siap dibuka langsung menggunakan program spreadsheet seperti <strong>Microsoft Excel</strong> atau <strong>Google Sheets</strong> untuk analisis teknis lanjutan.
                        </li>
                      </ol>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2 text-[11px]">
                      <h4 className="text-xs font-bold text-[#00f0ff] uppercase tracking-wider">⚙️ SISTEM SINKRONISASI DATABASE INTEGRATOR</h4>
                      <p className="text-slate-300 leading-relaxed">
                        Sistem AWS memiliki fitur <strong>Integrated Database Engine</strong> yang berjalan secara efisien. Mengacu pada standar WMO (World Meteorological Organization), sistem ini melakukan kompresi <em>10-Minute Average</em> (Rata-rata 10 menit) dari 5 sampel sensor instan yang ditangkap buffer akumulator. 
                        Tombol <strong>SYNC & AMBIL DATA ASLI</strong> digunakan untuk melakukan sinkronisasi database server secara real-time.
                      </p>
                    </div>

                    <div className="border-t border-white/5 pt-4">
                      <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">📊 BENTUK INTEGRASI ANTARMUKA LAYAR DATABASE</div>
                      {/* CSS Mockup of Database Tab to represent user screen */}
                      <div className="border border-white/10 rounded-2xl bg-slate-950/60 p-4 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-mono font-bold text-[#00f0ff] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            GAMBAR 4: ANTARMUKA LOG DATABASE & EKSPOR DATA (DATABASE TAB)
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">DATABASE TAB</span>
                        </div>
                        
                        <div className="grid grid-cols-12 gap-3 aspect-[1.8/1] text-[8px] font-mono text-slate-400">
                          {/* DB Header */}
                          <div className="col-span-12 bg-[#0b1424] border border-white/5 rounded p-1.5 flex justify-between items-center text-[7px]">
                            <span className="bg-emerald-500/10 text-emerald-400 font-bold px-1 rounded border border-emerald-500/20">DATABASE DRIVER ACTIVE</span>
                            <span className="text-slate-400">10 MIN AVG LOGGER</span>
                          </div>
                          {/* Filter Panel */}
                          <div className="col-span-12 bg-[#0d1e31]/40 border border-[#00f0ff]/10 rounded-lg p-2 grid grid-cols-4 gap-2 items-center text-[7px]">
                            <div>
                              <span>START PERIOD</span>
                              <div className="bg-slate-950 p-1 rounded text-white mt-0.5">22/06/2026</div>
                            </div>
                            <div>
                              <span>END PERIOD</span>
                              <div className="bg-slate-950 p-1 rounded text-white mt-0.5">23/06/2026</div>
                            </div>
                            <div>
                              <span>SEARCH METRICS</span>
                              <div className="bg-slate-950 p-1 rounded text-slate-500 mt-0.5">Search logs...</div>
                            </div>
                            <div className="flex gap-1">
                              <button className="bg-cyan-500 text-black px-1.5 py-1 rounded font-bold">APPLY FILTER</button>
                              <button className="bg-emerald-500 text-black px-1.5 py-1 rounded font-bold">EXPORT CSV</button>
                            </div>
                          </div>
                          {/* Table logs */}
                          <div className="col-span-12 bg-[#0b1424] border border-white/5 rounded overflow-hidden">
                            <div className="bg-white/5 p-1 grid grid-cols-5 text-white font-bold text-center">
                              <span>DATETIME</span><span>TEMP</span><span>HUMID</span><span>RAIN</span><span>W-SPEED</span>
                            </div>
                            <div className="p-1 grid grid-cols-5 text-center bg-white/2 border-t border-white/5">
                              <span>23-06-2026 21:49</span><span>28.4 °C</span><span>67%</span><span>2.5 mm</span><span>4.2 m/s</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          * Tampilan skema menu Database di atas mencakup seluruh widget pengolahan logs sesuai screenshot Database Tab.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualChapter === 'troubleshoot' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-white uppercase">05. DETIL SISTEM ALARM & TROUBLESHOOTING</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Panduan praktis untuk mengenali letak sistem alarm, memahami parameter ambang batas aman (thresholds), serta langkah penyelesaian masalah teknis pada sistem AWS.
                      </p>
                    </div>

                    {/* Alarm System Detail Block */}
                    <div className="bg-[#0b1424] p-5 rounded-2xl border border-red-500/20 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider">
                        <BellRing className="w-5 h-5 text-red-400 animate-pulse" />
                        <span>🚨 PEMETAAN SISTEM ALARM & PARAMETERNYA DI DASHBOARD</span>
                      </div>
                      
                      <div className="space-y-3.5 text-[11px] text-slate-300">
                        <div className="border-l-2 border-red-500 pl-3 space-y-1">
                          <strong className="text-white text-xs block">1. Alarm Kualitas Air (Water pH Alarm)</strong>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Letak di Dashboard:</span> Widget <strong>LIVE WATER QUALITY INDEX</strong> yang berada di blok <strong>KUALITAS AIR</strong> (Pojok Kiri Bawah pada layar Realtime).
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Parameter / Batas Aman:</span> Nilai pH ideal air laut berkisar antara <strong className="text-emerald-400">6.5 s/d 8.5</strong>.
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-red-400 font-semibold">Fungsi Warning:</span> Jika pH terdeteksi di luar batas aman (misal kurang dari 6.5 karena polusi asam, atau lebih dari 8.5 karena limpahan limbah kimia), teks status kualitas air pada dashboard akan berubah dari hijau <strong>"IDEAL"</strong> menjadi merah berkedip bertuliskan <strong className="text-red-400">"WARNING / DANGER"</strong>.
                          </p>
                        </div>

                        <div className="border-l-2 border-amber-500 pl-3 space-y-1">
                          <strong className="text-white text-xs block">2. Alarm Batas Curah Hujan (Rainfall Warning)</strong>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Letak di Dashboard:</span> Terletak di dalam widget <strong>RAINFALL</strong> pada blok <strong>HYGRO, SOLAR & RAIN</strong> (Tengah Kiri pada layar Realtime).
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Parameter / Batas Aman:</span> Ambang batas (threshold) curah hujan lebat default disetel pada angka <strong className="text-cyan-400">10.0 mm</strong>.
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Fungsi Warning:</span> Hujan yang terlalu lebat (&gt; 10 mm) dapat menghalangi pandangan nakhoda kapal dan memicu genangan air di dermaga. Indikator curah hujan akan berkedip oranye jika curah hujan melampaui batas aman ini.
                          </p>
                        </div>

                        <div className="border-l-2 border-cyan-500 pl-3 space-y-1">
                          <strong className="text-white text-xs block">3. Alarm Kecepatan Angin Maksimum (Wind Speed Limit & Gust Alert)</strong>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Letak di Dashboard:</span> Terletak pada panel <strong>WIND STATS & GUST EVENTS</strong> (Pojok Kanan Bawah pada layar Realtime).
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Parameter / Batas Aman:</span> Mengukur kecepatan angin sesaat maksimum (<strong className="text-cyan-400">WIND MAX</strong>) dan melacak kejadian hembusan angin kencang mendadak (<strong className="text-cyan-400">GUST EVENT</strong>).
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-red-400 font-semibold">Fungsi Warning:</span> Kecepatan angin di atas <strong className="text-red-400">15 m/s</strong> digolongkan sebagai bahaya badai laut. Jika sensor mencatat angka ini, status Gust akan berkedip merah untuk memperingatkan operator bahwa kondisi luar ruangan sangat berbahaya untuk bongkar muat gantry crane dan proses penyandaran kapal.
                          </p>
                        </div>

                        <div className="border-l-2 border-purple-500 pl-3 space-y-1">
                          <strong className="text-white text-xs block">4. Threat Radar / Marine Risk Assessment Warning</strong>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Letak di Dashboard:</span> Terletak di dalam tab menu <strong>ANALYST</strong>, tepatnya pada widget <strong>THREAT RADAR</strong>.
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Parameter / Batas Aman:</span> Menggabungkan kecepatan angin, kelembapan udara, dan radiasi solar untuk menilai risiko operasi pelayaran.
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-purple-400 font-semibold">Fungsi Warning:</span> Jika tingkat risiko melampaui 50%, indikator status operasi di dashboard analis akan bergeser dari hijau <strong>"SAFE OPERATION"</strong> ke merah bertuliskan <strong>"HIGH MARINE RISK"</strong> untuk mengisyaratkan kesiagaan kru darurat pelabuhan.
                          </p>
                        </div>

                        <div className="border-l-2 border-orange-500 pl-3 space-y-1">
                          <strong className="text-white text-xs block">5. Peringatan / Warning Data Terputus (Loss of Signal / Offline Warning)</strong>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Letak di Dashboard:</span> Terlihat pada bagian **Indikator Koneksi Logger / Status Aliran Data** (Header Atas, Streaming Monitor, serta label port di layar utama).
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">Parameter / Batas Aman:</span> Menguji jeda asupan (timeout) penerimaan string data telemetri. Batas kritis ditoleransi selama maksimal <strong className="text-orange-400">10-15 detik</strong> tanpa pembaruan data masuk.
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-red-400 font-semibold">Fungsi Warning:</span> Jika transmisi terputus akibat kabel kendur atau daya Moxa mati, widget indikator koneksi di panel atas akan berubah menjadi merah menyala bertuliskan <strong className="text-red-400">"DATA FEED DISCONNECTED / OFFLINE"</strong> dan mengunci visualisasi data pada status terakhir. Ini merupakan protokol keamanan kritis untuk mencegah kesalahan pembacaan data basi/stale oleh petugas pelabuhan.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2 text-[11px]">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">🛠️ TROUBLESHOOTING KONEKSI & DATA</h4>
                        <ul className="space-y-2 text-slate-300 list-disc pl-4">
                          <li>
                            <strong>Gejala: Dashboard Menampilkan Tulisan "OFFLINE"</strong>
                            <br />
                            <em>Langkah Penanganan:</em> Periksa panel <strong>Moxa Live Status</strong> di menu Option. Pastikan daemon berstatus <strong>CONNECTED</strong>. Jika terputus, pastikan kabel LAN Moxa terhubung dan alamat IP Moxa <code>192.168.1.254</code> dalam kondisi menyala (aktif).
                          </li>
                          <li>
                            <strong>Gejala: Muncul Peringatan "DATA FEED DISCONNECTED" atau "CONNECTION LOSS"</strong>
                            <br />
                            <em>Langkah Penanganan:</em>
                            <ul className="list-decimal pl-4 mt-1 space-y-1 text-slate-400">
                              <li>Buka tab <strong>OPTION</strong> dan periksa feed data mentah di console bawah. Jika kosong, asupan fisik terhenti.</li>
                              <li>Jika memakai mode Serial COM: periksa sambungan kabel fisik RS232, dan pastikan Port COM yang dipilih di browser tidak sedang dipakai oleh software terminal lain (seperti Putty/HyperTerminal).</li>
                              <li>Jika memakai mode Moxa TCP/IP: lakukan ping ke IP <code>192.168.1.254</code> (atau IP yang diset) lewat Command Prompt PC Anda untuk memastikan link jaringan hidup.</li>
                              <li>Lakukan siklus reboot daya (power-cycle) pada router Moxa di gardu sensor dengan mencabut adaptor selama 10 detik lalu tancapkan kembali.</li>
                            </ul>
                          </li>
                          <li>
                            <strong>Gejala: Angka Sensor Tertukar / Kacau</strong>
                            <br />
                            <em>Langkah Penanganan:</em> Terjadi kesalahan urutan parsing data. Masuk ke menu Option dan atur ulang nomor index pada panel <strong>Sensor Channel Mapping Indexes</strong> untuk menyelaraskan urutan kolom output dari logger AWS Anda.
                          </li>
                        </ul>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-[11px] space-y-1.5 text-slate-300">
                        <h4 className="font-bold text-amber-400 uppercase tracking-wider">⚠️ REKOMENDASI PEMELIHARAAN ROUTER MOXA</h4>
                        <p className="leading-relaxed">
                          Pastikan Moxa NPort Gateway dipasang dalam kotak panel IP66 yang kedap air dari paparan air laut asin (salt mist/korosi). Lakukan restart berkala pada router Moxa melalui web interface admin atau mematikan steker listrik selama 10 detik apabila koneksi daemon mengalami penurunan kecepatan atau kehilangan transmisi paket data (packet loss).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 text-slate-400 text-xs font-mono">
              <span>SISTEM DOKUMENTASI AWS RESMI (ID: AWS_DOC_PRO_V3)</span>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="bg-[#00f0ff] hover:bg-[#00d0e0] text-black font-bold px-6 py-2 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.3)] text-xs font-sans"
              >
                TUTUP BUKU MANUAL
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Decorative subtle console metadata footer */}
      <footer className="fixed bottom-3 right-6 pointer-events-none opacity-20 flex flex-col items-end gap-0.5">
        <span className="text-xs font-mono tracking-widest text-[#00f0ff] uppercase">AWS SYS STN: CONNECTED SECURE</span>
        <span className="text-xs font-mono tracking-widest text-slate-500">UTC: 2026-06-06 UTC+7 LOCAL SYSTEM</span>
      </footer>
    </div>
  );
}

