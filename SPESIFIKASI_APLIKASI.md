# SPESIFIKASI SISTEM MONITORING METEOROLOGI MARITIM & PELABUHAN
*(Maritime Meteorological & Port Monitoring System Specification)*

Dokumen ini berisi spesifikasi teknis lengkap, fitur unggulan, arsitektur menu, skema transmisi data kustom, serta panduan instalasi komprehensif mulai dari setup aplikasi utama hingga manajemen server database PostgreSQL dan layanan background Windows Service menggunakan NSSM (Non-Sucking Service Manager).

---

## 📌 1. DESKRIPSI UMUM APLIKASI
Aplikasi ini adalah **Maritime Telemetry Command Center Dashboard** terintegrasi yang berfungsi sebagai pusat kendali untuk memantau data cuaca maritim, dinamika atmosfer, karakteristik gelombang laut, kualitas keasaman air, dan arah angin secara real-time. Dirancang khusus untuk menjamin keselamatan aktivitas penyandaran kapal (*vessel berthing*), efisiensi logistik bongkar muat, serta mitigasi risiko bencana di wilayah pelabuhan.

Aplikasi ini mengadopsi teknologi modern berbasis web dengan arsitektur tangguh, dilengkapi backup database asinkron (PostgreSQL) serta resilience data offline ketika terjadi pemutusan jaringan atau pemadaman listrik darurat.

---

## 🛠️ 2. DASHBOARD & FITUR UNGGULAN SYSTEM (ARTEFAK MENU)

Sistem antarmuka terbagi atas 4 tab fungsional utama yang dirancang ergonomis:

### A. Dashboard Real-Time Console (Tab Utama)
Menyajikan informasi krusial sensor langsung (*zero-latency*) untuk pengawasan aktivitas pelabuhan instan:
1. **Dermaga & Vessel Wind Compass Center**:
   * **Kompas Visual Dermaga**: Grafis interaktif 360 derajat yang menggambarkan layout dermaga pelabuhan (*Pier Angle*) dan posisi kapal kargo secara spasial.
   * **Wind Arrow Live Pointer**: Panah dinamis berotasi secara realtime demi merepresentasikan arah datang angin aktual secara presisi ke badan kapal.
   * **Dynamic Alarm Ring**: Border di sekeliling kompas berubah warna secara otomatis menjadi **Merah Berpendar (Pulse)** jika terdeteksi krisis bahaya ganda, atau **Kuning Amber** bila salah satu sensor melampaui batas waspada.
2. **Sistem Peringatan Dini Maritim (Dynamic Hazard EWS)**:
   * **SIAGA 1 (Double Hazard)**: Aktif otomatis jika Kecepatan Angin $\ge$ 12.0 m/s **dan** Tinggi Gelombang $\ge$ 1.2m secara bersamaan.
   * **WARNING ANGIN KENCANG**: Aktif jika Kecepatan Angin $\ge$ 12.0 m/s (Gelombang aman).
   * **WARNING GELOMBANG TINGGI**: Aktif jika Tinggi Gelombang $\ge$ 1.2m (Angin aman).
   * **STATUS OPERASI AMAN & NORMAL**: Aktif jika parameter di bawah ambang batas bahaya, memberikan indikator hijau terang yang menenangkan.
3. **Kondisi Atmosfer Sektor Kiri**:
   * *Thermal & Humidity Info*: Menampilkan Suhu Udara (°C), Kelembapan Relatif (RH %), serta perhitungan dinamis Titik Embun (*Dew Point*).
   * *Rain Rate & Precipitation*: Nilai curah hujan instan (mm/jam) dan sensor akumulasi presipitasi harian hulu-ke-hilir.
   * *Barometric Air Pressure STN*: Tekanan udara aktual di stasiun pengamat dalam satuan hPa.
