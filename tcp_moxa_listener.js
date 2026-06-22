/**
 * DAEMON SERVICE: MOXA TCP/IP GATEWAY CLIENT TO POSTGRESQL BRIDGE
 * File: C:\MARITIME-OS-main\MARITIME-OS-main\tcp_moxa_listener.js
 * 
 * SINKRONISASI OTOMATIS (MENGGUNAKAN NATIVE ES MODULES):
 * - Script ini bertindak sebagai "TCP Client" yang secara aktif menghubungkan diri ke MOXA (berperan sebagai TCP Server).
 * - IP & Port Moxa dibaca SEPENUHNYA SECARA DINAMIS dari yang Anda masukkan di menu SETTINGS Dashboard!
 * - Setiap kali menyambungkan diri, daemon ini secara otomatis mendownload konfigurasi IP/Port terupdate dari api.php.
 * - Dilengkapi fitur AUTO-RECONNECT tangguh: Jika koneksi terputus, ia akan mencoba menyambung kembali setiap 5 detik.
 */

import net from 'net';
import http from 'http';
import { URL } from 'url';

// ==================== CONFIGURATION ====================
// Alamat API Jembatan database PHP lokal Anda (Default XAMPP: http://localhost/aws_marine/api.php)
// Sekarang mendukung argumen baris perintah, misalnya: node tcp_moxa_listener.js http://localhost:8000/api.php
const API_URL = process.argv[2] || 'http://localhost/aws_marine/api.php';

// Fallback jika database belum aktif atau konfigurasi kosong
let MOXA_IP = '192.168.127.254'; 
let MOXA_PORT = 10001;          
const RECONNECT_INTERVAL = 5000;  // Percobaan ulang koneksi (5 detik)
// =======================================================

console.log(`==================================================================`);
console.log(`          AWS MARITIME TELEMETRY TCP CLIENT FOR MOXA GATEWAY`);
console.log(`          Mode: Aktif Menghubungkan ke Moxa (Moxa as TCP Server)`);
console.log(`          Sinkronisasi dinamis via menu Dashboard Settings.`);
console.log(`==================================================================`);
console.log(`Target API URL   : ${API_URL}`);
console.log(`==================================================================\n`);

let client = null;
let reconnectTimer = null;
let isFetchingConfig = false;
let isTcpConnecting = false;
let dataBuffer = ''; // Penyangga aliran byte stream TCP

// Fungsi menguraikan URL secara cerdas agar kompeten di port berapapun (80, 8000, dll)
function parseUrlConfig(targetUrl) {
    try {
        const parsed = new URL(targetUrl);
        return {
            hostname: parsed.hostname || 'localhost',
            port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search
        };
    } catch (e) {
        return {
            hostname: 'localhost',
            port: 80,
            path: '/aws_marine/api.php'
        };
    }
}

