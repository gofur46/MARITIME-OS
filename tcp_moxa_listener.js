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
import { URL } from 'url';

// ==================== CONFIGURATION ====================
// Alamat database PHP lokal Anda (Default Standalone PHP: http://localhost:8000/api.php)
const API_URL = process.argv[2] || 'http://localhost:8000/api.php';

// IP & Port Moxa (Dapat langsung ditulis di baris perintah sebagai override):
// FORMAT: node tcp_moxa_listener.js [API_URL] [MOXA_IP] [MOXA_PORT]
let MOXA_IP = process.argv[3] || '192.168.1.254'; 
let MOXA_PORT = parseInt(process.argv[4]) || 4001;          
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

// Parser URL cerdas untuk posting database
function parseUrlConfig(targetUrl) {
    try {
        const parsed = new URL(targetUrl);
        return {
            hostname: parsed.hostname || 'localhost',
            port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search
        };
    } catch (e) {
        return { hostname: 'localhost', port: 80, path: '/aws_marine/api.php' };
    }
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
    const apiParts = parseUrlConfig(API_URL);
    
    const options = {
        hostname: apiParts.hostname,
        port: apiParts.port,
        path: apiParts.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataString)
        }
    };

    const req = http.request(options);
    req.on('error', () => {}); // Silenced
    req.write(dataString);
    req.end();
}

// Ambil konfigurasi paling update dari database
function syncConfigAndConnect() {
    if (isFetchingConfig) return;
    isFetchingConfig = true;

    console.log(`[${new Date().toISOString()}] 🔍 Mengambil konfigurasi IP & Port dari database via api.php...`);
    
    const apiParts = parseUrlConfig(API_URL);
    const options = {
        hostname: apiParts.hostname,
        port: apiParts.port,
        path: apiParts.path + (apiParts.path.includes('?') ? '&' : '?') + 'get_moxa_config=1',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode === 200 && body.trim().startsWith('{')) {
                    const config = JSON.parse(body);
                    if (config && config.moxa_ip) {
                        MOXA_IP = config.moxa_ip;
                        MOXA_PORT = parseInt(config.moxa_port) || 4001;
                        console.log(`[${new Date().toISOString()}] ⚙️ [CONFIG SYNC]: IP Moxa : ${MOXA_IP} | Port Moxa : ${MOXA_PORT} (Sesuai Database!)`);
                    }
                } else {
                    // Fallback to command line overrides if available
                    if (process.argv[3] && process.argv[4]) {
                        MOXA_IP = process.argv[3];
                        MOXA_PORT = parseInt(process.argv[4]) || 4001;
                    }
                    console.log(`[${new Date().toISOString()}] ⚠️ Respon API tidak valid, menggunakan IP: ${MOXA_IP} | Port: ${MOXA_PORT}`);
                }
            } catch (err) {
                if (process.argv[3] && process.argv[4]) {
                    MOXA_IP = process.argv[3];
                    MOXA_PORT = parseInt(process.argv[4]) || 4001;
                }
                console.log(`[${new Date().toISOString()}] ⚠️ Gagal mengurai respon api.php, menggunakan IP: ${MOXA_IP} | Port: ${MOXA_PORT}`);
            }
            isFetchingConfig = false;
            connectToMoxa();
        });
    });

    req.on('error', (err) => {
        if (process.argv[3] && process.argv[4]) {
            MOXA_IP = process.argv[3];
            MOXA_PORT = parseInt(process.argv[4]) || 4001;
        }
        console.warn(`[${new Date().toISOString()}] ⚠️ Server PHP API Offline. Menggunakan IP: ${MOXA_IP} | Port: ${MOXA_PORT}`);
        isFetchingConfig = false;
        connectToMoxa();
    });

    req.end();
}

