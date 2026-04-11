"use client";

import { motion, AnimatePresence, Reorder } from "framer-motion";
import { 
  useRideFocusMode, 
  useCustomMetrics, 
  FOCUS_MODE_META, 
  type MetricKey,
  type MetricConfig
} from "@/app/hooks/ui/use-ride-focus-mode";

/**
 * HUD Settings - Per-metric customization UI
 * Priority 4: Metric checkboxes, drag-to-reorder, per-mode customization
 */

interface HUDSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onHaptic?: (type?: "light" | "medium" | "heavy") => void;
}

export function HUDSettings({ isOpen, onClose, onHaptic }: HUDSettingsProps) {
  const mode = useRideFocusMode((state) => state.mode);
  const { 
    metrics, 
    useCustomMetrics: isCustomMetricsEnabled, 
    toggleMetricVisibility, 
    resetMetricsToPreset,
    enableCustomMetrics
  } = useCustomMetrics();
  
  const meta = FOCUS_MODE_META[mode];
  
  const handleToggleVisibility = (key: MetricKey) => {
    onHaptic?.("light");
    toggleMetricVisibility(key);
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl z-[70] overflow-hidden flex flex-col max-h-[80vh]"
            initial={{ opacity: 0, scale: 0.9, y: "-40%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.9, y: "-40%" }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className={meta.color}>{meta.icon}</span>
                  {meta.label} HUD Settings
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Customize metrics for this focus mode
                </p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-white/80">Use Custom Metrics</span>
                <button
                  onClick={() => {
                    onHaptic?.("medium");
                    enableCustomMetrics(!isCustomMetricsEnabled);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isCustomMetricsEnabled ? "bg-blue-500" : "bg-zinc-700"
                  }`}
                >
                  <motion.div
                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    animate={{ x: isCustomMetricsEnabled ? 24 : 0 }}
                  />
                </button>
              </div>
              
              <div className={`space-y-4 transition-opacity ${isCustomMetricsEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Metric</span>
                  <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Visible</span>
                </div>
                
                <Reorder.Group 
                  axis="y" 
                  values={metrics} 
                  onReorder={(newOrder: MetricConfig[]) => {
                    // Update priority values to match new order
                    const updatedMetrics = newOrder.map((m, idx) => ({ ...m, priority: idx + 1 }));
                    
                    // Update store
                    const currentMode = useRideFocusMode.getState().mode;
                    const newCustomConfigs = {
                      ...useRideFocusMode.getState().customConfigs,
                      [currentMode]: { useCustomMetrics: true, metrics: updatedMetrics }
                    };
                    
                    useRideFocusMode.setState({
                      customConfigs: newCustomConfigs,
                      config: { ...useRideFocusMode.getState().config, metrics: updatedMetrics }
                    });
                  }}
                  className="space-y-2"
                >
                  {metrics.map((metric: MetricConfig) => (
                    <Reorder.Item
                      key={metric.key}
                      value={metric}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 active:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="cursor-grab active:cursor-grabbing text-white/20 group-hover:text-white/40 transition-colors">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5 4h2v2H5V4zm4 0h2v2H9V4zM5 7h2v2H5V7zm4 0h2v2H9V7zm-4 3h2v2H5v-2zm4 0h2v2H9v-2z" />
                          </svg>
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${metric.color}`}>{metric.label}</div>
                          <div className="text-[10px] text-white/40">{metric.unit}</div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleToggleVisibility(metric.key)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${
                          metric.visible 
                            ? "bg-blue-500/20 border-blue-500 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]" 
                            : "bg-black/20 border-white/10 text-white/10"
                        }`}
                      >
                        {metric.visible && (
                          <motion.svg 
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </motion.svg>
                        )}
                      </button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 bg-black/40 border-t border-white/5 flex gap-3">
              <button
                onClick={() => {
                  onHaptic?.("medium");
                  resetMetricsToPreset();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium transition-colors"
              >
                Reset to Preset
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
