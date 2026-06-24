"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { modalTransition, modalExitTransition } from "@/app/lib/motion";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";

interface ExitConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ExitConfirmModalInternal({ open, onConfirm, onCancel }: ExitConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: Z_LAYERS.modals }}
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, ...modalExitTransition }}
            transition={modalTransition}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: Z_LAYERS.modals }}
          >
            <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-gray-900/95 backdrop-blur-xl p-6 shadow-2xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10">
                <svg className="h-7 w-7 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>

              <h3 className="text-center text-lg font-semibold text-white mb-2">
                End your ride?
              </h3>
              <p className="text-center text-sm text-white/60 mb-6">
                Your ride data will be saved and you&apos;ll see your performance summary.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onConfirm}
                  className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-all hover:shadow-rose-500/50 active:scale-[0.98]"
                >
                  End Ride
                </button>
                <button
                  onClick={onCancel}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 active:scale-[0.98]"
                >
                  Keep Riding
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export const ExitConfirmModal = memo(ExitConfirmModalInternal);
