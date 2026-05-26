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
    <div className="tech-card p-6 h-[320px] w-full bg-gradient-to-b from-paper to-bg/90 border-accent/10 relative">
      <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-[9px] uppercase font-bold tracking-[0.25em] text-accent mb-1">{label}</h3>
          <div className="text-2xl font-black data-mono tracking-tighter text-white">
            {data[data.length - 1][dataKey as keyof WeatherData]?.toString()}
            <span className="text-[9px] ml-1.5 opacity-50 font-bold uppercase tracking-widest text-accent font-sans">{unit}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[7.5px] font-mono opacity-40 uppercase tracking-[0.2em] text-accent">L-H Oracle Latency</span>
          <div className="flex gap-1.5 mt-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-1 h-3 rounded bg-accent/25 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
      
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
                <stop offset="100%" stopColor={color} stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 184, 103, 0.03)" vertical={false} />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(val) => format(val, 'HH:mm')}
              tick={{ fontSize: 8.5, fill: '#e2b867', opacity: 0.45, fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}
              axisLine={{ stroke: 'rgba(226, 184, 103, 0.1)', strokeWidth: 1 }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis 
              tick={{ fontSize: 8.5, fill: '#e2b867', opacity: 0.45, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              hide
            />
            <Tooltip 
              cursor={{ stroke: 'rgba(226, 184, 103, 0.2)', strokeWidth: 1.5, strokeDasharray: '2 2' }}
              contentStyle={{ 
                background: 'rgba(14, 16, 19, 0.95)', 
                border: '1px solid rgba(226, 184, 103, 0.15)', 
                borderRadius: '14px',
                fontSize: '9.5px', 
                fontFamily: 'JetBrains Mono',
                backdropFilter: 'blur(15px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                color: '#f1f3f5'
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
