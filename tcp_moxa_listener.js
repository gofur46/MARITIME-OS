/**
 * DAEMON SERVICE: MOXA TCP/IP GATEWAY CLIENT TO POSTGRESQL BRIDGE
 * File: C:\MARITIME-OS-main\MARITIME-OS-main\tcp_moxa_listener.js
 * 
 * SINKRONISASI OTOMATIS:
 * - Script ini bertindak sebagai "TCP Client" yang secara aktif menghubungkan diri ke MOXA (berperan sebagai TCP Server).
 * - IP IP & Port Moxa dibaca SEPENUHNYA SECARA DINAMIS dari yang Anda masukkan di menu SETTINGS Dashboard!
 * - Setiap kali menyambungkan diri, daemon ini secara otomatis mendownload konfigurasi IP/Port terupdate dari api.php.
 * - Dilengkapi fitur AUTO-RECONNECT tangguh: Jika koneksi terputus (listrik padam, kabel lepas, Moxa reboot),
 *   script akan meluncurkan handshake retry setiap 5 detik dengan konfigurasi terupdate.
 */

const net = require('net');
const http = require('http');

// ==================== INITIAL CONFIGURATION ====================
// Default fallback bila PHP belum aktif
let MOXA_IP = '192.168.127.254'; 
let MOXA_PORT = 10001;          
const RECONNECT_INTERVAL = 5000;  // Jeda waktu mencoba menyambung kembali (5 detik)
const API_URL = 'http://localhost:8000/api.php';
// ===============================================================

console.log(`==================================================================`);
console.log(`          AWS MARITIME TELEMETRY TCP CLIENT FOR MOXA GATEWAY`);
console.log(`          Mode: Aktif Menghubungkan ke Moxa (Moxa as TCP Server)`);
console.log(`          sinkronisasi dinamis via menu Dashboard Settings.`);
console.log(`==================================================================`);

let client = null;
let reconnectTimer = null;
let isConnecting = false;
let dataBuffer = ''; // Penyangga untuk menangkap data potongan TCP stream

// Fungsi mengambil konfigurasi terupdate dari api.php
function getMoxaConfigAndConnect() {
    if (isConnecting) return;
    isConnecting = true;

    console.log(`\n[${new Date().toISOString()}] 🔍 Mengambil konfigurasi IP & Port Moxa terupdate dari api.php...`);
    
    const req = http.get(`${API_URL}?get_moxa_config=1`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            try {
                const config = JSON.parse(body);
                if (config && config.moxa_ip) {
                    MOXA_IP = config.moxa_ip;
                    MOXA_PORT = parseInt(config.moxa_port) || 10001;
                    console.log(`[${new Date().toISOString()}] ⚙️ [CONFIG SYNC]: IP Moxa : ${MOXA_IP} | Port Moxa : ${MOXA_PORT} (Sesuai isian Dashboard Settings!)`);
                }
            } catch (err) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Gagal mengurai moxa_config.json, menggunakan fallback IP=${MOXA_IP}, Port=${MOXA_PORT}`);
            }
            isConnecting = false;
            connectToMoxa();
        });
    });

    req.on('error', (err) => {
        console.warn(`[${new Date().toISOString()}] ⚠️ Gagal menghubungi api.php (Port 8000 belum aktif?). Menggunakan fallback IP=${MOXA_IP}, Port=${MOXA_PORT}`);
        isConnecting = false;
        connectToMoxa();
    });
}

function connectToMoxa() {
    if (isConnecting) return;
    isConnecting = true;

    console.log(`[${new Date().toISOString()}] 🔌 [DIALING] Melakukan panggilan TCP ke MOXA Server di ${MOXA_IP}:${MOXA_PORT}...`);

    client = net.createConnection({ host: MOXA_IP, port: MOXA_PORT }, () => {
        isConnecting = false;
        console.log(`[${new Date().toISOString()}] 🟢 [CONNECTED] Sukses tersambung ke port Moxa! Monitor transmisi dimulai...`);
        dataBuffer = '';
    });

    // Menerima stream data dari Moxa
    client.on('data', (data) => {
        dataBuffer += data.toString();

        // Cari baris lengkap dipisah oleh enter (\n atau \r)
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

    // Menangani koneksi terputus
    client.on('close', () => {
        isConnecting = false;
        console.log(`[${new Date().toISOString()}] 🔴 [DISCONNECTED] Koneksi ke MOXA terputus!`);
        scheduleReconnect();
    });

    // Menangani kegagalan koneksi / error routing
    client.on('error', (err) => {
        isConnecting = false;
        console.error(`[${new Date().toISOString()}] ❌ [TCP ERROR]: ${err.message}`);
        if (client) {
            client.destroy();
        }
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    console.log(`[${new Date().toISOString()}] ⏱️ Menjadwalkan penyambungan ulang ke MOXA dalam ${RECONNECT_INTERVAL / 1000} detik...`);
    reconnectTimer = setTimeout(() => {
        getMoxaConfigAndConnect();
    }, RECONNECT_INTERVAL);
}

// Fungsi utama memproses data sensor maritim dari Moxa
function processRawPayload(rawPayload) {
    console.log(`[${new Date().toISOString()}] 📥 [RAW DATA]: "${rawPayload}"`);

    const tokens = rawPayload.split(';');

    if (tokens.length < 15) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER ERROR] Data token tidak valid (${tokens.length}/22 tokens). Abaikan.`);
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
            formattedTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        const mappedRecord = {
            station_id: stationId,
            timestamp: formattedTimestamp,
            temperature: parseFloat(tokens[6]) || 28.0,
            humidity: parseInt(tokens[9]) || 80,
            solar_radiation: parseInt(tokens[12]) || 0,
            rainfall: 0.0, 
            wave_height: 1.0, 
            sea_level: parseFloat(tokens[17]) ? (parseFloat(tokens[17]) * 100) : 120.0, // m ke cm
            water_ph: parseFloat(tokens[18]) || 7.0,
            wind_direction: parseInt(parseFloat(tokens[5])) || 0,
            wind_speed: parseFloat(tokens[3]) || 0.0,
            pressure: parseFloat(tokens[10]) || 1013.25
        };

        console.log(`[${new Date().toISOString()}] ⚙️ [PARSED OK]: Temp=${mappedRecord.temperature}°C, WS=${mappedRecord.wind_speed} m/s, WD=${mappedRecord.wind_direction}°, pH=${mappedRecord.water_ph}, Press=${mappedRecord.pressure} hPa`);

        postToPhpGateway(mappedRecord);

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER CRASH] Gagal mengurai berkas data: ${err.message}`);
    }
}

function postToPhpGateway(payload) {
    const dataString = JSON.stringify(payload);
    
    const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/api.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': dataString.length
        }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(`[${new Date().toISOString()}] 💾 [POSTGRESQL SAVE SUCCESS]: Data berhasil dimasukkan ke PostgreSQL (api.php)!`);
            } else {
                console.error(`[${new Date().toISOString()}] ❌ [HTTP EXCEPTION]: Server responding status ${res.statusCode}: ${responseBody}`);
            }
        });
    });

    req.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] ❌ [POST BRIDGE CRASH]: Gagal mengirim ke api.php di port 8000. Error: ${err.message}`);
    });

    req.write(dataString);
    req.end();
}

// Jalankan pencarian config & proses dial
getMoxaConfigAndConnect();
