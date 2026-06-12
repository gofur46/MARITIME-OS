import React, { useState, useEffect, useRef } from 'react';
import { 
  Thermometer, Droplets, Droplet, Wind, Navigation, Gauge, Sun, CloudRain, 
  Waves, MoveDown, LayoutDashboard, History, Settings, FileText,
  AlertTriangle, Play, RefreshCw, Send, CheckCircle, Database
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WeatherData, AlertLevel, PortInstruction } from './types';
import { format } from 'date-fns';

// Create Yesterday's baseline climatology averages for our math
const CLIMATOLOGY_AVG = {
  waveHeight: 1.15, // meters
  windSpeed: 10.4,   // Knots (or m/s depending on system unit)
  temperature: 28.5,
  pressure: 1011.2
};

// Initial Config state
const DEFAULT_CONFIG = {
  idStation: 'SYS1000',
  transport: 'SERIAL', // SERIAL | TCP | OFF
  splitchar: ';',
  serialcom: 'COM3',
  baudrate: '9600',
  pierAngle: '15', // Rotating ship inside the compass
  cloudMode: 'OFF',
  httpUrl: 'https://api.portmarine.gov/aws/v1',
  ftpHost: 'ftp.portmarine.gov',
  ftpUser: 'aws_logger',
  ftpPass: '********',
  ftpPath: '/data/xml',
  ind_date: '1',
  ind_id: '0',
  minPhThreshold: '6.5', // Default min safe pH
  maxPhThreshold: '8.5', // Default max safe pH
  dbStorageMode: 'AVG', // 'AVG' (Rata-Rata) | 'RAW' (Instan/Setiap Detik/Sesaat)
  dbStorageInterval: 10, // 1 to 60 Minutes
  localDbApiUrl: 'http://localhost/aws_marine/api.php',
  uiZoom: '115', // Default font size scale (%) for excellent laptop reading
  isSimulationOn: 'ON', // ON / OFF simulation mode
  sensors: {
    'ch_0': '2',   // Air Temp
    'ch_2': '2',   // Temp Avg (let's map to Temp source with average)
    'ch_4': '2',   // Temp Max (computed in code or mapped)
    'ch_6': '2',   // Temp Min
    'ch_8': '3',   // Humidity
    'ch_12': '4',  // Dew Point (computed or mapped)
    'ch_1': '5',   // Rain Rate
    'ch_3': '6',   // Rain Accumulation
    'ch_5': '7',   // Solar Rad
    'ch_14': '8',  // Wave Height
    'ch_15': '9',  // Water Level
    'ch_16': '10', // Wind Direction
    'ch_17': '11',  // Wind Speed
    'ch_7': '12',  // Pressure STN
    'ch_9': '12',  // Pres QFE
    'ch_11': '12', // Pres QFF
    'ch_13': '12', // Pres QNH
    'ch_18': '13'  // Water pH
  }
};

