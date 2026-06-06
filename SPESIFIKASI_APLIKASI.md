# SPESIFIKASI SISTEM MONITORING METEOROLOGI MARITIM & PELABUHAN
*(Maritime Meteorological & Port Monitoring System Specification)*

Dokumen ini berisi spesifikasi teknis, fitur-fitur unggulan, serta arsitektur antarmuka dari aplikasi monitoring cuaca maritim real-time yang dirancang khusus untuk keselamatan operasi pelabuhan dan pelayaran.

---

## 📌 1. DESKRIPSI UMUM APLIKASI
Aplikasi ini adalah **Maritime Telemetry Command Center Dashboard** terintegrasi yang berfungsi untuk memantau data cuaca, atmosfer, gelombang laut, dan arah angin secara real-time. Dilengkapi dengan sistem peringatan dini otomatis (Early Warning System - EWS) yang dinamis, kompas visual interaktif berpatokan pada dermaga dan kapal kargo, serta analisis data historis untuk mendukung keputusan keselamatan operasi pelabuhan yang presisi.

---

## 🛠️ 2. FITUR UTAMA & KEMAMPUAN SISTEM

Aplikasi ini dibagi menjadi 4 pusat kendali (*Tab Kontrol Utama*):

### A. Dashboard Real-Time (Tab Utama)
Menampilkan data metrik krusial atmosfer dan maritim secara langsung dengan responsivitas performa tinggi:
1.  **Dermaga & Vessel Wind Compass Center**:
    *   **Kompas Visual Dermaga**: Menampilkan orientasi dermaga (*Pier Angle*) dan kapal kargo berukuran besar secara interaktif.
    *   **Wind Arrow Live Pointer**: Panah pelacak dinamis yang menunjukkan arah datangnya angin secara langsung ke objek kapal.
    *   **Dynamic Alarm Ring**: Warna border lingkar kompas luar berubah secara otomatis menjadi merah berpendar (*pulse*) jika mendeteksi bahaya ganda, atau kuning jika terdapat kondisi angin kencang / gelombang tinggi tertentu.
2.  **Sistem Peringatan Dini Maritim (Dynamic Hazard EWS)**:
    *   **SIAGA 1 (Double Hazard)**: Aktif otomatis jika Kecepatan Angin $\ge$ 12.0 m/s **dan** Tinggi Gelombang $\ge$ 1.2m.
    *   **WARNING ANGIN KENCANG**: Aktif jika Kecepatan Angin $\ge$ 12.0 m/s.
    *   **WARNING GELOMBANG TINGGI**: Aktif jika Tinggi Gelombang $\ge$ 1.2m.
    *   **STATUS OPERASI AMAN & NORMAL**: Aktif jika seluruh parameter berada dalam batas keselamatan operasional standar.
3.  **Kondisi Atmosfer Sektor Kiri**:
    *   *Thermal & Humidity Info*: Suhu udara, tingkat kelembapan (RH), dan titik embun (*dew point*).
    *   *Rain Rate & Precipitation*: Laju curah hujan instan, sensor akumulasi presipitasi harian (dioptimalkan tanpa notifikasi redundan).
    *   *Barometric Air Pressure STN*: Tekanan atmosfer murni stasiun dengan visualisasi data box taktis bergaris batas sejajar.
4.  **Sektor Kanan & Sensor Akumulasi**:
    *   *Solar Radiation Irradiance*: Radiasi matahari (W/m²) tampil eksklusif dalam kotak instrumen premium yang ringkas dan hemat ruang.
    *   *Sea Water pH Quality Indicator*: Parameter sensor pH air laut terbaru untuk memantau kelestarian ekosistem pelabuhan dan tingkat keasaman air pelabuhan. Dilengkapi dengan status penanda otomatis (Ideal/Netral, Asam, Basa, atau Bahaya Eksitasi).
    *   *Pressure ATN Info*: Detail tekanan atmosfer yang sejajar tinggi vertikalnya, terdiri dari parameter:
        *   **STN (Station Pressure)**: Tekanan nyata stasiun.
        *   **QFE (Elevation Pressure)**: Koreksi ketinggian landasan.
        *   **QFF (Sea Level)**: Tekanan disesuaikan dengan rata-rata permukaan laut.
        *   **QNH (Standard Atmos)**: Tekanan atmosfer standar udara penerbangan/maritim.
5.  **Wind Vector Flow Path & Chrono Flow Track**:
    *   **Vector Compass Graph (24H Trace)**: Grafik vektor angin dua dimensi yang menggambarkan pergeseran pola arah dan kecepatan angin dalam 24 jam terakhir secara mulus menggunakan translasi matematika SVG.
    *   **Chrono Flow Sequence**: Urutan kronologis horizontal dari 5 log data arah angin terakhir dengan visual vektor panah navigasi mini terotasi mandiri.

