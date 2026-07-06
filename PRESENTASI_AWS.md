# PANDUAN & SCRIPT PRESENTASI INTERAKTIF
## SISTEM MONITORING METEOROLOGI MARITIM & TELEMETRI PELABUHAN (MARITIME OS)

Dokumen ini disusun sebagai panduan lengkap slide demi slide untuk mempermudah Anda mempresentasikan aplikasi **Maritime Telemetry Command Center** (Automatic Weather Station) kepada klien, manajemen pelabuhan (e.g., Pelindo), Syahbandar (Harbour Master), atau pemangku kepentingan lainnya.

---

### 📊 STRUKTUR SLIDE PRESENTASI

#### SLIDE 1: HALAMAN JUDUL (TITLE SLIDE)
*   **Judul Utama:** MARITIME OS: Sistem Monitoring Meteorologi Maritim & Telemetri Pelabuhan Terintegrasi
*   **Sub-Judul:** Solusi Command Center Real-Time untuk Menjamin Keselamatan Navigasi, Efisiensi Berthing, dan Mitigasi Risiko Cuaca Ekstrem
*   **Rekomendasi Visual:** Tampilan mockup dashboard utama dalam perangkat monitor besar, berlatar belakang gelap elegan khas Command Center, menampilkan Kompas Dermaga interaktif dan indikator Early Warning System (EWS) yang aktif.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Selamat pagi/siang Bapak dan Ibu sekalian. Hari ini saya ingin mempresentasikan **Maritime OS**, sebuah terobosan sistem Command Center meteorologi maritim yang dirancang khusus untuk meningkatkan standar keselamatan pelayaran dan efisiensi logistik di pelabuhan kita. Sistem ini bertindak sebagai 'mata dan telinga' pelabuhan dalam memantau kondisi cuaca, dinamika laut, serta kualitas air secara real-time dan presisi."*

---

#### SLIDE 2: LATAR BELAKANG & TANTANGAN OPERASIONAL PELABUHAN
*   **Judul Slide:** Tantangan & Kebutuhan Operasional Pelabuhan Modern
*   **Poin Utama Slide:**
    *   **Cuaca Ekstrem Tak Terduga:** Risiko angin kencang (*wind shear*) dan gelombang tinggi yang membahayakan proses bersandar (*vessel berthing*).
    *   **Ketiadaan Data Real-Time:** Keterlambatan respons operasional akibat pemantauan cuaca konvensional yang bersifat periodik atau manual.
    *   **Risiko Kerusakan Aset:** Korosi lambung kapal dan struktur dermaga akibat keasaman air laut (pH) yang tidak terpantau.
    *   **Konektivitas Rentan:** Gangguan cuaca buruk yang berisiko memutuskan komunikasi data dari stasiun AWS lapangan ke ruang kendali utama.
*   **Rekomendasi Visual:** Foto aktivitas bongkar muat kapal kargo di bawah kondisi cuaca buruk/berangin, disandingkan dengan infografis tantangan operasional.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Dalam operasional pelabuhan sehari-hari, keselamatan adalah prioritas mutlak. Angin kencang yang tiba-tiba atau gelombang tinggi dapat menyebabkan benturan keras kapal pada struktur dermaga saat proses bersandar (*berthing*). Tanpa data yang bersifat real-time, keputusan menunda atau mengizinkan kapal bersandar hanya mengandalkan insting. Ditambah lagi, polusi industri yang memengaruhi pH air laut seringkali merusak lambung kapal secara perlahan tanpa kita sadari. Itulah mengapa kita membutuhkan sistem monitoring otomatis yang tangguh."*

---

#### SLIDE 3: SOLUSI KAMI - MARITIME COMMAND CENTER
*   **Judul Slide:** Solusi: Maritime Telemetry Command Center Dashboard
*   **Poin Utama Slide:**
    *   **Zero-Latency Data Stream:** Aliran data dari sensor stasiun cuaca langsung terdistribusi ke layar monitor tanpa jeda.
    *   **Single-Pane Visual Console:** Menyatukan seluruh data meteorologi, oseanografi, dan kualitas air dalam satu tampilan antarmuka ergonomis.
    *   **High-Fidelity UI/UX:** Desain visual bertema gelap (*dark theme*) yang dirancang khusus untuk mengurangi kelelahan mata operator *Command Center* yang bertugas 24/7.
    *   **Skalabilitas & Fleksibilitas:** Dapat diakses dari komputer lokal di ruang kontrol maupun gawai seluler petugas di lapangan.