4. **Sektor Kanan & Sensor Kualitas Air**:
   * *Solar Radiation Irradiance*: Radiasi penyinaran matahari (W/m²) dengan panel instrumen bertema militer taktis.
   * *Sea Water pH Quality Indicator*: Sensor mutakhir pengamat derajat keasaman air laut pelabuhan guna mendeteksi limbah industri maupun korosifitas lambung kapal. Dilengkapi status otomatis: **Ideal (Netral)**, **Asam**, **Basa**, atau **Bahaya Eksitasi**.
   * *Pressure ATN Altitude Profile*: Informasi taktis tekanan udara yang sejajar tinggi vertikalnya, terdiri dari parameter:
     * **STN (Station Pressure)**: Tekanan murni stasiun cuaca.
     * **QFE (Elevation Pressure)**: Tekanan dikoreksi terhadap ketinggian landasan dermaga.
     * **QFF (Sea Level)**: Tekanan ekivalen rata-rata permukaan laut (MSL).
     * **QNH (Standard Atmos)**: Pembacaan altimeter standar untuk navigasi kapal/helipad darurat pelabuhan.
5. **Wind Vector Flow Path & Chrono Flow Track**:
   * **Vector Compass Graph (24H Trace)**: Grafik historis dua dimensi yang mulus memetakan jejak perjalanan angin (arah & kecepatan) dari 24 jam terakhir secara melingkar menggunakan kalkulasi formula trigonometri SVG.
   * **Chrono Flow Sequence**: Log visual horisontal berurutan yang menampilkan rotasi panah dari 5 pembacaan sensor angin terakhir.

### B. Pusat Analisis Cuaca & Badai (Tab Analyst)
* **Forecast Line Charts**: Grafik interaktif Recharts untuk meramalkan tren gelombang air, pasang surut, tinggi ombak, dan kecepatan hembusan angin dari model cuaca 24 jam mendatang.
* **Storm & Gale Threat Radar**: Visualisasi melingkar dinamis menyerupai radar kapal militer untuk menganalisis badai regional dan mendeteksi bahaya badai tropis (*storm warning*) di wilayah koordinat pelabuhan.

### C. Basis Data & Log Sensor (Tab Database)
* **Data Telemetry Ledger**: Tabel komprehensif yang menampung ribuan rekaman detail sensor per-menit (suhu, angin, tekanan, pasut, pH air, dsb).
* **Ekspor & Filter Data**: Fitur ekspor langsung ke format `.csv` (termasuk metrik pH Air) dengan satu ketukan tombol untuk keperluaan penyerahan laporan harian ke pihak BMKG atau otoritas perhubungan laut.

### D. Pengaturan Konsol (Tab Settings)
* **Pier Angle Calibration**: Kalibrasi sudut orientasi dermaga (0-359 derajat) untuk menyinkronkan arah dermaga kompas visual dengan kondisi asli di lapangan.
* **Sistem Alarm & Toleransi**: Mengatur batas waspada bagi sensor pH air laut (standar: 6.5 - 8.5), kecepatan angin maksimum, dan tinggi gelombang perairan.
* **Database Connection Settings**: Pengaturan tautan API URL localhost PostgreSQL (`api.php`) guna menghubungkan aplikasi berbasis browser ke database lokal.

---

## 📡 3. KONEKTIVITAS & SKEMA TRANSMISI DATA

Sistem ini mentransmisikan data mentah dari stasiun fisik sensor lapangan melalui port fisik Serial Hardware atau koneksi jaringan TCP/IP Socket.

### Format Paket Data Telemetri Mentah (Raw String)
Stasiun cuaca mengirim data asinkron berbasis terminal dengan format string hemat lebar pita (*bandwidth friendly*) menggunakan pembatas titik koma (`;`):

```text
[ID_STATION];[DATE_TIME];[AIR_TEMP];[HUMIDITY];[SOLAR_RAD];[RAIN_RATE];[WAVE_HEIGHT];[WATER_LEVEL];[WATER_PH];[WIND_DIR];[WIND_SPEED];[BARO_PRESSURE]
```

**CONTOH STRING ASLI SENSOR:**
```syslog
SYS1000;2026-06-18 19:45:00;29.4;82;620;0.0;0.95;152.4;7.85;142;3.8;1011.8
```

---

## 💾 4. PANDUAN KONFIGURASI POSTGRESQL & pgADMIN

