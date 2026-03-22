"use client";

import { useState, useEffect } from "react";
import { LoadingButton } from "@/app/components/ui/loading-button";
import {
  Music,
  FileText,
  Sparkles,
  Trash2,
  CheckCircle2,
  Cloud,
  Wand2,
  Clock,
  Layout,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WalrusClient } from "@/app/lib/walrus/client";
import { synthesizeWorkoutPlan } from "@/app/lib/ai/autonomous-synthesis";
import { WorkoutPlan } from "@/app/lib/workout-plan";

interface StyleAnchor {
  id: string;
  type: "transcript" | "audio" | "music_profile";
  content: string;
  name: string;
}

export function TrainingStudio() {
  const [mode, setMode] = useState<"anchors" | "synthesis">("anchors");
  const [anchors, setStyleAnchors] = useState<StyleAnchor[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null);

  // Synthesis State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthGoal, setSynthGoal] = useState(
    "Burn 500 calories with high intensity sprints",
  );
  const [synthDuration, setSynthDuration] = useState(30);
  const [lastSynthPlan, setLastSynthPlan] = useState<WorkoutPlan | null>(null);

  // Load anchors from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("instructor_style_anchors");
    const savedBlobId = localStorage.getItem("instructor_walrus_blob_id");
    const savedPlan = localStorage.getItem("last_synthesized_plan");

    if (savedBlobId) setWalrusBlobId(savedBlobId);
    if (savedPlan) setLastSynthPlan(JSON.parse(savedPlan));

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

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    try {
      const plan = await synthesizeWorkoutPlan({
        goal: synthGoal,
        durationMinutes: synthDuration,
        personality: "drill-sergeant", // Mock personality
        theme: "neon",
      });
      setLastSynthPlan(plan);
      localStorage.setItem("last_synthesized_plan", JSON.stringify(plan));
    } catch (e) {
      console.error("Synthesis failed", e);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const saveToLocal = (newAnchors: StyleAnchor[]) => {
    localStorage.setItem(
      "instructor_style_anchors",
      JSON.stringify(newAnchors),
    );
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

  const updateAnchor = (
    id: string,
    field: keyof StyleAnchor,
    value: string,
  ) => {
    const updated = anchors.map((a) =>
      a.id === id ? { ...a, [field]: value } : a,
    );
    setStyleAnchors(updated);
    saveToLocal(updated);
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      // 1. Initialize Walrus Client
      const walrus = new WalrusClient();

      // 2. Store style anchors as JSON blob
      const data = JSON.stringify({
        version: "1.0",
        anchors,
        timestamp: Date.now(),
      });

      const result = await walrus.store(data, "application/json");

      if (result.success && result.blobId) {
        setWalrusBlobId(result.blobId);
        localStorage.setItem("instructor_walrus_blob_id", result.blobId);
        setLastSync(Date.now());
        console.log("Style Anchors persisted to Walrus:", result.blobId);
      } else {
        throw new Error(result.error || "Walrus storage failed");
      }
    } catch (error) {
      console.error("Failed to sync to Walrus:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex p-1 bg-black/20 rounded-xl border border-white/5 w-fit">
        <button
          onClick={() => setMode("anchors")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
            mode === "anchors"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <Layout className="w-3 h-3" /> Style Anchors
        </button>
        <button
          onClick={() => setMode("synthesis")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
            mode === "synthesis"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <Wand2 className="w-3 h-3" /> Autonomous Synthesis
        </button>
      </div>

      {mode === "anchors" ? (
        <>
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
                        onChange={(e) =>
                          updateAnchor(anchor.id, "name", e.target.value)
                        }
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
                      onChange={(e) =>
                        updateAnchor(anchor.id, "content", e.target.value)
                      }
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
            {walrusBlobId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <Cloud className="w-3 h-3 text-indigo-400" />
                <span className="text-[9px] font-mono text-indigo-300/60 truncate">
                  Walrus ID: {walrusBlobId}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              {lastSync ? (
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Last synced {new Date(lastSync).toLocaleTimeString()}
                </div>
              ) : (
                <div />
              )}
              <LoadingButton
                variant="primary"
                className="gap-2 min-w-[160px]"
                onClick={handleSync}
                isLoading={isSyncing}
                loadingText="Syncing to Walrus..."
              >
                <Sparkles className="w-4 h-4" />
                Sync to Agent Brain
              </LoadingButton>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-indigo-300 mb-4 flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Synthesis Parameters
            </h4>
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Class Objective
                </label>
                <textarea
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-indigo-500 outline-none transition-all resize-none h-24"
                  placeholder="e.g. Endurance climb with 80s pop music vibe..."
                  value={synthGoal}
                  onChange={(e) => setSynthGoal(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-8">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    Duration (Min)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="15"
                      max="90"
                      step="5"
                      className="flex-1 accent-indigo-500"
                      value={synthDuration}
                      onChange={(e) =>
                        setSynthDuration(parseInt(e.target.value))
                      }
                    />
                    <span className="text-xl font-black text-white w-12">
                      {synthDuration}
                    </span>
                  </div>
                </div>
                <LoadingButton
                  className="h-14 px-8 rounded-2xl gap-3"
                  onClick={handleSynthesize}
                  isLoading={isSynthesizing}
                  loadingText="Synthesizing..."
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Class
                </LoadingButton>
              </div>
            </div>
          </div>

          {lastSynthPlan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Synthesized Class Preview
                </h4>
                <div className="flex gap-2">
                  {lastSynthPlan.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] font-bold uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {lastSynthPlan.name}
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                      {lastSynthPlan.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                      Difficulty
                    </span>
                    <span className="text-sm font-black text-white uppercase">
                      {lastSynthPlan.difficulty}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {lastSynthPlan.intervals.map((interval, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 group hover:border-white/10 transition-all"
                    >
                      <div
                        className={`w-1 h-8 rounded-full ${
                          interval.phase === "sprint"
                            ? "bg-red-500"
                            : interval.phase === "recovery"
                              ? "bg-emerald-500"
                              : "bg-indigo-500"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                            {interval.phase}
                          </span>
                          <span className="text-[10px] font-mono text-white/40">
                            {Math.floor(interval.durationSeconds / 60)}m{" "}
                            {interval.durationSeconds % 60}s
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60 italic">
                          &ldquo;{interval.coachCue}&rdquo;
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] font-bold text-white/40">
                            {interval.targetRpm
                              ? `${interval.targetRpm[0]}-${interval.targetRpm[1]}`
                              : "--"}{" "}
                            RPM
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Music className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] font-bold text-white/40">
                            {Math.round((interval.musicEnergy ?? 0.5) * 100)}%
                            Energy
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-end">
                  <LoadingButton
                    variant="secondary"
                    className="gap-2 rounded-xl"
                  >
                    Deploy Autonomous Class to Protocol
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
