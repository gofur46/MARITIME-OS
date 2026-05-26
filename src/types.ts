export interface WeatherData {
  timestamp: number;
  temperature: number; // Celsius
  humidity: number; // %
  windSpeed: number; // knots or m/s
  windDirection: number; // degrees
  pressure: number; // hPa
  solarRadiation: number; // W/m2
  rainfall: number; // mm
  waveHeight: number; // meters
  seaLevel: number; // cm (relative to mean)
}

export type AlertLevel = 'Normal' | 'Caution' | 'Warning' | 'Critical';

export interface PortInstruction {
  id: string;
  timestamp: number;
  level: AlertLevel;
  type: 'Navigation' | 'Docking' | 'Emergency' | 'System';
  message: string;
}

export interface WeatherPrediction {
  time: string;
  summary: string;
  safetyScore: number; // 0-100
  recommendations: string[];
}
