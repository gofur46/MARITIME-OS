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

## 💾 6. STRUKTUR DATABASE (XAMPP COMPATIBLE) & OFFLINE BUFFER RESILIENCE

Untuk menjamin kedaulatan data dan mencegah hilangnya rekaman sensor penting ketika server penerima mengalami gangguan (*down*), aplikasi ini dilengkapi dengan arsitektur penyimpanan ganda (*Dual-Storage Architecture*).

### A. Struktur Tabel Database XAMPP (MySQL / MariaDB)
Jika Anda menggunakan modul database **XAMPP (MySQL/MariaDB)** untuk mengarsipkan data telemetri jangka panjang, Anda dapat menduplikasi struktur skema relasional yang kompatibel penuh dengan data keluaran aplikasi ini.

#### 🛠️ Query SQL DDL untuk phpMyAdmin / XAMPP:
```sql
CREATE DATABASE IF NOT EXISTS db_pelabuhan_telemetry;
USE db_pelabuhan_telemetry;

CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
*Arsitektur kolom ini memetakan seluruh parameter stasiun cuaca pelabuhan secara linear dan presisi dari baris data masukan.*

---

### B. Integrasi Otomatis & Konektor PHP (api.php) untuk XAMPP

Aplikasi ini berjalan langsung dari dalam cloud sandbox browser Anda. Karena pembatasan keamanan web (*browser sandboxing*), web browser tidak diizinkan membuat koneksi mentah binner TCP langsung ke port database lokal MySQL (`3306`) Anda. Untuk menjembatani pengiriman data otomatis secara real-time ke database XAMPP Anda, jembatan API PHP yang ringan sangat direkomendasikan.

#### 🔧 Panduan Penyusunan Konektor PHP (api.php):

1. **Langkah 1: Buat Folder di htdocs**
   Buat folder baru bernama `aws_marine` di dalam folder `htdocs` instalasi XAMPP Anda. Biasanya terletak di jalur default:
   * **Windows**: `C:\xampp\htdocs\aws_marine\`
   * **macOS / Linux**: `/opt/lampp/htdocs/aws_marine/` atau `/var/www/html/aws_marine/`

2. **Langkah 2: Buat File api.php**
   Salin kode PHP di bawah ini, buat file teks baru bernama `api.php` di dalam direkotori `aws_marine` tersebut, lalu tempel kodenya dan simpan.

   ```php
   <?php
   // Mengizinkan CORS demi kelancaran pertukaran data asinkron dari browser
   header("Access-Control-Allow-Origin: *");
   header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
   header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
   header("Content-Type: application/json; charset=UTF-8");

   if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
       http_response_code(200);
       exit();
   }

   $host = "localhost";
   $username = "root";
   $password = ""; // Secara default, password root di XAMPP kosong

   try {
       $conn = new PDO("mysql:host=$host", $username, $password);
       $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
       
       // Otomatis membuat database jika belum ada
       $conn->exec("CREATE DATABASE IF NOT EXISTS db_pelabuhan_telemetry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
       $conn->exec("USE db_pelabuhan_telemetry;");

       // Otomatis membuat tabel struktur sensor jika belum ada (Auto-Installer)
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
       echo json_encode(["status" => "error", "message" => "Database Setup Failed: " . $e->getMessage()]);
       exit();
   }

   // Memproses pengiriman log telemetri baru (POST Request)
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
       // GET Request atau Test Connection biasa
       echo json_encode([
           "status" => "success",
           "message" => "XAMPP Gateway active! Database 'db_pelabuhan_telemetry' and Table 'tbl_sensor_logs' successfully checked/constructed."
       ]);
   }
   ?>
   ```

3. **Langkah 3: Jalankan Layanan di XAMPP Control Panel**
   Buka panel control XAMPP Anda, pastikan layanan **Apache** dan **MySQL** telah dihidupkan (berwarna hijau).

4. **Langkah 4: Jalankan Test Connection dari Dashboard**
   Dari dalam menu database aplikasi UI ini, Anda dapat langsung mengklik tombol **"⚡ Test Connection & Auto-Create Table"**. Jembatan API akan merespon dengan status sukses dan secara ajaib membuat database `db_pelabuhan_telemetry` serta tabel `tbl_sensor_logs` untuk pertama kalinya secara otomatis tanpa perlu melakukan copy-paste manual query di phpMyAdmin.

---

### C. Mekanisme Proteksi Data Hilang (Offline Buffer Storage)
Aplikasi ini memiliki sistem **Penyimpanan Lokal Mandiri (Local Offline Cache Buffer)** terintegrasi untuk menangani kondisi darurat ketika jaringan internet terputus, atau server penerima (*HTTP/FTP upstream*) padam:

1.  **Local Memory State Queue + LocalStorage Recovery**
    *   Setiap kali paket data sensor masuk dari stasiun cuaca (melalui **Serial** or **TCP**), data akan langsung ditulis ke dalam antrean memori lokal teramankan (*Client-Ledger Queue*).
    *   Sistem menyinkronkan data log historis ke dalam media penyimpanan non-volatile browser (`localStorage`). Sehingga jika aplikasi tidak sengaja ditutup atau halaman web disegarkan (*page refresh*), riwayat data sensor penting **TIDAK AKUAN HILANG** dan tetap tersimpan rapi di perangkat operator pelabuhan.
2.  **Mekanisme "Buffer-Hold & Delayed Sync"**
    *   Selama server penerima eksternal mati (*disconnected/offline state*), aplikasi akan terus mengumpulkan dan menumpuk log telemetri di tabel **Data Telemetry Ledger** dashboard lokal.
    *   Operator dapat mengonfirmasi status antrean data melalu indikator visual status **SCADA Connection** di dashboard.
3.  **Manual & Auto CSV Synchronizer (One-Click Reconciliation)**
    *   Setelah server penerima atau jaringan telah kembali pulih berganti status menjadi online, operator pelabuhan dapat langsung mengunduh seluruh saldo antrean data offline tersebut dengan menekan tombol **Export CSV** di Tab **Database**.
    *   File CSV hasil ekspor tersebut memiliki format kolom komparatif yang identik tinggi dengan tabel SQL di XAMPP, memudahkan operator untuk mengunggah langsung (*import*) log yang sempat tertahan ke database phpMyAdmin tanpa ada satu baris pun data yang tercecer.

---

### C. Algoritma Akumulasi & Rata-rata 10 Menit (Standardisasi BMKG & WMO)
Sistem ini mengimplementasikan teknik filtrasi statistik standar **WMO (World Meteorological Organization)** di mana data tidak ditulis mentah-mentah setiap detik ke database demi menghindari noise gelombang atau tiupan angin yang terlalu fluktuatif (*gush noise*).

1.  **Metodologi Pooling Data:**
    *   **Sampel Sesaat (Instantaneous samples)**: Ditangkap setiap 1-5 detik oleh unit sirkuit mikrokontroler (atau simulator asinkronus internal).
    *   **Buffer Penampungan Temp (Windowing Buffer)**: Setiap nilai dimasukkan ke dalam antrean kalkulator sementara selama rentang jendela waktu 10-menit berjalan (*rolling 10-minute window*).
2.  **Rumus Perhitungan Rata-Rata Parameter:**
    *   **Suhu, Kelembaban, Tekanan, pH, dan Level Air**: Dihitung menggunakan rata-rata aritmatika murni:
        $$\bar{X} = \frac{1}{N} \sum_{i=1}^{N} X_i$$
    *   **Arah & Kecepatan Angin (Vector Average)**: Arah angin dihitung berdasarkan rata-rata komponen vektor polar ($u$ dan $v$) untuk mencegah kesalahan kalkulasi matematika (contoh: rata-rata antara $350^\circ$ utara dan $10^\circ$ utara dihitung secara akurat sebagai $0^\circ$ atau utara sejati, bukan $180^\circ$ selatan).
    *   **Curah Hujan (Rainfall)**: Menggunakan akumulasi penjumlahan total ($Integration$) kumulatif tinggi air yang tercurah selama interval 10 menit tersebut, bukan dicari rata-ratanya.
3.  **Manfaat Utama Sistem Rata-rata 10 Menit:**
    *   **Efisiensi Penyimpanan (XAMPP Friendly)**: Mengurangi jumlah total transaksi tulis (*write query*) PHP/MySQL dari yang semula $86.400$ baris per hari (jika disimpan tiap 1 detik) menjadi hanya **144 baris per hari** (berserial interval 10 menit). Hal ini menjamin database XAMPP Anda berjalan mulus bertahun-tahun tanpa penurunan kecepatan operasional keras.
    *   **Data Validitas Tinggi**: Eliminasi noise gelombang laut mendadak (*sea waves crest*) atau hembusan angin acak (*wind gusts*), memberikan data tren pelabuhan sejati yang optimal untuk keselamatan penyandaran kapal laut.

---

### D. Panduan Setup Autostart (Menjalankan Otomatis Saat Windows Boot)

Agar stasiun pemantauan pelabuhan AWS Marine Board ini dapat berjalan secara mandiri dan otomatis kembali menyala tanpa intervensi manual saat komputer / server Windows dinyalakan (booting/restart), Anda dapat mengikuti dua langkah praktis berikut ini:

#### 1. Konfigurasi Autostart XAMPP (Apache & MySQL sebagai Service)
Untuk memastikan basis data MariaDB dan jembatan API PHP (`api.php`) langsung aktif secara otomatis setelah PC dinyalakan:
1. Buka aplikasi **XAMPP Control Panel** dengan hak akses administrator (Klik kanan -> *Run as administrator*).
2. Di pojok kanan atas, klik tombol **Config**.
3. Di dalam jendela pengaturan "Configuration of Control Panel", centang kotak (*checkbox*) **Apache** dan **MySQL** di bawah kolom **Autostart of modules**.
4. Klik **Save** untuk menyimpan perubahan.
5. *(Opsional)* Jika Anda ingin XAMPP Control Panel berjalan langsung di latar belakang (*system tray*) saat startup Windows:
   * Tekan tombol pintas **Win + R** pada keyboard Anda, ketik `shell:startup`, lalu tekan **Enter**. Ini akan membuka folder Startup Windows.
   * Buat pintasan (*shortcut*) dari aplikasi `xampp-control.exe` (biasanya terletak di `C:\xampp\`) lalu pindahkan atau salin pintasannya ke dalam folder Startup tersebut.

---

#### 2. Konfigurasi Autostart Aplikasi Antarmuka (React / Web Node Server)

Anda dapat memilih salah satu dari dua metode di bawah ini untuk menjalankan aplikasi web lokal secara otomatis saat Windows aktif:

##### **Metode A: Menggunakan Folder Windows Startup (Jendela CMD Tetap Terbuka)**
Metode ini adalah yang paling sederhana apabila Anda masih ingin melihat jendela hitam terminal (*Command Prompt*) yang memantau log sistem saat berjalan secara langsung:
1. Buat file script Batch baru bernama `start_aws_marine.bat` menggunakan Notepad atau Text Editor lainnya.
2. Tuliskan baris perintah di bawah ini (sesuaikan dengan lokasi folder proyek Anda):
   ```cmd
   @echo off
   :: Pindah ke direktori tempat Anda mengekstrak source code proyek ini
   cd /d "C:\lokasi\folder_aws_project"
   
   :: Menjalankan server aplikasi web lokal
   npm run dev
   ```
3. Simpan file tersebut.
4. Buat pintasan (*shortcut*) baru dari file `start_aws_marine.bat` tersebut.
5. Tempel (*paste*) file shortcut tersebut ke dalam folder Startup Windows:
   * Tekan **Win + R**, ketik `shell:startup`, lalu tekan **Enter**.
   * Letakkan file shortcut batch tersebut di sana.

---

##### **Metode B: Mendaftarkan sebagai Windows Service Resmi (Berjalan Sunyi di Latar Belakang - RECOMMENDED) ⭐**
Jika Anda menginginkan aplikasi ini berjalan secara profesional sebagai layanan sistem latar belakang (**Windows Service**) yang sepenuhnya sunyi (*headless/no terminal window visible*), berjalan bebas sebelum ada user yang login (*pre-login background execution*), dan memiliki penanganan pemulihan restart otomatis jika mati:

Anda dapat menggunakan utilitas open-source standar industri bernama **NSSM (Non-Sucking Service Manager)**:

###### **Langkah Alur Instalasinya:**
1. **Unduh NSSM:**
   * Download NSSM dari situs resminya di `https://nssm.cc/download`.
   * Ekstrak file zip tersebut, lalu salin file `nssm.exe` yang sesuai dengan arsitektur OS Anda (biasanya di dalam folder `win64/`) ke direktori aman, misalnya ke `C:\windows-utils\nssm.exe` ATAU langsung masukkan ke dalam folder proyek Anda.