Untuk memigrasi penyimpanan dari XAMPP MySQL biasa ke basis data relasional berkinerja tinggi **PostgreSQL**, Anda harus mengonfigurasi pgAdmin dan PHP lokal Anda terlebih dahulu.

### Langkah A: Konfigurasi Database di pgAdmin 4
1. Buka aplikasi **pgAdmin 4** di komputer Anda.
2. Pada panel bagian kiri (*Browser*), perluas bagian **Servers** dan masukkan password akun administrator PostgreSQL default (`postgres`) Anda.
3. Klik kanan pada folder **Databases**, pilih **Create** -> **Database...**
4. Pada kolom **Database**, ketik:
   ```text
   db_pelabuhan_telemetry
   ```
5. Klik tombol **Save**. Database siap digunakan! *(Anda TIDAK perlu membuat tabel manual karena script api.php kami dilengkapi dengan installer otomatis).*

### Langkah B: Mengaktifkan Driver PostgreSQL di PHP
Agar executable PHP Anda (`C:\php\php.exe`) dapat berkomunikasi dengan PostgreSQL, Anda harus mengaktifkan ekstensi `pdo_pgsql`:
1. Buka folder instalasi PHP Anda (Contoh: `C:\php\`).
2. Cari dan buka file bernama `php.ini` menggunakan Notepad.
3. Tekan **Ctrl + F**, cari baris text berikut:
   ```ini
   ;extension=pdo_pgsql
   ;extension=pgsql
   ```
4. Hilangkan tanda titik koma (`;`) di depan kedua konfigurasi tersebut untuk mengizinkannya aktif berjalan:
   ```ini
   extension=pdo_pgsql
   extension=pgsql
   ```
5. Pastikan baris direktori ekstensi juga aktif (*tidak diawali titik koma*):
   ```ini
   extension_dir = "ext"
   ```
6. Simpan file `php.ini`.

---

## 🔧 5. KODE SUMBER LENGKAP api.php UNTUK POSTGRESQL

Buat file baru bernama `api.php` dan letakkan di dalam folder proyek Anda (`C:\MARITIME-OS-main\MARITIME-OS-main\api.php`). Masukkan kode berikut:

```php
<?php
/**
 * GATEWAY API PHP TO POSTGRESQL (PDO)
 * Desain Khusus untuk Keamanan Integrasi Antarmuka Web Pelabuhan
 */

// Protokol CORS demi kelancaran transmisi data asinkron dari browser
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = "localhost";
$port = "5432";
$db_name = "db_pelabuhan_telemetry";
$user = "postgres";
$password = "123456"; // !!! GANTI DENGAN PASSWORD pgADMIN ANDA !!!

try {
    // Hubungkan ke server PostgreSQL default (postgres) terlebih dahulu untuk auto-create database jika belum ada
    $pdo_init = new PDO("pgsql:host=$host;port=$port;dbname=postgres", $user, $password);
    $pdo_init->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Periksa eksistensi db_pelabuhan_telemetry
    $stmt = $pdo_init->query("SELECT 1 FROM pg_database WHERE datname = '$db_name'");
    $exists = $stmt->fetchColumn();
    
    if (!$exists) {
        $pdo_init->exec("CREATE DATABASE $db_name");
    }
    unset($pdo_init); // Tutup koneksi postgres init

    // Hubungkan langsung ke db_pelabuhan_telemetry
    $conn = new PDO("pgsql:host=$host;port=$port;dbname=$db_name", $user, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // AUTO-INSTALLER: Membuat tabel tbl_sensor_logs jika belum ada di PostgreSQL
    $sql_table = "CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
        id SERIAL PRIMARY KEY,
        station_id VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        temperature DECIMAL(5,2) NOT NULL,
        humidity INTEGER NOT NULL,
        solar_radiation INTEGER NOT NULL,
        rainfall DECIMAL(5,2) NOT NULL,
        wave_height DECIMAL(4,2) NOT NULL,
        sea_level DECIMAL(5,1) NOT NULL,
        water_ph DECIMAL(4,2) NOT NULL,
        wind_direction INTEGER NOT NULL,
        wind_speed DECIMAL(4,1) NOT NULL,
        pressure DECIMAL(6,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );";
    $conn->exec($sql_table);

    // AUTO-INSTALLER: Membuat tabel tbl_moxa_status jika belum ada di PostgreSQL
    $sql_status_table = "CREATE TABLE IF NOT EXISTS tbl_moxa_status (
        id SERIAL PRIMARY KEY,
        connected BOOLEAN NOT NULL,
        moxa_ip VARCHAR(50) NOT NULL,
        moxa_port INTEGER NOT NULL,
        state VARCHAR(50) NOT NULL,
        error TEXT,
        last_seen VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );";
    $conn->exec($sql_status_table);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Setup Database PostgreSQL Gagal: " . $e->getMessage()
    ]);
    exit();
}