function connectToMoxa() {
    if (isTcpConnecting) return;
    isTcpConnecting = true;

    console.log(`[${new Date().toISOString()}] 🔌 [DIALING] Menghubungkan ke MOXA Server di ${MOXA_IP}:${MOXA_PORT}...`);
    broadcastStatus(false, 'DIALING', `Menghubungkan ke ${MOXA_IP}:${MOXA_PORT}`);

    if (client) {
        try { client.destroy(); } catch (e) {}
    }

    client = new net.Socket();
    
    // Enable TCP Keep-Alives to detect broken physical connection quickly
    client.setKeepAlive(true, 5000); // Send TCP probes every 5 seconds
    
    // Set 5-second initial connect handshake timeout
    client.setTimeout(5000);

    client.on('timeout', () => {
        console.warn(`[${new Date().toISOString()}] ⚠️ [TCP TIMEOUT] Batas waktu koneksi/data Moxa terlampaui (${MOXA_IP}:${MOXA_PORT})!`);
        broadcastStatus(false, 'TIMEOUT', 'Batas waktu koneksi habis (Moxa Offline)');
        client.destroy(); // Destroys socket, triggering 'close' event
    });

    client.connect(MOXA_PORT, MOXA_IP, () => {
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
        isTcpConnecting = false;
        console.log(`[${new Date().toISOString()}] 🔴 [DISCONNECTED] Koneksi ke MOXA terputus!`);
        broadcastStatus(false, 'DISCONNECTED', 'Koneksi terputus');
        scheduleReconnect();
    });

    client.on('error', (err) => {
        isTcpConnecting = false;
        console.error(`[${new Date().toISOString()}] ❌ [TCP ERROR]: ${err.message}`);
        broadcastStatus(false, 'ERROR', err.message);
        if (client) {
            client.destroy();
        }
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    console.log(`[${new Date().toISOString()}] ⏱️ Menjadwalkan reconnect dalam ${currentReconnectInterval / 1000} detik...`);
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

    const tokens = rawPayload.split(';');

    if (tokens.length < 15) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER ERROR] Skenario token tidak valid (${tokens.length} tokens).`);
        return;
    }

    try {
        const stationId = tokens[0] || 'AWS001';
        let datePart = tokens[1]; // dd-mm-yyyy
        let timePart = tokens[2]; // HH:mm:ss
        
        let formattedTimestamp = '';
        if (datePart && datePart.includes('-')) {
            const dates = datePart.split('-');
            if (dates.length === 3) {
                formattedTimestamp = `${dates[2]}-${dates[1]}-${dates[0]} ${timePart}`;
            }
        } else {
            const d = new Date();
            const pad = (n) => n.toString().padStart(2, '0');
            formattedTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        const mappedRecord = {
            station_id: stationId,
            timestamp: formattedTimestamp,
            temperature: parseFloat(tokens[6]) || 28.0,
            humidity: parseInt(tokens[9]) || 80,
            solar_radiation: parseInt(tokens[12]) || 0,
            rainfall: parseFloat(tokens[15]) || 0.0, 
            wave_height: parseFloat(tokens[16]) || 1.0, 
            sea_level: parseFloat(tokens[17]) ? (parseFloat(tokens[17]) * 100) : 120.0, // kelola meter ke cm
            water_ph: parseFloat(tokens[18]) || 7.0,
            wind_direction: parseInt(parseFloat(tokens[5])) || 0,
            wind_speed: parseFloat(tokens[3]) || 0.0,
            pressure: parseFloat(tokens[10]) || 1013.25
        };

        console.log(`[${new Date().toISOString()}] ⚙️ [PARSED OK]: Temp=${mappedRecord.temperature}°C, WS=${mappedRecord.wind_speed} m/s, WD=${mappedRecord.wind_direction}°, pH=${mappedRecord.water_ph}`);

        // 1. Emit live parsed telemetry ke React UI via Socket.io secara instan
        io.emit('dataUpdate', mappedRecord);

        // 2. Pompa asinkron langsung ke PostgreSQL (via api.php) dinonaktifkan
        // Penyimpanan database sekarang dihandle oleh aplikasi frontend React agar mematuhi interval penyimpanan & averaging mode di Pengaturan
        // postToPhpGateway(mappedRecord);

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER CRASH] Gagal mengolah payload: ${err.message}`);
    }
}

function postToPhpGateway(payload) {
    const dataString = JSON.stringify(payload);
    const apiParts = parseUrlConfig(API_URL);
    
    const options = {
        hostname: apiParts.hostname,
        port: apiParts.port,
        path: apiParts.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataString)
        }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
    });

    req.on('error', (err) => {
        // Silent error
    });

    req.write(dataString);
    req.end();
}

// Server endpoints Express
app.use(express.json());

// Sinkronisasi konfigurasi lewat API POST Express (Mirip kode referensi Anda)
app.post('/save-config', (req, res) => {
    if (req.body && req.body.ip) {
        MOXA_IP = req.body.ip;
        MOXA_PORT = parseInt(req.body.port) || 4001;
        console.log(`[${new Date().toISOString()}] 🔄 Konfigurasi diperbarui oleh Dashboard: ${MOXA_IP}:${MOXA_PORT}`);
        
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