2. **Daftarkan Layanan Menggunakan Command Prompt:**
   > ⚠️ **PENTING (Jangan Di-double Click langsung!):**
   > Jika Anda langsung melakukan klik dua kali (*double-click*) pada file `nssm.exe` di File Explorer, maka akan muncul jendela panduan penggunaan saja (*Usage help popup* seperti yang muncul pada tangkapan layar di atas). Ini normal karena NSSM membutuhkan argumen teks spesifik untuk memanggil jendela GUI-nya.
   > 
   > **Cara yang Benar:**
   1. Klik tombol **Start Windows**, ketik `cmd`.
   2. Klik kanan pada **Command Prompt** lalu pilih **Run as administrator**.
   3. Buka folder dari tempat ekstraksi NSSM Anda dengan mengetik cd (Contoh: `cd /d "C:\lokasi\ekstrak\nssm\win64"`).
   4. Tulis perintah berikut dan tekan **Enter**:
      ```cmd
      nssm install AWSMarineTelemetry
      ```
   *(Setelah menekan Enter, jendela GUI installer yang asli dengan form isian parameter baru akan segera terbuka secara otomatis!)*
   
3. **Konfigurasikan Parameter Service pada Jendela GUI NSSM yang muncul:**
   * **Path**: `C:\Windows\System32\cmd.exe`
   * **Startup directory**: Isi dengan jalur direktori absolut dari proyek AWS Marine Anda:
     Contoh: `C:\MARITIME-OS-main\MARITIME-OS-main`
   * **Arguments**: Harus diisi dengan argumen awalan `/c` sebelum nama file batch, yaitu:
     `/c start_aws_marine.bat`
     
     > ⚠️ **BENTUK KORREKSI DARI TANGKAPAN LAYAR ANDA:**
     > Pada tangkapan layar Anda, Arguments hanya terisi `start_aws_marine.bat`. Tanpa menuliskan kata kunci **`/c`** di depannya, Windows `cmd.exe` hanya akan terbuka dalam mode interaktif kosong dan **tidak akan pernah mengeksekusi** file batch atau perintah Node di dalamnya! Pastikan Anda mengetik:
     > **`/c start_aws_marine.bat`**

