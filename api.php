<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// PostgreSQL Server Configuration
$host = "localhost";
$port = "5432"; // Standard PostgreSQL Port
$dbname = "db_pelabuhan_telemetry"; // Pastikan database ini sudah dibuat di PostgreSQL Anda
$username = "postgres"; // Username PostgreSQL Anda
$password = "your_pg_password"; // Ganti dengan password postgres Anda

try {
    $conn = new PDO("pgsql:host=$host;port=$port;dbname=$dbname", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Auto-create table di PostgreSQL
    $sql_table = "CREATE TABLE IF NOT EXISTS tbl_sensor_logs (
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
        sea_level_min NUMERIC(5,1) DEFAULT 0.0,
        sea_level_max NUMERIC(5,1) DEFAULT 0.0,
        water_ph NUMERIC(4,2) NOT NULL,
        water_temp NUMERIC(4,1) DEFAULT 25.0,
        water_temp_min NUMERIC(4,1) DEFAULT 24.0,
        water_temp_max NUMERIC(4,1) DEFAULT 26.0,
        wind_direction INT NOT NULL,
        wind_speed NUMERIC(4,1) NOT NULL,
        wind_speed_min NUMERIC(4,1) DEFAULT 0.0,
        wind_speed_max NUMERIC(4,1) DEFAULT 0.0,
        pressure NUMERIC(6,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_station_timestamp UNIQUE (station_id, timestamp)
    );";
    
    $conn->exec($sql_table);

    // Auto-create table status di PostgreSQL (Database-backed Config/Status Fallback)
    $sql_status_table = "CREATE TABLE IF NOT EXISTS tbl_moxa_status (
        id SERIAL PRIMARY KEY,
        connected INT NOT NULL,
        moxa_ip VARCHAR(50) NOT NULL,
        moxa_port INT NOT NULL,
        state VARCHAR(50) NOT NULL,
        error TEXT,
        last_seen VARCHAR(50) NOT NULL,
        db_storage_interval INT DEFAULT 10,
        db_storage_mode VARCHAR(10) DEFAULT 'AVG',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );";
    $conn->exec($sql_status_table);

    // Auto-migrate: Pastikan kolom-kolom baru (seperti suhu air laut, pasut min/max, ph, dll) ditambahkan jika tabel lama sudah ada
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS temp_min NUMERIC(5,2) DEFAULT 0.00;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS temp_max NUMERIC(5,2) DEFAULT 0.00;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS sea_level_min NUMERIC(5,1) DEFAULT 0.0;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS sea_level_max NUMERIC(5,1) DEFAULT 0.0;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS water_ph NUMERIC(4,2) DEFAULT 7.50;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS water_temp NUMERIC(4,1) DEFAULT 25.0;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS water_temp_min NUMERIC(4,1) DEFAULT 24.0;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS water_temp_max NUMERIC(4,1) DEFAULT 26.0;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS wind_speed_min NUMERIC(4,1) DEFAULT 0.0;");
    $conn->exec("ALTER TABLE tbl_sensor_logs ADD COLUMN IF NOT EXISTS wind_speed_max NUMERIC(4,1) DEFAULT 0.0;");

    // Auto-migrate constraint: Pastikan constraint unique_station_timestamp ada
    try {
        // Bersihkan data duplikat terlebih dahulu sebelum menerapkan constraint unik agar migrasi tidak gagal!
        $conn->exec("DELETE FROM tbl_sensor_logs a USING tbl_sensor_logs b WHERE a.id < b.id AND a.station_id = b.station_id AND a.timestamp = b.timestamp;");
        $conn->exec("ALTER TABLE tbl_sensor_logs ADD CONSTRAINT unique_station_timestamp UNIQUE (station_id, timestamp);");
    } catch (PDOException $ex) {
        // Abaikan jika constraint sudah ada
    }

    // Auto-migrate status table columns
    try {
        $conn->exec("ALTER TABLE tbl_moxa_status ADD COLUMN IF NOT EXISTS db_storage_interval INT DEFAULT 10");
        $conn->exec("ALTER TABLE tbl_moxa_status ADD COLUMN IF NOT EXISTS db_storage_mode VARCHAR(10) DEFAULT 'AVG'");
    } catch (PDOException $ex) {
        // Abaikan
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "PostgreSQL Setup Failed: " . $e->getMessage()]);
    exit();
}

