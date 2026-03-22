"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Users, Zap, Trophy, MessageSquare } from "lucide-react";

interface SocialEvent {
  id: string;
  type: "shoutout" | "recommendation" | "nudge";
  message: string;
  timestamp: number;
}

export function RiderSocialFeed({ events }: { events: SocialEvent[] }) {
  return (
    <div className="fixed top-24 right-4 w-64 pointer-events-none z-50">
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl"
            >
              <div className="flex gap-3">
                <div
                  className={`p-2 rounded-xl h-fit ${
                    event.type === "shoutout"
                      ? "bg-indigo-500/20 text-indigo-400"
                      : event.type === "recommendation"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {event.type === "shoutout" ? (
                    <Trophy className="w-3 h-3" />
                  ) : event.type === "recommendation" ? (
                    <Zap className="w-3 h-3" />
                  ) : (
                    <MessageSquare className="w-3 h-3" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Agent Action
                  </span>
                  <p className="text-[11px] font-bold text-white/90 leading-tight">
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