4. **Konfigurasi Tab Pilihan Lainnya:**
   * Masuk ke tab **Details**:
     * **Display name**: `AWS Port Marine Telemetry Server`
     * **Description**: `Layanan background pengumpul telemetri sensor pelabuhan dan sinkronisasi MariaDB XAMPP lokal.`
     * **Startup type**: Pilih **Automatic** agar otomatis langsung berjalan saat Windows booting tanpa perlu ada pengguna yang melakukan login.
   * Klik tombol **Install service**.

5. **Nyalakan Layanan Secara Manual Pertama Kali:**
   * Tekan tombol **Win + R**, ketik `services.msc`, lalu tekan **Enter** untuk membuka panel pengatur Windows Services.
   * Cari layanan bernama **AWS Port Marine Telemetry Server**.
   * Klik kanan pada layanan tersebut, lalu klik **Start**.
   * Selesai! Aplikasi Anda sekarang sepenuhnya dikunci aman sebagai bagian dari core service Windows dan berjalan secara transparan tanpa mengganggu tampilan layar desktop.

---

### **E. SOLUSI MENGHILANGNYA LOCALHOST:3000 KETIKA RUNNING SERVICE (TROUBLESHOOTING)**

Jika layanan Windows Service Anda tertulis **"Running"** tapi `localhost:3000` tidak bisa diakses dan memunculkan error page (kosong), hal ini disebabkan oleh **dua masalah utama**:

