import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WeatherData } from '../types';
import { format } from 'date-fns';

interface WeatherChartProps {
  data: WeatherData[];
  dataKey: keyof WeatherData;
  label: string;
  unit: string;
  color: string;
}

export const WeatherChart: React.FC<WeatherChartProps> = ({ data, dataKey, label, unit, color }) => {
  return (
    <div className="tech-card p-4 h-[210px] w-full bg-gradient-to-b from-paper to-bg/90 border-accent/10 relative flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
        <div>
          <h3 className="text-[9px] uppercase font-bold tracking-[0.25em] text-accent mb-0.5">{label}</h3>
          <div className="text-xl font-black data-mono tracking-tighter text-white">
            {data[data.length - 1][dataKey as keyof WeatherData]?.toString()}
            <span className="text-[9px] ml-1.5 opacity-50 font-bold uppercase tracking-widest text-accent font-sans">{unit}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[7.5px] font-mono opacity-40 uppercase tracking-[0.2em] text-accent">L-H Oracle Latency</span>
          <div className="flex gap-1 mt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-[3px] h-2.5 rounded bg-accent/25 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
      
      <div className="h-[110px] w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
                <stop offset="100%" stopColor={color} stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 240, 255, 0.03)" vertical={false} />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(val) => format(val, 'HH:mm')}
              tick={{ fontSize: 8, fill: '#00f0ff', opacity: 0.35, fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
              axisLine={{ stroke: 'rgba(0, 240, 255, 0.1)', strokeWidth: 1 }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis 
              tick={{ fontSize: 8, fill: '#00f0ff', opacity: 0.35, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              hide
            />
            <Tooltip 
              cursor={{ stroke: 'rgba(0, 240, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '2 2' }}
              contentStyle={{ 
                background: 'rgba(11, 20, 36, 0.95)', 
                border: '1px solid rgba(0, 240, 255, 0.15)', 
                borderRadius: '14px',
                fontSize: '9.5px', 
                fontFamily: 'JetBrains Mono',
                backdropFilter: 'blur(15px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                color: '#e0f2fe'
              }}
              labelFormatter={(val) => `GPS Time: ${format(val, 'HH:mm:ss')}`}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              fillOpacity={1} 
              fill={`url(#gradient-${dataKey})`} 
              strokeWidth={2}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
