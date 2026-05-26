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
      case 'Warning': return 'text-orange-500';
      case 'Critical': return 'text-danger';
      default: return 'text-success';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="tech-card p-4 flex flex-col justify-between min-h-[140px]"
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] uppercase font-semibold tracking-wider opacity-60 font-mono">{label}</span>
        <div className={cn("p-2.5 rounded-xl bg-white/5", getAlertColor())}>
          {icon}
        </div>
      </div>
      
      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold data-mono leading-none tracking-tighter">{value}</span>
          {unit && <span className="text-xs opacity-40 font-medium">{unit}</span>}
        </div>
        
        {trend !== undefined && (
          <div className={cn("text-[10px] mt-1 font-mono", trend > 0 ? 'text-danger' : 'text-success')}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last hr
          </div>
        )}
      </div>
    </motion.div>
  );
};
