"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Users, Zap, Trophy, MessageSquare, Hand } from "lucide-react";

interface SocialEvent {
  id: string;
  type: "shoutout" | "recommendation" | "nudge" | "highfive";
  message: string;
  timestamp: number;
  from?: string;
}

export function RiderSocialFeed({ 
  events, 
  onHighFive 
}: { 
  events: SocialEvent[], 
  onHighFive?: (riderId: string) => void 
}) {
  return (
    <div className="fixed top-24 right-4 w-72 pointer-events-none z-50">
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="group pointer-events-auto bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:border-indigo-500/30 transition-all"
            >
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-2xl h-fit ${
                  event.type === 'shoutout' ? 'bg-indigo-500/20 text-indigo-400' :
                  event.type === 'recommendation' ? 'bg-emerald-500/20 text-emerald-400' :
                  event.type === 'highfive' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {event.type === 'shoutout' ? <Trophy className="w-4 h-4" /> :
                   event.type === 'recommendation' ? <Zap className="w-4 h-4" /> :
                   event.type === 'highfive' ? <Hand className="w-4 h-4" /> :
                   <MessageSquare className="w-4 h-4" />}
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                      {event.type === 'highfive' ? 'Social Interaction' : 'Agent Intelligence'}
                    </span>
                    {event.type === 'highfive' && (
                      <button 
                        onClick={() => onHighFive?.(event.from || 'unknown')}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:border-rose-500/30 transition-all text-white/40 hover:text-rose-400"
                      >
                        <Hand className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[12px] font-bold text-white/90 leading-snug">
                    {event.message}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
