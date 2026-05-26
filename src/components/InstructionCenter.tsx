import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PortInstruction } from '../types';
import { format } from 'date-fns';
import { Bell, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface InstructionCenterProps {
  instructions: PortInstruction[];
}

export const InstructionCenter: React.FC<InstructionCenterProps> = ({ instructions }) => {
  const getIcon = (level: string) => {
    switch (level) {
      case 'Caution': return <Info className="w-4 h-4" />;
      case 'Warning': return <AlertTriangle className="w-4 h-4" />;
      case 'Critical': return <ShieldAlert className="w-4 h-4 text-danger animate-pulse" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getBorderColor = (level: string) => {
    switch (level) {
      case 'Caution': return 'border-warning/30';
      case 'Warning': return 'border-orange-500/30';
      case 'Critical': return 'border-danger/30 bg-danger/5';
      default: return 'border-white/10';
    }
  };

  return (
    <div className="tech-card h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs uppercase font-bold tracking-[0.2em] opacity-80">Port Instructions</h3>
        <span className="flex h-2 w-2 rounded-full bg-success animate-ping"></span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {instructions.length === 0 ? (
            <div className="text-[10px] opacity-40 text-center py-10 uppercase tracking-widest">
              No active instructions
            </div>
          ) : (
            instructions.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  "p-3 border rounded-2xl transition-colors",
                  getBorderColor(item.level)
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase",
                      item.level === 'Critical' ? 'text-danger' : 
                      item.level === 'Warning' ? 'text-orange-500' : 'text-ink'
                    )}>
                      [{item.level}]
                    </span>
                    <span className="text-[10px] opacity-40 font-mono">
                      {format(item.timestamp, 'HH:mm:ss')}
                    </span>
                  </div>
                  {getIcon(item.level)}
                </div>
                <p className="text-xs leading-relaxed opacity-90">{item.message}</p>
                <div className="mt-2 text-[8px] uppercase tracking-widest opacity-40 font-bold">
                  AUTH: PORT CONTROL / {item.type}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