*   **Rekomendasi Visual:** Diagram alur sederhana: **Sensor AWS Lapangan** ➔ **Gateway Transmisi (Moxa TCP/Serial)** ➔ **Server Database PostgreSQL** ➔ **Aplikasi Web Dashboard (Maritime OS)**.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Sebagai jawaban atas tantangan tersebut, kami menghadirkan **Maritime OS**. Ini adalah aplikasi pusat komando visual satu layar yang menggabungkan seluruh pembacaan sensor fisik di lapangan ke dalam sebuah antarmuka yang sangat informatif dan responsif. Sistem ini bekerja secara asinkron dengan latensi mendekati nol detik, memastikan setiap hembusan angin kencang atau pasang surut air laut langsung terdeteksi saat itu juga di ruang kendali utama."*

---

#### SLIDE 4: FITUR UNGGULAN - DASHBOARD REAL-TIME CONSOLE
*   **Judul Slide:** Dashboard Real-Time: Pengawasan Instan & Ergonomis
*   **Poin Utama Slide:**
    *   **Vessel Wind Compass Center:** Kompas visual interaktif 360° yang menunjukkan hubungan spasial antara orientasi dermaga (*Pier Angle*), posisi kapal, dan arah datang angin.
    *   **Dynamic Alarm Ring:** Ring indikator yang berubah warna secara dinamis (Hijau, Kuning, atau Merah Berpendar) berdasarkan tingkat bahaya parameter cuaca.
    *   **Atmosfer & Kualitas Air Terintegrasi:** Memantau Suhu Udara, Kelembapan, Tekanan Udara multi-elevasi (STN, QFE, QFF, QNH), Curah Hujan, Solar Radiasi, hingga pH Air Laut.
    *   **Vector Compass Graph:** Melacak jejak pergerakan arah angin dalam 24 jam terakhir secara melingkar menggunakan kalkulasi trigonometri.
*   **Rekomendasi Visual:** Screenshot bagian konsol kiri dan kanan dari Tab Real-Time Console, tunjukkan detail Kompas visual dan widget sensor.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Mari kita lihat fitur andalan di tab utama. Di tengah layar, terdapat kompas dermaga dinamis. Kita dapat mengkalibrasi arah dermaga kita (*Pier Angle*), lalu sistem akan secara spasial memperlihatkan bagaimana arah datang angin akan memengaruhi lambung kapal yang sedang bersandar. Di sekeliling kompas, terdapat **Dynamic Alarm Ring** yang akan berpendar merah jika terjadi situasi darurat. Selain itu, kami juga memonitor parameter kualitas air laut seperti pH dan suhu air laut secara konstan untuk mengantisipasi potensi korosifitas air pelabuhan."*

---

#### SLIDE 5: PEMANTAUAN PASANG SURUT (WATER LEVEL) & GELOMBANG
*   **Judul Slide:** Pemantauan Pasang Surut & Tinggi Gelombang (Oceanography)
*   **Poin Utama Slide:**
    *   **Pengukuran Ketinggian Air (Tide Level):** Mengukur permukaan air laut dalam centimeter dan menampilkannya dalam meter secara akurat.
    *   **Mean Sea Level (MSL) Calibration:** Menghitung deviasi pasut harian secara dinamis terhadap nilai referensi MSL yang diatur pada panel Settings.
    *   **Mitigasi Kapal Kandas (Grounding Mitigation):** Memberikan peringatan pendangkalan jika ketinggian air laut surut mendekati batas draf kapal.
    *   **Tinggi Gelombang (Wave Height):** Memonitor tinggi gelombang secara kontinu dengan ambang krisis waspada &ge; `1.2 m`.