// Mengambil pengaturan IP/Port Moxa terbaru yang disimpan user di UI Settings
function getMoxaConfigAndConnect() {
    if (isFetchingConfig) return;
    isFetchingConfig = true;

    console.log(`[${new Date().toISOString()}] 🔍 Mengambil konfigurasi IP & Port Moxa dari database via api.php...`);
    
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
                        MOXA_PORT = parseInt(config.moxa_port) || 10001;
                        console.log(`[${new Date().toISOString()}] ⚙️ [CONFIG SYNC]: IP Moxa : ${MOXA_IP} | Port Moxa : ${MOXA_PORT} (Sesuai Dashboard!)`);
                    }
                } else {
                    console.warn(`[${new Date().toISOString()}] ⚠️ Respon API tidak valid (Status ${res.statusCode}), menggunakan setingan lokal: IP=${MOXA_IP}, Port=${MOXA_PORT}`);
                }
            } catch (err) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Gagal mengurai respon api.php, menggunakan setingan lokal: IP=${MOXA_IP}, Port=${MOXA_PORT}`);
            }
            isFetchingConfig = false;
            connectToMoxa();
        });
    });

    req.on('error', (err) => {
        console.warn(`[${new Date().toISOString()}] ⚠️ Tidak dapat menghubungi api.php (${err.message}). Menggunakan setingan lokal: IP=${MOXA_IP}, Port=${MOXA_PORT}`);
        isFetchingConfig = false;
        connectToMoxa();
    });

    req.end();
}

function updateStatusOnServer(connected, stateLabel, errorMsg = '') {
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

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
    });

    req.on('error', (err) => {
        // Silent block to avoid loop logging when backend is temporarily offline
    });

    req.write(dataString);
    req.end();
}

function connectToMoxa() {
    if (isTcpConnecting) return;
    isTcpConnecting = true;

    console.log(`[${new Date().toISOString()}] 🔌 [DIALING] Menghubungkan ke MOXA Server di ${MOXA_IP}:${MOXA_PORT}...`);
    updateStatusOnServer(false, 'DIALING', `Connecting to ${MOXA_IP}:${MOXA_PORT}...`);

    // Clean up old socket if it exists to avoid leakage
    if (client) {
        try {
            client.destroy();
        } catch (e) {}
    }

    client = new net.Socket();

    client.connect(MOXA_PORT, MOXA_IP, () => {
        isTcpConnecting = false;
        console.log(`[${new Date().toISOString()}] 🟢 [CONNECTED] Sukses tersambung ke Moxa! Mendengarkan data nirkabel...`);
        dataBuffer = '';
        updateStatusOnServer(true, 'CONNECTED', '');
    });

    client.on('data', (data) => {
        dataBuffer += data.toString();

        // Cari baris kalimat data lengkap dipisah oleh enter (\n atau \r)
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

    // Koneksi terputus
    client.on('close', () => {
        isTcpConnecting = false;
        console.log(`[${new Date().toISOString()}] 🔴 [DISCONNECTED] Koneksi ke MOXA terputus!`);
        updateStatusOnServer(false, 'DISCONNECTED', 'Connection closed');
        scheduleReconnect();
    });

    // Kesalahan jaringan / host tidak terjangkau
    client.on('error', (err) => {
        isTcpConnecting = false;
        console.error(`[${new Date().toISOString()}] ❌ [TCP ERROR]: ${err.message}`);
        updateStatusOnServer(false, 'ERROR', err.message);
        if (client) {
            client.destroy();
        }
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    console.log(`[${new Date().toISOString()}] ⏱️ Mencoba menyambung kembali ke MOXA dalam ${RECONNECT_INTERVAL / 1000} detik...`);
    reconnectTimer = setTimeout(() => {
        getMoxaConfigAndConnect();
    }, RECONNECT_INTERVAL);
}

// parsing tanggal standard herp
function formatSqlDateTime(date) {
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Parsing byte data Moxa yang terkirim
function processRawPayload(rawPayload) {
    console.log(`[${new Date().toISOString()}] 📥 [RAW DATA]: "${rawPayload}"`);

    const tokens = rawPayload.split(';');

    if (tokens.length < 15) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER ERROR] Skenario token tidak valid (${tokens.length}/22 tokens). Abaikan.`);
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
            formattedTimestamp = formatSqlDateTime(new Date());
        }

        const mappedRecord = {
            station_id: stationId,
            timestamp: formattedTimestamp,
            temperature: parseFloat(tokens[6]) || 28.0,
            humidity: parseInt(tokens[9]) || 80,
            solar_radiation: parseInt(tokens[12]) || 0,
            rainfall: 0.0, 
            wave_height: 1.0, 
            sea_level: parseFloat(tokens[17]) ? (parseFloat(tokens[17]) * 100) : 120.0, // kelola meter ke cm
            water_ph: parseFloat(tokens[18]) || 7.0,
            wind_direction: parseInt(parseFloat(tokens[5])) || 0,
            wind_speed: parseFloat(tokens[3]) || 0.0,
            pressure: parseFloat(tokens[10]) || 1013.25
        };

        console.log(`[${new Date().toISOString()}] ⚙️ [PARSED OK]: Temp=${mappedRecord.temperature}°C, WS=${mappedRecord.wind_speed} m/s, WD=${mappedRecord.wind_direction}°, pH=${mappedRecord.water_ph}, Press=${mappedRecord.pressure} hPa`);

        postToPhpGateway(mappedRecord);

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER CRASH] Gagal mengolah payload: ${err.message}`);
    }
}

// Pompa data asinkron langsung ke PostgreSQL menggunakan API lokal
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
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(`[${new Date().toISOString()}] 💾 [POSTGRESQL SAVE SUCCESS]: Data masuk PostgreSQL!`);
            } else {
                console.error(`[${new Date().toISOString()}] ❌ [HTTP ERROR]: Server merespon ${res.statusCode}: ${responseBody}`);
            }
        });
    });

    req.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] ❌ [HTTP POST CRASH]: Gagal mengirim ke database. Apakah PHP server offline? Error: ${err.message}`);
    });

    req.write(dataString);
    req.end();
}

// Mulai monitor
getMoxaConfigAndConnect();
