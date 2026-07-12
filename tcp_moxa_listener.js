/**
 * DAEMON SERVICE: MOXA TCP/IP GATEWAY CLIENT TO POSTGRESQL BRIDGE (WITH SOCKET.IO BROADCAST)
 * File: C:\MARITIME-OS-main\MARITIME-OS-main\tcp_moxa_listener.js
 * 
 * METODE REAL-TIME BARU (SANGAT STABIL & BEBAS BLOKIR CORS):
 * - Script ini mendirikan Web & WebSocket Server di port 8080 menggunakan Express + Socket.IO.
 * - Menghubungkan secara langsung diri ke MOXA (TCP Server).
 * - Saat data wireless masuk, data didecode secara presisi lalu disiarkan (emit) langsung ke React Dashboard lewat Socket.IO.
 * - Koneksi status juga di-emit secara live sehingga status "CONNECTED" tampil instan & akurat di layar.
 * - Tetap memompa/menyimpan data hasil parser ke api.php (PostgreSQL database) agar riwayat grafik Dashboard tetap terisi otomatis.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import net from 'net';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// ==================== CONFIGURATION ====================
// Alamat database PHP lokal Anda (Default Standalone PHP: http://localhost:8000/api.php)
const API_URL = process.argv[2] || 'http://localhost:8000/api.php';

// IP & Port Moxa (Dapat langsung ditulis di baris perintah sebagai override):
// FORMAT: node tcp_moxa_listener.js [API_URL] [MOXA_IP] [MOXA_PORT]
let MOXA_IP = process.argv[3] || '172.16.4.48'; 
let MOXA_PORT = parseInt(process.argv[4]) || 5001;          
const RECONNECT_INTERVAL = 5000; // Coba menyambung kembali setiap 5 detik jika putus
const WEB_IO_PORT = 8080; // Port Web Server + Socket.IO lokal
// =======================================================

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Mengizinkan semua koneksi dashboard termasuk Web Preview & Localhost
        methods: ["GET", "POST"]
    }
});

console.log(`==================================================================`);
console.log(`          AWS MARITIME TELEMETRY TCP CLIENT FOR MOXA GATEWAY`);
console.log(`          [MODE SOCKET.IO]: Menyediakan data real-time di port ${WEB_IO_PORT}`);
console.log(`==================================================================`);
console.log(`Target API URL      : ${API_URL}`);
console.log(`Socket.IO Server URL: http://localhost:${WEB_IO_PORT}`);
console.log(`==================================================================\n`);

let client = null;
let reconnectTimer = null;
let connectTimeoutTimer = null;
let isFetchingConfig = false;
let isTcpConnecting = false;
let dataBuffer = ''; // Penyangga byte stream
let currentReconnectInterval = RECONNECT_INTERVAL;
let lastStatus = {
    connected: false,
    moxa_ip: MOXA_IP,
    moxa_port: MOXA_PORT,
    state: 'DISCONNECTED',
    error: 'Initializing daemon...'
};

// Pengaturan Penyimpanan Database Lokal PostgreSQL via api.php
let dbStorageInterval = 10; // Default: 10 menit. 0 = Instan.
let dbStorageMode = 'AVG'; // Default: AVG. RAW = Mentah.
let sampleBuffer = [];
let lastDbSaveTime = Date.now();

// Parser URL cerdas untuk posting database (Mendukung http dan https)
function parseUrlConfig(targetUrl) {
    try {
        const parsed = new URL(targetUrl);
        return {
            protocol: parsed.protocol || 'http:',
            hostname: parsed.hostname || 'localhost',
            port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search
        };
    } catch (e) {
        return { protocol: 'http:', hostname: 'localhost', port: 80, path: '/aws_marine/api.php' };
    }
}

// Helper untuk melakukan request HTTP/HTTPS secara cerdas
function makeRequest(targetUrl, options, callback, bodyData = null) {
    const apiParts = parseUrlConfig(targetUrl);
    const clientLib = apiParts.protocol === 'https:' ? https : http;
    
    const reqOptions = {
        hostname: apiParts.hostname,
        port: apiParts.port,
        path: options.path || apiParts.path,
        method: options.method || 'GET',
        headers: options.headers || {}
    };

    if (bodyData) {
        reqOptions.headers['Content-Type'] = 'application/json';
        reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = clientLib.request(reqOptions, callback);
    req.on('error', (err) => {
        if (options.onError) {
            options.onError(err);
        }
    });

    if (bodyData) {
        req.write(bodyData);
    }
    req.end();
}

// Menyiarkan status terbaru ke seluruh klien Socket.IO & mengabari api.php
function broadcastStatus(connected, stateLabel, errorMsg = '') {
    lastStatus = {
        connected: connected,
        moxa_ip: MOXA_IP,
        moxa_port: MOXA_PORT,
        state: stateLabel,
        last_seen: new Date().toLocaleTimeString('id-ID'),
        error: errorMsg
    };

    // Emit live status ke browser client lewat WebSockets
    io.emit('statusUpdate', lastStatus);

    // Kirim juga ke database PHP lokal (agar kompatibel penuh dengan php internal status)
    updateStatusOnPhpServer(connected, stateLabel, errorMsg);
}

// Fungsi pembantu murni mengirim status ke PHP API
function updateStatusOnPhpServer(connected, stateLabel, errorMsg) {
    const statusPayload = {
        action: 'save_moxa_status',
        connected: connected,
        moxa_ip: MOXA_IP,
        moxa_port: MOXA_PORT,
        state: stateLabel,
        error: errorMsg
    };
    
    const dataString = JSON.stringify(statusPayload);
    makeRequest(API_URL, {
        method: 'POST',
        onError: () => {}
    }, () => {}, dataString);
}

// Helper untuk menerjemahkan error TCP umum ke bahasa Indonesia yang mudah dimengerti pengguna
function getFriendlyErrorMessage(err) {
    if (!err) return '';
    const msg = err.message || String(err);
    if (msg.includes('ECONNREFUSED')) {
        return `Koneksi ditolak (${msg}). Pastikan Moxa sudah diatur sebagai "TCP Server" dan port ${MOXA_PORT} sudah benar. Moxa hanya mengizinkan SATU koneksi TCP aktif. Pastikan tidak ada program lain (seperti daemon moxa ganda, HyperTerminal, atau Putty) yang sedang tersambung ke Moxa ini.`;
    }
    if (msg.includes('ETIMEDOUT') || msg.includes('TIMEOUT')) {
        return `Batas waktu koneksi habis (${msg}). Periksa jaringan fisik ke Moxa, pastikan Moxa menyala, kabel LAN terpasang kencang, dan IP PC satu segmen (subnet) dengan Moxa.`;
    }
    if (msg.includes('EHOSTUNREACH')) {
        return `Host tidak terjangkau (${msg}). Komputer tidak dapat menemukan jalur ke IP Moxa. Periksa konfigurasi IP PC Anda, pastikan segmen IP sama (misal: PC 172.16.4.10 dan Moxa 172.16.4.48).`;
    }
    if (msg.includes('EADDRNOTAVAIL')) {
        return `Alamat IP tidak valid (${msg}). Alamat IP Moxa ${MOXA_IP} tidak dapat digunakan. Periksa kembali penulisan IP di Pengaturan Dashboard.`;
    }
    if (msg.includes('ENOTFOUND')) {
        return `IP atau Host tidak ditemukan (${msg}). Pastikan IP yang dimasukkan adalah alamat IP yang valid, bukan nama COM port seperti COM3 (COM port hanya digunakan untuk mode SERIAL, gunakan IP seperti 172.16.4.48 untuk MOXA_TCP).`;
    }
    return msg;
}

// Ambil konfigurasi paling update dari database
let hasInitializedFromArgs = false;

function syncConfigAndConnect() {
    // Jika user menentukan IP & Port lewat parameter baris perintah (Command Line / BAT file),
    // kita kunci nilai tersebut agar tidak pernah tertimpa oleh database api.php atau Express.
    if (process.argv[3] && process.argv[4]) {
        MOXA_IP = process.argv[3];
        MOXA_PORT = parseInt(process.argv[4]) || 4001;
        if (!hasInitializedFromArgs) {
            console.log(`[${new Date().toISOString()}] 🚀 [STATIC OVERRIDE]: Mengunci IP Moxa: ${MOXA_IP} | Port Moxa: ${MOXA_PORT} (Sesuai Parameter BAT!)`);
            hasInitializedFromArgs = true;
        }
        connectToMoxa();
        return;
    }

    if (isFetchingConfig) return;
    isFetchingConfig = true;

    console.log(`[${new Date().toISOString()}] 🔍 Mengambil konfigurasi IP & Port dari database via api.php...`);
    
    const apiParts = parseUrlConfig(API_URL);
    const moxaConfigPath = apiParts.path + (apiParts.path.includes('?') ? '&' : '?') + 'get_moxa_config=1';

    makeRequest(API_URL, {
        path: moxaConfigPath,
        method: 'GET',
        onError: (err) => {
            console.warn(`[${new Date().toISOString()}] ⚠️ Server PHP API Offline. Menggunakan IP: ${MOXA_IP} | Port: ${MOXA_PORT}`);
            isFetchingConfig = false;
            connectToMoxa();
        }
    }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode === 200 && body.trim().startsWith('{')) {
                    const config = JSON.parse(body);
                    if (config) {
                        if (config.moxa_ip) {
                            MOXA_IP = config.moxa_ip;
                            MOXA_PORT = parseInt(config.moxa_port) || 4001;
                            console.log(`[${new Date().toISOString()}] ⚙️ [CONFIG SYNC]: IP Moxa : ${MOXA_IP} | Port Moxa : ${MOXA_PORT} (Sesuai Database!)`);
                        }
                        if (config.db_storage_interval !== undefined) {
                            dbStorageInterval = parseInt(config.db_storage_interval);
                            console.log(`[${new Date().toISOString()}] ⚙️ [CONFIG SYNC]: DB Storage Interval : ${dbStorageInterval} Menit`);
                        }
                        if (config.db_storage_mode) {
                            dbStorageMode = config.db_storage_mode;
                            console.log(`[${new Date().toISOString()}] ⚙️ [CONFIG SYNC]: DB Storage Mode : ${dbStorageMode}`);
                        }
                    }
                } else {
                    console.log(`[${new Date().toISOString()}] ⚠️ Respon API tidak valid, menggunakan IP: ${MOXA_IP} | Port: ${MOXA_PORT}`);
                }
            } catch (err) {
                console.log(`[${new Date().toISOString()}] ⚠️ Gagal mengurai respon api.php, menggunakan IP: ${MOXA_IP} | Port: ${MOXA_PORT}`);
            }
            isFetchingConfig = false;
            connectToMoxa();
        });
    });
}

function connectToMoxa() {
    if (isTcpConnecting) return;
    isTcpConnecting = true;

    console.log(`[${new Date().toISOString()}] 🔌 [DIALING] Menghubungkan ke MOXA Server di ${MOXA_IP}:${MOXA_PORT}...`);
    broadcastStatus(false, 'DIALING', `Menghubungkan ke ${MOXA_IP}:${MOXA_PORT}`);

    if (client) {
        try { client.destroy(); } catch (e) {}
    }

    if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer);
    connectTimeoutTimer = setTimeout(() => {
        if (isTcpConnecting) {
            console.warn(`[${new Date().toISOString()}] ⚠️ [HANDSHAKE TIMEOUT] Gagal terhubung ke Moxa (Handshake Timeout setelah 15 detik)`);
            isTcpConnecting = false;
            broadcastStatus(false, 'TIMEOUT', 'Batas waktu koneksi habis (Moxa Offline / Handshake Timeout)');
            try { client.destroy(); } catch (e) {}
        }
    }, 15000);

    client = new net.Socket();
    
    // Enable TCP Keep-Alives to detect broken physical connection quickly
    client.setKeepAlive(true, 5000); // Send TCP probes every 5 seconds
    
    // Set 15-second initial connect handshake timeout
    client.setTimeout(15000);

    client.on('timeout', () => {
        if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer);
        console.warn(`[${new Date().toISOString()}] ⚠️ [TCP TIMEOUT] Batas waktu koneksi/data Moxa terlampaui (${MOXA_IP}:${MOXA_PORT})!`);
        broadcastStatus(false, 'TIMEOUT', 'Batas waktu koneksi habis (Moxa Offline)');
        client.destroy(); // Destroys socket, triggering 'close' event
    });

    client.connect(MOXA_PORT, MOXA_IP, () => {
        if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer);
        isTcpConnecting = false;
        console.log(`[${new Date().toISOString()}] 🟢 [CONNECTED] Sukses tersambung ke Moxa!`);
        dataBuffer = '';
        currentReconnectInterval = RECONNECT_INTERVAL; // Reset jeda reconnect ke default (5 detik)
        
        // Disable inactivity timeout once connected, to prevent silence from triggering a disconnect
        client.setTimeout(0);
        
        broadcastStatus(true, 'CONNECTED', '');
    });

    client.on('data', (data) => {
        dataBuffer += data.toString();

        // Mengurai byte stream yang masuk secara linear berdasarkan batasan ganti baris (\n)
        let boundary = dataBuffer.indexOf('\n');
        while (boundary !== -1) {
            const rawPayload = dataBuffer.slice(0, boundary).trim();
            dataBuffer = dataBuffer.slice(boundary + 1);
            boundary = dataBuffer.indexOf('\n');

            if (rawPayload) {
                processRawPayload(rawPayload);
            }
        }
    });

    client.on('close', () => {
        if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer);
        isTcpConnecting = false;
        console.log(`[${new Date().toISOString()}] 🔴 [DISCONNECTED] Koneksi ke MOXA terputus!`);
        broadcastStatus(false, 'DISCONNECTED', 'Koneksi terputus');
        scheduleReconnect();
    });

    client.on('error', (err) => {
        if (connectTimeoutTimer) clearTimeout(connectTimeoutTimer);
        isTcpConnecting = false;
        const friendlyMsg = getFriendlyErrorMessage(err);
        console.error(`[${new Date().toISOString()}] ❌ [TCP ERROR]: ${err.message}\n💡 Solusi: ${friendlyMsg}`);
        broadcastStatus(false, 'ERROR', friendlyMsg);
        if (client) {
            client.destroy();
        }
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const retrySeconds = currentReconnectInterval / 1000;
    const reconnectMsg = `Menjadwalkan koneksi ulang (reconnect) ke Moxa di IP ${MOXA_IP}:${MOXA_PORT} dalam ${retrySeconds} detik...`;
    console.log(`[${new Date().toISOString()}] ⏱️ [RECONNECT] ${reconnectMsg}`);
    
    // Kirim status bahwa daemon sedang masa jeda untuk mencoba menghubungkan kembali ke IP & Port tersebut
    broadcastStatus(false, 'RECONNECTING', `Sedang menjadwalkan koneksi ulang ke ${MOXA_IP}:${MOXA_PORT} dalam ${retrySeconds} detik...`);

    reconnectTimer = setTimeout(() => {
        syncConfigAndConnect();
    }, currentReconnectInterval);

    // Tingkatkan jeda reconnect (exponential backoff) secara bertahap hingga maks 30 detik
    // Ini memberi waktu bagi MOXA untuk membersihkan koneksi zombie lama yang menggantung (half-open)
    currentReconnectInterval = Math.min(currentReconnectInterval * 1.5, 30000);
}

// Memproses payload mentah dari MOXA (Format Semicolon ';')
function processRawPayload(rawPayload) {
    console.log(`[${new Date().toISOString()}] 📥 [RAW DATA]: "${rawPayload}"`);

    // Emit data asli (raw update) via socket io ke klien-klien yang mendengarkan
    io.emit('rawTelemetry', {
        timestamp: new Date().toLocaleTimeString('id-ID'),
        data: rawPayload
    });

    postRawTelemetryToExpress(rawPayload);

    const tokens = rawPayload.split(';');

    if (tokens.length < 21) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER ERROR] Skenario token tidak valid (${tokens.length} tokens).`);
        return;
    }

    try {
        const stationId = tokens[0] || 'AWS001';
        let datePart = tokens[1] || ''; // DD-MM-YYYY
        let timePart = tokens[2] || ''; // HH:mm:ss
        
        let formattedTimestamp = '';
        if (datePart && timePart) {
            if (datePart.includes('-')) {
                const dates = datePart.split('-');
                if (dates.length === 3) {
                    if (dates[0].length === 4) {
                        formattedTimestamp = `${datePart} ${timePart}`;
                    } else {
                        formattedTimestamp = `${dates[2]}-${dates[1]}-${dates[0]} ${timePart}`;
                    }
                }
            }
        }
        if (!formattedTimestamp) {
            const d = new Date();
            const pad = (n) => n.toString().padStart(2, '0');
            formattedTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        const rawSea = parseFloat(tokens[17]) || 120.0;
        const seaLevel = rawSea < 20 ? rawSea * 100 : rawSea;

        const mappedRecord = {
            station_id: stationId,
            timestamp: formattedTimestamp,
            temperature: parseFloat(tokens[6]) || 28.0,
            humidity: parseInt(tokens[9]) || 80,
            solar_radiation: parseInt(tokens[12]) || 0,
            rainfall: parseFloat(tokens[20]) || 0.0, 
            wave_height: 1.10, 
            sea_level: seaLevel,
            water_ph: parseFloat(tokens[18]) || 7.0,
            wind_direction: parseInt(parseFloat(tokens[5])) || 0,
            wind_speed: parseFloat(tokens[3]) || 0.0,
            pressure: parseFloat(tokens[10]) || 1013.25
        };

        console.log(`[${new Date().toISOString()}] ⚙️ [PARSED OK]: Temp=${mappedRecord.temperature}°C, WS=${mappedRecord.wind_speed} m/s, WD=${mappedRecord.wind_direction}°, pH=${mappedRecord.water_ph}`);

        // 1. Emit live parsed telemetry ke React UI via Socket.io secara instan
        io.emit('dataUpdate', mappedRecord);

        postTelemetryToExpress(mappedRecord);

        // 2. Simpan ke database lokal PostgreSQL via api.php mematuhi dbStorageInterval & dbStorageMode
        const now = Date.now();
        const intervalMs = dbStorageInterval * 60 * 1000;

        if (dbStorageInterval === 0) {
            // Instant Logging: Simpan langsung seketika!
            console.log(`[${new Date().toISOString()}] 🚀 [INSTANT LOGGING] Menyimpan data langsung ke database PostgreSQL via api.php...`);
            postToPhpGateway(mappedRecord);
            lastDbSaveTime = now;
            sampleBuffer = [];
        } else {
            const currentBlock = Math.floor(now / intervalMs);
            const lastSaveBlock = Math.floor(lastDbSaveTime / intervalMs);

            if (currentBlock > lastSaveBlock) {
                // Saatnya kompilasi rata-rata / raw dan simpan!
                lastDbSaveTime = currentBlock * intervalMs;
                const updated = [...sampleBuffer, mappedRecord];
                let recordToSave;
                let logMsg = '';

                if (dbStorageMode === 'AVG') {
                    recordToSave = calculateAverageDaemonRecord(updated);
                    logMsg = `Menyimpan composite average standar WMO ${dbStorageInterval} menit berdasarkan ${updated.length} sampel ke database.`;
                } else {
                    // RAW mode: Ambil sampel instan terakhir dengan hembusan angin tertinggi
                    const gusts = [];
                    for (let i = 0; i < updated.length; i++) {
                        const last3 = updated.slice(Math.max(0, i - 2), i + 1);
                        const rawSpeeds = last3.map(item => item.wind_speed);
                        const maxS = Math.max(...rawSpeeds);
                        const minS = Math.min(...rawSpeeds);
                        if (maxS - minS >= 10) {
                            gusts.push(parseFloat(maxS.toFixed(1)));
                        }
                    }
                    const highestGust = gusts.length > 0 ? Math.max(...gusts) : undefined;
                    
                    recordToSave = {
                        ...mappedRecord,
                        wind_gust: highestGust
                    };
                    logMsg = `Menyimpan data instan mentah interval ${dbStorageInterval} menit ke database.`;
                }

                if (recordToSave) {
                    // Format timestamp agar presisi di batas interval
                    const d = new Date(currentBlock * intervalMs);
                    const pad = (n) => n.toString().padStart(2, '0');
                    recordToSave.timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

                    console.log(`[${new Date().toISOString()}] ⏱️ [INTERVAL LOGGING] ${logMsg}`);
                    postToPhpGateway(recordToSave);
                }
                sampleBuffer = [];
            } else {
                // Buffer sampel
                sampleBuffer.push(mappedRecord);
            }
        }

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER CRASH] Gagal mengolah payload: ${err.message}`);
    }
}

// Menghitung Rata-rata Komposit Standar WMO di Sisi Daemon
function calculateAverageDaemonRecord(buffer) {
    if (buffer.length === 0) return null;
    
    const count = buffer.length;
    let sumTemp = 0;
    let sumHum = 0;
    let sumSpeed = 0;
    let sumPress = 0;
    let sumSolar = 0;
    let sumRain = 0;
    let sumWave = 0;
    let sumSea = 0;
    let sumPh = 0;
    
    let sinSum = 0;
    let cosSum = 0;
    
    buffer.forEach(item => {
        sumTemp += item.temperature;
        sumHum += item.humidity;
        sumSpeed += item.wind_speed;
        sumPress += item.pressure;
        sumSolar += item.solar_radiation;
        sumRain += item.rainfall;
        sumWave += item.wave_height;
        sumSea += item.sea_level;
        sumPh += item.water_ph;
        
        const rad = (item.wind_direction * Math.PI) / 180;
        sinSum += Math.sin(rad);
        cosSum += Math.cos(rad);
    });
    
    let avgDirection = Math.round((Math.atan2(sinSum / count, cosSum / count) * 180) / Math.PI);
    if (avgDirection < 0) avgDirection += 360;
    
    return {
        station_id: buffer[0].station_id,
        timestamp: buffer[0].timestamp,
        temperature: parseFloat((sumTemp / count).toFixed(1)),
        humidity: Math.round(sumHum / count),
        wind_speed: parseFloat((sumSpeed / count).toFixed(1)),
        wind_direction: avgDirection,
        pressure: parseFloat((sumPress / count).toFixed(1)),
        solar_radiation: Math.round(sumSolar / count),
        rainfall: parseFloat(sumRain.toFixed(1)),
        wave_height: parseFloat((sumWave / count).toFixed(2)),
        sea_level: parseFloat((sumSea / count).toFixed(1)),
        water_ph: parseFloat((sumPh / count).toFixed(2))
    };
}

function postTelemetryToExpress(payload) {
    let telemetryUrl = API_URL;
    if (API_URL.includes('/api/aws-config')) {
        telemetryUrl = API_URL.replace('/api/aws-config', '/api/telemetry');
    } else if (API_URL.includes('/api/local-db')) {
        telemetryUrl = API_URL.replace('/api/local-db', '/api/telemetry');
    } else {
        return;
    }
    
    const dataString = JSON.stringify(payload);
    makeRequest(telemetryUrl, {
        method: 'POST',
        onError: () => {}
    }, () => {}, dataString);
}

function postRawTelemetryToExpress(rawPayload) {
    let rawUrl = API_URL;
    if (API_URL.includes('/api/aws-config')) {
        rawUrl = API_URL.replace('/api/aws-config', '/api/raw-telemetry');
    } else if (API_URL.includes('/api/local-db')) {
        rawUrl = API_URL.replace('/api/local-db', '/api/raw-telemetry');
    } else {
        return;
    }
    
    const dataString = JSON.stringify({
        timestamp: new Date().toLocaleTimeString('id-ID'),
        data: rawPayload
    });
    makeRequest(rawUrl, {
        method: 'POST',
        onError: () => {}
    }, () => {}, dataString);
}

function postToPhpGateway(payload) {
    const dataString = JSON.stringify(payload);
    makeRequest(API_URL, {
        method: 'POST',
        onError: () => {}
    }, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
    }, dataString);
}

// Server endpoints Express
app.use(express.json());

// Sinkronisasi konfigurasi lewat API POST Express (Mirip kode referensi Anda)
app.post('/save-config', (req, res) => {
    if (req.body && req.body.ip) {
        MOXA_IP = req.body.ip;
        MOXA_PORT = parseInt(req.body.port) || 4001;
        if (req.body.db_storage_interval !== undefined) {
            dbStorageInterval = parseInt(req.body.db_storage_interval);
        }
        if (req.body.db_storage_mode) {
            dbStorageMode = req.body.db_storage_mode;
        }
        console.log(`[${new Date().toISOString()}] 🔄 Konfigurasi diperbarui oleh Dashboard: ${MOXA_IP}:${MOXA_PORT} | Interval: ${dbStorageInterval} Menit | Mode: ${dbStorageMode}`);
        
        if (client) {
            try { client.destroy(); } catch (e) {}
            client = null;
        }
        isTcpConnecting = false;
        
        syncConfigAndConnect();
        res.json({ success: true, message: "Koneksi ke Moxa diperbarui secara instan!" });
    } else {
        res.status(400).json({ success: false, message: "IP dan Port diperlukan!" });
    }
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS Maritime Telemetry - Moxa Daemon Status</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #0b1329;
        }
        .mono-font {
            font-family: 'JetBrains Mono', monospace;
        }
    </style>
</head>
<body class="text-slate-200 min-h-screen flex items-center justify-center p-4">
    <div class="max-w-xl w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <!-- Header -->
        <div class="flex items-center gap-3.5 border-b border-slate-800 pb-5 mb-6">
            <div class="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-teal-400">
                <svg class="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </div>
            <div>
                <h1 class="text-xl font-extrabold text-white tracking-tight uppercase">AWS Maritime OS</h1>
                <p class="text-xs text-teal-400 font-semibold tracking-wider uppercase">Telemetry Daemon Active</p>
            </div>
        </div>

        <!-- Connection Status Card -->
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 mb-6 space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400 uppercase font-bold tracking-wider">Status Koneksi Moxa:</span>
                <span class="px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider ${
                    lastStatus.connected 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : lastStatus.state === 'DIALING' || lastStatus.state === 'RECONNECTING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }">
                    \${lastStatus.state}
                </span>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/50 text-xs">
                <div>
                    <span class="text-slate-500 block mb-0.5">IP Gateway:</span>
                    <span class="font-bold text-white mono-font">\${lastStatus.moxa_ip}</span>
                </div>
                <div>
                    <span class="text-slate-500 block mb-0.5">Port Gateway:</span>
                    <span class="font-bold text-white mono-font">\${lastStatus.moxa_port}</span>
                </div>
                <div>
                    <span class="text-slate-500 block mb-0.5">Waktu Update:</span>
                    <span class="font-semibold text-slate-300 mono-font">\${lastStatus.last_seen || 'Belum ada data'}</span>
                </div>
                <div>
                    <span class="text-slate-500 block mb-0.5">Target Database API:</span>
                    <span class="font-semibold text-slate-300 mono-font truncate block" title="\${API_URL}">\${API_URL}</span>
                </div>
            </div>

            \${lastStatus.error ? \`
            <div class="mt-4 p-3 bg-rose-500/10 border border-rose-500/15 rounded-xl text-xs text-rose-300 leading-relaxed">
                <strong>Catatan Error:</strong> \${lastStatus.error}
            </div>
            \` : ''}
        </div>

        <!-- Navigation Links -->
        <div class="space-y-3">
            <div class="text-xs text-slate-400 font-medium">
                Peralatan bantu & API Endpoint Daemon:
            </div>
            <div class="grid grid-cols-2 gap-3">
                <a href="/status" class="flex items-center justify-between p-3 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800/80 rounded-xl transition text-xs font-semibold text-teal-400 hover:text-teal-300">
                    <span>📊 Lihat API Status (JSON)</span>
                    <span>→</span>
                </a>
                <a href="http://localhost:3000" class="flex items-center justify-between p-3 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800/80 rounded-xl transition text-xs font-semibold text-sky-400 hover:text-sky-300">
                    <span>💻 Buka Dashboard Utama</span>
                    <span>→</span>
                </a>
            </div>
        </div>

        <!-- Footer Info -->
        <div class="mt-6 pt-5 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-slate-500 font-medium">
            <span>Daemon berjalan secara lokal menggunakan Node.js Express</span>
            <span>Port: \${WEB_IO_PORT}</span>
        </div>
    </div>
</body>
</html>`);
});

app.get('/status', (req, res) => {
    res.json(lastStatus);
});

let isStarted = false;
function startDaemon() {
    if (isStarted) return;
    isStarted = true;
    syncConfigAndConnect();
}

httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`\n⚠️  [WARNING] Port ${WEB_IO_PORT} sudah digunakan oleh proses lain (EADDRINUSE).`);
        console.warn(`ℹ️   Aplikasi web Dashboard atau script Moxa sebelumnya mungkin sudah berjalan di port ini.`);
        console.warn(`⚡  DAEMON TETAP BERJALAN: Pengumpulan data dari Moxa ke PostgreSQL (${API_URL}) tetap berfungsi secara penuh!`);
        console.warn(`💡  Untuk mengaktifkan kembali WebSocket real-time, tutup aplikasi lain di port 8080 lalu restart daemon.\n`);
        startDaemon();
    } else {
        console.error(`❌ [ERROR] Gagal menjalankan HTTP Server: ${err.message}`);
        startDaemon();
    }
});

httpServer.listen(WEB_IO_PORT, '0.0.0.0', () => {
    console.log(`[DAEMON] WebSocket Server berjalan aktif di http://localhost:${WEB_IO_PORT}`);
    startDaemon();
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    // Beri status terbaru ke client yang baru masuk
    socket.emit('statusUpdate', lastStatus);
    console.log(`[${new Date().toISOString()}] 🔌 Client browser tersambung ke WebSocket Daemon.`);
});