// Generate highly realistic initial historical database rows (60 rows)
const generateInitialLogs = (count: number, intervalMinutes: number = 10): WeatherData[] => {
  const data: WeatherData[] = [];
  const spacingMs = intervalMinutes * 60 * 1000;
  let baseTime = Date.now() - count * spacingMs;
  for (let i = 0; i < count; i++) {
    const temp = 27 + Math.random() * 4;
    const hum = 75 + Math.random() * 15;
    const windSpeed = 8 + Math.random() * 12;
    data.push({
      timestamp: baseTime + i * spacingMs,
      temperature: parseFloat(temp.toFixed(1)),
      humidity: Math.round(hum),
      windSpeed: parseFloat(windSpeed.toFixed(1)),
      windDirection: Math.round(Math.random() * 360),
      pressure: parseFloat((1008 + Math.random() * 6).toFixed(1)),
      solarRadiation: Math.round(250 + Math.random() * 400),
      rainfall: Math.random() > 0.88 ? parseFloat((Math.random() * 4).toFixed(1)) : 0,
      waveHeight: parseFloat((0.4 + Math.random() * 1.5).toFixed(2)),
      seaLevel: parseFloat((120 + Math.random() * 50).toFixed(1)), // cm
      waterPh: parseFloat((7.6 + Math.random() * 0.8).toFixed(2)) // pH
    });
  }
  return data;
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
      rainfall: 0,
      waveHeight: 1.0,
      seaLevel: 150.0,
      waterPh: 7.8
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
  let sumSea = 0;
  let sumPh = 0;

  // Vector direction variables
  let sinSum = 0;
  let cosSum = 0;

  buffer.forEach(item => {
    sumTemp += item.temperature;
    sumHum += item.humidity;
    sumSpeed += item.windSpeed;
    sumPress += item.pressure;
    sumSolar += item.solarRadiation;
    sumRain += item.rainfall; // Sum accumulated rainfall
    sumWave += item.waveHeight;
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
    rainfall: parseFloat(sumRain.toFixed(1)), // Sum accumulated rainfall
    waveHeight: parseFloat((sumWave / count).toFixed(2)),
    seaLevel: parseFloat((sumSea / count).toFixed(1)),
    waterPh: parseFloat((sumPh / count).toFixed(2))
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'analyst' | 'database' | 'settings'>('realtime');
  
  // Persisted state setup matching your parameters
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('aws_config');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    return {
      ...DEFAULT_CONFIG,
      ...parsed
    };
  });

  const [history, setHistory] = useState<WeatherData[]>(() => {
    const saved = localStorage.getItem('aws_history_logs');
    return saved ? JSON.parse(saved) : generateInitialLogs(45, (saved ? DEFAULT_CONFIG : config).dbStorageInterval || 10);
  });

  // Database start/end period filter state for tab 3
  const [dbStartDate, setDbStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dbEndDate, setDbEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filteredLogs, setFilteredLogs] = useState<WeatherData[]>([]);
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbScriptTab, setDbScriptTab] = useState<'sql' | 'php'>('sql');
  const [isIntegratorOpen, setIsIntegratorOpen] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
    details?: string;
  }>({ status: 'idle', message: '' });
  
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

  // Gracefully post log data to local XAMPP MariaDB API
  const postLogToLocalXampp = async (record: WeatherData) => {
    const url = config.localDbApiUrl || 'http://localhost/aws_marine/api.php';
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
      pressure: record.pressure
    };

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
          const msg = `[${timeStr} SQL LINK] 🌐 Sent to local XAMPP: HTTP 200 OK (Data recorded in tbl_sensor_logs table).`;
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
        const msg = `[${timeStr} SQL LINK] 🔌 XAMPP Link Idle (Ensure local api.php is running at ${url} to sync data).`;
        const output = [...lines, msg];
        if (output.length > 40) return output.slice(output.length - 30).join('\n');
        return output.join('\n');
      });
    }
  };

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

      // Detection of Moxa Schema vs General CSV Schema 
      if (source === 'MOXA_TCP' || tokens.length >= 20) {
        // MOXA 22-field scheme:
        // [0] Kode_Stasiun, [1] Date (DD-MM-YYYY), [2] Time (HH:mm:ss), [3] WS_meas, [5] WD_meas, 
        // [6] TA_meas, [9] RH_meas, [10] PA_meas, [12] SR_meas, [17] water_level (m), [18] PH_meas
        const ws_meas = parseFloat(tokens[3]) || 0;
        const wd_meas = parseInt(tokens[5]) || 0;
        const ta_meas = parseFloat(tokens[6]) || 28.0;
        const rh_meas = parseInt(tokens[9]) || 80;
        const pa_meas = parseFloat(tokens[10]) || 1010.0;
        const sr_meas = tokens[12] === 'NAN' ? 0 : (parseInt(tokens[12]) || 0);
        const water_level = tokens[17] === 'NAN' ? 140.0 : parseFloat(tokens[17]) * 100; // convert m to cm
        const ph_meas = tokens[18] === 'NAN' ? 7.8 : parseFloat(tokens[18]) || 7.8;

        record = {
          timestamp: now,
          temperature: ta_meas,
          humidity: rh_meas,
          windSpeed: ws_meas,
          windDirection: wd_meas,
          pressure: pa_meas,
          solarRadiation: sr_meas,
          rainfall: 0.0,
          waveHeight: 1.10, // constant base
          seaLevel: water_level, 
          waterPh: ph_meas
        };
      } else {
        // Standard payload scheme (Standard 11 properties):
        // [0] ID, [1] Date Time, [2] Temp, [3] Hum, [4] Solar, [5] Rain, [6] WaveHr, [7] SeaLvl, [8] pH, [9] WindDir, [10] WindSpd, [11] Press
        const temp = parseFloat(tokens[2]) || 28.0;
        const hum = parseInt(tokens[3]) || 80;
        const solar = parseInt(tokens[4]) || 0;
        const rain = parseFloat(tokens[5]) || 0.0;
        const wave = parseFloat(tokens[6]) || 1.10;
        const sea = parseFloat(tokens[7]) || 140.0;
        const ph = parseFloat(tokens[8]) || 7.80;
        const wd = parseInt(tokens[9]) || 0;
        const ws = parseFloat(tokens[10]) || 0.0;
        const press = parseFloat(tokens[11]) || 1010.0;

        record = {
          timestamp: now,
          temperature: temp,
          humidity: hum,
          solarRadiation: solar,
          rainfall: rain,
          waveHeight: wave,
          seaLevel: sea,
          waterPh: ph,
          windDirection: wd,
          windSpeed: ws,
          pressure: press
        };
      }

      // Add mapped record to live memory history immediately
      setHistory(prev => {
        const updated = [...prev, record];
        const keeps = updated.length > 200 ? updated.slice(updated.length - 150) : updated;
        localStorage.setItem('aws_history_logs', JSON.stringify(keeps));
        return keeps;
      });

      // Forward directly to local database (XAMPP api.php) if configured
      postLogToLocalXampp(record);

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
  const handleSaveConfig = (newConfig: typeof config) => {
    setConfig(newConfig);
    localStorage.setItem('aws_config', JSON.stringify(newConfig));
    showToastNotification('Config Saved Successfully!');
  };

  const showToastNotification = (msg: string) => {
    setSystemAlert(msg);
    setTimeout(() => {
      setSystemAlert(null);
    }, 3000);
  };

  const [systemAlert, setSystemAlert] = useState<string | null>(null);

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
      const nextTemp = 27 + Math.random() * 4;
      const nextHum = 70 + Math.floor(Math.random() * 25);
      const nextWindSpeed = 6 + Math.random() * 14;
      const nextWindDir = Math.floor(Math.random() * 360);
      const nextPress = 1008 + Math.random() * 5;
      const nextSolar = Math.floor(100 + Math.random() * 600);
      const nextRainRate = Math.random() > 0.9 ? parseFloat((Math.random() * 6).toFixed(1)) : 0;
      const nextWave = parseFloat((0.3 + Math.random() * 1.6).toFixed(2));
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
        seaLevel: nextSeaLvl,
        waterPh: nextPh
      };

      // Handle Storage Rules dynamically
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
            // RAW mode: Save the latest instantaneous sample at the exact interval (e.g. data pada menit ke-10 atau menit ke-1)
            recordToSave = { ...newRecord };
            msgLog = `📦 saved raw instantaneous record for ${config.dbStorageInterval}-minute interval directly to database successfully.`;
          }
          
          // Adjust simulated timestamp backward to show historical interval
          const intervalMs = (config.dbStorageInterval || 10) * 60 * 1000;
          recordToSave.timestamp = Date.now() - intervalMs;

          // Asynchronously post to local XAMPP MariaDB script
          postLogToLocalXampp(recordToSave);

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

      // Update terminal stream simulator
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
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [config]);

  // Handle default initial filter for database search logs
  useEffect(() => {
    filterLogsData();
  }, [history, dbStartDate, dbEndDate, dbSearchTerm]);

  const filterLogsData = () => {
    const active = history.filter(row => {
      const rowDateStr = format(row.timestamp, 'yyyy-MM-dd');
      const startMatch = dbStartDate ? rowDateStr >= dbStartDate : true;
      const endMatch = dbEndDate ? rowDateStr <= dbEndDate : true;
      
      const searchMatch = dbSearchTerm ? (
        row.temperature.toString().includes(dbSearchTerm) ||
        row.windSpeed.toString().includes(dbSearchTerm) ||
        row.windDirection.toString().includes(dbSearchTerm) ||
        row.pressure.toString().includes(dbSearchTerm) ||
        (row.waterPh && row.waterPh.toString().includes(dbSearchTerm))
      ) : true;

      return startMatch && endMatch && searchMatch;
    });
    setFilteredLogs(active.reverse());
  };

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

  // Export database metrics to CSV format
  const exportLogsToCSV = () => {
    const headers = ['DateTime', 'Temp (deg C)', 'Humidity (%)', 'Solar (W/m2)', 'Wave (m)', 'WaterLvl (cm)', 'Water pH', 'WindDir (deg)', 'WindSpd (m/s)', 'Rain (mm)', 'Press (hPa)'];
    const rows = filteredLogs.map(row => [
      format(row.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      row.temperature,
      row.humidity,
      row.solarRadiation,
      row.waveHeight,
      row.seaLevel,
      row.waterPh || 7.8,
      row.windDirection,
      row.windSpeed,
      row.rainfall,
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
    // 1. Live historical momentum (last 6 captured records in history, simulating 1 hour back at 10m cycle)
    const wave_hist = history.slice(-6).map(h => h.waveHeight);
    const wind_hist = history.slice(-6).map(h => h.windSpeed);
    
    // Ensure historical array has elements
    if (wave_hist.length === 0) {
      wave_hist.push(1.10);
      wind_hist.push(10.0);
    }

    const currentWave = wave_hist[wave_hist.length - 1];
    const currentWind = wind_hist[wind_hist.length - 1];

    // Yesterday's Climatology Baselines as specified in your logic
    const yestWave = CLIMATOLOGY_AVG.waveHeight;
    const yestWind = CLIMATOLOGY_AVG.windSpeed;

    // Seberapa cepat momentum pergerakan 1 jam terakhir 
    let waveMomentum = 0;
    let windMomentum = 0;
    if (wave_hist.length > 1) {
      waveMomentum = (currentWave - wave_hist[0]) / wave_hist.length;
      windMomentum = (currentWind - wind_hist[0]) / wind_hist.length;
    }

    // ANOMALY OVERRIDE: Jika saat ini beda ekstrem dengan kemarin (> 50% atau sudah berbahaya)
    // Jika True = ADA BADAI / SQUALL, abaikan sejarah, fokus pada bacaan sensor live!
    const isWaveStorm = Math.abs(currentWave - yestWave) > (yestWave * 0.5) || currentWave >= 1.5;
    const isWindStorm = Math.abs(currentWind - yestWind) > (yestWind * 0.5) || currentWind >= 15.0;

    const forecastedWaves = [];
    const forecastedWinds = [];
    const timestamps = [];
    const baseDate = new Date();

    for (let i = 1; i <= 6; i++) {
      const stepTime = new Date(baseDate.getTime() + i * 10 * 60000);
      
      // Prediksi dasar murni dari gaya dorong (momentum) sensor saat ini
      let futureWave = currentWave + (waveMomentum * i * 0.8); // 0.8 dumper 
      let futureWind = currentWind + (windMomentum * i * 0.8);

      // Jika TIDAK ADA BADAI (Cuaca Normal), baru kita tarik ke siklus kemarin
      if (!isWaveStorm) {
        futureWave = (futureWave * 0.6) + (yestWave * 0.4); // 40% influence yesterday
      }
      if (!isWindStorm) {
        futureWind = (futureWind * 0.6) + (yestWind * 0.4); // 40% influence yesterday
      }

      // Tambahkan sedikit turbulensi acak alami
      futureWave += (Math.random() * 0.08 - 0.04);
      futureWind += (Math.random() * 0.8 - 0.4);

      forecastedWaves.push(parseFloat(Math.max(0.1, futureWave).toFixed(2)));
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
      pastAndFutureData.push({
        time: format(h.timestamp, 'HH:mm'),
        pastWave: h.waveHeight,
        pastWind: h.windSpeed,
        futWave: null,
        futWind: null
      });
    });

    // Add linkage point so solid line touches dashed forecast line
    if (pastAndFutureData.length > 0) {
      const idx = pastAndFutureData.length - 1;
      pastAndFutureData[idx].futWave = pastAndFutureData[idx].pastWave;
      pastAndFutureData[idx].futWind = pastAndFutureData[idx].pastWind;
    }

    // Append Future elements
    forecastedWaves.forEach((w, idx) => {
      pastAndFutureData.push({
        time: timestamps[idx],
        pastWave: null,
        pastWind: null,
        futWave: w,
        futWind: forecastedWinds[idx]
      });
    });

    return {
      forecastedWaves,
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
        
        {/* RMS Yacht Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#00f0ff] to-[#3b82f6]/40 rounded-2xl flex flex-col items-center justify-center shadow-[0_0_35px_rgba(0,240,255,0.3)] border border-[#00f0ff]/30 cursor-pointer" onClick={() => setActiveTab('realtime')}>
          <span className="text-bg text-black font-black text-2xl tracking-tighter leading-none">RMS</span>
          <span className="text-[7.5px] text-white tracking-[0.2em] font-extrabold uppercase mt-1">PRO v3</span>
        </div>

        <nav className="flex flex-col gap-5 w-full px-3">
          <button 
            onClick={() => setActiveTab('realtime')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'realtime' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span className="text-[9px]">REALTIME</span>
          </button>

          <button 
            onClick={() => setActiveTab('analyst')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'analyst' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <RefreshCw className="w-4.5 h-4.5" />
            <span className="text-[9px]">ANALYST</span>
          </button>

          <button 
            onClick={() => setActiveTab('database')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'database' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <Database className="w-4.5 h-4.5" />
            <span className="text-[9px]">DATABASE</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full py-3.5 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold uppercase tracking-wider font-sans border ${activeTab === 'settings' ? 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
          >
            <Settings className="w-4.5 h-4.5" />
            <span className="text-[9px]">OPTION</span>
          </button>
        </nav>

        {/* Station Indicator */}
        <div className="mt-auto text-center">
          <div className="text-[8.5px] font-mono opacity-50 uppercase font-black text-slate-400">Station ID</div>
          <div className="text-[11px] font-mono tracking-wider font-black text-[#00f0ff] mt-1 bg-white/5 px-2.5 py-1 rounded border border-[#00f0ff]/20">{config.idStation}</div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-5 md:p-8 space-y-6 max-w-full w-full overflow-hidden flex flex-col justify-between">
        
        {/* SHARED HEADER CONTROLLER */}
        <header className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center bg-gradient-to-r from-[#0b1424]/90 via-[#0b1424]/50 to-bg/90 backdrop-blur-xl p-5 md:p-6 rounded-[1.5rem] border border-[#00f0ff]/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00f0ff]/40 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00f0ff]/40 rounded-br-xl" />

          <div>
            <div className="text-[8px] uppercase tracking-[0.3em] font-mono text-[#00f0ff]/80 font-extrabold flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>AWS OS CONNECTION: {config.transport}{config.transport !== 'OFF' && ` (${config.serialcom || '192.168.1.1'}:${config.baudrate || '4001'})`}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase flex items-baseline gap-2">
              AWS MARINE BOARD <span className="text-[#00f0ff] text-xs font-mono lowercase tracking-[0.05em] bg-[#00f0ff]/10 py-0.5 px-3 rounded border border-[#00f0ff]/30 font-bold">Pro RMS v3</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
              Kondisi Operasional Port & Log Terminal Cuaca Maritim
            </p>
          </div>

          <div className="flex items-center gap-6 self-stretch lg:self-auto justify-between lg:justify-end border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
            <div className="hidden xl:flex gap-6 text-right">
              <div>
                <div className="text-[8px] uppercase font-bold opacity-40 tracking-wider text-[#00f0ff]">DB STATUS</div>
                <div className="text-[10px] font-mono font-bold text-emerald-400">CONNECT_SECURE</div>
              </div>
              <div>
                <div className="text-[8px] uppercase font-bold opacity-40 tracking-wider text-[#00f0ff]">PIER ALIGNMENT</div>
                <div className="text-[10px] font-mono font-bold text-[#3b82f6]">{config.pierAngle}° CLOCKWISE</div>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10 hidden xl:block" />
            <div className="text-right">
              <div className="text-[9.5px] font-mono opacity-50 uppercase tracking-widest text-[#00f0ff] font-semibold">{format(Date.now(), 'EEEE, dd MMM yyyy')}</div>
              <div className="text-2xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.08)] bg-white/5 py-0.5 px-3 rounded-xl border border-white/5 mt-0.5">{format(Date.now(), 'HH:mm:ss')}</div>
            </div>
          </div>
        </header>

        {/* PAGE tab 1: REALTIME DASH */}
        {activeTab === 'realtime' && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* COLUMN 1: KONDISI ATMOSFER (width 3/12 on large screens) */}
            <div className="lg:col-span-3 flex flex-col space-y-6 h-full justify-between">
              
              {/* Thermal group */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="text-[10.5px] font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                  <Thermometer className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span>Thermal Sensors</span>
                </div>

                {/* Primary Air temp StatCard */}
                <div className="bg-[#0b1424] border-t-2 border-[#22c55e] border-x border-b border-white/5 rounded-xl p-4 text-center">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1">Air Temperature</div>
                  <div className="flex justify-center items-baseline">
                    <span className="text-4xl font-extrabold font-mono tracking-tight text-white">{currentData.temperature.toFixed(1)}</span>
                    <span className="text-sm font-bold text-[#22c55e] ml-1">°C</span>
                  </div>
                </div>

                {/* Avg, Max, Min grid row inside column 1 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#0b1424]/80 border border-white/5 rounded-lg p-2 text-center">
                    <div className="text-[8px] uppercase font-semibold text-slate-500 tracking-wider">Avg</div>
                    <div className="text-sm font-bold text-[#e0f2fe] font-mono mt-0.5">{tempStats.avg}</div>
                  </div>
                  <div className="bg-[#0b1424]/80 border border-white/5 rounded-lg p-2 text-center">
                    <div className="text-[8px] uppercase font-semibold text-slate-500 tracking-wider text-rose-400">Max</div>
                    <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">{tempStats.max}</div>
                  </div>
                  <div className="bg-[#0b1424]/80 border border-white/5 rounded-lg p-2 text-center">
                    <div className="text-[8px] uppercase font-semibold text-slate-500 tracking-wider text-teal-400">Min</div>
                    <div className="text-sm font-bold text-teal-400 font-mono mt-0.5">{tempStats.min}</div>
                  </div>
                </div>
              </div>

              {/* Hygrometry group */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="text-[10.5px] font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                  <Droplets className="w-3.5 h-3.5 text-[#00f0ff]" />
                  <span>Hygrometry</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-[#0b1424] border-t-2 border-[#00f0ff] border-x border-b border-white/5 rounded-xl p-3.5 flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Humidity</span>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold font-mono text-white">{currentData.humidity}</span>
                      <span className="text-[10px] text-[#00f0ff] ml-1.5 font-bold">%</span>
                    </div>
                  </div>

                  <div className="bg-[#0b1424] border-t-2 border-[#00f0ff] border-x border-b border-white/5 rounded-xl p-3.5 flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Dew Point</span>
                    <div className="text-right">
                      <span className="text-xl font-extrabold font-mono text-white">
                        {computeDewPoint(currentData.temperature, currentData.humidity)}
                      </span>
                      <span className="text-[10px] text-[#00f0ff] ml-1.5 font-bold">°C</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Atmospheric pressure STN */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-5 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                    <Gauge className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pressure STN</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-center py-2.5">
                  <div className="bg-[#0b1424] border-t-2 border-amber-500 border-x border-b border-white/5 rounded-xl p-4 text-center">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1">Barometric Air Pressure</div>
                    <div className="flex justify-center items-baseline">
                      <span className="text-3xl font-extrabold font-mono tracking-tight text-white">{currentData.pressure.toFixed(1)}</span>
                      <span className="text-[10px] text-amber-500 ml-1.5 font-bold uppercase tracking-wider">HPa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 2: COMMAND CENTER WIND COMPASS (width 6/12 on large screens) */}
            <div className="lg:col-span-6 bg-gradient-to-br from-[#0d1726]/80 to-bg border border-[#00f0ff]/20 p-6 rounded-3xl relative min-h-[500px] flex flex-col justify-between shadow-[0_30px_70px_rgba(0,0,0,0.9)] h-full">
              <div className="absolute top-0 right-0 w-24 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/30 to-transparent" />
              
              <div className="text-center font-bold">
                <h3 className="text-xs uppercase font-extrabold tracking-[0.25em] text-[#00f0ff] flex items-center justify-center gap-2 mb-1">
                  🌐 Live Wind Vector & Port Orientation ({config.pierAngle}°)
                </h3>
                <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest bg-white/5 py-0.5 px-3 rounded">
                  CONSOLE_INTEGRATION_ONLINE
                </span>
              </div>

              {/* Dynamic Maritime Hazard Alert Panel (EWS) */}
              {(() => {
                const isAnginKencang = currentData.windSpeed >= 12.0;
                const isGelombangTinggi = currentData.waveHeight >= 1.2;
                
                if (isAnginKencang && isGelombangTinggi) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-rose-500/50 bg-rose-950/40 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.25)] select-none">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wider font-mono text-center">
                        🔥 SIAGA 1: DOUBLE HAZARD (WIND & WAVE WARN)
                      </span>
                    </div>
                  );
                } else if (isAnginKencang) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-amber-500/40 bg-amber-950/30 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse select-none shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider font-mono text-center">
                        ⚠️ WARNING: ANGIN KENCANG ({currentData.windSpeed.toFixed(1)} m/s)
                      </span>
                    </div>
                  );
                } else if (isGelombangTinggi) {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-2 border border-cyan-500/40 bg-[#082f49]/40 rounded-xl flex items-center gap-2.5 justify-center max-w-sm animate-pulse select-none shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                      <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider font-mono text-center">
                        🌊 WARNING: GELOMBANG TINGGI ({currentData.waveHeight}m)
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="mx-auto mt-2.5 px-4 py-1.5 border border-emerald-500/20 bg-emerald-950/10 rounded-xl flex items-center gap-2 justify-center max-w-xs select-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-mono text-center">
                        🟢 STATUS OPERASI: AMAN & NORMAL
                      </span>
                    </div>
                  );
                }
              })()}

              {/* WIND COMPASS PORT-REPRESENTATION (PORT & STD) */}
              <div className="flex justify-center items-center my-6 relative">
                
                {/* PORT STD side panels labels */}
                <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 text-center bg-[#0b1424]/90 border border-white/10 p-3 rounded-xl max-w-[150px] shadow-25 select-none font-sans">
                  <div className="text-[10px] font-black text-[#00f0ff] uppercase tracking-wider mb-1">PORT (Kiri)</div>
                  <div className="text-[8px] text-slate-400 font-semibold">LEFT VESSEL</div>
                </div>

                {/* Compass Ring wrapper with dynamic warning colors */}
                {(() => {
                  const isAnginKencang = currentData.windSpeed >= 12.0;
                  const isGelombangTinggi = currentData.waveHeight >= 1.2;
                  
                  let ringBorderColor = "border-slate-700 shadow-[#00f0ff]/5";
                  if (isAnginKencang && isGelombangTinggi) {
                    ringBorderColor = "border-rose-900/80 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse";
                  } else if (isAnginKencang) {
                    ringBorderColor = "border-amber-700/80 shadow-[0_0_15px_rgba(245,158,11,0.15)]";
                  } else if (isGelombangTinggi) {
                    ringBorderColor = "border-cyan-800/80 shadow-[0_0_15px_rgba(6,182,212,0.15)]";
                  }

                  return (
                    <div className={`relative w-72 h-72 rounded-full border-[12px] transition-all duration-700 flex items-center justify-center bg-radial-gradient from-[#00f0ff]/10 to-[#0284c7]/30 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] ${ringBorderColor}`}>
                      {/* Water ring container inside */}
                      <div className="absolute w-[180px] h-[180px] rounded-full border border-white/5 bg-transparent pointer-events-none" />
                      
                      {/* Direction characters */}
                      <span className="absolute top-1 text-slate-200 text-xs font-black tracking-widest font-sans">N</span>
                      <span className="absolute bottom-1 text-slate-200 text-xs font-black tracking-widest font-sans">S</span>
                      <span className="absolute right-3 text-slate-200 text-xs font-black tracking-widest font-sans font-extrabold">E</span>
                      <span className="absolute left-3 text-slate-200 text-xs font-black tracking-widest font-sans font-extrabold">W</span>

                      {/* Ship Silhouette Wrapper rotated strictly with visual pierAngle state */}
                      <div 
                        className="absolute w-full h-full flex items-center justify-center transition-all duration-1000 ease-out"
                        style={{ transform: `rotate(${config.pierAngle}deg)` }}
                      >
                        {/* Ship body with real containers area and bridge */}
                        <div className="w-10 h-32 bg-slate-500 border-2 border-slate-900 rounded-full flex flex-col items-center justify-between py-4 shadow-[5px_5px_15px_rgba(0,0,0,0.7)] relative">
                          <div className="absolute top-1 w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]" />
                          <div className="w-7 h-14 bg-gradient-to-b from-[#22c55e]/90 via-[#1e293b] to-[#3b82f6]/90 border border-slate-950 rounded mt-2 flex items-center justify-center p-1">
                            <span className="text-[6.5px] font-mono leading-none tracking-tight opacity-40 uppercase">cargo</span>
                          </div>
                          <div className="w-8 h-4 bg-slate-100 border border-slate-900 rounded-sm mb-1 shadow" />
                        </div>
                      </div>

                      {/* Pointer rotating Wind Arrow strictly matching live wind arah direction */}
                      <div 
                        className="absolute w-full h-full flex items-center justify-center transition-all duration-1000 ease-out pointer-events-none"
                        style={{ transform: `rotate(${currentData.windDirection}deg)` }}
                      >
                        {/* Orange-Red Gradient pointer trail & arrow */}
                        <div className="absolute top-[8px] bottom-[8px] w-[2.5px] bg-gradient-to-b from-rose-500 via-amber-500 to-transparent flex flex-col items-center">
                          {/* Pointer Head strictly pointing to ship */}
                          <div className="w-4 h-4 bg-rose-500 border border-white rounded mt-1.5 shadow-[0_0_12px_rgba(239,68,68,0.8)] rotate-45" />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* STARBOARD std side panel labels */}
                <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 text-center bg-[#0b1424]/90 border border-white/10 p-3 rounded-xl max-w-[150px] shadow-25 select-none font-sans">
                  <div className="text-[10px] font-black text-[#22c55e] uppercase tracking-wider mb-1">STARBOARD (Kan)</div>
                  <div className="text-[8px] text-slate-400 font-semibold">RIGHT VESSEL</div>
                </div>

              </div>

              {/* Angle display relative wind and wind digital specifications */}
              <div className="grid grid-cols-2 gap-4 items-center mb-6 max-w-md mx-auto bg-[#050a12]/70 p-3.5 rounded-2xl border border-white/5 text-center font-mono text-xs">
                <div className="border-r border-white/10 pr-2">
                  <span className="text-slate-400 uppercase text-[9px] tracking-wider block font-sans">Relative Wind</span>
                  <span className="text-sm font-extrabold text-[#00f0ff]">{relativeVesselWind.toFixed(0)}° Azimuth</span>
                </div>
                <div className="pl-2">
                  <span className="text-slate-400 uppercase text-[9px] tracking-wider block font-sans">Arah & Rose</span>
                  <span className="text-sm font-extrabold text-[#f59e0b]">{currentData.windDirection}° ({getWindRoseString(currentData.windDirection)})</span>
                </div>
              </div>

              {/* Bottom horizontal grid showing: Marine & Wind Data digital */}
              <div className="border border-[#00f0ff]/15 bg-gradient-to-b from-[#0b1424]/70 to-bg p-4.5 rounded-2xl relative">
                <div className="text-[9.5px] uppercase tracking-[0.25em] font-extrabold text-slate-300 mb-3 font-sans flex items-center justify-between">
                  <span>⚓ Marine & Wind Digital Indicators</span>
                  <span className="text-[8.5px] font-mono text-[#00f0ff]/50">ACC_SYS_01</span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Wind Dir</span>
                    <span className="text-base font-black font-mono text-[#00f0ff]">{currentData.windDirection}°</span>
                  </div>
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Wind Spd</span>
                    <span className="text-base font-black font-mono text-[#00f0ff]">{currentData.windSpeed.toFixed(1)} <span className="text-[8px] font-sans">m/s</span></span>
                  </div>
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Wave Ht.</span>
                    <span className="text-base font-black font-mono text-[#22c55e]">{currentData.waveHeight}m</span>
                  </div>
                  <div className="bg-[#050a12] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Water Lvl</span>
                    <span className="text-base font-black font-mono text-[#3b82f6]">{currentData.seaLevel.toFixed(1)}m</span>
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMN 3: RAIN, SOLAR & WIND ROSE ACC (3/12 on large screens) */}
            <div className="lg:col-span-3 flex flex-col space-y-6 h-full justify-between">
              
              {/* Rain group */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="text-[10.5px] font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  <span>Precipitation</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-[#0b1424] border-t-2 border-sky-400 border-x border-b border-white/5 rounded-xl p-3.5 flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Rain Rate</span>
                    <div className="text-right font-mono">
                      <span className="text-xl font-extrabold text-white">{currentData.rainfall.toFixed(1)}</span>
                      <span className="text-[8px] uppercase tracking-wider ml-1.5 text-sky-400 font-bold">MM/H</span>
                    </div>
                  </div>

                  <div className="bg-[#0b1424] border-t-2 border-sky-400 border-x border-b border-white/5 rounded-xl p-3.5 flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Accumulation</span>
                    <div className="text-right font-mono">
                      <span className="text-xl font-extrabold text-white">{rainAccum}</span>
                      <span className="text-[8px] uppercase tracking-wider ml-1.5 text-sky-400 font-bold">MM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Solar Irradiation group (compact and elegant) */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-[#f59e0b]/10 p-2 rounded-xl border border-[#f59e0b]/20">
                    <Sun className="w-4 h-4 text-[#f59e0b]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-[0.1em] block">Solar Radiation</span>
                    <span className="text-[8px] text-slate-400 font-mono">Irradiance</span>
                  </div>
                </div>
                <div className="text-right font-mono flex items-baseline gap-1 bg-[#0b1424] px-3.5 py-1.5 rounded-xl border border-white/5">
                  <span className="text-lg font-extrabold text-white">{currentData.solarRadiation}</span>
                  <span className="text-[8px] text-[#f59e0b] font-black uppercase">W/m²</span>
                </div>
              </div>

              {/* Sea Water Quality (pH Air) Indicator */}
              {(() => {
                const minPh = parseFloat(config.minPhThreshold || '6.5');
                const maxPh = parseFloat(config.maxPhThreshold || '8.5');
                const phValue = currentData.waterPh ?? 7.8;
                const isPhUnsafe = phValue < minPh || phValue > maxPh;
                
                return (
                  <div className={`bg-gradient-to-b from-[#0b1424]/40 to-bg p-4 rounded-2xl border transition-all ${isPhUnsafe ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse' : 'border-white/5'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border ${isPhUnsafe ? 'bg-amber-500/10 border-amber-500/20' : 'bg-pink-500/10 border-pink-500/20'}`}>
                        <Droplet className={`w-4 h-4 ${isPhUnsafe ? 'text-amber-400 font-bold' : 'text-pink-400'}`} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-[0.1em] block">Kualitas Air (pH)</span>
                        <span className="text-[8px] font-mono block leading-tight">
                          {isPhUnsafe ? (
                            <span className="text-amber-400 uppercase font-black tracking-wide">⚠️ BAHAYA: PH EKSTRIM!</span>
                          ) : phValue < 7.0 ? (
                            <span className="text-rose-400">Asam / Acidic</span>
                          ) : phValue > 8.5 ? (
                            <span className="text-pink-400 font-bold">Basa / Alkaline</span>
                          ) : (
                            <span className="text-emerald-400 font-bold">Ideal / Netral</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono flex items-baseline gap-1 bg-[#0b1424] px-3.5 py-1.5 rounded-xl border border-white/5">
                      <span className={`text-lg font-extrabold ${isPhUnsafe ? 'text-amber-400 animate-pulse' : 'text-pink-400'}`}>{phValue.toFixed(2)}</span>
                      <span className="text-[8px] text-pink-300 font-black uppercase">pH</span>
                    </div>
                  </div>
                );
              })()}

              {/* Pressure ATN group (compact & premium layout) */}
              <div className="bg-gradient-to-b from-[#0b1424]/40 to-bg p-4.5 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-2">
                    <Gauge className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pressure ATN Info</span>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center py-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">STN (Station)</span>
                      <span className="text-sm font-black font-mono text-[#00f0ff]">{currentData.pressure.toFixed(1)} <span className="text-[7.5px] font-sans text-slate-400">hPa</span></span>
                    </div>
                    <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">QFE (Elevation)</span>
                      <span className="text-sm font-black font-mono text-[#00f0ff]">{currentData.pressure.toFixed(1)} <span className="text-[7.5px] font-sans text-slate-400">hPa</span></span>
                    </div>
                    <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">QFF (Sea Lvl)</span>
                      <span className="text-sm font-black font-mono text-emerald-400">{(currentData.pressure + 2.1).toFixed(1)} <span className="text-[7.5px] font-sans text-slate-400">hPa</span></span>
                    </div>
                    <div className="bg-[#0b1424] border border-white/5 p-2 rounded-xl text-center">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">QNH (Std Atm)</span>
                      <span className="text-sm font-black font-mono text-emerald-400">{(currentData.pressure - 1.2).toFixed(1)} <span className="text-[7.5px] font-sans text-slate-400">hPa</span></span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* LOWER PORTION: DAILY WIND SPEED & WIND VECTOR ANALYSIS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            
            {/* Daily Wind speed chart (lg:col-span-7) */}
            <div className="lg:col-span-7 bg-gradient-to-b from-[#0b1424]/40 to-bg border border-white/5 p-5 rounded-3xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Wind className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Daily Wind Speed & Peak Tracker</span>
                </div>
                {/* Find daily wind speed peak time inside history */}
                {(() => {
                  let maxWind = 0;
                  let peakTime = 'N/A';
                  
                  history.slice(-48).forEach(row => {
                    if (row.windSpeed > maxWind) {
                      maxWind = row.windSpeed;
                      peakTime = format(row.timestamp, 'HH:mm');
                    }
                  });

                  return (
                    <span className="text-[10px] font-mono font-black text-rose-400 bg-rose-500/10 py-1 px-3 rounded border border-rose-500/20">
                      ⚡ PEAK: {maxWind.toFixed(1)} m/s at {peakTime} WIB
                    </span>
                  );
                })()}
              </div>

              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.slice(-24)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDailyWindSpd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                    <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f59e0b' }} labelFormatter={(val) => format(val, 'dd-MM-yyyy HH:mm')} />
                    <Area type="monotone" dataKey="windSpeed" name="Wind Speed (m/s)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDailyWindSpd)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Wind Vector shift visual compass plot (lg:col-span-5) */}
            <div className="lg:col-span-5 bg-gradient-to-b from-[#0b1424]/40 to-bg border border-white/5 p-5 rounded-3xl flex flex-col justify-between min-h-[300px]">
              <div>
                {/* Title */}
                <div className="text-[11px] font-bold text-[#00f0ff] uppercase tracking-widest flex justify-between items-center pb-2 border-b border-white/5 mb-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-[#00f0ff] animate-pulse" />
                    <span>Wind Vector Flow Path</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500">24H TRACE</span>
                </div>

                {/* Top Section Layout: Compass (left) & Info Stats Card (right) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
                  
                  {/* SVG circular grid for plotting wind vector trail */}
                  <div className="sm:col-span-6 flex justify-center">
                    <div className="relative w-[130px] h-[130px] rounded-full border border-white/10 flex items-center justify-center bg-[#050a12]/80 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]">
                      
                      {/* Outer & Inner markers */}
                      <span className="absolute top-1 text-[8px] font-bold text-slate-500">N</span>
                      <span className="absolute right-1 text-[8px] font-bold text-slate-500">E</span>
                      <span className="absolute bottom-1 text-[8px] font-bold text-slate-500">S</span>
                      <span className="absolute left-1 text-[8px] font-bold text-slate-500">W</span>

                      <div className="absolute w-10 h-10 rounded-full border border-white/5" />
                      <div className="absolute w-20 h-20 rounded-full border border-white/5 border-dashed" />
                      <div className="absolute w-[100px] h-[100px] rounded-full border border-white/10" />

                      {/* SVG vector arrow plot */}
                      <svg className="absolute w-full h-full pointer-events-none" viewBox="0 0 100 100">
                        {(() => {
                          const traceLogs = history.slice(-8);
                          if (traceLogs.length === 0) return null;

                          const points = traceLogs.map((log) => {
                            const angleRad = ((log.windDirection - 90) * Math.PI) / 180;
                            const radius = Math.min(42, Math.max(8, (log.windSpeed / 20) * 42));
                            const x = 50 + radius * Math.cos(angleRad);
                            const y = 50 + radius * Math.sin(angleRad);
                            return { x, y, speed: log.windSpeed, dir: log.windDirection };
                          });

                          return (
                            <>
                              <path 
                                d={`M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`} 
                                fill="none" 
                                stroke="url(#vectorTrailGrad)" 
                                strokeWidth={1.5} 
                                strokeDasharray="2 1"
                              />
                              
                              <defs>
                                <linearGradient id="vectorTrailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                                  <stop offset="50%" stopColor="#a855f7" stopOpacity={0.6} />
                                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={1} />
                                </linearGradient>
                              </defs>

                              {points.map((p, idx) => {
                                const isLast = idx === points.length - 1;
                                const arrowAngle = p.dir;
                                return (
                                  <g key={idx} transform={`translate(${p.x}, ${p.y}) rotate(${arrowAngle})`}>
                                    <circle r={isLast ? 2 : 1} fill={isLast ? '#00f0ff' : '#a855f7'} />
                                    <line 
                                      x1={0} 
                                      y1={0} 
                                      x2={0} 
                                      y2={-5} 
                                      stroke={isLast ? '#00f0ff' : '#6366f1'} 
                                      strokeWidth={isLast ? 1.5 : 1} 
                                    />
                                    <polyline 
                                      points="-1.5,-3.5 0,-5 1.5,-3.5" 
                                      fill="none" 
                                      stroke={isLast ? '#00f0ff' : '#6366f1'} 
                                      strokeWidth={isLast ? 1.5 : 1} 
                                    />
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>

                  {/* High Tech Vector Statistics Side Card */}
                  <div className="sm:col-span-6 space-y-1.5 text-[10px] font-sans">
                    <div className="bg-[#050a12]/70 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                      <span className="text-[7.5px] uppercase font-bold tracking-widest text-[#00f0ff]/80 block">Vector Statistics</span>
                      
                      <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                        <span className="text-slate-400">Avg Speed:</span>
                        <span className="font-extrabold text-white font-mono">
                          {(history.reduce((sum, h) => sum + h.windSpeed, 0) / Math.max(1, history.length)).toFixed(1)} <span className="text-[7px]">m/s</span>
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                        <span className="text-slate-400">Dominant:</span>
                        <span className="font-extrabold text-amber-400 font-mono">
                          {(() => {
                            const sectors = history.slice(-24).map(h => getWindRoseString(h.windDirection));
                            const occurrences: { [key: string]: number } = {};
                            let maxSector = 'N/A';
                            let maxCount = 0;
                            sectors.forEach(s => {
                              occurrences[s] = (occurrences[s] || 0) + 1;
                              if (occurrences[s] > maxCount) {
                                maxCount = occurrences[s];
                                maxSector = s;
                              }
                            });
                            return `${maxSector} (${maxCount}x)`;
                          })()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-0.5 text-[9px]">
                        <span className="text-slate-500 font-mono">SAMPLE RUN</span>
                        <span className="text-[#3b82f6] font-mono font-bold">{history.slice(-24).length} logs / 24H</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Bottom Section: Chronological sequence of latest 5 logs visually rendered as a horizontal track */}
              <div className="space-y-1.5 mt-3 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center text-[8.5px] text-slate-400 uppercase tracking-widest font-sans">
                  <span>Recent Wind Vectors (Sequence)</span>
                  <span className="text-[7.5px] font-mono text-[#00f0ff]/50">CHRONO FLOW ➡️</span>
                </div>
                
                <div className="grid grid-cols-5 gap-1.5">
                  {history.slice(-5).reverse().map((row, idx) => {
                    const directionName = getWindRoseString(row.windDirection);
                    return (
                      <div key={idx} className="bg-[#050a12] border border-white/5 p-1 rounded-lg text-center space-y-0.5 hover:border-[#00f0ff]/20 transition-all">
                        <span className="text-[7.5px] text-slate-500 font-mono block">{format(row.timestamp, 'HH:mm')}</span>
                        
                        {/* Interactive compass arrow visually rotated */}
                        <div className="flex justify-center py-0.5">
                          <Navigation 
                            className="w-3 h-3 text-[#00f0ff]" 
                            style={{ transform: `rotate(${row.windDirection}deg)` }}
                          />
                        </div>
                        
                        <div className="text-[9px] font-black text-slate-200">{directionName}</div>
                        <div className="text-[7.5px] font-mono font-bold text-amber-500 bg-amber-500/10 rounded-sm py-0.2">
                          {row.windSpeed.toFixed(0)} <span className="text-[6px]">m/s</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
          </>
        )}

        {/* PAGE tab 2: CHART ANALYST */}
        {activeTab === 'analyst' && (
          <div className="space-y-8">
            
            {/* Calendar filters & action panels */}
            <div className="bg-gradient-to-b from-[#0b1424] to-bg p-5 rounded-2xl border border-white/10 flex flex-wrap gap-5 items-end">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#00f0ff] tracking-wider block mb-2 font-sans">Start Analysis Date</label>
                <input 
                  type="date" 
                  value={dbStartDate}
                  onChange={(e) => setDbStartDate(e.target.value)}
                  className="bg-[#050a12] border border-white/10 text-white text-xs font-mono py-2 px-3.5 rounded-lg outline-none focus:border-[#00f0ff] transition" 
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#00f0ff] tracking-wider block mb-2 font-sans">End Analysis Date</label>
                <input 
                  type="date" 
                  value={dbEndDate}
                  onChange={(e) => setDbEndDate(e.target.value)}
                  className="bg-[#050a12] border border-white/10 text-white text-xs font-mono py-2 px-3.5 rounded-lg outline-none focus:border-[#00f0ff] transition" 
                />
              </div>
              <button 
                onClick={filterLogsData}
                className="bg-[#00f0ff] hover:bg-[#00d0f0] transition text-[#050a12] text-xs font-bold font-mono py-2.5 px-6 rounded-lg uppercase flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                REFRESH ANALYTICS DATA
              </button>
            </div>

            {/* Row of 3 charts containing: Temp, Hum, Solar */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Temp Area Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-[10.5px] uppercase font-bold text-[#00f0ff] tracking-[0.2em] font-sans pb-2 border-b border-white/5">
                  📈 Air Temperature History (°C)
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-25)}>
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
                <div className="text-[10.5px] uppercase font-bold text-[#22c55e] tracking-[0.2em] font-sans pb-2 border-b border-white/5">
                  📈 Relative Humidity History (%)
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-25)}>
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

              {/* Solar Radiation Spline Chart */}
              <div className="bg-gradient-to-b from-[#0b1424] to-bg border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-[10.5px] uppercase font-bold text-[#f59e0b] tracking-[0.2em] font-sans pb-2 border-b border-white/5">
                  📈 Solar Irradiance Acc. (W/m²)
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-25)}>
                      <defs>
                        <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="timestamp" tickFormatter={(val) => format(val, 'HH:mm')} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f59e0b' }} labelFormatter={(val) => format(val, 'dd/MM/yyyy HH:mm')} />
                      <Area type="monotone" dataKey="solarRadiation" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSolar)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* AI MARINE PORT FORECAST ENGINE (PURPLE GLOW HIGH CONTRAST BOX) */}
            <div className="border-[1.5px] border-purple-500/30 rounded-3xl p-6 bg-gradient-to-tr from-[#160f26] via-[#0b1424] to-bg relative shadow-[0_0_50px_rgba(168,85,247,0.15)] flex flex-col gap-6">
              
              <div className="absolute top-0 right-10 w-24 h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
              
              <div className="flex flex-col md:flex-row pb-4 border-b border-white/10 items-start md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-purple-400 uppercase tracking-[0.25em] flex items-center gap-2">
                    ⚡ AI MARINE PORT FORECAST ENGINE
                  </h4>
                  <p className="text-[9px] text-[#cbd5e1] font-mono mt-1 opacity-70">
                    Sistem Prediksi Real-Time Berdasarkan Live Momentum Sensor Versus Database Kemarin (60m Ahead)
                  </p>
                </div>
                <div className="bg-purple-900/40 border border-purple-500/30 font-mono text-[8px] font-bold py-1 px-4 tracking-widest text-[#e9d5ff] rounded">
                  ENGINE STATUS: AUTOMATIC_MOMENTUM
                </div>
              </div>

              {/* Rows of Forecast line charts containing: Wave, Wind & Safety Warning panel */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                
                {/* 1-Hour Wave Height Line Chart */}
                <div className="xl:col-span-4 bg-[#050a12]/70 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                  <div className="text-[10px] uppercase font-bold text-slate-300 tracking-[0.15em] mb-3 flex justify-between">
                    <span>🌊 Wave Height Forecast (m)</span>
                    <span className="text-[8px] font-mono text-purple-400">10m Steps</span>
                  </div>
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aiForecastResult.combinedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#a855f7' }} />
                        <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                        <Line type="monotone" dataKey="pastWave" name="Past" stroke="#0ea5e9" strokeWidth={2.5} dot={false} connectNulls />
                        <Line type="monotone" dataKey="futWave" name="Forecast" stroke="#a855f7" strokeWidth={3} strokeDasharray="5 5" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 1-Hour Wind Gust Line Chart */}
                <div className="xl:col-span-4 bg-[#050a12]/70 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                  <div className="text-[10px] uppercase font-bold text-slate-300 tracking-[0.15em] mb-3 flex justify-between">
                    <span>💨 Wind Force Forecast (m/s)</span>
                    <span className="text-[8px] font-mono text-purple-400">10m Steps</span>
                  </div>
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aiForecastResult.combinedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#0b1424', borderColor: '#f59e0b' }} />
                        <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                        <Line type="monotone" dataKey="pastWind" name="Past" stroke="#fbbf24" strokeWidth={2.5} dot={false} connectNulls />
                        <Line type="monotone" dataKey="futWind" name="Forecast" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Storm & Gale Threat Radar warning interactive block */}
                <div className={`xl:col-span-4 border rounded-2xl p-5 ${aiForecastResult.stormBg} flex flex-col justify-between text-center`}>
                  <div className="text-[10px] uppercase font-bold text-slate-200 tracking-[0.15em] mb-2 flex justify-between">
                    <span>⚠️ Storm & Gale Threat Radar</span>
                    <span className="text-[8.5px] font-mono opacity-50">STORM_RDR_05</span>
                  </div>

                  <div className="my-auto flex flex-col items-center justify-center py-4">
                    {/* Visual representation of radar danger: Gale wind spinner or boat */}
                    <div className={`text-6xl mb-3 tracking-wider ${aiForecastResult.stormPulse}`}>
                      {aiForecastResult.stormIcon}
                    </div>

                    {/* Threat indicator risk percent */}
                    <div className="text-3xl font-mono tracking-tighter text-white font-black drop-shadow" style={{ color: aiForecastResult.stormColor, textShadow: `0 0 20px ${aiForecastResult.stormColor}50` }}>
                      {aiForecastResult.stormProb}% Risk
                    </div>

                    {/* Standardised threat bar */}
                    <div className="w-4/5 h-2.5 bg-white/5 rounded-full overflow-hidden mt-4 relative">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${aiForecastResult.stormProb}%`, backgroundColor: aiForecastResult.stormColor, boxShadow: `0 0 10px ${aiForecastResult.stormColor}` }} 
                      />
                    </div>

                    {/* Human Weather Status indicator */}
                    <div 
                      className="border border-white/10 rounded-full font-mono text-[10px] py-1.5 px-6 font-black uppercase inline-block mt-4"
                      style={{ color: aiForecastResult.stormColor, borderColor: aiForecastResult.stormColor }}
                    >
                      {aiForecastResult.stormStatus}
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* PAGE tab 3: DATABASE LOG */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            
            {/* Real-time Custom Database Mode & XAMPP Integration Banner */}
            <div className="bg-gradient-to-r from-[#0a1b3a] to-[#041026] p-5 rounded-2xl border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.1)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">INTEGRATED DATABASE ENGINE (XAMPP & MariaDB)</h4>
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
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase font-mono tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {config.dbStorageMode === 'AVG' ? `⏱️ LOG BIND: ${config.dbStorageInterval} MIN AVG` : `📦 LOG BIND: ${config.dbStorageInterval} MIN RAW`}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase font-mono tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse">
                    XAMPP PHP_MY_ADMIN READY
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
                    <span className="text-[10px] uppercase tracking-wider font-black text-teal-400 font-mono">
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

                      // Asynchronously post to local XAMPP MariaDB script
                      postLogToLocalXampp(recordToSave);

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
                      showToastNotification(config.dbStorageMode === 'AVG' ? "Successfully forced calculation of average record!" : "Successfully forced raw instantaneous log commit!");
                    }}
                    disabled={sampleBuffer.length === 0}
                    className={`text-[9.5px] font-black uppercase py-2 px-3.5 rounded-lg border transition duration-250 cursor-pointer flex items-center gap-1.5 ${
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
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Layanan Status Sinkronisasi XAMPP</span>
                      <span className={`text-[8.5px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                        isDbConnected 
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}>
                        {isDbConnected ? '🟢 CONNECTED (LIVE)' : '🟡 STANDBY / NOT TESTED'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 mt-1 leading-normal max-w-[620px]">
                      {isDbConnected 
                        ? 'Koneksi ke database XAMPP lokal teruji aktif. Sinkronisasi data telemetri otomatis beroperasi di latar belakang.' 
                        : 'Menunggu pengujian koneksi. Klik tombol konfigurasi jika Anda ingin menyinkronkan data ke basis data lokal.'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setIsIntegratorOpen(true)}
                    className="w-full sm:w-auto text-[9.5px] font-black uppercase py-2.5 px-4 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 font-mono font-bold"
                  >
                    🔧 CONFIG DB INTEGRATOR
                  </button>
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
                        Konversikan telemetri langsung ke server basis data XAMPP Anda.
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
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-400">DATABASE INTEGRATOR & SETUP UTILITIES</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans max-w-[600px]">
                      Aplikasi berjalan di web browser. Browser tidak bisa langsung terhubung ke port MySQL lokal Anda (<code className="text-white font-mono bg-white/5 px-1 rounded">3306</code>) demi alasan keamanan sandboxing web. Gunakan salah satu metode di bawah ini untuk menghubungkannya secara mudah.
                    </p>
                  </div>
                  
                  {/* Selector Tabs */}
                  <div className="flex bg-[#050a12] p-1 border border-white/10 rounded-lg self-start md:self-auto">
                    <button
                      onClick={() => setDbScriptTab('sql')}
                      className={`text-[9.5px] px-3 py-1.5 rounded-md font-mono uppercase font-bold transition cursor-pointer ${
                        dbScriptTab === 'sql' 
                          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      📜 Manual SQL Script
                    </button>
                    <button
                      onClick={() => setDbScriptTab('php')}
                      className={`text-[9.5px] px-3 py-1.5 rounded-md font-mono uppercase font-bold transition cursor-pointer ${
                        dbScriptTab === 'php' 
                          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      ⚡ PHP Auto-Installer (Recommended)
                    </button>
                  </div>
                </div>

                {dbScriptTab === 'sql' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9.5px] font-mono text-slate-300 uppercase font-black">Metode Manual phpMyAdmin:</span>
                      <button 
                        onClick={() => {
                          const sqlText = `CREATE DATABASE IF NOT EXISTS db_pelabuhan_telemetry;\nUSE db_pelabuhan_telemetry;\n\nCREATE TABLE IF NOT EXISTS tbl_sensor_logs (\n    id INT AUTO_INCREMENT PRIMARY KEY,\n    station_id VARCHAR(50) NOT NULL,\n    timestamp DATETIME NOT NULL,\n    temperature DECIMAL(5,2) NOT NULL,\n    humidity INT NOT NULL,\n    solar_radiation INT NOT NULL,\n    rainfall DECIMAL(5,2) NOT NULL,\n    wave_height DECIMAL(4,2) NOT NULL,\n    sea_level DECIMAL(5,1) NOT NULL,\n    water_ph DECIMAL(4,2) NOT NULL,\n    wind_direction INT NOT NULL,\n    wind_speed DECIMAL(4,1) NOT NULL,\n    pressure DECIMAL(6,2) NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
                          navigator.clipboard.writeText(sqlText);
                          showToastNotification("SQL Query successfully copied to clipboard!");
                        }}
                        className="text-[9px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-bold uppercase px-3 py-1.5 rounded-lg border border-teal-500/20 transition cursor-pointer font-mono"
                      >
                        Copy SQL Script
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Copy query berikut dan paste langsung ke menu <strong>SQL</strong> di phpMyAdmin XAMPP Anda untuk membuat tabel secara manual.
                    </p>
                    <pre className="text-[9px] font-mono text-slate-400 p-3 bg-black/60 rounded-lg overflow-x-auto max-h-[160px] leading-relaxed select-all border border-white/5">
{`CREATE DATABASE IF NOT EXISTS db_pelabuhan_telemetry;
USE db_pelabuhan_telemetry;

CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id VARCHAR(50) NOT NULL,
    timestamp DATETIME NOT NULL, /* Start of the average-block / instant sample */
    temperature DECIMAL(5,2) NOT NULL,
    humidity INT NOT NULL,
    solar_radiation INT NOT NULL,
    rainfall DECIMAL(5,2) NOT NULL,
    wave_height DECIMAL(4,2) NOT NULL,
    sea_level DECIMAL(5,1) NOT NULL,
    water_ph DECIMAL(4,2) NOT NULL,
    wind_direction INT NOT NULL,
    wind_speed DECIMAL(4,1) NOT NULL,
    pressure DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`}
                    </pre>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-mono text-teal-400 uppercase font-black block">Metode Otomatis (1-Click Auto-Create Setup):</span>
                        <div className="text-[9px] text-slate-500 font-mono">
                          API URL: <span className="text-white font-bold">{config.localDbApiUrl || 'http://localhost/aws_marine/api.php'}</span>
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

$host = "localhost";
$username = "root";
$password = ""; // Default password kosong di XAMPP

try {
    $conn = new PDO("mysql:host=$host", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Auto-create database & table jika belum ada
    $conn->exec("CREATE DATABASE IF NOT EXISTS db_pelabuhan_telemetry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    $conn->exec("USE db_pelabuhan_telemetry;");

    $sql_table = "CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        station_id VARCHAR(50) NOT NULL,
        timestamp DATETIME NOT NULL,
        temperature DECIMAL(5,2) NOT NULL,
        humidity INT NOT NULL,
        solar_radiation INT NOT NULL,
        rainfall DECIMAL(5,2) NOT NULL,
        wave_height DECIMAL(4,2) NOT NULL,
        sea_level DECIMAL(5,1) NOT NULL,
        water_ph DECIMAL(4,2) NOT NULL,
        wind_direction INT NOT NULL,
        wind_speed DECIMAL(4,1) NOT NULL,
        pressure DECIMAL(6,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    
    $conn->exec($sql_table);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Setup Failed: " . $e->getMessage()]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);

    if (isset($data['station_id']) && isset($data['timestamp'])) {
        try {
            $stmt = $conn->prepare("INSERT INTO tbl_sensor_logs (
                station_id, timestamp, temperature, humidity, solar_radiation, 
                rainfall, wave_height, sea_level, water_ph, wind_direction, wind_speed, pressure
            ) VALUES (
                :station_id, :timestamp, :temperature, :humidity, :solar_radiation, 
                :rainfall, :wave_height, :sea_level, :water_ph, :wind_direction, :wind_speed, :pressure
            )");

            $stmt->execute([
                ':station_id' => $data['station_id'],
                ':timestamp' => $data['timestamp'],
                ':temperature' => $data['temperature'],
                ':humidity' => $data['humidity'],
                ':solar_radiation' => isset($data['solar_radiation']) ? $data['solar_radiation'] : 0,
                ':rainfall' => isset($data['rainfall']) ? $data['rainfall'] : 0.0,
                ':wave_height' => isset($data['wave_height']) ? $data['wave_height'] : 0.0,
                ':sea_level' => isset($data['sea_level']) ? $data['sea_level'] : 0.0,
                ':water_ph' => isset($data['water_ph']) ? $data['water_ph'] : 7.0,
                ':wind_direction' => isset($data['wind_direction']) ? $data['wind_direction'] : 0,
                ':wind_speed' => isset($data['wind_speed']) ? $data['wind_speed'] : 0.0,
                ':pressure' => isset($data['pressure']) ? $data['pressure'] : 1013.25
            ]);

            echo json_encode(["status" => "success", "message" => "Record logged successfully!"]);
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Insertion Failed: " . $e->getMessage()]);
            exit();
        }
    }
} else {
    echo json_encode([
        "status" => "success",
        "message" => "XAMPP Gateway active! Database 'db_pelabuhan_telemetry' and Table 'tbl_sensor_logs' successfully checked/constructed."
    ]);
}
?>`;
                            navigator.clipboard.writeText(phpCode);
                            showToastNotification("Automated PHP Hook successfully copied to clipboard!");
                          }}
                          className="text-xs bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] font-bold uppercase px-4 py-2.5 rounded-lg border border-[#00f0ff]/20 transition cursor-pointer font-mono flex items-center justify-center gap-1"
                        >
                          📋 Copy PHP Code
                        </button>
                        <button 
                          onClick={async () => {
                            const testUrl = config.localDbApiUrl || 'http://localhost/aws_marine/api.php';
                            showToastNotification("🔧 Menguji hubungan ke XAMPP...");
                            setDbTestResult({ status: 'loading', message: `Menghubungi endpoint lokal pada: ${testUrl}...`, details: 'Mengirimkan HTTP GET request ke web server Apache lokal Anda.' });
                            try {
                              const res = await fetch(testUrl, { method: 'GET' });
                              if (res.ok) {
                                const parsed = await res.json();
                                setIsDbConnected(true);
                                setDbTestResult({
                                  status: 'success',
                                  message: '🟢 KONEKSI DAN INISIALISASI DATABASE BERHASIL!',
                                  details: `${parsed.message || 'Server XAMPP merespon dengan OK.'}\nStatus: ${parsed.status || 'success'}`
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
                                return [...list, `[${ts} SQL ERROR] 🔴 TEST FAILED: Pastikan XAMPP Apache aktif & api.php diletakkan di htdocs/aws_marine/`].join('\n');
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
                          <div className="p-2.5 bg-black/60 rounded border border-white/5 mt-2 text-slate-300 text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto font-mono">
                            {dbTestResult.details}
                          </div>
                        )}
                        {dbTestResult.status === 'error' && (
                          <div className="mt-3 text-amber-300 text-[10.5px] leading-relaxed border-t border-red-500/15 pt-2 font-sans">
                            💡 <strong>PETUNJUK PENYELESAIAN MASALAH:</strong>
                            <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-300 text-xs">
                              <li>Apakah <strong>XAMPP Control Panel</strong> sudah dibuka di laptop Anda? Pastikan tombol <strong className="text-emerald-400">Apache</strong> dan <strong className="text-emerald-400">MySQL</strong> sudah dinyalakan sampai berwarna hijau.</li>
                              <li>Masukkan file <strong className="text-white">api.php</strong> di jalur direktori XAMPP lokal Anda: <code className="text-teal-300 bg-black/50 px-1 border border-white/5 font-mono text-xs">C:\xampp\htdocs\aws_marine\api.php</code>.</li>
                              <li>Gunakan URL API di setelan Settings: <code className="text-white bg-black/50 px-1 font-mono text-xs">{config.localDbApiUrl || 'http://localhost/aws_marine/api.php'}</code>.</li>
                              <li>Pastikan XAMPP berjalan di port standar (port 80). Jika menggunakan port custom (misal: 8080), sesuaikan URL anda menjadi <code className="text-white font-mono text-xs">http://localhost:8080/aws_marine/api.php</code>.</li>
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
// Kode Auto-Installer ini otomatis mengecek & membangun Database & Tabel pada kueri pertama Anda!
// Anda tidak perlu menulis query CREATE TABLE manual di phpMyAdmin.
?>`}
                    </pre>
                  </div>
                )}
              </div>
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
                      <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-[10px]">DateTime</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-[10px]">Temp (°C)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-[10px]">Hum (%)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-[#00f0ff] text-center text-[10px]">Rad (W/m²)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-[#22c55e] text-center text-[10px]">Wave (m)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-[#3b82f6] text-center text-[10px]">W-Level (m)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-pink-400 text-center text-[10px]">pH Air</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-amber-500 text-center text-[10px]">W-Dir (°)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-amber-500 text-center text-[10px]">W-Spd (m/s)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-sky-400 text-center text-[10px]">Rain (mm)</th>
                      <th className="p-3.5 uppercase font-bold tracking-widest text-slate-400 text-center text-[10px]">Press (hPa)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center uppercase tracking-widest text-slate-500 text-[10px]">
                          No logged matching rows found. Adjust criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-center border-r border-white/5 text-slate-300 font-sans">{format(item.timestamp, 'dd-MM-yyyy HH:mm:ss')}</td>
                          <td className="p-3 text-center border-r border-white/5 text-[#e0f2fe]">{item.temperature.toFixed(1)}</td>
                          <td className="p-3 text-center border-r border-white/5 text-[#e0f2fe]">{item.humidity}%</td>
                          <td className="p-3 text-center border-r border-white/5 text-[#f59e0b]">{item.solarRadiation}</td>
                          <td className="p-3 text-center border-r border-white/5 text-emerald-400 font-bold">{item.waveHeight.toFixed(2)}</td>
                          <td className="p-3 text-center border-r border-white/5 text-sky-400 text-right">{item.seaLevel.toFixed(1)}m</td>
                          <td className="p-3 text-center border-r border-white/5 text-pink-400 font-bold">{(item.waterPh ?? 7.80).toFixed(2)}</td>
                          <td className="p-3 text-center border-r border-white/5 text-[#e0f2fe]">{item.windDirection}°</td>
                          <td className="p-3 text-center border-r border-white/5 text-amber-400 font-bold">{item.windSpeed.toFixed(1)}</td>
                          <td className="p-3 text-center border-r border-white/5 text-[#38bdf8]">{item.rainfall.toFixed(1)}</td>
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
                      <span className="text-[10.5px] text-slate-400 font-mono block">Web Serial Control:</span>
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

                  <div>
                    <label className="text-xs md:text-xs uppercase font-bold text-teal-400 font-mono tracking-wider block mb-1.5">🕹️ Mode Simulasi Data</label>
                    <select 
                      value={config.isSimulationOn || 'ON'} 
                      onChange={(e) => setConfig({ ...config, isSimulationOn: e.target.value })}
                      className="w-full bg-[#050a12] border border-[#00f0ff]/20 font-mono text-xs md:text-sm p-3 text-sky-300 font-bold rounded-lg outline-none focus:border-[#00f0ff]"
                    >
                      <option value="ON">🟢 ON (Simulasi Otomatis Berjalan)</option>
                      <option value="OFF">🔴 OFF (Data Riil Mengandalkan Serial & Payload)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 font-sans mt-1 leading-normal">
                      Pilih <strong>OFF</strong> jika laptop Anda telah disambungkan ke sensor serial fisik atau gateway Moxa sesungguhnya.
                    </p>
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
                    <p className="text-[10px] text-slate-400 font-sans mt-1 leading-normal">
                      Sesuaikan skala ukuran teks untuk kenyamanan membaca di layar laptop Anda.
                    </p>
                  </div>

                  {/* Cloud Mode configs */}
                  <div className="border-t border-white/5 pt-3 space-y-3">
                    <div>
                      <label className="text-[8.5px] uppercase font-bold text-[#22c55e] tracking-wider block mb-1">Cloud Mode</label>
                      <select 
                        value={config.cloudMode}
                        onChange={(e) => setConfig({ ...config, cloudMode: e.target.value })}
                        className="w-full bg-[#050a12] border border-[#22c55e]/25 font-mono text-xs p-2 text-white rounded outline-none"
                      >
                        <option value="OFF">OFF</option>
                        <option value="HTTP">HTTP API</option>
                        <option value="FTP">FTP</option>
                        <option value="BOTH">BOTH (HTTP & FTP)</option>
                      </select>
                    </div>

                    {(config.cloudMode === 'HTTP' || config.cloudMode === 'BOTH') && (
                      <div className="space-y-1">
                        <label className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider block">HTTP API URL</label>
                        <input 
                          type="text" 
                          value={config.httpUrl}
                          onChange={(e) => setConfig({ ...config, httpUrl: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-xs text-left p-2 text-slate-300 rounded outline-none" 
                        />
                      </div>
                    )}

                    {(config.cloudMode === 'FTP' || config.cloudMode === 'BOTH') && (
                      <div className="space-y-2 p-3 bg-teal-950/20 border border-teal-500/20 rounded-lg">
                        <span className="text-[9px] font-black text-teal-400 font-mono block uppercase tracking-wider mb-1">📁 KREDENSIAL SERVER FTP</span>
                        
                        <div className="space-y-1">
                          <label className="text-[7.5px] uppercase font-bold text-slate-400 block font-mono">FTP Host / Server IP</label>
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
                            <label className="text-[7.5px] uppercase font-bold text-slate-400 block font-mono">FTP Username</label>
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
                  </div>

                  {/* Water pH Threshold configs */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <label className="text-xs uppercase font-bold text-pink-400 tracking-wider block font-mono mb-1">
                      🧪 Water pH Alarm Limits
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] md:text-xs text-slate-400 uppercase font-mono block mb-1">Min Safe (Acid)</span>
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
                        <span className="text-[10px] md:text-xs text-slate-400 uppercase font-mono block mb-1">Max Safe (Alkali)</span>
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

                  {/* Database Storage custom configurations */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <label className="text-[8.5px] uppercase font-bold text-teal-400 tracking-wider block">
                      📁 Database Archiving & Storage Settings
                    </label>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[7.5px] text-slate-400 uppercase font-mono block mb-1">Database Storage Mode</span>
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
                        <span className="text-[7.5px] text-slate-400 uppercase font-mono block mb-1">Averaging & Logging Interval ({config.dbStorageInterval || 10} Minutes)</span>
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
                        <p className="text-[8px] text-slate-500 font-mono mt-1 leading-normal">
                          Configure storage frequency: commits data from 1 to 60 minutes per log row.
                        </p>
                      </div>

                      {/* Local database API URL */}
                      <div>
                        <span className="text-[7.5px] text-slate-400 uppercase font-mono block mb-1">Local XAMPP Database API Endpoint (PHP API Link)</span>
                        <input 
                          type="text" 
                          value={config.localDbApiUrl || ''} 
                          placeholder="http://localhost/aws_marine/api.php"
                          onChange={(e) => setConfig({ ...config, localDbApiUrl: e.target.value })}
                          className="w-full bg-[#050a12] border border-white/10 font-mono text-xs p-2 text-teal-400 rounded outline-none text-left"
                        />
                        <p className="text-[8px] text-slate-500 font-mono mt-1 leading-tight">
                          Alamat file <code className="text-slate-400 bg-white/5 px-0.5 rounded">api.php</code> di htdocs XAMPP Anda. Berguna untuk sinkronisasi otomatis.
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
                        className="w-full bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 font-mono text-[9px] font-bold text-teal-300 p-2.5 rounded-lg transition text-center uppercase cursor-pointer"
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
                    <span className="text-[8.5px] uppercase tracking-wider text-[#00f0ff] font-bold block mb-1">Date Time Index</span>
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
                    <span className="text-[8.5px] uppercase tracking-wider text-[#00f0ff] font-bold block mb-1">Station ID Index</span>
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
                <div className="text-[11px] font-bold text-[#00f0ff] uppercase tracking-widest mb-6 pb-2 border-b border-white/5">
                  🕹️ Sensor Channel Mapping Indexes
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Air Temp', key: 'ch_0', color: '#4ade80', source: currentData.temperature.toFixed(1) + ' °C' },
                    { label: 'Temp Avg', key: 'ch_2', color: '#4ade80', source: tempStats.avg + ' °C' },
                    { label: 'Temp Max', key: 'ch_4', color: '#f87171', source: tempStats.max + ' °C' },
                    { label: 'Temp Min', key: 'ch_6', color: '#22d3ee', source: tempStats.min + ' °C' },
                    { label: 'Humidity', key: 'ch_8', color: '#00f0ff', source: currentData.humidity + ' %' },
                    { label: 'Dew Point', key: 'ch_12', color: '#00f0ff', source: computeDewPoint(currentData.temperature, currentData.humidity) + ' °C' },
                    { label: 'Rain Rate', key: 'ch_1', color: '#38bdf8', source: currentData.rainfall.toFixed(1) + ' mm/h' },
                    { label: 'Rain Acc.', key: 'ch_3', color: '#38bdf8', source: rainAccum + ' mm' },
                    { label: 'Solar Rad.', key: 'ch_5', color: '#f59e0b', source: currentData.solarRadiation + ' W/m²' },
                    { label: 'Wave Ht.', key: 'ch_14', color: '#3b82f6', source: currentData.waveHeight + ' m' },
                    { label: 'Water Lvl', key: 'ch_15', color: '#3b82f6', source: currentData.seaLevel.toFixed(1) + ' m' },
                    { label: 'Wind Dir', key: 'ch_16', color: '#fbbf24', source: currentData.windDirection + ' °' },
                    { label: 'Wind Spd', key: 'ch_17', color: '#fbbf24', source: currentData.windSpeed.toFixed(1) + ' m/s' },
                    { label: 'Pres QFE', key: 'ch_9', color: '#94a3b8', source: currentData.pressure.toFixed(1) + ' hPa' },
                    { label: 'Pres QFF', key: 'ch_11', color: '#94a3b8', source: (currentData.pressure + 2.1).toFixed(1) + ' hPa' },
                    { label: 'Pres QNH', key: 'ch_13', color: '#94a3b8', source: (currentData.pressure - 1.2).toFixed(1) + ' hPa' },
                    { label: 'Pres STN', key: 'ch_7', color: '#94a3b8', source: currentData.pressure.toFixed(1) + ' hPa' },
                    { label: 'Water pH', key: 'ch_18', color: '#f5d0fe', source: (currentData.waterPh ?? 7.80).toFixed(2) }
                  ].map((sensor, s_idx) => (
                    <div key={s_idx} className="bg-[#050a12]/70 border border-white/5 p-3 rounded-lg flex flex-col justify-between gap-1">
                      <span className="text-[8.5px] uppercase font-mono tracking-wider font-extrabold text-slate-400 block">{sensor.label} ({sensor.key})</span>
                      <div className="flex gap-2 items-center">
                        <select 
                          value={config.sensors[sensor.key as keyof typeof config.sensors]}
                          onChange={(e) => {
                            const updatedSensors = { ...config.sensors, [sensor.key]: e.target.value };
                            setConfig({ ...config, sensors: updatedSensors });
                          }}
                          className="bg-[#050a12] border border-white/10 font-mono text-[9px] w-[50px] text-white p-1 rounded outline-none"
                        >
                          <option value="OFF">OFF</option>
                          {[...Array(25)].map((_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                        <div className="flex-1 bg-[#010306] border border-white/5 py-1 px-2 rounded font-mono text-[10px] text-center font-black truncate" style={{ color: sensor.color }}>
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
                      'ch_12': '6',  // Dew point is computed
                      'ch_1': 'OFF', // Rain rate not mapped
                      'ch_3': 'OFF', // Rain acc. not mapped
                      'ch_5': '12',  // Solar Rad
                      'ch_14': 'OFF',// Wave Height not mapped
                      'ch_14_label': 'OFF',
                      'ch_15': '17', // Water Level (m)
                      'ch_16': '5',  // Wind Dir (WD_meas)
                      'ch_17': '3',  // Wind Spd (WS_meas)
                      'ch_7': '10',  // Pres STN
                      'ch_9': '10',  // Pres QFE
                      'ch_11': '10', // Pres QFF
                      'ch_13': '10', // Pres QNH
                      'ch_18': '18'  // Water pH (PH_meas)
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

                {/* Scrolling Raw Stream Monitor positioned directly below the Presets button */}
                <div className="col-span-2 bg-[#020408] border border-[#22c55e]/40 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between mt-2">
                  <div className="bg-gradient-to-r from-slate-900 to bg p-3 border-b border-[#22c55e]/25 text-xs uppercase font-mono font-bold text-[#c2fcd5] flex justify-between items-center">
                    <span>📟 Raw Stream Monitor</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <textarea 
                    readOnly 
                    value={streamLogs}
                    className="w-full h-44 bg-[#010306] border-none text-xs font-mono leading-relaxed p-4 text-emerald-400 outline-none resize-none"
                    placeholder="Menunggu stream data dari sensor..."
                  />
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Decorative subtle console metadata footer */}
      <footer className="fixed bottom-3 right-6 pointer-events-none opacity-20 flex flex-col items-end gap-0.5">
        <span className="text-[7.5px] font-mono tracking-widest text-[#00f0ff] uppercase">RMS SYS STN: CONNECTED SECURE</span>
        <span className="text-[7.5px] font-mono tracking-widest text-slate-500">UTC: 2026-06-06 UTC+7 LOCAL SYSTEM</span>
      </footer>
    </div>
  );
}
