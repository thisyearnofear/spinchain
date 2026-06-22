"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Zap, Target, Sparkles, Brain } from "lucide-react";
import { useCoachingStore, selectLastCoachMessage, selectIsSpeaking } from "@/app/stores/coaching-store";

const PHASE_COLORS: Record<string, { glow: string; accent: string; bar: string }> = {
  sprint: { glow: "bg-red-500/20", accent: "text-red-400", bar: "bg-red-500/50" },
  interval: { glow: "bg-orange-500/20", accent: "text-orange-400", bar: "bg-orange-500/50" },
  warmup: { glow: "bg-emerald-500/20", accent: "text-emerald-400", bar: "bg-emerald-500/50" },
  cooldown: { glow: "bg-cyan-500/20", accent: "text-cyan-400", bar: "bg-cyan-500/50" },
  recovery: { glow: "bg-blue-500/20", accent: "text-blue-400", bar: "bg-blue-500/50" },
  default: { glow: "bg-indigo-500/20", accent: "text-indigo-400", bar: "bg-indigo-500/40" },
};

export function CoachMessageOverlay() {
  const message = useCoachingStore(selectLastCoachMessage);
  const phase = useCoachingStore((s) => s.currentInterval?.phase);
  const isSpeaking = useCoachingStore(selectIsSpeaking);
  const colors = PHASE_COLORS[phase ?? "default"] ?? PHASE_COLORS.default;

  return (
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none px-4 w-full max-w-[90%] sm:max-w-md z-50">
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 20, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, scale: 1.1, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative"
          >
            {/* Background Glow */}
            <div className={`absolute inset-0 ${colors.glow} blur-3xl rounded-full scale-150 ${isSpeaking ? "animate-pulse" : ""}`} />
            
            <div className="relative rounded-[2.5rem] border border-white/20 bg-black/80 backdrop-blur-3xl px-8 py-6 text-center shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Decorative corner accents */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-white/10 to-transparent opacity-50" />

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-white/5 ${colors.accent}`}>
                    {phase === 'sprint' ? <Zap className="w-4 h-4" /> : 
                     phase === 'interval' ? <Target className="w-4 h-4" /> :
                     <MessageSquare className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
                    Coach Instruction
                  </span>
                  {isSpeaking && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-purple-400">AI</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Sparkles className="w-3 h-3 text-white/20" />
                  </div>
                </div>

                <p className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-sm">
                  &ldquo;{message}&rdquo;
                </p>

                {/* Progress indicator for the message duration */}
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear" }}
                  className={`absolute bottom-0 left-0 h-1 ${colors.bar}`}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
