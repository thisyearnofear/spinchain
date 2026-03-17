"use client";

import { useState, useEffect } from "react";
import { LoadingButton } from "@/app/components/ui/loading-button";
import { Music, FileText, Sparkles, Trash2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StyleAnchor {
  id: string;
  type: "transcript" | "audio" | "music_profile";
  content: string;
  name: string;
}

export function TrainingStudio() {
  const [anchors, setStyleAnchors] = useState<StyleAnchor[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // Load anchors from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("instructor_style_anchors");
    if (saved) {
      try {
        setStyleAnchors(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse style anchors", e);
      }
    } else {
      // Default anchors if none saved
      setStyleAnchors([
        {
          id: "1",
          type: "transcript",
          name: "High Intensity Motivation",
          content: "Focus on the burn, let it fuel you!",
        },
        {
          id: "2",
          type: "music_profile",
          name: "Techno-Neon Vibe",
          content: "140BPM Progressive House",
        },
      ]);
    }
  }, []);

  const saveToLocal = (newAnchors: StyleAnchor[]) => {
    localStorage.setItem("instructor_style_anchors", JSON.stringify(newAnchors));
  };

  const addAnchor = (type: StyleAnchor["type"]) => {
    const newAnchor: StyleAnchor = {
      id: Math.random().toString(36).substring(2, 11),
      type,
      name: `New ${type.replace("_", " ")}`,
      content: "",
    };
    const updated = [...anchors, newAnchor];
    setStyleAnchors(updated);
    saveToLocal(updated);
  };

  const removeAnchor = (id: string) => {
    const updated = anchors.filter((a) => id !== a.id);
    setStyleAnchors(updated);
    saveToLocal(updated);
  };

  const updateAnchor = (id: string, field: keyof StyleAnchor, value: string) => {
    const updated = anchors.map((a) => 
      a.id === id ? { ...a, [field]: value } : a
    );
    setStyleAnchors(updated);
    saveToLocal(updated);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    // Mock API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSyncing(false);
    setLastSync(Date.now());
    
    // In a real app, this would push to the Agent Brain (e.g., Pinecone or a Sui Move object)
    console.log("Synced anchors to Agent Brain:", anchors);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Instructor Training Studio
          </h3>
          <p className="text-xs text-white/40">
            Prime your agent with your unique style anchors
          </p>
        </div>
        <div className="flex gap-2">
          <LoadingButton
            variant="secondary"
            onClick={() => addAnchor("transcript")}
            className="gap-1 text-[10px] h-8 px-3"
          >
            <FileText className="w-3 h-3" /> + Transcript
          </LoadingButton>
          <LoadingButton
            variant="secondary"
            onClick={() => addAnchor("music_profile")}
            className="gap-1 text-[10px] h-8 px-3"
          >
            <Music className="w-3 h-3" /> + Vibe
          </LoadingButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {anchors.map((anchor) => (
            <motion.div
              key={anchor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 relative group backdrop-blur-xl hover:border-indigo-500/30 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    {anchor.type === "transcript" ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <Music className="w-4 h-4" />
                    )}
                  </div>
                  <input
                    className="bg-transparent text-sm font-semibold text-white outline-none focus:text-indigo-300 transition-colors flex-1"
                    value={anchor.name}
                    onChange={(e) => updateAnchor(anchor.id, "name", e.target.value)}
                  />
                  <button
                    onClick={() => removeAnchor(anchor.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  className="w-full bg-black/20 rounded-lg p-3 text-xs text-white/60 min-h-[80px] outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
                  placeholder={
                    anchor.type === "transcript"
                      ? "Paste class transcript here..."
                      : "Describe the music vibe..."
                  }
                  value={anchor.content}
                  onChange={(e) => updateAnchor(anchor.id, "content", e.target.value)}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
        {lastSync ? (
          <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Last synced {new Date(lastSync).toLocaleTimeString()}
          </div>
        ) : <div />}
        <LoadingButton 
          variant="primary" 
          className="gap-2 min-w-[160px]"
          onClick={handleSync}
          isLoading={isSyncing}
          loadingText="Syncing Brain..."
        >
          <Sparkles className="w-4 h-4" />
          Sync to Agent Brain
        </LoadingButton>
      </div>
    </div>
  );
}