*   **Rekomendasi Visual:** Grafik representasi level pasang surut air laut dinamis dengan garis referensi MSL dan visualisasi tinggi gelombang laut.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Selanjutnya, mari kita bahas salah satu fitur oseanografi utama kita: Pemantauan Pasang Surut (Water Level) dan Tinggi Gelombang. Sensor fisik di dermaga mengukur ketinggian air laut dalam centimeter dan menampilkannya dalam meter secara presisi. Data pasut ini dibandingkan secara real-time dengan MSL (Mean Sea Level) referensi yang dikalibrasi di Tab Settings, sehingga deviasi air pasang surut diketahui secara akurat untuk memitigasi kapal kandas harian (*grounding mitigation*). Selain itu, tinggi gelombang laut dipantau konstan dengan ambang batas bahaya 1.2 meter."*

---

#### SLIDE 6: SISTEM FAILSAFE PUTUS KONEKSI & LOCK DASHBOARD
*   **Judul Slide:** Failsafe Deteksi Putus Koneksi & Lock Dashboard Offline
*   **Poin Utama Slide:**
    *   **Deteksi Keaktifan (isLiveActive State):** Memonitor laju data sensor secara asinkron. Jika terhenti lebih dari beberapa detik, status beralih menjadi OFFLINE.
    *   **Dashboard Lock (Offline Lock):** Memblokir interaksi dan mengaburkan antarmuka widget dengan filter blur & opacity 30% ketika koneksi offline.
    *   **Pencegahan Stale Data:** Mencegah operator membaca atau mengambil keputusan berdasarkan data usang yang salah dan membahayakan kapal.
    *   **Retry Loop Persisten:** Background listener terus-menerus melakukan rekoneksi ke MOXA NPort setiap 5 detik tanpa crash.
*   **Rekomendasi Visual:** Desain banner merah peringatan "AWS OFFLINE" dan tampilan mockup widget yang terkunci dan ter-blur secara elegan.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Keandalan sistem kami diperkuat oleh sistem pengaman putusnya koneksi. Jika sensor AWS lapangan terputus karena gangguan fisik, badai, atau pemadaman listrik, status keaktifan langsung dideteksi terputus. Seketika, fitur pengunci dashboard otomatis mengaburkan tampilan widget dan memblokir seluruh interaksi klik. Mengapa ini penting? Untuk mencegah operator mengambil keputusan taktis berbahaya berdasarkan data usang (*stale data*) yang tidak lagi terupdate secara real-time. Sementara itu, jembatan konektor di latar belakang secara gigih mencoba menghubungkan kembali sistem setiap 5 detik."*

---

#### SLIDE 7: SISTEM PERINGATAN DINI (DYNAMIC HAZARD EWS)
*   **Judul Slide:** Sistem Peringatan Dini (EWS) Otomatis
*   **Poin Utama Slide:**
    *   **Logika Krisis Cerdas (Multi-Hazard EWS):**
        *   🔴 **SIAGA 1 (Double Hazard):** Aktif otomatis jika Kecepatan Angin &ge; 12.0 m/s DAN Tinggi Gelombang &ge; 1.2 m secara bersamaan.
        *   🟡 **WARNING ANGIN KENCANG:** Aktif jika Kecepatan Angin &ge; 12.0 m/s (Kondisi gelombang aman).
        *   🟡 **WARNING GELOMBANG TINGGI:** Aktif jika Tinggi Gelombang &ge; 1.2 m (Kondisi angin aman).
        *   ...
    *   **Intervensi Cepat:** Memberikan keputusan instan bagi otoritas untuk menghentikan sementara aktivitas bongkar muat demi keselamatan kru.
*   **Rekomendasi Visual:** Komparasi visual kartu alert EWS saat kondisi **SIAGA 1** (Merah menyala), **WARNING** (Kuning), dan **NORMAL** (Hijau tenang).
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Sistem ini tidak hanya pasif menampilkan angka, tetapi juga memiliki kecerdasan buatan lokal untuk menganalisis risiko. Sistem ini menerapkan **Dual-Hazard Logic**. Jika angin kencang bersanding dengan gelombang tinggi di atas ambang batas aman, sistem secara otomatis menerbitkan status **SIAGA 1** berwarna merah menyala dan mengaktifkan peringatan visual di seluruh layar. Ini memberikan panduan instan bagi operator untuk segera mengevaluasi keselamatan kapal di dermaga."*

---