// Memproses input POST dari aplikasi Client / Daemon
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);

    // Menyimpan Status Daemon Moxa
    if (isset($data['action']) && $data['action'] === 'save_moxa_status') {
        try {
            // Bersihkan status lama agar hemat ruang
            $conn->exec("TRUNCATE tbl_moxa_status");
            
            $stmt = $conn->prepare("INSERT INTO tbl_moxa_status (
                connected, moxa_ip, moxa_port, state, error, last_seen
            ) VALUES (
                :connected, :moxa_ip, :moxa_port, :state, :error, :last_seen
            )");

            $stmt->execute([
                ':connected' => $data['connected'] ? 1 : 0,
                ':moxa_ip' => $data['moxa_ip'],
                ':moxa_port' => (int)$data['moxa_port'],
                ':state' => $data['state'],
                ':error' => isset($data['error']) ? $data['error'] : '',
                ':last_seen' => isset($data['last_seen']) ? $data['last_seen'] : date('H:i:s')
            ]);

            echo json_encode(["status" => "success", "message" => "Status Moxa berhasil disimpan!"]);
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal menyimpan status Moxa: " . $e->getMessage()]);
            exit();
        }
    }

    // Menyimpan Data Sensor (Log Telemetri)
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

            echo json_encode(["status" => "success", "message" => "Data tersimpan di PostgreSQL!"]);
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal menulis ke database: " . $e->getMessage()]);
            exit();
        }
    }
} else {
    // GET Request: Mendapatkan log data atau status/config Moxa
    if (isset($_GET['get_telemetry_logs'])) {
        try {
            $stmt = $conn->query("SELECT * FROM tbl_sensor_logs ORDER BY timestamp DESC LIMIT 200");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($rows);
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal mengambil data log: " . $e->getMessage()]);
            exit();
        }
    }

    if (isset($_GET['get_moxa_status'])) {
        try {
            $stmt = $conn->query("SELECT * FROM tbl_moxa_status ORDER BY id DESC LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                echo json_encode([
                    "connected" => (bool)$row['connected'],
                    "moxa_ip" => $row['moxa_ip'],
                    "moxa_port" => (int)$row['moxa_port'],
                    "state" => $row['state'],
                    "last_seen" => $row['last_seen'],
                    "error" => $row['error']
                ]);
            } else {
                echo json_encode([
                    "connected" => false,
                    "moxa_ip" => "192.168.1.254",
                    "moxa_port" => 4001,
                    "state" => "OFFLINE",
                    "error" => "No status recorded yet."
                ]);
            }
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal membaca status: " . $e->getMessage()]);
            exit();
        }
    }

    if (isset($_GET['get_moxa_config'])) {
        try {
            $stmt = $conn->query("SELECT * FROM tbl_moxa_status ORDER BY id DESC LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                echo json_encode([
                    "moxa_ip" => $row['moxa_ip'],
                    "moxa_port" => $row['moxa_port']
                ]);
            } else {
                echo json_encode([
                    "moxa_ip" => "192.168.1.254",
                    "moxa_port" => 4001
                ]);
            }
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal membaca config: " . $e->getMessage()]);
            exit();
        }
    }

    // Default Response (Tes Koneksi)
    echo json_encode([
        "status" => "success",
        "message" => "Koneksi PostgreSQL Aktif & Siap Menerima Data Maritim!"
    ]);
}
?>
```

---

## 🛡️ 6. AUTO-RUN WINDOWS SERVICE LAYANAN GANDA MENGGUNAKAN NSSM

Untuk menjamin sistem terus memantau pelabuhan tanpa harus menyalakan Command Prompt secara manual (bila terjadi pemadaman listrik tiba-tiba dan menyala kembali), kita mendaftarkan **dua Windows Service otomatis seketika**.

### Langkah 1: Siapkan File batch untuk Aplikasi Utama
Buat file bernama `start_aws_marine.bat` di dalam folder proyek Anda (`C:\MARITIME-OS-main\MARITIME-OS-main\start_aws_marine.bat`) menggunakan Notepad. Masukkan baris berikut:

```cmd
@echo off
:: Berpindah ke direktori absolut dari aplikasi utama
cd /d "C:\MARITIME-OS-main\MARITIME-OS-main"