#### **Masalah 1: Lupa Menuliskan `/c` dalam Arguments NSSM**
*   **Analisis**: Tanpa `/c` sebelum nama file batch, `cmd.exe` menolak mengeksekusi file batch Anda.
*   **Cara Edit Service yang Sudah Terlanjur Dibuat**:
    1. Buka CMD sebagai administrator.
    2. Jalankan perintah edit NSSM:
       ```cmd
       nssm edit AWSMarineTelemetry
       ```
    3. Di tab **Application**, ubah nilai **Arguments** menjadi: `/c start_aws_marine.bat`
    4. Klik **Edit service**.
    5. Masuk ke `services.msc`, klik kanan layanan, lalu lakukan **Restart**.

#### **Masalah 2: Lingkungan `Local System Account` Tidak Mengenal Perintah `npm`**
Secara default, Windows Service berjalan di bawah nama akun istimewa **"Local System"**. Akun bawaan Windows ini **tidak memiliki akses** ke folder program yang terinstall di profile pengguna Anda (termasuk PATH lokasi `node` / `npm` Anda). Akibatnya, saat service berjalan, script batch gagal menemukan program `npm` dan langsung crash di latar belakang tanpa memberi tahu Anda.

*   **Solusi Terbaik & Paling Direkomendasikan (Ubah Hak Akses Log on):**
    Mengubah hak akses eksekusi service agar menggunakan akun Windows personal Anda sendiri yang terbukti sudah terinstall Node.js dengan benar:
    1. Buka Windows Services (jalankan `services.msc`).
    2. Cari layanan **AWS Port Marine Telemetry Server**, klik kanan lalu pilih **Properties**.
    3. Masuk ke tab **Log On** (berada di bagian atas di samping tab *General*).
    4. Ubah pilihan radio button dari **Local System account** menjadi **This account**.
    5. Klik **Browse...**, kemudian masukkan nama pengguna Windows Anda (atau klik *Advanced* -> *Find Now* -> pilih nama akun Anda yang biasanya digunakan untuk login ke komputer). Klik **OK**.
    6. Masukkan password akun login Windows komputer Anda di kolom password (kosongkan jika akun Windows Anda tidak memiliki password).
    7. Klik **Apply** dan **OK** (akan muncul petunjuk bahwa pilihan ini akan diterapkan sehabis service di-restart).
    8. Di daftar service, klik kanan **AWS Port Marine Telemetry Server** lalu pilih **Restart**.

