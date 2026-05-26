import React, { useState, useEffect, useRef } from 'react';
import { 
  Thermometer, Droplets, Wind, Navigation, Gauge, Sun, CloudRain, 
  Waves, MoveDown, LayoutDashboard, History, Shield, Info,
  AlertCircle
} from 'lucide-react';
import { StatCard } from './components/StatCard';
import { WeatherChart } from './components/WeatherChart';
import { InstructionCenter } from './components/InstructionCenter';
import { WindCompass } from './components/WindCompass';
import { WeatherData, PortInstruction, WeatherPrediction } from './types';
import { getInsights } from './services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

// Initial Mock Data
const generateMockData = (count: number): WeatherData[] => {
  const data: WeatherData[] = [];
  let now = Date.now() - count * 60000;
  for (let i = 0; i < count; i++) {
    data.push({
      timestamp: now + i * 60000,
      temperature: 28 + Math.random() * 5,
      humidity: 70 + Math.random() * 10,
      windSpeed: 5 + Math.random() * 15,
      windDirection: Math.random() * 360,
      pressure: 1010 + Math.random() * 5,
      solarRadiation: 400 + Math.random() * 200,
      rainfall: Math.random() > 0.9 ? Math.random() * 5 : 0,
      waveHeight: 0.5 + Math.random() * 1.5,
      seaLevel: 10 + Math.random() * 20,
    });
  }
  return data;
};