:: Jalankan aplikasi visual utama
"C:\Program Files\nodejs\npm.cmd" run dev
```

### Langkah 2: Unduh & Ekstrak NSSM
1. Kunjungi `https://nssm.cc/download` dan unduh file `.zip` versi terbaru.
2. Ekstrak file exe, lalu temukan file di dalam folder `win64\nssm.exe`.
3. Letakkan file `nssm.exe` di dalam direktori proyek Anda guna mempermudah pemanggilan (`C:\MARITIME-OS-main\MARITIME-OS-main\nssm.exe`).

### Langkah 3: Daftarkan Service Aplikasi Utama (Port 3000)
1. Klik tombol **Start Windows**, ketik `cmd`.
2. Klik kanan pada **Command Prompt**, pilih **Run as administrator** (Wajib).
3. Pindah ke direktori proyek Anda:
   ```cmd
   cd /d "C:\MARITIME-OS-main\MARITIME-OS-main"
   ```
4. Jalankan perintah instalasi layanan visual utama:
   ```cmd
   nssm install AWSMarineTelemetry
   ```
5. Jendela antarmuka GUI NSSM akan segera terbuka. Konfigurasikan seperti berikut:
   * **Path**: `C:\Windows\System32\cmd.exe`
   * **Startup directory**: `C:\MARITIME-OS-main\MARITIME-OS-main`
   * **Arguments**: `/c start_aws_marine.bat` *(PENTING: Jangan lupa menuliskan `/c` di depannya)*
6. Klik tab **Details** dan atur:
   * **Display name**: `AWS Port Marine Telemetry Server`
   * **Description**: `Layanan background pengumpul telemetri sensor pelabuhan dan panel visual dashboard.`
   * **Startup type**: `Automatic`
7. Klik tombol **Install service**.

---

### Langkah 4: Daftarkan Service PHP-PostgreSQL Gateway (Port 8000)
Agar file `api.php` di atas selalu siaga di port `8000` tanpa operator harus menyalakan cmd:
1. Kembali ke **Command Prompt** (Run as admin) yang masih terbuka tadi.
2. Tulis perintah instalasi layanan gateway PHP:
   ```cmd
   nssm install AWSPHPPostgresGateway
   ```
3. Jendela installer GUI NSSM kedua akan muncul. Isi konfigurasi sebagai berikut:
   * **Path**: `C:\php\php.exe` *(Arahkan ke file executable PHP Anda)*
   * **Startup directory**: `C:\MARITIME-OS-main\MARITIME-OS-main` *(Direktori yang menampung file api.php)*
   * **Arguments**: `-S localhost:8000` *(Membuat PHP Web Server lokal berjalan seumur hidup)*
4. Masuk ke tab **Details**:
   * **Display name**: `AWS PHP-PostgreSQL Bridge Gateway`
   * **Description**: `Jembatan API PHP yang memetakan paket sensor ke database PostgreSQL lokal.`
   * **Startup type**: `Automatic`
5. Klik tombol **Install service**.

---

