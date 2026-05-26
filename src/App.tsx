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
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-20 bg-paper border-r border-white/5 flex flex-col items-center py-8 gap-8 z-10">
        <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-[0_0_25px_rgba(59,130,246,0.4)]">
          M
        </div>
        <nav className="flex flex-col gap-6">
          <NavItem icon={<LayoutDashboard className="w-5 h-5" />} active label="Dashboard" />
          <NavItem icon={<History className="w-5 h-5" />} label="Logs" />
          <NavItem icon={<Shield className="w-5 h-5" />} label="Security" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 space-y-8 max-w-full w-full overflow-hidden">
        <header className="flex justify-between items-center bg-white/[0.02] backdrop-blur-md p-4 rounded-3xl border border-white/5">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-3">
                MARITIME<span className="text-accent">OS</span> 
                <span className="text-[10px] uppercase font-mono bg-accent/20 text-accent py-0.5 px-3 rounded-full border border-accent/30 tracking-[0.2em] font-bold">TERMINAL-H</span>
              </h1>
              <p className="text-[10px] opacity-40 mt-0.5 uppercase tracking-[0.3em] font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                Active Telemetry Feed • 106.8833E 6.1033S
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden xl:flex gap-8">
              <div className="text-right">
                <div className="text-[9px] uppercase font-bold opacity-30 tracking-widest">Station Health</div>
                <div className="text-[10px] font-mono text-success">99.9% UPTIME</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase font-bold opacity-30 tracking-widest">Data Latency</div>
                <div className="text-[10px] font-mono text-accent">12ms</div>
              </div>
            </div>
            <div className="h-10 w-px bg-white/10 hidden md:block" />
            <div className="text-right">
              <div className="text-xs font-mono opacity-40 uppercase tracking-tighter">{format(Date.now(), 'EEEE, dd MMM yyyy')}</div>
              <div className="text-xl font-black data-mono tracking-tighter text-white">{format(Date.now(), 'HH:mm:ss')}</div>
            </div>
          </div>
        </header>

        {/* AWS Triage Layout - Balanced Full Screen */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-8 items-start">
          
          {/* LEFT TELEMETRY: MARITIME (1/5) */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <div className="text-[10px] uppercase font-bold tracking-[0.3em] text-accent flex items-center gap-2">
                <Waves className="w-3 h-3" /> Maritime
              </div>
              <div className="text-[10px] font-mono opacity-20">GRP_01</div>
            </div>
            <StatCard label="Wave Height" value={currentData.waveHeight.toFixed(2)} unit="Meters" icon={<Waves />} alertLevel={currentData.waveHeight > 1.5 ? 'Warning' : 'Normal'} />
            <StatCard label="Sea Level" value={currentData.seaLevel.toFixed(1)} unit="CM" icon={<MoveDown />} />
            <StatCard label="Station Tide" value={(currentData.seaLevel * 0.8).toFixed(1)} unit="CM" icon={<Waves />} />

            <div className="tech-card p-6 bg-accent/[0.02] border-accent/10 mt-auto">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-3 bg-accent rounded-full" />
                <h4 className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">System Status</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[9px] border-b border-white/5 pb-2">
                  <span className="opacity-30 uppercase">Uptime</span>
                  <span className="font-mono font-bold text-success">CONNECTED</span>
                </div>
                <div className="flex justify-between items-center text-[9px]">
                  <span className="opacity-30 uppercase">Protocol</span>
                  <span className="font-mono font-bold opacity-60">MQTT-TLS_v3</span>
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
            <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] p-2 space-y-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <WeatherChart 
                  data={history} 
                  dataKey="temperature" 
                  label="Surface Temp" 
                  unit="°C" 
                  color="#f59e0b" 
                />
                <WeatherChart 
                  data={history} 
                  dataKey="waveHeight" 
                  label="Oceanic Swell" 
                  unit="m" 
                  color="#10b981" 
                />
              </div>
            </div>
          </div>

          {/* RIGHT TELEMETRY: ATMOSPHERIC (1/5) */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <div className="text-[10px] uppercase font-bold tracking-[0.3em] text-accent flex items-center gap-2">
                <Gauge className="w-3 h-3" /> Atmospheric
              </div>
              <div className="text-[10px] font-mono opacity-20">GRP_02</div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
              <StatCard label="Temperature" value={currentData.temperature.toFixed(1)} unit="°C" icon={<Thermometer />} />
              <StatCard label="Humidity" value={currentData.humidity.toFixed(0)} unit="%" icon={<Droplets />} />
            </div>
            <StatCard label="Barometric Pressure" value={currentData.pressure.toFixed(1)} unit="HPA" icon={<Gauge />} />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="tech-card p-4 flex flex-col items-center justify-center bg-white/[0.01] border-white/5">
                <div className="text-[8px] uppercase font-bold opacity-30 mb-1">Solar</div>
                <div className="text-xs font-mono font-bold">{currentData.solarRadiation.toFixed(0)}</div>
              </div>
              <div className="tech-card p-4 flex flex-col items-center justify-center bg-white/[0.01] border-white/5">
                <div className="text-[8px] uppercase font-bold opacity-30 mb-1">Precip</div>
                <div className="text-xs font-mono font-bold">{currentData.rainfall.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* HUD Overlays */}
      <div className="fixed bottom-4 right-4 pointer-events-none opacity-50 flex flex-col items-end gap-1">
        <div className="text-[8px] font-mono uppercase">System: AIS_PORT_RELAY_PROX_v1</div>
        <div className="text-[8px] font-mono uppercase tracking-tighter">Lat: -6.1033 | Lon: 106.8833</div>
      </div>
    </div>
  );
}

function NavItem({ icon, active = false, label }: { icon: React.ReactNode, active?: boolean, label: string }) {
  return (
    <div className={`group relative cursor-pointer p-4 rounded-2xl transition-all duration-300 ${active ? 'bg-accent/15 text-accent ring-1 ring-accent/20' : 'text-ink/40 hover:text-ink/80 hover:bg-white/5'}`}>
      {icon}
      <div className="absolute left-full ml-4 px-3 py-1.5 bg-ink text-bg text-[10px] font-bold uppercase rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap pointer-events-none z-50">
        {label}
      </div>
      {active && <motion.div layoutId="nav-pill" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-accent rounded-full" />}
    </div>
  );
}
