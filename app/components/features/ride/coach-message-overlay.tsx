"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Zap, Target, Sparkles } from "lucide-react";

interface CoachMessageOverlayProps {
  message: string | null;
  phase?: string | null;
}

export function CoachMessageOverlay({ message, phase }: CoachMessageOverlayProps) {
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
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
            
            <div className="relative rounded-[2.5rem] border border-white/20 bg-black/80 backdrop-blur-3xl px-8 py-6 text-center shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Decorative corner accents */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-50" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-indigo-500/20 to-transparent opacity-50" />

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    {phase === 'sprint' ? <Zap className="w-4 h-4" /> : 
                     phase === 'interval' ? <Target className="w-4 h-4" /> :
                     <MessageSquare className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
                    Coach Instruction
                  </span>
                  <div className="flex gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-400/40" />
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
                  className="absolute bottom-0 left-0 h-1 bg-indigo-500/40"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
