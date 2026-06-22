@echo off
:: ==============================================================
:: AUTOMATIC LAUNCHER FOR MOXA TCP TELEMETRY GATEWAY
:: Taruh file ini di desktop atau di folder Windows Startup agar jalan otomatis saat PC dinyalakan.
:: Cara masuk folder Startup: Tekan Win+R, ketik "shell:startup", lalu paste file ini di sana.
:: ==============================================================
title MOXA Gateway Telemetry Client
color 0b

:: --- PENGATURAN DEFAULT SINKRONISASI ---
set API_URL=http://localhost:8000/api.php
set MOXA_IP=192.168.1.254
set MOXA_PORT=4001

echo =========================================================
echo       AWS MARITIME TELEMETRY - AUTO DAEMON INITIALIZER
echo =========================================================
echo Target PHP Bridge : %API_URL%
echo Target Hardware  : %MOXA_IP%:%MOXA_PORT%
echo ---------------------------------------------------------
echo Menjalankan background listener daemon...
echo =========================================================

:: Jalankan daemon dengan nodejs
node tcp_moxa_listener.js "%API_URL%" "%MOXA_IP%" "%MOXA_PORT%"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Gagal menjalankan Node.js!
    echo Pastikan Node.js sudah diinstal di Komputer Host ini: https://nodejs.org/
    echo.
    pause
)