### B. Pusat Analisis (Tab Analyst)
*   **Forecast Line Charts**: Grafik tren masa depan (*forecasting*) yang menyajikan gelombang laut, laju angin, dan parameter keselamatan.
*   **Storm & Gale Threat Radar**: Visualisasi zona interaktif untuk menganalisis badai, pusaran angin kencang (*gale*), serta potensi bahaya cuaca buruk lainnya di sekitar wilayah perairan pelabuhan.

### C. Basis Data & Log Historis (Tab Database)
*   **Data Telemetry Ledger**: Tabel komprehensif berisi seluruh riwayat pembacaan sensor cuaca menit-demi-menit, kini dilengkapi kolom khusus **pH Air** untuk analisis pencemaran lingkungan laut pelabuhan secara berkala.
*   **Filter & Navigasi**: Kemudahan membaca data historis, status ekspor data (*CSV File Export with pH*), hingga pencarian log berbahaya secara instan demi kebutuhan investigasi keselamatan operasi kapal.

### D. Pengaturan Konsol (Tab Settings)
*   **Pier Angle Adjustment**: Pengaturan dinamis orientasi spasial dermaga kapal (dalam derajat) untuk menyesuaikan layout geografis asli pelabuhan Anda.
*   **Water pH Alarm Limits**: Konfigurasi nilai ambang batas minimum (*Acid Limit* standar: `6.5`) dan batas maksimum (*Alkali Limit* standar: `8.5`) untuk menjamin kepatuhan baku mutu air laut pelabuhan dan memicu alarm visual di dashboard realtime secara otomatis.
*   **Sensitivitas Threshold**: Mengganti toleransi batas maksimum parameter alarm angin dan gelombang tinggi.
*   **Feed Mode**: Pilihan untuk beralih antara simulasi sensor dinamis atau integrasi umpan data real-time stasiun cuaca.

---

## 🎨 3. IDENTITAS DESAIN & TEKNOLOGI VISUAL

Dokumen spesifikasi UI/UX menggunakan prinsip visual militer ultra-modern:
*   **Tema Dasarnya**: *Cosmic Dark Navy* (perpaduan gradasi Deep Charcoal dan Obsidian Blue `#050a12`, `#0b1424`).
*   **Accent Color**: Cyan Neon (`#00f0ff`) untuk nilai metrik dinamis, Amber Emas (`#f59e0b`) untuk status informasi penting, Emerald Mint (`#10b981`) untuk status aman, dan Rose Crimson (`#f43f5e`) untuk sinyal darurat bahaya.
*   **Tipografi**: Menggunakan font modern Sans-serif terintegrasi bersanding dengan huruf monospaced bertipe konsol navigasi pesawat untuk pembacaan angka telemetry presesi tinggi.

---

## 🐳 4. INFORMASI PENGEMBANGAN TEKNIS

Aplikasi dibangun menggunakan struktur kode tangguh standar industri modern:
*   **Frontend Library**: React JS 18+ (Vite)
*   **Bahasa Pemrograman**: TypeScript (Type-Safe, Strict)
*   **Framework CSS**: Tailwind CSS (Efisien, Cepat, Responsif di seluruh layar Desktop hingga Tablet)
*   **Library Animasi**: Motion React / Framer Motion
*   **Icon Set**: Lucide React
*   **Visualisasi Grafik**: SVG native & Recharts terintegrasi

---

## 📡 5. KONEKTIVITAS & TRANSMISI TELEMETRI (SERIAL & TCP)

Sistem ini didesain dengan fleksibilitas industri tinggi untuk mendukung akuisisi data dari berbagai instrumen sensor lapangan (*automatic weather station*) melalui protokol komunikasi standardisasi industri maritim.

### A. Protokol Antarmuka Fisik & Jaringan
Aplikasi mendukung tiga mode transportasi transmisi utama yang dapat dikonfigurasi melalui tab **Settings**:

1.  **Koneksi Serial Hardware (RS232 / RS485 / USB-to-Serial)**
    *   **Port Komunikasi**: Dukungan pemilihan port COM kustom (misal: `COM1` s/d `COM8`) secara dinamis.
    *   **Baud Rate (Kecepatan Simbol)**: Mendukung kecepatan baud industri standar (`1200`, `2400`, `4800`, `9600`, `19200`, `38400`, `57600`, `115200` bps).
    *   **Data Protokol**: Mengalirkan paket string sensor mentah per detik secara asinkronus ke server terminal konsol.