### Langkah 5: Solusi Hak Akses Log On (Menghindari Kegagalan Startup)
Secara default, Windows menjalankan Service baru dengan profil akun **"Local System account"**. Akun ini sering kali **tidak memiliki akses PATH** ke program user biasa (seperti Node, npm atau PHP). Untuk mengembalikannya agar berjalan normal:

1. Tekan tombol **Win + R**, ketik `services.msc`, lalu tekan **Enter**.
2. Cari layanan **AWS Port Marine Telemetry Server**. Klik kanan, lalu pilih **Properties**.
3. Masuk ke tab **Log On**:
   * Ubah tanda bulat dari *Local System account* menjadi **This account**.
   * Klik tombol **Browse...**, isikan nama akun pengguna akun Windows Anda (atau klik *Advanced* -> *Find Now* -> pilih username pc Anda). Klik **OK**.
   * Masukkan password login PC Anda (atau kosongkan jika PC Anda tidak memiliki password).
   * Klik **Apply**.
4. Lakukan hal yang sama persis untuk layanan kedua yaitu **AWS PHP-PostgreSQL Bridge Gateway** pada pilihan tab Log On-nya.
5. Klik kanan pada kedua layanan di halaman utama `services.msc`, lalu klik **Start** (atau **Restart**).

---

### Langkah 6: Konfigurasi Log Output Error (Metode Deteksi Masalah)
Jika di masa mendatang Anda ingin melacak error atau bug sistem secara pasif:
1. Jalankan CMD Admin, lalu buka konfigurasi edit:
   ```cmd
   nssm edit AWSMarineTelemetry
   ```
2. Pergi ke tab **I/O**.
3. Isikan file output log untuk memantau aktivitas:
   * **Output (stdout)**: `C:\MARITIME-OS-main\MARITIME-OS-main\stdout.log`
   * **Error (stderr)**: `C:\MARITIME-OS-main\MARITIME-OS-main\stderr.log`
4. Tekan **Edit service** untuk menyimpan. Sistem siap berjalan aman di latar belakang!

---

## ⚡ 7. MEKANISME RESILIENCE BUFFER OFFLINE & KEMBALINYA DAYA LISTRIK

Sistem didesain sangat tangguh (*resilient*) untuk meminimalkan kehilangan data saat komputer mendadak padam listrik (*blackout*):

1. **Auto-Recovery on Power Back**:
   * Ketika listrik kembali menyala dan Windows otomatis hidup (Power On State di BIOS aktif), kedua layanan **AWS Port Marine Telemetry Server** dan **AWS PHP-PostgreSQL Bridge Gateway** langsung boot-up seketika tanpa perlu menanti operator login ke Windows.
   * Jembatan API akan langsung membuka socket koneksi PostgreSQL di latar belakang.
2. **Dynamic Offline Buffer Storage (Session Memory + Local Browser Store)**:
   * Selama komputer dalam keadaan mati, stasiun cuaca fisik akan terus menyalurkan telemetry data ke panel cadangan atau menyimpannya di modul RAM hardware.
   * Dan sebaliknya, apabila hanya database PostgreSQL yang sempat terputus/crash sementara (*Gateway Offline*), aplikasi visual dashboard memiliki **sistem penyangga cerdas**. Setiap data sensor dari stasiun lapangan akan dialihkan sementara ke media penyimpanan luring non-volatile (`localStorage` browser).
   * Segera setelah PostgreSQL terkoneksi kembali, operator tinggal mengklik tombol **"Export CSV"** di tab database dan mengunggahnya langsung ke postgres demi sinkronisasi tanpa ada data yang tercecer.

---

## 📡 8. INTEGRASI MANDIRI: AUTO-CAPTURE MOXA TCP/IP GATEWAY (TANPA MEMBUKA BROWSER)

Sangat penting diperhatikan bahwa **Web Browser** berjalan pada lingkungan terproteksi (*sandbox*) yang tidak diizinkan oleh sistem operasi untuk bertindak sebagai Server atau Client Soket TCP/IP murni guna mendengarkan atau menghubungkan langsung ke jaringan perangkat nirkabel di port lokal.

