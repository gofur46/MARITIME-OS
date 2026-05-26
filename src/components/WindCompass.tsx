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
    <div className="tech-card p-8 bg-gradient-to-b from-paper/80 via-paper/50 to-bg/90 border-accent/20 backdrop-blur-xl relative">
      {/* Decorative luxury corners */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-accent/30 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-accent/30 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-accent/30 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-accent/30 rounded-br-lg" />

      <div className="text-[9px] uppercase font-bold tracking-[0.25em] text-accent flex items-center justify-between mb-8 pb-3 border-b border-accent/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/40 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          Yacht Port / Wind Matrix Vector
        </div>
        <div className="text-white/40 font-mono text-[8px] tracking-[0.1em] bg-white/5 py-0.5 px-2 rounded">
          INSTRUMENT_SYS_ACTIVE
        </div>
      </div>
      
      <div className="flex flex-col xl:flex-row items-center justify-around gap-12 py-4">
        {/* CIRCLE 1: MARITIME DIRECTIONAL ROSE */}
        <div className="relative group">
          <div className="text-[7.5px] absolute -top-10 left-1/2 -translate-x-1/2 opacity-40 font-bold tracking-[0.2em] uppercase text-center w-full text-accent/80 font-mono">01 // Harbor Vessel Positioning</div>
          <div className="w-68 h-68 rounded-full border-2 border-accent/15 flex items-center justify-center relative bg-gradient-to-br from-paper to-bg shadow-[0_0_50px_rgba(226,184,103,0.03),inset_0_0_30px_rgba(226,184,103,0.05)]">
            
            {/* Compass glass reflection effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.04] pointer-events-none z-20" />

            {/* Harbor/Pier Context (Sleek minimalist gold outlines mimicking terminal maps) */}
            <div className="absolute inset-0 opacity-15 pointer-events-none">
              <div className="absolute top-[48%] left-1/2 -translate-y-1/2 w-48 h-12 border-b-2 border-r-2 border-accent/60 rounded-br-2xl skew-x-12 ml-6" />
              <div className="absolute top-[30%] left-1/2 -translate-y-1/2 w-0.5 h-20 bg-accent/40 ml-28" />
              <div className="absolute top-[65%] left-1/2 -translate-y-1/2 w-20 h-0.5 bg-accent/40 -ml-28" />
            </div>

            {/* Vessel Silhouette */}
            <div className="relative z-10 flex items-center justify-center">
              {/* Ship Body - Luxury Yacht Metallic Silhouette */}
              <div className="w-10 h-28 bg-gradient-to-b from-white/[0.15] to-white/[0.03] border-2 border-accent/40 rounded-full relative flex flex-col items-center py-3 shadow-2xl">
                <div className="w-7 h-[88%] bg-bg border border-white/5 rounded-t-[50%] rounded-b-md relative flex flex-col items-center justify-between p-1 overflow-hidden">
                  {/* Miniature premium yacht elements */}
                  <div className="w-3 h-6 bg-accent/[0.12] border border-accent/20 rounded-full mt-2" />
                  <div className="w-px h-10 bg-accent/20 absolute top-10" />
                  <div className="w-4 h-2 bg-white/[0.08] rounded mb-1" />
                </div>
                {/* Port & Starboard Status lights - Luxe theme */}
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-[7.5px] font-bold tracking-[0.2em] text-danger/80 bg-danger/5 border border-danger/10 px-1 py-0.5 rounded uppercase">Port</div>
                <div className="absolute -right-12 top-1/2 -translate-y-1/2 text-[7.5px] font-bold tracking-[0.2em] text-success/80 bg-success/5 border border-success/10 px-1 py-0.5 rounded uppercase">Stbd</div>
                
                {/* Bow marker */}
                <div className="absolute -top-1 w-2 h-2 bg-accent rounded-full border border-white/20 shadow-[0_0_10px_rgba(226,184,103,0.8)]" />
              </div>
            </div>

            {/* Compass markings and high-end yacht divisions */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <div 
                key={deg} 
                className="absolute inset-0 flex justify-center py-2"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-[1.5px] h-3 bg-accent/40 rounded-full"></div>
                  <span className="text-[7.5px] font-mono opacity-60 font-bold mt-1 text-accent" style={{ transform: `rotate(-${deg}deg)` }}>
                    {deg === 0 ? 'N' : deg === 45 ? 'NE' : deg === 90 ? 'E' : deg === 135 ? 'SE' : deg === 180 ? 'S' : deg === 225 ? 'SW' : deg === 270 ? 'W' : 'NW'}
                  </span>
                </div>
              </div>
            ))}

            {/* Rotating Wind Arrow - Pointing Inward to Ship with custom luxury vector line */}
            <motion.div 
              animate={{ rotate: direction }}
              transition={{ type: 'spring', stiffness: 35, damping: 14 }}
              className="absolute inset-0 flex items-center justify-center p-3"
            >
              <div className="w-full h-full relative flex items-center justify-center">
                {/* Gold Gradient pointer trail pointing deep into center */}
                <div className="absolute top-[15px] bottom-[15px] w-[2px] bg-gradient-to-b from-accent/80 via-accent/20 to-transparent pointer-events-none" />
                
                {/* Luxury Arrow Head pointing directly to ship hull */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2">
                   <svg width="22" height="42" viewBox="0 0 24 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-secondary drop-shadow-[0_0_15px_rgba(0,229,255,0.9)]">
                    <path d="M12 40L12 10M12 40L4 28M12 40L20 28" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* CIRCLE 2: KINETIC VECTOR (SPEED & FORCE) */}
        <div className="relative group">
          <div className="text-[7.5px] absolute -top-10 left-1/2 -translate-x-1/2 opacity-40 font-bold tracking-[0.2em] uppercase text-center w-full text-accent/80 font-mono">02 // Wind Velocity Monitor</div>
          <div className="w-56 h-56 rounded-full border-2 border-accent/15 flex items-center justify-center relative shadow-[0_0_50px_rgba(226,184,103,0.03)] bg-gradient-to-tr from-paper/90 to-bg backdrop-blur-xl">
            
            {/* Outer dial frame */}
            <div className="absolute inset-1.5 rounded-full border border-white/5 pointer-events-none" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03] pointer-events-none z-20" />

            {/* Degree Markings for Speed Vector */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <div 
                key={deg} 
                className="absolute inset-0 flex justify-center p-3"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-px h-2.5 bg-accent/30 rounded-full"></div>
                  <span className="text-[7px] font-mono text-accent/40 mt-1 font-semibold" style={{ transform: `rotate(-${deg}deg)` }}>
                    {deg}°
                  </span>
                </div>
              </div>
            ))}

            {/* Speed HUD: Fine Luxe Typography */}
            <div className="text-center z-10 flex flex-col items-center bg-bg/80 border border-white/5 p-6 rounded-full aspect-square justify-center shadow-inner">
              <div className="text-4xl font-extrabold data-mono tracking-tighter text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] leading-none mb-1">
                {speed.toFixed(1)}
              </div>
              <div className="text-[8.5px] font-bold text-accent tracking-[0.25em] uppercase opacity-90">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent drop-shadow-[0_0_15px_rgba(226,184,103,0.8)]">
                  <path d="M12 20L12 4M12 20L7 15M12 20L17 15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </motion.div>

            {/* Inner Ring Glow */}
            <div className="absolute inset-5 rounded-full border border-accent/15 border-dotted animate-[spin_180s_linear_infinite]" />
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-accent/10 flex justify-between items-center opacity-60">
        <div className="text-[9px] font-mono tracking-[0.15em] text-accent/85 flex items-center gap-1.5">
          <span className="w-1 h-1 bg-accent rounded-full"></span>
          REALTIME_TELEMETRY_ENGINE
        </div>
        <div className="text-[9px] font-mono font-bold text-white tracking-widest">{direction.toFixed(1)}° AZIMUTH</div>
      </div>
    </div>
  );
};