2.  **Koneksi Jaringan TCP/IP Socket (TCP Server/Client)**
    *   **Metode Transmisi**: Menggunakan paket soket TCP biner atau string beralamat IP lokal/publik pelabuhan.
    *   **Keunggulan**: Memungkinkan pembacaan nirkabel (*wireless*) jarak jauh melalui infrastruktur Wi-Fi pelabuhan, Radio Link, atau jaringan seluler 4G/5G dari modul transmisi telemetri di tengah laut.
3.  **Mode Pengiriman Non-Aktif (OFF)**
    *   Sistem berjalan dalam mode terisolasi (*stand-alone simulator*) menggunakan generator stochastic untuk pemeliharaan sistem (*maintenance mode*) tanpa interupsi eksternal.

---

### B. Format Paket Data Aliran Masuk (Raw Data Telemetry Packet)
Data telemetry ditransmisikan dalam format baris teks terkompresi dengan pemisah karakter (*delimiter*) kustom (contoh default menggunakan semicolon `;`). Format ini sangat hemat bandwidth dan ramah terhadap mikrokompresor mikrokontroler.

#### 📝 Formula Struktur String Data:
```text
[ID_STATION][SPLIT_CHAR][DATE_TIME][SPLIT_CHAR][AIR_TEMP][SPLIT_CHAR][HUMIDITY][SPLIT_CHAR][SOLAR_RAD][SPLIT_CHAR][RAIN_RATE][SPLIT_CHAR][WAVE_HEIGHT][SPLIT_CHAR][WATER_LEVEL][SPLIT_CHAR][WATER_PH][SPLIT_CHAR][WIND_DIR][SPLIT_CHAR][WIND_SPD][SPLIT_CHAR][BARO_PRES]
```

#### 📊 Skema Kamus Indeks Variabel:

| No | Nama Parameter | Simbol / Satuan | Contoh Nilai | Deskripsi Teknis |
| :--- | :--- | :---: | :---: | :--- |
| **1** | **Station ID** | *Alphanumeric* | `SYS1000` | Kode identitas otentikasi hardware stasiun cuaca pelabuhan |
| **2** | **Timestamp** | `DD-MM-YYYY HH:mm:ss` | `06-06-2026 10:45:00` | Waktu lokal pencatatan sensor terkalibrasi waktu satelit / NTP |
| **3** | **Air Temperature** | `°C` | `28.5` | Suhu termal sekitar lingkungan pelabuhan udara terbuka |
| **4** | **Humidity** | `%` | `78` | Kelembapan relatif atmosfer laut |
| **5** | **Solar Radiation** | `W/m²` | `480` | Intensitas penyinaran energi matahari langsung |
| **6** | **Rain Rate** | `mm/hr` | `0.0` | Derajat intensitas curah hujan seketika (*instantaneous rainfall*) |
| **7** | **Wave Height** | `meter` | `0.85` | Tinggi gelombang laut efektif di area dermaga luar |
| **8** | **Water Level** | `cm` | `145.2` | Ketinggian permukaan air laut absolut berpatokan pada sensor pasut |
| **9** | **Water pH** | *pH Scale* | `7.82` | Tingkat keasaman air laut pelabuhan untuk pencegahan korosi lambung kapal |
| **10** | **Wind Direction** | `degree (°)` | `165` | Arah datangnya angin (0° - 359° searah jarum jam utara murni) |
| **11** | **Wind Speed** | `m/s` | `4.2` | Kecepatan laju tiupan angin permukaan dermaga maritim |
| **12** | **Barometric Pressure** | `hPa` | `1012.3` | Sensor barik stasiun murni sebelum normalisasi sea level |

#### 📨 Contoh Paket Data Asli Seri SERIAL/TCP Terkirim:
```syslog
SYS1000;06-06-2026 10:45:02;28.5;78;480;0.0;0.85;145.2;7.82;165;4.2;1012.3
```

---

### C. Sistem Pengiriman Eksternal Integrasi Cloud (Cloud Push Upward)
Selain menangkap data, sistem terminal aplikasi cerdas ini mampu melakukan "Smart Forwarding" ke cloud server eksternal:

1.  **HTTP REST API Webhook Client**
    *   **Protokol**: HTTP POST Request dengan payload terstruktur.
    *   **Endpoint**: URL tujuan kustom (default: `https://api.portmarine.gov/aws/v1`) untuk integrasi data tingkat nasional atau instansi BMKG daerah setempat.
    *   **Interval**: Mengirimkan bundle log telemetry maritim secara berkala sesuai frekuensi sinkronisasi yang ditentukan.
2.  **FTP Server Automated Archiver**
    *   Aplikasi dapat mengunggah cadangan log dalam bentuk file XML standar atau biner aman ke server FTP cadangan secara otomatis menggunakan pengaturan kredensial FTP (`Host`, `User`, `Pass`, dan `Directory Path`).

---