*   **Solusi Alternatif (Menggunakan Path Node.js Absolut di File Batch):**
    Jika Anda ingin menggunakan path absolut, mari analisa baris script yang Anda tanyakan:
    ```cmd
    @echo off
    cd /d "C:\lokasi\folder_aws_project"
    "C:\MARITIME-OS-main\MARITIME-OS-main\nodejs\npm.cmd" run dev
    ```
    
    Ada **dua hal** yang perlu dikoreksi agar script tersebut berfungsi dengan benar:
    
    1. **Ubah `cd /d "C:\lokasi\folder_aws_project"`** sesuai dengan direktori proyek Anda yang sebenarnya. Berdasarkan gambar jendela NSSM Anda, jalurnya adalah:
       `C:\MARITIME-OS-main\MARITIME-OS-main`
    2. **Pastikan letak folder `nodejs` Anda sudah benar.** Apakah Anda menaruh folder program Node.js portable di dalam folder proyek tersebut? 
       * **Jika YA (Anda mengekstrak Node portable di sana):** Pastikan folder `nodejs` tersebut memang ada di dalam `C:\MARITIME-OS-main\MARITIME-OS-main\nodejs`. Jika benar, maka path `"C:\MARITIME-OS-main\MARITIME-OS-main\nodejs\npm.cmd"` sudah tepat.
       * **Jika TIDAK (Anda menginstal Node secara normal di Windows):** Biasanya Node.js terletak di program files bawaan Windows, yaitu:
         `"C:\Program Files\nodejs\npm.cmd"`

    **Berikut adalah draft file `.bat` yang sudah dikoreksi dan siap Anda gunakan (Pilih salah satu di bawah ini yang sesuai dengan cara install Node Anda):**

    **Pilihan 1 (Jika menginstal Node.js installer normal/default):**
    ```cmd
    @echo off
    :: 1. Berpindah ke folder asli proyek Anda
    cd /d "C:\MARITIME-OS-main\MARITIME-OS-main"

    :: 2. Menjalankan npm dengan path default Windows
    "C:\Program Files\nodejs\npm.cmd" run dev
    ```

    **Pilihan 2 (Jika Anda mengekstrak Node.js portable ke dalam folder proyek Anda):**
    ```cmd
    @echo off
    :: 1. Berpindah ke folder asli proyek Anda
    cd /d "C:\MARITIME-OS-main\MARITIME-OS-main"

    :: 2. Menjalankan npm dari folder portable lokal Anda
    "C:\MARITIME-OS-main\MARITIME-OS-main\nodejs\npm.cmd" run dev
    ```