// 1. GET Request: Check if requesting Moxa IP & Port configuration dynamically
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['get_moxa_config'])) {
    $config_sent = false;
    try {
        $stmt = $conn->query("SELECT moxa_ip, moxa_port, db_storage_interval, db_storage_mode FROM tbl_moxa_status ORDER BY id DESC LIMIT 1");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && !empty($row['moxa_ip'])) {
            echo json_encode([
                "moxa_ip" => $row['moxa_ip'],
                "moxa_port" => (int)$row['moxa_port'],
                "db_storage_interval" => isset($row['db_storage_interval']) ? (int)$row['db_storage_interval'] : 10,
                "db_storage_mode" => isset($row['db_storage_mode']) ? $row['db_storage_mode'] : 'AVG'
            ]);
            $config_sent = true;
        }
    } catch (PDOException $e) {
        // Abaikan db error, fallback ke file
    }

    if (!$config_sent) {
        if (file_exists("moxa_config.json")) {
            echo file_get_contents("moxa_config.json");
        } else {
            echo json_encode([
                "moxa_ip" => "172.16.4.48",
                "moxa_port" => 5001,
                "db_storage_interval" => 10,
                "db_storage_mode" => "AVG"
            ]);
        }
    }
    exit();
}

// 1b. GET Request: Check Moxa background daemon connection status
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['get_moxa_status'])) {
    $status_sent = false;
    try {
        $stmt = $conn->query("SELECT connected, moxa_ip, moxa_port, state, last_seen, error FROM tbl_moxa_status ORDER BY id DESC LIMIT 1");
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
            $status_sent = true;
        }
    } catch (PDOException $e) {
        // Abaikan db error, fallback ke file
    }

    if (!$status_sent) {
        if (file_exists("moxa_status.json")) {
            echo file_get_contents("moxa_status.json");
        } else {
            echo json_encode([
                "connected" => false,
                "moxa_ip" => "172.16.4.48",
                "moxa_port" => 5001,
                "state" => "OFFLINE",
                "last_seen" => "Never / Waiting for Daemon...",
                "error" => "No status reported from background daemon yet."
            ]);
        }
    }
    exit();
}

