import React from 'react';
import { Navigation } from 'lucide-react';
import { motion } from 'motion/react';

interface WindCompassProps {
  speed: number;
  direction: number;
  unit: string;
}

export const WindCompass: React.FC<WindCompassProps> = ({ speed, direction, unit }) => {
  return (
    <div className="tech-card p-8 bg-accent/[0.03] border-accent/10">
      <div className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 mb-10 font-mono flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-accent rounded-full"></div>
          Dual-Axis Wind Monitoring System
        </div>
        <div className="text-accent/60">ACTIVE_VECTOR_SCAN</div>
      </div>
      
      <div className="flex flex-col md:flex-row items-center justify-around gap-12">
        {/* CIRCLE 1: MARITIME DIRECTIONAL ROSE */}
        <div className="relative group">
          <div className="text-[8px] absolute -top-10 left-1/2 -translate-x-1/2 opacity-30 font-bold tracking-widest uppercase italic text-center w-full">Vessel Heading & Wind Relative</div>
          <div className="w-64 h-64 rounded-full border border-white/10 flex items-center justify-center relative bg-gradient-to-br from-white/[0.03] to-transparent shadow-[inset_0_0_30px_rgba(255,255,255,0.02)]">
            
            {/* Harbor/Pier Context (Subtle lines) */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-48 h-1 bg-white/40 skew-x-12 ml-12" />
              <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-1 h-32 bg-white/40 -mt-16 ml-32" />
            </div>

            {/* Vessel Silhouette */}
            <div className="relative z-10 flex items-center justify-center">
              {/* Ship Body */}
              <div className="w-8 h-24 bg-white/10 border-2 border-white/20 rounded-full relative flex flex-col items-center py-2">
                <div className="w-6 h-[85%] bg-accent/5 border border-white/5 rounded-t-[50%] rounded-b-sm" />
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-[7px] font-black tracking-widest opacity-40 uppercase">Port</div>
                <div className="absolute -right-10 top-1/2 -translate-y-1/2 text-[7px] font-black tracking-widest opacity-40 uppercase">Stbd</div>
              </div>
            </div>

            {/* Compass markings */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <div 
                key={deg} 
                className="absolute inset-0 flex justify-center py-2"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-3 bg-white/20 rounded-full"></div>
                  <span className="text-[7px] font-mono opacity-20 mt-1" style={{ transform: `rotate(-${deg}deg)` }}>
                    {deg === 0 ? 'N' : deg === 45 ? 'NE' : deg === 90 ? 'E' : deg === 135 ? 'SE' : deg === 180 ? 'S' : deg === 225 ? 'SW' : deg === 270 ? 'W' : 'NW'}
                  </span>
                </div>
              </div>
            ))}

            {/* Rotating Wind Arrow - Pointing Inward to Ship */}
            <motion.div 
              animate={{ rotate: direction }}
              transition={{ type: 'spring', stiffness: 30, damping: 15 }}
              className="absolute inset-0 flex items-center justify-center p-4"
            >
              <div className="w-px h-full relative">
                {/* Arrow Head pointing to center */}
                <div className="absolute top-12 left-1/2 -translate-x-1/2">
                   <svg width="24" height="40" viewBox="0 0 24 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]">
                    <path d="M12 40L12 10M12 40L4 30M12 40L20 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* CIRCLE 2: KINETIC VECTOR (SPEED & FORCE) */}
        <div className="relative group">
          <div className="text-[8px] absolute -top-10 left-1/2 -translate-x-1/2 opacity-30 font-bold tracking-widest uppercase italic text-center w-full">Wind Force & Kinetic Vector</div>
          <div className="w-56 h-56 rounded-full border-2 border-accent/10 flex items-center justify-center relative shadow-[0_0_50px_rgba(59,130,246,0.05)] bg-accent/[0.03] backdrop-blur-sm">
            {/* Degree Markings for Speed Vector */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <div 
                key={deg} 
                className="absolute inset-0 flex justify-center p-2"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-px h-2 bg-accent/40 rounded-full"></div>
                  <span className="text-[7px] font-mono text-accent/50 mt-1" style={{ transform: `rotate(-${deg}deg)` }}>
                    {deg}
                  </span>
                </div>
              </div>
            ))}

            {/* Speed HUD */}
            <div className="text-center z-10 flex flex-col items-center">
              <div className="text-5xl font-black data-mono tracking-tighter text-white drop-shadow-md">
                {speed.toFixed(1)}
              </div>
              <div className="text-[10px] font-bold text-accent tracking-[0.2em] opacity-80">
                {unit}
              </div>
            </div>

            {/* Dynamic Vector Line - Pointing Inward */}
            <motion.div 
              animate={{ rotate: direction }}
              transition={{ type: 'spring', stiffness: 60, damping: 20 }}
              className="absolute inset-0 p-6"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">
                  <path d="M12 20L12 4M12 20L7 15M12 20L17 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </motion.div>

            {/* Inner Ring Glow */}
            <div className="absolute inset-4 rounded-full border border-accent/20 border-dotted animate-[spin_120s_linear_infinite]" />
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-white/5 flex justify-between items-center opacity-40">
        <div className="text-[9px] font-mono tracking-widest">REALTIME_TELEMETRY_PROCESSOR</div>
        <div className="text-[9px] font-mono font-bold">{direction.toFixed(1)}° AZIMUTH</div>
      </div>
    </div>
  );
};
