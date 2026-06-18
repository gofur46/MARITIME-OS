/**
 * DAEMON SERVICE: MOXA TCP/IP GATEWAY CLIENT TO POSTGRESQL BRIDGE
 * File: C:\MARITIME-OS-main\MARITIME-OS-main\tcp_moxa_listener.js
 * 
 * Skenario Baru:
 * - MOXA bertindak sebagai "TCP Server" (mendengarkan di IP & Port tertentu, contoh: 192.168.127.254:10001).
 * - Script ini bertindak sebagai "TCP Client" yang secara aktif menghubungkan diri ke MOXA.
 * - Dilengkapi fitur AUTO-RECONNECT tangguh: Jika koneksi terputus (listrik padam, kabel terlepas, Moxa reboot),
 *   script akan mendeteksi putusan dan otomatis mencoba menyambung kembali setiap 5 detik.
 */

const net = require('net');
const http = require('http');

// ==================== CONFIGURATION ====================
// Ganti IP dan Port di bawah ini sesuai dengan konfigurasi Moxa Anda
const MOXA_IP = '192.168.127.254'; // Isikan IP Address alat Moxa di jaringan lokal Anda
const MOXA_PORT = 10001;          // Isikan port TCP Server Moxa (contoh: 10001, 4001, atau sesuai set di Moxa)
const RECONNECT_INTERVAL = 5000;  // Jeda waktu mencoba menyambung kembali (5000 milidetik = 5 detik)
const API_GATEWAY_URL = 'http://localhost:8000/api.php';
// ========================================================

console.log(`==================================================================`);
console.log(`          AWS MARITIME TELEMETRY TCP CLIENT FOR MOXA GATEWAY`);
console.log(`          Mode: Aktif Menghubungkan ke Moxa (Moxa as TCP Server)`);
console.log(`==================================================================`);
console.log(`Moxa Target IP   : ${MOXA_IP}`);
console.log(`Moxa Target Port : ${MOXA_PORT}`);
console.log(`API Destination  : ${API_GATEWAY_URL}`);
console.log(`==================================================================\n`);

let client = null;
let reconnectTimer = null;
let isConnecting = false;
let dataBuffer = ''; // Penyangga untuk menangkap data potongan TCP stream

function connectToMoxa() {
    if (isConnecting) return;
    isConnecting = true;

    console.log(`[${new Date().toISOString()}] 🔍 Menginisiasi koneksi ke MOXA di ${MOXA_IP}:${MOXA_PORT}...`);

    client = net.createConnection({ host: MOXA_IP, port: MOXA_PORT }, () => {
        isConnecting = false;
        console.log(`[${new Date().toISOString()}] 🔌 [CONNECTED] Sukses terhubung ke MOXA Server!`);
        // Reset buffers
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
        console.log(`[${new Date().toISOString()}] ⚠️ [DISCONNECTED] Koneksi ke MOXA terputus!`);
        scheduleReconnect();
    });

    // Menangani kegagalan koneksi / error routing
    client.on('error', (err) => {
        isConnecting = false;
        console.error(`[${new Date().toISOString()}] ❌ [TCP CONNECTION ERROR]: ${err.message}`);
        // Event 'close' akan otomatis dipicu setelah 'error', namun kita pastikan koneksi dihancurkan
        if (client) {
            client.destroy();
        }
    });
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    console.log(`[${new Date().toISOString()}] ⏱️ Mencoba menyambung kembali ke MOXA dalam ${RECONNECT_INTERVAL / 1000} detik...`);
    reconnectTimer = setTimeout(() => {
        connectToMoxa();
    }, RECONNECT_INTERVAL);
}

// Fungsi utama memproses data sensor maritim dari Moxa
function processRawPayload(rawPayload) {
    console.log(`[${new Date().toISOString()}] 📥 [RAW DATA RECVD]: "${rawPayload}"`);

    // Split token berdasarkan tanda titik koma (;)
    const tokens = rawPayload.split(';');

    if (tokens.length < 15) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER ERROR] Data tidak sesuai standar token (${tokens.length}/22 tokens). Baris data diabaikan.`);
        return;
    }

    try {
        const stationId = tokens[0] || 'AWS001';
        
        // Konversi format tanggal DD-MM-YYYY ke YYYY-MM-DD
        let datePart = tokens[1]; // dd-mm-yyyy
        let timePart = tokens[2]; // HH:mm:ss
        
        let formattedTimestamp = '';
        if (datePart && datePart.includes('-')) {
            const dates = datePart.split('-');
            if (dates.length === 3) {
                // YYYY-MM-DD HH:mm:ss
                formattedTimestamp = `${dates[2]}-${dates[1]}-${dates[0]} ${timePart}`;
            }
        } else {
            formattedTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        // Mapping token array telemetry kustom Anda ke struktur database PostgreSQL:
        const mappedRecord = {
            station_id: stationId,
            timestamp: formattedTimestamp,
            temperature: parseFloat(tokens[6]) || 28.0,
            humidity: parseInt(tokens[9]) || 80,
            solar_radiation: parseInt(tokens[12]) || 0,
            rainfall: 0.0, // Curah hujan
            wave_height: 1.0, // Gelombang laut
            sea_level: parseFloat(tokens[17]) ? (parseFloat(tokens[17]) * 100) : 120.0, // Meter ke cm
            water_ph: parseFloat(tokens[18]) || 7.0,
            wind_direction: parseInt(parseFloat(tokens[5])) || 0,
            wind_speed: parseFloat(tokens[3]) || 0.0,
            pressure: parseFloat(tokens[10]) || 1013.25
        };

        console.log(`[${new Date().toISOString()}] ⚙️ [PARSED OK]: Temp=${mappedRecord.temperature}°C, WS=${mappedRecord.wind_speed} m/s, WD=${mappedRecord.wind_direction}°, pH=${mappedRecord.water_ph}, Press=${mappedRecord.pressure} hPa`);

        // Posting asinkron ke database lokal (api.php)
        postToPhpGateway(mappedRecord);

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ [PARSER CRASH] Gagal mengurai berkas data: ${err.message}`);
    }
}

// Fungsi pengiriman ke database via api.php
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

// Mulai jalankan pooling client
connectToMoxa();