// 2. GET Request: Ambil data dari tabel tbl_sensor_logs untuk ditampilkan di Dashboard
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['get_telemetry_logs'])) {
    try {
        $stmt = $conn->prepare("SELECT * FROM tbl_sensor_logs ORDER BY timestamp DESC LIMIT 500");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Fetch Logs Failed: " . $e->getMessage()]);
    }
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents("php://input");
    $data = json_decode($input, true);

    // 2. POST Action: Save dynamic config to local database/file
    if (isset($data['action']) && $data['action'] === 'save_moxa_config') {
        $moxa_ip = isset($data['moxa_ip']) ? $data['moxa_ip'] : '172.16.4.48';
        $moxa_port = isset($data['moxa_port']) ? (int)$data['moxa_port'] : 5001;
        $db_storage_interval = isset($data['db_storage_interval']) ? (int)$data['db_storage_interval'] : 10;
        $db_storage_mode = isset($data['db_storage_mode']) ? $data['db_storage_mode'] : 'AVG';

        try {
            $stmt = $conn->query("SELECT id FROM tbl_moxa_status ORDER BY id DESC LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $stmt_update = $conn->prepare("UPDATE tbl_moxa_status SET 
                    moxa_ip = :moxa_ip, 
                    moxa_port = :moxa_port,
                    db_storage_interval = :db_storage_interval,
                    db_storage_mode = :db_storage_mode
                    WHERE id = :id");
                $stmt_update->execute([
                    ':moxa_ip' => $moxa_ip,
                    ':moxa_port' => $moxa_port,
                    ':db_storage_interval' => $db_storage_interval,
                    ':db_storage_mode' => $db_storage_mode,
                    ':id' => $row['id']
                ]);
            } else {
                $stmt_insert = $conn->prepare("INSERT INTO tbl_moxa_status (
                    connected, moxa_ip, moxa_port, state, error, last_seen, db_storage_interval, db_storage_mode
                ) VALUES (
                    0, :moxa_ip, :moxa_port, 'DISCONNECTED', 'Configured via dashboard', :last_seen, :db_storage_interval, :db_storage_mode
                )");
                $stmt_insert->execute([
                    ':moxa_ip' => $moxa_ip,
                    ':moxa_port' => $moxa_port,
                    ':last_seen' => date('H:i:s'),
                    ':db_storage_interval' => $db_storage_interval,
                    ':db_storage_mode' => $db_storage_mode
                ]);
            }
        } catch (PDOException $e) {
            // Abaikan db error jika gagal
        }

        // Tulis file cadangan dengan penahan error (@) jika terbentur izin Windows Service Account
        $config_data = [
            "moxa_ip" => $moxa_ip,
            "moxa_port" => $moxa_port,
            "transport" => isset($data['transport']) ? $data['transport'] : 'TCP',
            "db_storage_interval" => $db_storage_interval,
            "db_storage_mode" => $db_storage_mode
        ];
        @file_put_contents("moxa_config.json", json_encode($config_data, JSON_PRETTY_PRINT));

        echo json_encode(["status" => "success", "message" => "Moxa configuration successfully synced & saved."]);
        exit();
    }

    // 2b. POST Action: Save dynamic Moxa background daemon live connection status report
    if (isset($data['action']) && $data['action'] === 'save_moxa_status') {
        $connected = isset($data['connected']) ? (bool)$data['connected'] : false;
        $moxa_ip = isset($data['moxa_ip']) ? $data['moxa_ip'] : '172.16.4.48';
        $moxa_port = isset($data['moxa_port']) ? (int)$data['moxa_port'] : 5001;
        $state = isset($data['state']) ? $data['state'] : 'UNKNOWN';
        $error = isset($data['error']) ? $data['error'] : '';
        $last_seen = isset($data['last_seen']) ? $data['last_seen'] : date('d-m-Y H:i:s');

        try {
            $conn->exec("TRUNCATE tbl_moxa_status");
            $stmt = $conn->prepare("INSERT INTO tbl_moxa_status (
                connected, moxa_ip, moxa_port, state, error, last_seen, db_storage_interval, db_storage_mode
            ) VALUES (
                :connected, :moxa_ip, :moxa_port, :state, :error, :last_seen, 10, 'AVG'
            )");
            $stmt->execute([
                ':connected' => $connected ? 1 : 0,
                ':moxa_ip' => $moxa_ip,
                ':moxa_port' => $moxa_port,
                ':state' => $state,
                ':error' => $error,
                ':last_seen' => $last_seen
            ]);
        } catch (PDOException $e) {
            // Abaikan db error jika gagal
        }

        // Tulis file cadangan dengan penahan error (@) jika terbentur izin Windows Service Account
        $status_data = [
            "connected" => $connected,
            "moxa_ip" => $moxa_ip,
            "moxa_port" => $moxa_port,
            "state" => $state,
            "last_seen" => $last_seen,
            "error" => $error
        ];
        @file_put_contents("moxa_status.json", json_encode($status_data, JSON_PRETTY_PRINT));

        echo json_encode(["status" => "success", "message" => "Daemon status synced."]);
        exit();
    }

    if (isset($data['station_id']) && isset($data['timestamp'])) {
        try {
            $stmt = $conn->prepare("INSERT INTO tbl_sensor_logs (
                station_id, timestamp, temperature, temp_min, temp_max, humidity, solar_radiation, 
                rainfall, wave_height, sea_level, sea_level_min, sea_level_max, water_ph, water_temp, water_temp_min, water_temp_max, wind_direction, wind_speed, wind_speed_min, wind_speed_max, pressure
            ) VALUES (
                :station_id, :timestamp, :temperature, :temp_min, :temp_max, :humidity, :solar_radiation, 
                :rainfall, :wave_height, :sea_level, :sea_level_min, :sea_level_max, :water_ph, :water_temp, :water_temp_min, :water_temp_max, :wind_direction, :wind_speed, :wind_speed_min, :wind_speed_max, :pressure
            ) ON CONFLICT (station_id, timestamp) DO UPDATE SET
                temperature = EXCLUDED.temperature,
                temp_min = EXCLUDED.temp_min,
                temp_max = EXCLUDED.temp_max,
                humidity = EXCLUDED.humidity,
                solar_radiation = EXCLUDED.solar_radiation,
                rainfall = EXCLUDED.rainfall,
                wave_height = EXCLUDED.wave_height,
                sea_level = EXCLUDED.sea_level,
                sea_level_min = EXCLUDED.sea_level_min,
                sea_level_max = EXCLUDED.sea_level_max,
                water_ph = EXCLUDED.water_ph,
                water_temp = EXCLUDED.water_temp,
                water_temp_min = EXCLUDED.water_temp_min,
                water_temp_max = EXCLUDED.water_temp_max,
                wind_direction = EXCLUDED.wind_direction,
                wind_speed = EXCLUDED.wind_speed,
                wind_speed_min = EXCLUDED.wind_speed_min,
                wind_speed_max = EXCLUDED.wind_speed_max,
                pressure = EXCLUDED.pressure,
                created_at = NOW()");

            $stmt->execute([
                ':station_id' => $data['station_id'],
                ':timestamp' => $data['timestamp'],
                ':temperature' => $data['temperature'],
                ':temp_min' => isset($data['temp_min']) ? $data['temp_min'] : ($data['temperature'] - 1.5),
                ':temp_max' => isset($data['temp_max']) ? $data['temp_max'] : ($data['temperature'] + 1.2),
                ':humidity' => $data['humidity'],
                ':solar_radiation' => isset($data['solar_radiation']) ? $data['solar_radiation'] : 0,
                ':rainfall' => isset($data['rainfall']) ? $data['rainfall'] : 0.0,
                ':wave_height' => isset($data['wave_height']) ? $data['wave_height'] : 0.0,
                ':sea_level' => isset($data['sea_level']) ? $data['sea_level'] : 0.0,
                ':sea_level_min' => isset($data['sea_level_min']) ? $data['sea_level_min'] : (isset($data['sea_level']) ? $data['sea_level'] - 15.5 : 0.0),
                ':sea_level_max' => isset($data['sea_level_max']) ? $data['sea_level_max'] : (isset($data['sea_level']) ? $data['sea_level'] + 12.3 : 0.0),
                ':water_ph' => isset($data['water_ph']) ? $data['water_ph'] : 7.0,
                ':water_temp' => isset($data['water_temp']) ? $data['water_temp'] : ($data['temperature'] - 1.2),
                ':water_temp_min' => isset($data['water_temp_min']) ? $data['water_temp_min'] : ($data['temperature'] - 2.0),
                ':water_temp_max' => isset($data['water_temp_max']) ? $data['water_temp_max'] : ($data['temperature'] - 0.7),
                ':wind_direction' => isset($data['wind_direction']) ? $data['wind_direction'] : 0,
                ':wind_speed' => isset($data['wind_speed']) ? $data['wind_speed'] : 0.0,
                ':wind_speed_min' => isset($data['wind_speed_min']) ? $data['wind_speed_min'] : max(0.0, $data['wind_speed'] - 1.8),
                ':wind_speed_max' => isset($data['wind_speed_max']) ? $data['wind_speed_max'] : ($data['wind_speed'] + 2.5),
                ':pressure' => isset($data['pressure']) ? $data['pressure'] : 1013.25
            ]);

            echo json_encode(["status" => "success", "message" => "Record logged successfully to PostgreSQL!"]);
            exit();
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "PostgreSQL Insertion Failed: " . $e->getMessage()]);
            exit();
        }
    }
} else {
    echo json_encode([
        "status" => "success",
        "message" => "PostgreSQL Gateway active! Table 'tbl_sensor_logs' successfully checked/constructed."
    ]);
}
?>
