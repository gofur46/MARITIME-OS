import React, { useState } from 'react';
import { 
  BookOpen, Search, ArrowRight, Download, HelpCircle, AlertCircle, 
  CheckCircle, ChevronRight, Copy, Terminal, Compass, LayoutDashboard, 
  Database, RefreshCw, Anchor, Settings
} from 'lucide-react';

// Import generated guide images
// @ts-ignore
import dashboardGuideImg from '../assets/images/dashboard_guide_img_1782628660586.jpg';
// @ts-ignore
import analystGuideImg from '../assets/images/analyst_guide_img_1782628675497.jpg';
// @ts-ignore
import databaseGuideImg from '../assets/images/database_guide_img_1782628687858.jpg';
// @ts-ignore
import bmkgGuideImg from '../assets/images/bmkg_guide_img_1782628700471.jpg';

interface UserManualProps {
  stationId: string;
  stationName: string;
  localDbApiUrl: string;
}

export default function UserManual({ stationId, stationName, localDbApiUrl }: UserManualProps) {
  const [activeChapter, setActiveChapter] = useState<string>('intro');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const chapters = [
    { id: 'intro', title: '1. Pendahuluan & Arsitektur', icon: BookOpen },
    { id: 'dashboard', title: '2. Dashboard Real-time', icon: LayoutDashboard },
    { id: 'analyst', title: '3. Analisis & Tren Cuaca', icon: RefreshCw },
    { id: 'database', title: '4. Sinkronisasi Database', icon: Database },
    { id: 'bmkg', title: '5. Integrasi BMKG Maritim', icon: Anchor },
    { id: 'settings', title: '6. Konfigurasi Sistem', icon: Settings },
    { id: 'faq', title: '7. Pertanyaan Umum (FAQ)', icon: HelpCircle },
  ];

  const phpCodeSnippet = `<?php
/**
 * API Endpoint Lokal PostgreSQL / SQLite untuk RMS PRO v3
 * Letakkan file ini di webserver Anda (misal: Apache/Nginx di localhost atau server lokal)
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if (\$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Konfigurasi Database (Contoh PostgreSQL)
\$host = "localhost";
\$port = "5432";
\$dbname = "db_marine_telemetry";
\$user = "postgres";
\$password = "admin123";

try {
    \$conn = new PDO("pgsql:host=\$host;port=\$port;dbname=\$dbname", \$user, \$password);
    \$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Inisialisasi tabel jika belum ada
    \$table_sql = "CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
        id SERIAL PRIMARY KEY,
        station_id VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        temperature NUMERIC(5,2) NOT NULL,
        temp_min NUMERIC(5,2) DEFAULT 0.00,
        temp_max NUMERIC(5,2) DEFAULT 0.00,
        humidity INT NOT NULL,
        solar_radiation INT NOT NULL,
        rainfall NUMERIC(5,2) NOT NULL,
        wave_height NUMERIC(4,2) NOT NULL,
        sea_level NUMERIC(5,1) NOT NULL,
        water_ph NUMERIC(4,2) NOT NULL,
        wind_direction INT NOT NULL,
        wind_speed NUMERIC(4,1) NOT NULL,
        wind_speed_min NUMERIC(4,1) DEFAULT 0.0,
        wind_speed_max NUMERIC(4,1) DEFAULT 0.0,
        pressure NUMERIC(6,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );";
    \$conn->exec(\$table_sql);
    
} catch(PDOException \$e) {
    echo json_encode(["status" => "error", "message" => "Koneksi database gagal: " . \$e->getMessage()]);
    exit;
}

// ROUTING SEDERHANA
\$method = \$_SERVER['REQUEST_METHOD'];

if (\$method === 'GET') {
    // Ambil data log terakhir
    try {
        \$stmt = \$conn->prepare("SELECT * FROM tbl_sensor_logs ORDER BY timestamp DESC LIMIT 200");
        \$stmt->execute();
        \$logs = \$stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["status" => "success", "data" => \$logs]);
    } catch(PDOException \$e) {
        echo json_encode(["status" => "error", "message" => \$e->getMessage()]);
    }
} elseif (\$method === 'POST') {
    // Simpan data log baru
    \$json = file_get_contents('php://input');
    \$data = json_decode(\$json, true);
    
    if (isset(\$data['station_id']) && isset(\$data['timestamp'])) {
        try {
            \$stmt = \$conn->prepare("INSERT INTO tbl_sensor_logs (
                station_id, timestamp, temperature, temp_min, temp_max, humidity, solar_radiation, 
                rainfall, wave_height, sea_level, water_ph, wind_direction, wind_speed, wind_speed_min, wind_speed_max, pressure
            ) VALUES (
                :station_id, :timestamp, :temperature, :temp_min, :temp_max, :humidity, :solar_radiation, 
                :rainfall, :wave_height, :sea_level, :water_ph, :wind_direction, :wind_speed, :wind_speed_min, :wind_speed_max, :pressure
            )");

            \$stmt->execute([
                ':station_id' => \$data['station_id'],
                ':timestamp' => \$data['timestamp'],
                ':temperature' => \$data['temperature'],
                ':temp_min' => isset(\$data['temp_min']) ? \$data['temp_min'] : (\$data['temperature'] - 1.5),
                ':temp_max' => isset(\$data['temp_max']) ? \$data['temp_max'] : (\$data['temperature'] + 1.2),
                ':humidity' => \$data['humidity'],
                ':solar_radiation' => isset(\$data['solar_radiation']) ? \$data['solar_radiation'] : 0,
                ':rainfall' => isset(\$data['rainfall']) ? \$data['rainfall'] : 0.0,
                ':wave_height' => isset(\$data['wave_height']) ? \$data['wave_height'] : 0.0,
                ':sea_level' => isset(\$data['sea_level']) ? \$data['sea_level'] : 0.0,
                ':water_ph' => isset(\$data['water_ph']) ? \$data['water_ph'] : 7.0,
                ':wind_direction' => isset(\$data['wind_direction']) ? \$data['wind_direction'] : 0,
                ':wind_speed' => isset(\$data['wind_speed']) ? \$data['wind_speed'] : 0.0,
                ':wind_speed_min' => isset(\$data['wind_speed_min']) ? \$data['wind_speed_min'] : max(0.0, \$data['wind_speed'] - 1.8),
                ':wind_speed_max' => isset(\$data['wind_speed_max']) ? \$data['wind_speed_max'] : (\$data['wind_speed'] + 2.5),
                ':pressure' => isset(\$data['pressure']) ? \$data['pressure'] : 1013.25
            ]);

            echo json_encode(["status" => "success", "message" => "Data berhasil disimpan ke PostgreSQL"]);
        } catch(PDOException \$e) {
            echo json_encode(["status" => "error", "message" => \$e->getMessage()]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Parameter tidak lengkap"]);
    }
}
?>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(phpCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const downloadManual = () => {
    const markdownContent = `# MANUAL BOOK - RMS YACHT TELEMETRY SYSTEM PRO v3

Dokumen ini berisi panduan pengoperasian perangkat lunak RMS PRO v3 untuk pemantauan cuaca maritim (Automatic Weather Station).

## 1. PENDAHULUAN & ARSITEKTUR
RMS PRO v3 adalah sistem terminal konsol cuaca terintegrasi untuk kapal pesiar (yacht), pelabuhan, dan stasiun meteorologi mandiri. Sistem ini memproses input telemetry serial (RS232/RS485/USB), TCP socket, dan secara cerdas menyinkronkannya ke database PostgreSQL lokal serta membandingkannya dengan data resmi BMKG Maritim.

## 2. DASHBOARD REAL-TIME
Dashboard dirancang dengan tema gelap kontras tinggi (High-Contrast Yacht Marine Console) untuk kenyamanan mata saat berlayar di malam hari.
Metode Perhitungan Wind Gust:
Hembusan angin (Wind Gust) dihitung secara matematis menggunakan selisih antara batas kecepatan maksimum (maxSpeed) dan kecepatan minimum (minSpeed) dalam jendela buffer data sensor. Jika selisihnya >= 10 m/s (sekitar 19.4 Knot), maka sistem mendeteksi hembusan mendadak (Gust) dan mencatat kecepatan maksimum tersebut sebagai hembusan aktif.

## 3. ANALISIS & TREN CUACA
Menu ANALYST menyediakan komparasi visual menggunakan grafik area multi-axis. Anda bisa menganalisis tren 24 jam terakhir dari variabel suhu, kelembaban, tekanan, pasang surut air laut, radiasi matahari, dan tingkat keasaman air (pH).

## 4. SINKRONISASI DATABASE
RMS PRO v3 mendukung penyimpanan database lokal menggunakan API jembatan 'api.php'. Anda dapat memilih model AVG (pencatatan rata-rata per interval blok waktu, misalnya per 10 menit) atau RAW (pencatatan instan per detik).

## 5. INTEGRASI BMKG MARITIM
Sistem ini memuat API BMKG untuk 42 Pelabuhan utama di Indonesia (Banten, Jakarta, Jawa Barat, Jawa Tengah, Jawa Timur, Bali, dll.). Ini memfasilitasi perbandingan langsung antara pembacaan sensor fisik AWS dengan prakiraan resmi BMKG.

---
© 2026 RMS PRO v3 - Terminal Sistem Telemetri Maritim.`;

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manual_Book_RMS_PRO_v3.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const faqs = [
    {
      q: 'Bagaimana cara menghitung hembusan angin (Wind Gust) pada perangkat lunak ini?',
      a: 'Sistem mencatat data kecepatan angin real-time ke dalam buffer memori jangka pendek. Selisih antara Kecepatan Angin Maksimum dan Kecepatan Angin Minimum diperiksa secara konstan. Jika selisihnya mencapai atau melebihi 10 m/s (sekitar 19.4 Knot), sistem mengklasifikasikan kejadian tersebut sebagai "Wind Gust" terdeteksi, dengan nilai hembusan sama dengan kecepatan maksimum yang terekam pada periode tersebut. Formula ini mencegah gangguan noise konstan dan hanya mengisolasi lonjakan energi angin murni.'
    },
    {
      q: 'Bagaimana cara menghubungkan aplikasi ini ke database PostgreSQL lokal?',
      a: '1. Salin script jembatan "api.php" yang kami sediakan di menu ini ke web server lokal Anda (XAMPP/Laragon/Apache).\n2. Sesuaikan username, password, dan port PostgreSQL Anda di script tersebut.\n3. Masuk ke menu "OPTION" di aplikasi ini, isi kolom "Local DB API URL" dengan alamat endpoint Anda (contoh: http://localhost/api.php).\n4. Sistem akan secara otomatis menguji koneksi dan menyinkronkan data sensor Anda ke tabel tbl_sensor_logs.'
    },
    {
      q: 'Apa perbedaan antara mode penyimpanan "AVG" dan "RAW"?',
      a: 'Dalam mode "AVG" (Rata-rata), aplikasi mengumpulkan semua pembacaan sensor kecil yang diterima selama interval waktu tertentu (misalnya 10 menit), lalu menghitung rata-ratanya sebelum dikirim ke PostgreSQL. Ini menghemat penyimpanan disk server dan sangat direkomendasikan untuk operasional 24/7. Dalam mode "RAW", setiap baris data mentah instan yang masuk akan langsung ditulis ke database.'
    },
    {
      q: 'Mengapa pH air laut sangat penting untuk dipantau di pelabuhan?',
      a: 'Derajat keasaman (pH) air laut normal berkisar antara 7.8 hingga 8.2. Penurunan pH di bawah 6.5 atau kenaikan di atas 8.5 dapat mengindikasikan adanya pencemaran industri, tumpahan bahan bakar kapal di pelabuhan, atau fenomena alam berbahaya yang dapat merusak lambung kapal (korosi masif) dan ekosistem laut sekitar.'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0b1424] via-[#091a33] to-[#040912] p-6 rounded-3xl border border-[#00f0ff]/20 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#00f0ff]/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="p-4 bg-[#00f0ff]/10 border border-[#00f0ff]/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <BookOpen className="w-8 h-8 text-[#00f0ff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#00f0ff]/20 text-[#00f0ff] font-black px-2 py-0.5 rounded border border-[#00f0ff]/30 uppercase tracking-widest font-mono">
                Official User Manual v3.2
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase mt-1">
              Manual Operasional & Antarmuka Software
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Panduan lengkap tata cara pengoperasian terminal telemetri cerdas maritim <strong className="text-[#00f0ff]">RMS PRO v3</strong>.
            </p>
          </div>
        </div>

        <button 
          onClick={downloadManual}
          className="w-full sm:w-auto px-5 py-3 bg-[#00f0ff] hover:bg-[#38bdf8] text-slate-950 text-xs font-black font-mono tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:scale-105"
        >
          <Download className="w-4 h-4" />
          <span>UNDUH MANUAL (MARKDOWN)</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar of Manual */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-[#0b1424]/90 border border-white/10 rounded-2xl p-4 shadow-lg space-y-4">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-white/5 pb-2">
              Daftar Bab Panduan
            </div>
            <div className="flex flex-col gap-1">
              {chapters.map((ch) => {
                const Icon = ch.icon;
                const isSelected = activeChapter === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChapter(ch.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 border ${
                      isSelected 
                        ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30 shadow-md font-extrabold' 
                        : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${isSelected ? 'text-[#00f0ff]' : 'text-slate-500'}`} />
                    <span className="truncate">{ch.title}</span>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#00f0ff]" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari kata kunci..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) {
                      // Simple routing to matching sections if searched
                      const val = e.target.value.toLowerCase();
                      if (val.includes('gust') || val.includes('angin') || val.includes('kompas')) setActiveChapter('dashboard');
                      else if (val.includes('grafik') || val.includes('tren') || val.includes('suhu')) setActiveChapter('analyst');
                      else if (val.includes('db') || val.includes('postgre') || val.includes('api.php') || val.includes('sql')) setActiveChapter('database');
                      else if (val.includes('bmkg') || val.includes('pelabuhan')) setActiveChapter('bmkg');
                      else if (val.includes('baud') || val.includes('serial') || val.includes('station')) setActiveChapter('settings');
                      else if (val.includes('faq') || val.includes('pertanyaan')) setActiveChapter('faq');
                    }
                  }}
                  className="w-full bg-[#03060d] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-[#00f0ff]/40 font-sans"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#11243b]/40 to-[#03060d]/40 border border-[#00f0ff]/10 rounded-2xl p-4 text-center space-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Stasiun Aktif Anda</span>
            <span className="text-xs font-black text-[#00f0ff] bg-white/5 px-2.5 py-1 rounded-lg border border-[#00f0ff]/20 inline-block font-mono">{stationId}</span>
            <span className="text-xs text-slate-300 block font-sans font-medium">{stationName}</span>
          </div>
        </div>

        {/* Manual Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-[#0b1424]/90 border border-white/10 rounded-3xl p-6 lg:p-8 shadow-xl min-h-[500px] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00f0ff]/25 rounded-tl-2xl" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00f0ff]/25 rounded-br-2xl" />

            {/* Render Chapter 1: Introduction */}
            {activeChapter === 'intro' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#00f0ff]" />
                    1. Pendahuluan & Arsitektur RMS PRO v3
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-[#00f0ff] to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  <strong>RMS PRO v3 (Yacht Weather & Hydrological Telemetry Terminal)</strong> merupakan solusi stasiun pengawas cuaca terpadu (Automatic Weather Station) berkinerja tinggi yang dirancang khusus untuk memantau, memproses, menyimpan, dan menganalisis parameter ekosistem maritim secara presisi.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                    <span className="text-[#00f0ff] font-extrabold text-xs block font-mono">INPUT TELEMETRI</span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">Mendukung koneksi Serial RS232/USB, TCP Socket, dan parser kalimat cerdas terkonfigurasi pemisah baris.</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                    <span className="text-emerald-400 font-extrabold text-xs block font-mono">PENGOLAH KONSOL</span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">Komputasi real-time untuk parameter rumit seperti Wind Gust, pH air laut, dan perataan gelombang laut.</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                    <span className="text-cyan-400 font-extrabold text-xs block font-mono">SINKRONISASI</span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">Satu klik sinkronisasi ke PostgreSQL lokal melalui API PHP mandiri dan integrasi validasi data BMKG.</p>
                  </div>
                </div>

                <div className="bg-blue-950/20 border border-blue-500/20 p-4 rounded-2xl flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-black text-blue-300 uppercase block font-mono">INFORMASI STRUKTUR DATA</span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed mt-1">
                      Setiap paket sensor yang diterima diproses secara paralel dan ditampung ke dalam array memori sebelum diposting ke database. Ini menjamin sistem tetap berjalan lancar tanpa membebani browser atau server lokal Anda.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">Gambaran Arsitektur Aliran Data:</h4>
                  <div className="bg-[#03060d] p-4 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed text-slate-400 space-y-2">
                    <div className="flex items-center gap-2"><span className="text-[#00f0ff] font-bold">[Sensor Fisik AWS]</span> ➔ (Kabel Serial/TCP) ➔ <span className="text-yellow-400 font-bold">[RMS PRO Client Parser]</span></div>
                    <div className="flex items-center gap-2 pl-4">└── <span className="text-emerald-400 font-bold">[Komparasi BMKG Port]</span> (Uji Validasi Silang dari BMKG Maritim)</div>
                    <div className="flex items-center gap-2"><span className="text-yellow-400 font-bold">[RMS PRO Client Parser]</span> ➔ (HTTP POST) ➔ <span className="text-cyan-400 font-bold">[api.php Endpoint]</span> ➔ <span className="text-indigo-400 font-bold">[PostgreSQL DB]</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Render Chapter 2: Real-time Dashboard */}
            {activeChapter === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-[#00f0ff]" />
                    2. Pengoperasian Dashboard Real-time
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-[#00f0ff] to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Dashboard utama adalah antarmuka panel kontrol berkecepatan tinggi yang menampilkan 12 variabel sensor krusial. Desain antarmuka dibuat modular untuk kemudahan pelacakan kapal atau fasilitas dermaga.
                </p>

                {/* Dashboard Image Mockup */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#00f0ff] tracking-widest font-bold uppercase block">GAMBAR 2.1: DESAIN ANTARMUKA DASHBOARD UTAMA</span>
                  <img 
                    src={dashboardGuideImg} 
                    alt="Realtime Dashboard Mockup" 
                    referrerPolicy="no-referrer"
                    className="rounded-2xl border border-[#00f0ff]/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-h-80 w-full object-cover"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-black text-white uppercase font-sans">A. Sistem Deteksi Hembusan Angin (Wind Gust)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Di meteorologi maritim, <strong>Kecepatan Angin (Wind Speed)</strong> dan <strong>Hembusan Angin (Wind Gust)</strong> memiliki arti operasional berbeda. Kecepatan angin diukur dengan nilai rata-rata, sedangkan Wind Gust adalah lonjakan singkat yang membahayakan kapal layar atau yacht.
                  </p>
                  
                  <div className="bg-yellow-950/20 border border-yellow-500/25 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4.5 h-4.5 text-yellow-400 animate-spin" />
                      <span className="text-xs font-black text-yellow-300 uppercase font-mono">FORMULA PERHITUNGAN GUST INTEGRASI RMS</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      Sistem kami merekam data angin dalam jendela buffer real-time. Jika selisih antara nilai angin maksimal (<code className="text-white">maxSpeed</code>) dan minimal (<code className="text-white">minSpeed</code>) bernilai <strong className="text-white">&ge; 10 m/s</strong>, maka kondisi gust dinyatakan aktif (<code className="text-white">hasGust = true</code>) dan nilai <code className="text-white">windGust</code> akan disematkan sebesar nilai <code className="text-white">maxSpeed</code> tersebut. Jika di bawah 10 m/s, sistem mendefinisikan angin bertiup konstan tenang (<code className="text-white">windGust = undefined</code>).
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white uppercase font-sans">B. Indikator Status & Tingkat Bahaya</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Sistem memantau parameter penting dan memberikan sinyal visual instan:
                  </p>
                  <ul className="text-xs text-slate-400 space-y-2 font-sans list-disc pl-5">
                    <li><strong className="text-emerald-400">NORMAL (Hijau)</strong>: Semua sensor berada di batas aman standar maritim internasional.</li>
                    <li><strong className="text-yellow-400">CAUTION / WASPADA (Kuning)</strong>: Parameter mendekati batas kritis (misalnya: hujan ringan mendekati batas threshold atau pH air laut bergeser tipis).</li>
                    <li><strong className="text-orange-400">WARNING (Jingga)</strong>: Terdeteksi hembusan angin &ge; 14 m/s atau tingkat keasaman laut abnormal.</li>
                    <li><strong className="text-red-500">CRITICAL (Merah)</strong>: Terjadi badai ekstrem dengan kecepatan angin &ge; 15 m/s, hembusan &ge; 18 m/s, atau curah hujan lebat di atas ambang batas.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Render Chapter 3: Weather Analyst */}
            {activeChapter === 'analyst' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-[#00f0ff]" />
                    3. Analisis & Tren Cuaca Historis
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-[#00f0ff] to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Menu <strong>ANALYST</strong> menyediakan visualisasi grafis area interaktif untuk membantu kapten kapal dan operator pelabuhan membaca pola cuaca makro 24 jam terakhir.
                </p>

                {/* Analyst Image Mockup */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#00f0ff] tracking-widest font-bold uppercase block">GAMBAR 3.1: DASHBOARD GRAFIK ANALYTICS CUACA</span>
                  <img 
                    src={analystGuideImg} 
                    alt="Weather Analyst Mockup" 
                    referrerPolicy="no-referrer"
                    className="rounded-2xl border border-[#00f0ff]/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-h-80 w-full object-cover"
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white uppercase font-sans">Fitur Utama Halaman Analis:</h4>
                  <ul className="text-xs text-slate-400 space-y-2 font-sans list-decimal pl-5">
                    <li>
                      <strong className="text-white">Time Series Overlay</strong>: Grafik menggabungkan beberapa sumbu koordinat secara dinamis, memudahkan operator membandingkan antara curah hujan dengan fluktuasi tekanan atmosfer di saat yang bersamaan.
                    </li>
                    <li>
                      <strong className="text-white">Interaktivitas Cursor (Tooltip)</strong>: Mengarahkan kursor ke atas kurva grafik menampilkan rincian data sensor, waktu pencatatan presisi, dan status anomali pada detik/menit tersebut.
                    </li>
                    <li>
                      <strong className="text-white">Radar Intensity Grid Tracker</strong>: Visualisasi intensitas hujan bergaya matriks kontribusi (mirip kontribusi GitHub) untuk memantau waktu akumulasi hujan harian secara ringkas.
                    </li>
                  </ul>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-2xl flex gap-3 items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-black text-emerald-300 uppercase block font-mono">TIPS PEMBACAAN GRAFIK</span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed mt-1">
                      Apabila kurva tekanan udara (<strong className="text-white">Pressure</strong>) merosot tajam di bawah 1009 hPa secara mendadak sementara kecepatan angin menanjak, ini merupakan indikasi kuat terbentuknya area tekanan rendah yang berpotensi memicu badai dalam waktu dekat.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Render Chapter 4: Database Sync */}
            {activeChapter === 'database' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#00f0ff]" />
                    4. Sinkronisasi Database PostgreSQL & SQLite Lokal
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-[#00f0ff] to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Sistem telemetri RMS PRO v3 mendukung penyimpanan permanen ke server database SQL lokal menggunakan file API jembatan <code className="text-[#00f0ff] font-mono">api.php</code>.
                </p>

                {/* Database Image Mockup */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#00f0ff] tracking-widest font-bold uppercase block">GAMBAR 4.1: PANEL KONTROL KONEKSI & STRUKTUR TABEL DATABASE</span>
                  <img 
                    src={databaseGuideImg} 
                    alt="Database Sync Mockup" 
                    referrerPolicy="no-referrer"
                    className="rounded-2xl border border-[#00f0ff]/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-h-80 w-full object-cover"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-white uppercase font-sans">A. Mekanisme Penyimpanan Cerdas (AVG vs RAW Mode)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Di menu OPTION, Anda dapat menentukan konfigurasi penyimpanan database:
                  </p>
                  <ul className="text-xs text-slate-400 space-y-2 font-sans list-disc pl-5">
                    <li>
                      <strong>Mode AVG (Rata-rata - Direkomendasikan)</strong>: Aplikasi mengumpulkan seluruh data sensor mentah yang masuk setiap detik. Setelah mencapai interval menit tertentu (misal: 10 menit), aplikasi menghitung nilai rata-rata, suhu min/max, dan hembusan angin maksimal, lalu memposting 1 baris data bersih tersebut ke database. Menghindari pemborosan disk space.
                    </li>
                    <li>
                      <strong>Mode RAW (Data Instan)</strong>: Setiap paket data sensor yang diterima dari port serial akan langsung diposting seketika ke database tanpa proses filter perataan.
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-[#00f0ff]" />
                      Kode Script Jembatan (api.php)
                    </h4>
                    <button 
                      onClick={copyToClipboard}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[#00f0ff] border border-[#00f0ff]/30 text-[10px] font-bold font-mono rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedCode ? 'Tersalin!' : 'Salin Kode'}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Unggah kode di bawah ini ke web server lokal Anda (misalnya Apache di alamat <code className="text-white">http://localhost/api.php</code>) untuk mengizinkan aplikasi melakukan sinkronisasi PostgreSQL instan:
                  </p>

                  <div className="relative">
                    <pre className="bg-[#03060d] text-slate-300 text-[10px] p-4 rounded-xl border border-white/5 overflow-x-auto max-h-52 font-mono leading-relaxed">
                      {phpCodeSnippet}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Render Chapter 5: BMKG Port Sync */}
            {activeChapter === 'bmkg' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Anchor className="w-5 h-5 text-emerald-400" />
                    5. Integrasi BMKG Maritim & Validasi Cuaca
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-emerald-500 to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Salah satu fitur unggulan RMS PRO v3 adalah kemampuan membandingkan data sensor fisik AWS lokal Anda dengan database resmi Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) Republik Indonesia.
                </p>

                {/* BMKG Image Mockup */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#00f0ff] tracking-widest font-bold uppercase block">GAMBAR 5.1: MENU INTEGRASI BMKG & VALIDASI PELABUHAN</span>
                  <img 
                    src={bmkgGuideImg} 
                    alt="BMKG Sync Mockup" 
                    referrerPolicy="no-referrer"
                    className="rounded-2xl border border-[#00f0ff]/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-h-80 w-full object-cover"
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white uppercase font-sans">Cara Menggunakan Sinkronisasi BMKG:</h4>
                  <ol className="text-xs text-slate-400 space-y-2 font-sans list-decimal pl-5">
                    <li>
                      Masuk ke tab <strong className="text-white">BMKG PORT</strong> di menu navigasi utama.
                    </li>
                    <li>
                      Pilih wilayah regional provinsi (misal: Banten, Jakarta, Jawa Timur) dan pilih pelabuhan spesifik (misal: Pelabuhan Ciwandan).
                    </li>
                    <li>
                      Tekan tombol <strong className="text-emerald-400">Hubungkan & Sinkronisasi API Maritim</strong>. Sistem akan mengambil data cuaca, angin, gelombang laut, dan pasang surut air laut BMKG yang sedang berlangsung.
                    </li>
                    <li>
                      Gunakan informasi ini untuk melakukan audit kalibrasi sensor fisik AWS di lokasi Anda.
                    </li>
                  </ol>
                </div>

                <div className="bg-yellow-950/20 border border-yellow-500/20 p-4 rounded-2xl flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-black text-yellow-300 uppercase block font-mono">BATASAN DATA BMKG</span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed mt-1">
                      Data BMKG diperbarui berkala setiap 3-6 jam sekali oleh BMKG Maritim pusat, berbeda dengan sensor AWS Anda yang memberikan pembacaan instan per detik. Adanya sedikit deviasi adalah hal yang sangat normal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Render Chapter 6: Settings */}
            {activeChapter === 'settings' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#00f0ff]" />
                    6. Konfigurasi Sistem (Settings Panel)
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-[#00f0ff] to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Tab <strong>OPTION</strong> menyimpan seluruh parameter vital pengoperasian software. Pengaturan ini tersimpan secara instan ke dalam <code className="text-white">localStorage</code> browser komputer agar konfigurasi Anda tidak hilang saat aplikasi dimuat ulang.
                </p>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">Rincian Variabel Konfigurasi:</h4>
                  
                  <div className="space-y-3">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[#00f0ff] font-extrabold text-xs block font-mono">1. STATION IDENTIFICATION & DATA SPLIT</span>
                      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                        ID Stasiun berfungsi sebagai pengenal unik data di database server. Karakter pemisah (<code className="text-white font-mono">;</code> atau <code className="text-white font-mono">,</code>) harus disesuaikan persis dengan output string yang dipancarkan oleh micro-controller sensor AWS Anda.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-amber-400 font-extrabold text-xs block font-mono">2. CHANNELS SENSORS MAPPING</span>
                      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                        Anda dapat memetakan urutan index pemisahan string telemetry dari sensor AWS fisik Anda ke parameter internal program. Misalnya, jika data suhu berada di index ke-2 setelah splitter, petakan channel yang bersesuaian dengan benar.
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-purple-400 font-extrabold text-xs block font-mono">3. CLOUD TELEMETRY PUSH</span>
                      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                        Mendukung pengiriman telemetri satelit/seluler terintegrasi: HTTP JSON POST, FTP XML Upload (untuk integrasi server BMKG nasional), serta MQTT Broker client untuk sistem IoT dengan latensi ultra rendah.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Render Chapter 7: FAQ */}
            {activeChapter === 'faq' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-[#00f0ff]" />
                    7. Pertanyaan yang Sering Diajukan (FAQ)
                  </h3>
                  <div className="h-0.5 w-24 bg-gradient-to-r from-[#00f0ff] to-transparent mt-2" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Temukan jawaban cepat atas beberapa pertanyaan teknis seputar operasional software RMS PRO v3 di bawah ini:
                </p>

                <div className="space-y-3">
                  {faqs.map((faq, index) => {
                    const isExpanded = expandedFaq === index;
                    return (
                      <div 
                        key={index} 
                        className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden transition-all"
                      >
                        <button
                          onClick={() => setExpandedFaq(isExpanded ? null : index)}
                          className="w-full text-left p-4 flex justify-between items-center gap-4 hover:bg-white/5 transition-all"
                        >
                          <span className="text-xs font-extrabold text-white font-sans">{faq.q}</span>
                          <span className="text-xs text-[#00f0ff] font-mono shrink-0">{isExpanded ? '[-]' : '[+]'}</span>
                        </button>
                        {isExpanded && (
                          <div className="p-4 bg-black/45 border-t border-white/5 text-xs text-slate-400 leading-relaxed font-sans whitespace-pre-line">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-gradient-to-r from-[#0b1424] to-[#040912] p-5 rounded-2xl border border-[#00f0ff]/10 text-center space-y-2 mt-6">
                  <span className="text-xs font-black text-white block font-sans">Butuh Bantuan Teknis Lebih Lanjut?</span>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Hubungi tim teknisi maritime engineering atau kirimkan query NMEA logs Anda ke alamat email administrator pelabuhan terdaftar.
                  </p>
                  <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 px-3 py-1 rounded-full border border-[#00f0ff]/20 inline-block font-extrabold uppercase mt-2">
                    SYSTEM SUPPORT ONLINE
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