#### SLIDE 8: KONEKTIVITAS TANGGUH & INTEGRASI MOXA TCP/IP
*   **Judul Slide:** Konektivitas Fleksibel & Integrasi Perangkat MOXA NPort
*   **Poin Utama Slide:**
    *   **Multi-Connection Protocol:** Mendukung komunikasi data langsung via Serial COM Port hardware maupun jaringan TCP/IP.
    *   **Integrasi Cerdas MOXA NPort:** Komputer bertindak sebagai *TCP Client* yang aktif melakukan koneksi (*dial*) ke Moxa NPort yang berada dalam mode *TCP Server* (e.g., Port 10001).
    *   **Resilience & Auto-Reconnect:** Dilengkapi daemon latar belakang cerdas `tcp_moxa_listener.js` yang secara otomatis melakukan *retry* setiap 5 detik jika koneksi terputus akibat kabel lepas atau gangguan listrik.
    *   **Configurable Sensor Mapping:** Fleksibilitas pemetaan kanal sensor langsung melalui halaman pengaturan antarmuka visual.
*   **Rekomendasi Visual:** Diagram skematis penyaluran data: **AWS Weather Station** (Serial RS232/485) ➔ **MOXA NPort** (Konversi ke TCP Server IP `192.168.127.254`) ➔ **Aplikasi Client Daemon (Port 10001)**.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Salah satu keunggulan teknis dari sistem ini adalah keandalan konektivitasnya. Kami menggunakan integrasi nirkabel/kabel menggunakan perangkat industri **MOXA NPort**. Perangkat Moxa bertindak sebagai TCP Server, dan aplikasi kita bertindak sebagai TCP Client yang sangat aktif. Jika ada kabel tercabut atau perangkat Moxa sengaja direstart, sistem kami tidak akan mengalami crash. Daemon pintar kami akan mendeteksi pemutusan tersebut secara otomatis dan melakukan 'jabat tangan ulang' (*reconnection loop*) setiap 5 detik secara persisten hingga koneksi kembali pulih."*

---

#### SLIDE 9: ARSITEKTUR LAYANAN LATAR BELAKANG & AUTO-RECOVERY
*   **Judul Slide:** Arsitektur 3 Windows Services (Zero-Operator Maintenance)
*   **Poin Utama Slide:**
    *   **Instalasi Windows Service via NSSM (Non-Sucking Service Manager):**
        1.  **Layanan Visual Dashboard (AWS Port Marine):** Menyajikan panel visual di port `3000`.
        2.  **Layanan Jembatan Database (AWS PHP-PostgreSQL Bridge):** Mengelola API jembatan di port `8000`.
        3.  **Layanan Listener Moxa (AWS Moxa Listener):** Menghubungkan client TCP ke perangkat Moxa secara konstan.
    *   **Auto-Recovery on Power Back:** Seluruh layanan berjalan otomatis di latar belakang sesaat setelah komputer menyala (bahkan sebelum operator melakukan login Windows).
    *   **Dynamic Offline Buffer Storage:** Jika database PostgreSQL offline sementara, data sensor dialihkan sementara ke `localStorage` browser dan dapat disinkronkan kemudian hari menggunakan fitur ekspor CSV.
*   **Rekomendasi Visual:** Ilustrasi ikon 3 roda gigi berputar melambangkan tiga Windows Services yang berjalan serempak di balik sistem operasi Windows.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Untuk memastikan sistem ini bebas perawatan (*low maintenance*), kami mendaftarkan sistem ini ke dalam **Tiga Windows Service Otomatis** menggunakan NSSM. Artinya, jika terjadi pemadaman listrik di pelabuhan dan komputer server kita mati, saat listrik menyala kembali dan komputer melakukan booting, ketiga layanan ini—Visual Dashboard, Jembatan PostgreSQL, dan Listener Moxa—akan langsung berjalan secara otomatis di latar belakang tanpa membutuhkan operator untuk masuk ke Windows dan mengetikkan perintah cmd secara manual."*

---

