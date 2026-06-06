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
*   **Data Telemetry Ledger**: Tabel komprehensif berisi seluruh riwayat pembacaan sensor cuaca menit-demi-menit.
*   **Filter & Navigasi**: Kemudahan membaca data historis, status ekspor data, hingga pencarian log berbahaya secara instan demi kebutuhan investigasi keselamatan operasi kapal.

### D. Pengaturan Konsol (Tab Settings)
*   **Pier Angle Adjustment**: Pengaturan dinamis orientasi spasial dermaga kapal (dalam derajat) untuk menyesuaikan layout geografis asli pelabuhan Anda.
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