export default function App() {
  const [history, setHistory] = useState<WeatherData[]>(generateMockData(60));
  const [instructions, setInstructions] = useState<PortInstruction[]>([]);
  const [insights, setInsights] = useState<WeatherPrediction | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  
  const currentData = history[history.length - 1];

  // Simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        const last = prev[prev.length - 1];
        const newData: WeatherData = {
          timestamp: Date.now(),
          temperature: last.temperature + (Math.random() - 0.5) * 0.5,
          humidity: Math.min(100, Math.max(0, last.humidity + (Math.random() - 0.5) * 1)),
          windSpeed: Math.max(0, last.windSpeed + (Math.random() - 0.5) * 2),
          windDirection: (last.windDirection + (Math.random() - 0.5) * 10 + 360) % 360,
          pressure: last.pressure + (Math.random() - 0.5) * 0.2,
          solarRadiation: Math.max(0, last.solarRadiation + (Math.random() - 0.5) * 20),
          rainfall: Math.random() > 0.95 ? Math.random() * 2 : 0,
          waveHeight: Math.max(0.1, last.waveHeight + (Math.random() - 0.5) * 0.1),
          seaLevel: last.seaLevel + (Math.random() - 0.5) * 0.5,
        };
        const updated = [...prev.slice(1), newData];
        
        // Trigger alerts based on logic
        checkThresholds(newData);
        
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkThresholds = (data: WeatherData) => {
    if (data.windSpeed > 20) {
      addInstruction('Warning', 'Navigation', `High wind speed detected (${data.windSpeed.toFixed(1)} knots). Small craft warning in effect.`);
    }
    if (data.waveHeight > 2.0) {
      addInstruction('Critical', 'Docking', `Wave height (${data.waveHeight.toFixed(2)}m) exceeds safe docking limits for Zone B.`);
    }
  };

  const addInstruction = (level: PortInstruction['level'], type: PortInstruction['type'], message: string) => {
    setInstructions(prev => {
      // Avoid duplicate recent messages
      if (prev.length > 0 && prev[0].message === message) return prev;
      return [{
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        level,
        type,
        message
      }, ...prev].slice(0, 50);
    });
  };

  const fetchAIInsights = async () => {
    setIsLoadingInsights(true);
    const result = await getInsights(currentData, history);
    setInsights(result);
    setIsLoadingInsights(false);
  };

  useEffect(() => {
    fetchAIInsights();
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row grid-pattern">
      {/* Sidebar Navigation - Ultra Premium Yacht Console Style */}
      <aside className="w-full md:w-24 bg-gradient-to-b from-[#11243b] via-[#081220] to-[#03060d] border-r border-accent/25 flex flex-col items-center py-8 gap-10 z-10 shadow-[6px_0_50px_rgba(0,240,255,0.08)] relative">
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-accent/40 via-transparent to-accent/15" />
        <div className="w-14 h-14 bg-gradient-to-tr from-accent to-[#00a2ff]/30 rounded-2xl flex items-center justify-center text-bg font-black text-2xl shadow-[0_0_35px_rgba(0,240,255,0.45)] border border-accent/40">
          M
        </div>
        <nav className="flex flex-col gap-8">
          <NavItem icon={<LayoutDashboard className="w-5 h-5" />} active label="Dashboard" />
          <NavItem icon={<History className="w-5 h-5" />} label="Logs" />
          <NavItem icon={<Shield className="w-5 h-5" />} label="Security" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 space-y-10 max-w-full w-full overflow-hidden">
        <header className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center bg-gradient-to-r from-paper/90 via-paper/50 to-bg/90 backdrop-blur-xl p-6 rounded-[2rem] border border-accent/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent/40 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent/40 rounded-br-xl" />

          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-3">
                MARITIME<span className="text-accent underline decoration-accent/30 underline-offset-4">OS</span> 
                <span className="text-[9px] uppercase font-mono bg-accent/10 text-accent py-1 px-4 rounded-full border border-accent/30 tracking-[0.25em] font-black">VESSEL_TLM_H</span>
              </h1>
              <p className="text-[9.5px] opacity-60 mt-1.5 uppercase tracking-[0.25em] font-bold flex items-center gap-2 font-mono text-accent/80">
                <span className="w-2.5 h-2.5 bg-success rounded-full animate-ping absolute"></span>
                <span className="w-2.5 h-2.5 bg-success rounded-full"></span>
                Active Telemetry Feed • 106.8833° E 6.1033° S
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-8 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
            <div className="hidden xl:flex gap-8">
              <div className="text-right">
                <div className="text-[8.5px] uppercase font-bold opacity-40 tracking-widest text-accent font-mono">Cons_Health</div>
                <div className="text-[10px] font-mono font-bold text-success">99.99% SECURE</div>
              </div>
              <div className="text-right">
                <div className="text-[8.5px] uppercase font-bold opacity-40 tracking-widest text-accent font-mono">Feed Latency</div>
                <div className="text-[10px] font-mono font-bold text-secondary">0.08 MS</div>
              </div>
            </div>
            <div className="h-10 w-px bg-accent/20 hidden xl:block" />
            <div className="text-right flex lg:flex-col items-baseline lg:items-end justify-between lg:justify-start w-full lg:w-auto gap-4 lg:gap-0">
              <div className="text-[10px] font-mono opacity-50 uppercase tracking-[0.1em] text-accent font-bold">{format(Date.now(), 'EEEE, dd MMM yyyy')}</div>
              <div className="text-2xl font-black data-mono tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.08)]">{format(Date.now(), 'HH:mm:ss')}</div>
            </div>
          </div>
        </header>

        {/* AWS Triage Layout - Balanced Full Screen */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-10 items-start">
          
          {/* LEFT TELEMETRY: MARITIME (1/5) */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-3 py-1 border-b border-accent/15">
              <div className="text-[11px] uppercase font-bold tracking-[0.25em] text-accent flex items-center gap-2">
                <Waves className="w-3.5 h-3.5 text-secondary" /> Maritime Sensors
              </div>
              <div className="text-[8.5px] font-mono opacity-40 text-accent font-bold">NODE_ALPHA</div>
            </div>
            <StatCard label="Wave Height" value={currentData.waveHeight.toFixed(2)} unit="Meters" icon={<Waves />} alertLevel={currentData.waveHeight > 1.5 ? 'Warning' : 'Normal'} />
            <StatCard label="Sea Level" value={currentData.seaLevel.toFixed(1)} unit="CM" icon={<MoveDown />} />
            <StatCard label="Station Tide" value={(currentData.seaLevel * 0.8).toFixed(1)} unit="CM" icon={<Waves />} />

            <div className="tech-card p-6 bg-gradient-to-b from-paper/60 to-bg border-accent/15 mt-4 relative">
              <div className="absolute top-0 right-0 w-16 h-[1.5px] bg-gradient-to-r from-transparent to-accent" />
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <h4 className="text-[9px] font-bold text-accent uppercase tracking-[0.25em] font-mono">Telemetry Status</h4>
              </div>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2">
                  <span className="opacity-40 uppercase font-bold text-[8.5px] tracking-wider">L-H Broadcast</span>
                  <span className="font-mono font-bold text-success tracking-widest text-[9px]">ONLINE_SECURE</span>
                </div>
                <div className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2">
                  <span className="opacity-40 uppercase font-bold text-[8.5px] tracking-wider">Protocol</span>
                  <span className="font-mono font-bold opacity-85 text-[9px]">MQTT-TLS_v3.2</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="opacity-40 uppercase font-bold text-[8.5px] tracking-wider">Encryption</span>
                  <span className="font-mono font-bold text-secondary text-[9px]">AES_256_GCM</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER HUB: WIND & PRIMARY CHARTS (3/5) */}
          <div className="xl:col-span-3 flex flex-col gap-8">
            {/* WIND HUB */}
            <WindCompass 
              speed={currentData.windSpeed} 
              direction={currentData.windDirection} 
              unit="KNOTS" 
            />
            
            {/* COMPACT CHART CONTAINER */}
            <div className="bg-gradient-to-tr from-paper to-bg border border-accent/15 rounded-[2rem] p-3 shadow-inner">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WeatherChart 
                  data={history} 
                  dataKey="temperature" 
                  label="Surface Temperature" 
                  unit="°C" 
                  color="#00f0ff" 
                />
                <WeatherChart 
                  data={history} 
                  dataKey="waveHeight" 
                  label="Oceanic Swell" 
                  unit="m" 
                  color="#3b82f6" 
                />
              </div>
            </div>
          </div>

          {/* RIGHT TELEMETRY: ATMOSPHERIC (1/5) */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-3 py-1 border-b border-accent/15">
              <div className="text-[11px] uppercase font-bold tracking-[0.25em] text-accent flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-secondary" /> Atmospheric Sensors
              </div>
              <div className="text-[8.5px] font-mono opacity-40 text-accent font-bold font-mono">NODE_BETA</div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
              <StatCard label="Temperature" value={currentData.temperature.toFixed(1)} unit="°C" icon={<Thermometer />} />
              <StatCard label="Humidity" value={currentData.humidity.toFixed(0)} unit="%" icon={<Droplets />} />
            </div>
            <StatCard label="Barometric Pressure" value={currentData.pressure.toFixed(1)} unit="HPA" icon={<Gauge />} />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="tech-card p-5 flex flex-col items-center justify-center bg-gradient-to-br from-paper to-bg border-accent/10 relative">
                <div className="absolute top-1 right-2 w-1 h-1 rounded-full bg-accent/40" />
                <div className="text-[8px] uppercase tracking-[0.2em] font-bold text-accent mb-2 font-mono">Solar Rad</div>
                <div className="text-sm font-extrabold text-white font-mono">{currentData.solarRadiation.toFixed(0)}</div>
                <div className="text-[7px] text-accent/50 font-mono mt-1 font-semibold uppercase">W/M²</div>
              </div>
              <div className="tech-card p-5 flex flex-col items-center justify-center bg-gradient-to-br from-paper to-bg border-accent/10 relative">
                <div className="absolute top-1 right-2 w-1 h-1 rounded-full bg-secondary/40" />
                <div className="text-[8px] uppercase tracking-[0.2em] font-bold text-accent mb-2 font-mono">Precipitation</div>
                <div className="text-sm font-extrabold text-white font-mono">{currentData.rainfall.toFixed(1)}</div>
                <div className="text-[7px] text-accent/50 font-mono mt-1 font-semibold uppercase">MM/H</div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* HUD Overlays */}
      <div className="fixed bottom-4 right-6 pointer-events-none opacity-40 flex flex-col items-end gap-1">
        <div className="text-[8px] font-mono uppercase text-accent font-bold tracking-widest">System: AIS_PORT_RELAY_PROX_v1.5</div>
        <div className="text-[8px] font-mono uppercase tracking-[0.1em] text-white">Lat: -6.1033 | Lon: 106.8833</div>
      </div>
    </div>
  );
}

function NavItem({ icon, active = false, label }: { icon: React.ReactNode, active?: boolean, label: string }) {
  return (
    <div className={`group relative cursor-pointer p-4 rounded-xl transition-all duration-300 ${active ? 'bg-accent/15 text-accent border border-accent/30 shadow-[0_0_20px_rgba(0,240,255,0.25)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
      {icon}
      <div className="absolute left-full ml-4 px-3 py-1.5 bg-paper text-white text-[9.5px] tracking-widest font-bold uppercase rounded-lg border border-accent/20 shadow-xl opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap pointer-events-none z-50 font-mono">
        {label}
      </div>
      {active && <motion.div layoutId="nav-pill" className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-accent rounded-full" />}
    </div>
  );
}