#### **Masalah 3: 'vite' is not recognized as an internal or external command**
*   **Analisis**: Pesan error ini muncul karena folder pustaka **`node_modules`** belum terinstall di komputer lokal Anda (atau terhapus/gagal terunduh saat pemindahan folder proyek). Tanpa folder ini, perintah `npm run dev` tidak tahu di mana harus menemukan program pembangun server bernama `vite`.
*   **Cara Mengatasinya**:
    1. Pastikan Anda sedang terhubung ke internet.
    2. Buka **Command Prompt (CMD)** Anda seperti biasa.
    3. Masuk ke folder proyek Anda terlebih dahulu dengan mengetik perintah berikut:
       ```cmd
       cd /d "C:\MARITIME-OS-main\MARITIME-OS-main"
       ```
    4. Jalankan perintah instalasi seluruh pustaka pendukung bawaan dengan mengetik:
       ```cmd
       npm install
       ```
       *(Tunggu hingga proses pengunduhan selesai. Windows akan otomatis mengunduh program `vite` dan pustaka-pustaka React yang diperlukan ke dalam direktori proyek Anda).*
    5. Setelah proses instalasi selesai (ditandai dengan kembalinya kursor perintah CMD Anda), silakan jalankan kembali perintah manual dambaan Anda:
       ```cmd
       npm run dev
       ```
       *(Kini server lokal seharusnya sudah bisa menyala dengan normal tanpa kendala!)*
    6. Setelah dijalankan manual terbukti sudah aman dan `localhost:3000` menyala, Anda bisa menutup CMD manual tersebut, lalu pergi ke jendela `services.msc` dan tekan tombol **Start** pada layanan **AWS Port Marine Telemetry Server** agar ia berjalan tenang di latar belakang (*background*).

#### **Cara Melihat Log Kesalahan Service Melalui NSSM (Redirect Output):**
Agar Anda bisa memantau jika ada error lain:
1. Jalankan perintah `nssm edit AWSMarineTelemetry` di CMD Admin.
2. Masuk ke tab **I/O**.
3. Di bagian **Output (stdout)**, isikan lokasi file penampung log Anda, misal: `C:\MARITIME-OS-main\MARITIME-OS-main\stdout.log`
4. Di bagian **Error (stderr)**, isikan lokasi file penampung log error Anda, misal: `C:\MARITIME-OS-main\MARITIME-OS-main\stderr.log`
5. Simpan / Klik **Edit service**, lalu lakukan **Restart** service.
6. Sekarang, buka file `stderr.log` di dalam folder Anda menggunakan Notepad. Seluruh pesan kesalahan dari aplikasi atau Node.js akan tertulis lengkap di sana sehingga troubleshooting menjadi sangat presisi!

---
*Dokumen ini dibuat secara otomatis oleh sistem asisten virtual AI Studio sebagai panduan operasional integrasi aplikasi.*