Oleh karena itu, kami menyertakan **Background Daemon Client** khusus bernama `tcp_moxa_listener.js`.

### Konsep Kerja Baru (Moxa sebagai TCP Server & Aplikasi sebagai TCP Client):
1. **Moxa NPort** beroperasi dalam **TCP Server Mode**, membuka port (misalnya `10001` dengan IP Moxa e.g., `192.168.127.254`).
2. **`tcp_moxa_listener.js`** beroperasi sebagai **TCP Client**. Begitu komputer Anda menyala, daemon ini akan secara aktif melakukan panggilan (*dial/connect*) ke alamat Moxa.
3. **Mesin Autorecover & Reconnect**: Jika kabel dicabut, listrik mati, atau Moxa direstart, daemon client ini akan mendeteksi putusan, melepaskan socket usang, dan kembali melakukan percobaan jabat tangan (*handshake retry*) **setiap 5 detik** tanpa batas waktu hingga Moxa kembali online.
4. Data yang berhasil dikoleksi dikirimkan secara internal dengan metode HTTP POST ke jembatan `api.php` di port `8000` untuk ditulis ke PostgreSQL lokal.

### Langkah-langkah Memasang Layanan Client Moxa Otomatis (Service NSSM Ketiga):
1. Buka berkas `C:\MARITIME-OS-main\MARITIME-OS-main\tcp_moxa_listener.js` menggunakan Notepad.
2. Pada baris konfigurasi teratas, sesuaikan variabel berikut dengan konfigurasi Moxa Anda:
   ```javascript
   const MOXA_IP = '192.168.127.254'; // Isikan IP Address alat Moxa Anda
   const MOXA_PORT = 10001;          // Isikan port TCP Server Moxa Anda
   ```
3. Buka **Command Prompt** dengan hak akses **Administrator** (*Run as Administrator*).
4. Masuk ke direktori utama aplikasi port:
   ```cmd
   cd /d "C:\MARITIME-OS-main\MARITIME-OS-main"
   ```
5. Pasang layanan ketiga untuk listener Moxa menggunakan perintah NSSM:
   ```cmd
   nssm install AWSMoxaListener
   ```
6. Jendela GUI NSSM ketiga akan segera muncul. Atur parameternya:
   * **Path**: `node` (atau arahkan ke berkas Node.js absolut Anda, misal: `C:\Program Files\nodejs\node.exe`)
   * **Startup directory**: `C:\MARITIME-OS-main\MARITIME-OS-main`
   * **Arguments**: `tcp_moxa_listener.js`
7. Masuk ke tab **Details** dan berikan isian:
   * **Display name**: `AWS Moxa Gateway TCP/IP Client Listener`
   * **Description**: `Daemon client penangkap telemetri yang aktif mendial Moxa TCP Server Port 10001 dan memompanya langsung ke postgres.`
   * **Startup type**: `Automatic`
8. Masuk ke tab **Log On**:
   * Ubah bulatannya ke **This account** lalu masukkan profil user Windows Anda (seperti langkah Service sebelumnya) untuk menjamin hak akses path dan logs.
9. Tekan **Install Service**.
10. Jalankan layanan tersebut secara instan:
    ```cmd
    net start AWSMoxaListener
    ```

Sistem pelabuhan Anda kini telah terproteksi penuh dari mati lampu! Listrik padam, menyala kembali, Windows boot, seluruh 3 background services bekerja secara otomatis tanpa Operator harus login:
1. **Layanan Aplikasi Visual Dashboard**: Menyajikan data visual di port `3000`.
2. **Layanan Jembatan Database (api.php)**: Menerima POST request dan mengelolanya ke database PostgreSQL di port `8000`.
3. **Layanan Penangkap TCP Moxa Client**: Aktif menghubungkan komputer ke perangkat Moxa di port `10001` untuk menyerap data tangkapan cuaca real-time.

---
*Dokumen ini diperbarui secara berkala oleh tim teknisi AI Studio untuk mengawal operasional keselamatan maritim pelabuhan.*