#### SLIDE 10: BASIS DATA POSTGRESQL & FITUR HISTORI (TAB DATABASE)
*   **Judul Slide:** Manajemen Data Historis Berkinerja Tinggi
*   **Poin Utama Slide:**
    *   **PostgreSQL Engine:** Menggunakan basis data relasional kelas enterprise yang terkenal sangat cepat dan stabil dalam menangani jutaan rekaman data sensor.
    *   **Ledger Historis:** Tabel komprehensif yang menampilkan seluruh sejarah pencatatan parameter cuaca per menit secara rapi.
    *   **Pencarian & Filter Taktis:** Memudahkan petugas mencari tren cuaca pada tanggal tertentu, jam tertentu, atau mencari berdasarkan ID stasiun.
    *   **Ekspor CSV Sekali Klik:** Memungkinkan ekspor laporan data mentah terstandarisasi untuk keperluan analisis lanjut atau pelaporan ke BMKG.
*   **Rekomendasi Visual:** Tangkapan layar dari Tab Database, memperlihatkan baris data log yang detail dan tombol ekspor CSV yang siap ditekan.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Seluruh data telemetri yang dikumpulkan tidak dibuang begitu saja, melainkan disimpan secara aman di dalam **Database PostgreSQL**. Kami beralih dari database tradisional ke PostgreSQL untuk menjamin kecepatan kueri meskipun data sudah menyentuh jutaan baris di masa depan. Pada Tab Database, operator dapat melakukan pencarian data log historis secara taktis berdasarkan rentang tanggal tertentu, serta mengunduhnya langsung dalam format `.csv` dengan satu klik tombol untuk diserahkan sebagai laporan resmi ke BMKG atau Syahbandar."*

---

#### SLIDE 11: KESIMPULAN & NILAI INVESTASI STRATEGIS
*   **Judul Slide:** Nilai Strategis Implementasi Maritime OS
*   **Poin Utama Slide:**
    *   **Menekan Angka Kecelakaan Kerja:** Mitigasi dini benturan kapal atau kerusakan dermaga saat bongkar muat.
    *   **Efisiensi Waktu Sandar (Berthing):** Mengoptimalkan keluar-masuk kapal berdasarkan data hembusan angin riil di pelabuhan.
    *   **Transparansi & Akuntabilitas Data:** Memiliki database cuaca orisinal yang valid dan dapat dipertanggungjawabkan secara hukum jika terjadi klaim asuransi perkapalan.
    *   **Standardisasi Pelabuhan Pintar (Smart Port):** Melangkah maju menuju modernisasi pelabuhan berbasis teknologi *Internet of Things* (IoT).
*   **Rekomendasi Visual:** Foto pelabuhan kargo yang rapi, efisien, aman, dengan kapal kargo bersandar mulus di dermaga.
*   **Poin Pembicaraan (Narasi Anda):**
    > *"Sebagai kesimpulan, implementasi **Maritime OS** bukan sekadar memasang layar monitor cuaca biasa. Ini adalah investasi jangka panjang untuk mewujudkan konsep **Smart Port** yang aman, efisien, dan patuh terhadap regulasi nasional maupun internasional. Dengan adanya sistem ini, kita dapat melindungi kru kapal, melindungi aset dermaga kita yang bernilai miliaran rupiah, dan mengoptimalkan perputaran logistik pelabuhan kita secara maksimal. Terima kasih atas perhatian Bapak dan Ibu sekalian, saya membuka sesi tanya jawab jika ada hal yang ingin didiskusikan."*

---

### 💡 TIPS TAMBAHAN UNTUK SUKSES PRESENTASI:
1.  **Lakukan Live Demo:** Setelah membawakan Slide 5 atau Slide 6, mintalah izin untuk menunjukkan langsung (*live demo*) tab **Real-Time Console** dan tunjukkan bagaimana arah angin berputar serta bagaimana status EWS bekerja.
2.  **Tunjukkan Ketahanan Alat:** Jelaskan kembali skenario "Kabel dicabut" di depan audiens untuk membuktikan bahwa daemon **Moxa Listener** yang Anda buat sangat tangguh dan otomatis melakukan rekoneksi sendiri tanpa perlu program direstart.
3.  **Tekankan PostgreSQL:** Sebutkan bahwa penggunaan PostgreSQL membuat sistem ini setingkat dengan sistem korporat besar dalam hal ketahanan penyimpanan data jangka panjang.
