import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: number;
  alertLevel?: 'Normal' | 'Caution' | 'Warning' | 'Critical';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon, trend, alertLevel = 'Normal' }) => {
  const getAlertColor = () => {
    switch (alertLevel) {
      case 'Caution': return 'text-warning';
      case 'Warning': return 'text-orange-400';
      case 'Critical': return 'text-danger animate-pulse';
      default: return 'text-secondary';
    }
  };

  const getAlertBg = () => {
    switch (alertLevel) {
      case 'Caution': return 'bg-warning/10 border-warning/20';
      case 'Warning': return 'bg-orange-500/10 border-orange-500/20';
      case 'Critical': return 'bg-danger/10 border-danger/20';
      default: return 'bg-secondary/10 border-secondary/20';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, borderColor: 'rgba(226, 184, 103, 0.25)' }}
      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
      className="tech-card p-5 flex flex-col justify-between min-h-[150px] relative bg-gradient-to-br from-paper to-bg/80 border-accent/15"
    >
      {/* Decorative top dot */}
      <div className="absolute top-3 right-3 flex gap-1">
        <span className="w-1 h-1 rounded-full bg-accent/40" />
        <span className="w-1 h-1 rounded-full bg-accent/20" />
      </div>

      <div className="flex justify-between items-start">
        <span className="text-[11px] md:text-xs uppercase font-extrabold tracking-[0.18em] opacity-65 text-accent font-mono">{label}</span>
        <div className={cn("p-2.5 rounded-xl border flex items-center justify-center shadow-lg backdrop-blur-md transition-all", getAlertColor(), getAlertBg())}>
          {icon}
        </div>
      </div>
      
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl md:text-4xl font-extrabold data-mono leading-none tracking-tighter text-white drop-shadow-sm">{value}</span>
          {unit && <span className="text-xs uppercase font-bold tracking-widest text-accent opacity-75 font-mono">{unit}</span>}
        </div>
        
        {trend !== undefined ? (
          <div className={cn("text-xs mt-2.5 font-mono flex items-center gap-1 font-bold", trend > 0 ? 'text-danger' : 'text-success')}>
            <span className="text-[8px]">{trend > 0 ? '▲' : '▼'}</span>
            <span>{Math.abs(trend)}% vs last hr</span>
          </div>
        ) : (
          <div className="text-[10px] mt-2.5 font-mono opacity-40 uppercase tracking-wider">Tlm Stream Active</div>
        )}
      </div>
    </motion.div>
  );
};
