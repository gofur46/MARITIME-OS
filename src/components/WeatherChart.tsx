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
    <div className="tech-card p-6 h-[320px] w-full bg-white/[0.02] backdrop-blur-md">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-[10px] uppercase font-bold tracking-[0.3em] text-accent/80 mb-1">{label}</h3>
          <div className="text-xl font-bold data-mono tracking-tighter">
            {data[data.length - 1][dataKey as keyof WeatherData]?.toString()}
            <span className="text-[10px] ml-1 opacity-40 font-normal uppercase">{unit}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-mono opacity-30 uppercase tracking-widest">Telemetry Stream</span>
          <div className="flex gap-1 mt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-accent/20 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
      
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="100%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(val) => format(val, 'HH:mm')}
              tick={{ fontSize: 9, fill: '#ffffff20', fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis 
              tick={{ fontSize: 9, fill: '#ffffff20', fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              hide
            />
            <Tooltip 
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{ 
                background: 'rgba(15, 17, 19, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '12px',
                fontSize: '10px', 
                fontFamily: 'JetBrains Mono',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }}
              labelFormatter={(val) => format(val, 'HH:mm:ss')}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              fillOpacity={1} 
              fill={`url(#gradient-${dataKey})`} 
              strokeWidth={2.5}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
