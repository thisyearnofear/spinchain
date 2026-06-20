"use client";

import { useState, useEffect, useMemo } from "react";
import { PrimaryNav } from "@/app/components/layout/nav";
import { GlassCard } from "@/app/components/ui/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Clock,
  TrendingUp,
  Sparkles,
  Dumbbell,
  Flame,
  Heart,
  Brain,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { WorkoutPlan } from "@/app/lib/workout-plan";

interface TemplateCard {
  id: string;
  name: string;
  description: string;
  difficulty: "easy" | "moderate" | "hard";
  durationMinutes: number;
  personality: "zen" | "drill-sergeant" | "data";
  theme: "neon" | "alpine" | "mars" | "anime" | "rainbow";
  tags: string[];
  author: string;
  uses: number;
  rating: number;
  intervals: number;
  estimatedCalories: number;
}

const FEATURED_TEMPLATES: TemplateCard[] = [
  {
    id: "tpl-1",
    name: "Neon Peak HIIT",
    description: "High-intensity intervals with neon city aesthetics. Sprint, recover, repeat.",
    difficulty: "hard",
    durationMinutes: 45,
    personality: "drill-sergeant",
    theme: "neon",
    tags: ["hiit", "sprint", "calorie-burn"],
    author: "Coach Atlas",
    uses: 1284,
    rating: 4.8,
    intervals: 8,
    estimatedCalories: 520,
  },
  {
    id: "tpl-2",
    name: "Alpine Endurance",
    description: "Steady-state climbing with breathtaking mountain views. Build your aerobic base.",
    difficulty: "moderate",
    durationMinutes: 60,
    personality: "zen",
    theme: "alpine",
    tags: ["endurance", "climb", "scenic"],
    author: "Zen Master",
    uses: 892,
    rating: 4.9,
    intervals: 6,
    estimatedCalories: 480,
  },
  {
    id: "tpl-3",
    name: "Mars Colony Sprint",
    description: "Short, explosive sprints across the red planet. Max power output focus.",
    difficulty: "hard",
    durationMinutes: 30,
    personality: "data",
    theme: "mars",
    tags: ["sprint", "power", "short"],
    author: "Dr. Spin",
    uses: 2103,
    rating: 4.7,
    intervals: 10,
    estimatedCalories: 380,
  },
  {
    id: "tpl-4",
    name: "Anime Recovery Ride",
    description: "Gentle recovery spin with vibrant anime aesthetics. Active recovery day.",
    difficulty: "easy",
    durationMinutes: 25,
    personality: "zen",
    theme: "anime",
    tags: ["recovery", "easy", "fun"],
    author: "Zen Master",
    uses: 567,
    rating: 4.6,
    intervals: 5,
    estimatedCalories: 180,
  },
  {
    id: "tpl-5",
    name: "Rainbow Intervals",
    description: "Colorful interval training with progressive intensity. Fun and challenging.",
    difficulty: "moderate",
    durationMinutes: 40,
    personality: "drill-sergeant",
    theme: "rainbow",
    tags: ["intervals", "progressive", "fun"],
    author: "Coach Atlas",
    uses: 1456,
    rating: 4.8,
    intervals: 7,
    estimatedCalories: 410,
  },
  {
    id: "tpl-6",
    name: "Data-Driven Threshold",
    description: "Precision threshold training with metrics-focused coaching. Hit your zones.",
    difficulty: "hard",
    durationMinutes: 50,
    personality: "data",
    theme: "neon",
    tags: ["threshold", "metrics", "precision"],
    author: "Dr. Spin",
    uses: 743,
    rating: 4.9,
    intervals: 9,
    estimatedCalories: 550,
  },
];

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  moderate: { label: "Moderate", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  hard: { label: "Hard", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

const PERSONALITY_CONFIG = {
  "drill-sergeant": { label: "Drill", icon: Flame },
  zen: { label: "Zen", icon: Heart },
  data: { label: "Data", icon: Brain },
};

const THEME_CONFIG: Record<string, string> = {
  neon: "from-cyan-500/20 to-purple-500/20",
  alpine: "from-blue-500/20 to-emerald-500/20",
  mars: "from-orange-500/20 to-red-500/20",
  anime: "from-pink-500/20 to-indigo-500/20",
  rainbow: "from-pink-500/20 via-yellow-500/20 to-cyan-500/20",
};

export default function TemplateMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterPersonality, setFilterPersonality] = useState<string>("all");
  const [savedTemplates, setSavedTemplates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem("saved_templates");
    if (saved) {
      try {
        setSavedTemplates(new Set(JSON.parse(saved)));
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleSave = (id: string) => {
    const next = new Set(savedTemplates);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSavedTemplates(next);
    localStorage.setItem("saved_templates", JSON.stringify([...next]));
  };

  const filtered = useMemo(() => {
    return FEATURED_TEMPLATES.filter((t) => {
      if (filterDifficulty !== "all" && t.difficulty !== filterDifficulty) return false;
      if (filterPersonality !== "all" && t.personality !== filterPersonality) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
        );
      }
      return true;
    });
  }, [searchQuery, filterDifficulty, filterPersonality]);

  const applyTemplate = (template: TemplateCard) => {
    const plan: Partial<WorkoutPlan> = {
      name: template.name,
      description: template.description,
      difficulty: template.difficulty,
      totalDuration: template.durationMinutes * 60,
      tags: template.tags,
    };
    localStorage.setItem("selected_template", JSON.stringify({
      ...plan,
      personality: template.personality,
      theme: template.theme,
      durationMinutes: template.durationMinutes,
    }));
    window.location.href = "/instructor/builder";
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-20 pt-6 lg:px-12 lg:pt-10">
        <div className="rounded-3xl border border-white/5 bg-white/5 px-6 py-4 lg:px-8 lg:py-6 backdrop-blur-xl">
          <PrimaryNav />
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Template Marketplace
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
            Browse Class Templates
          </h1>
          <p className="text-white/50 max-w-2xl">
            Discover AI-synthesized workout plans created by the community. Save your favorites or deploy instantly to your builder.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search templates, tags, or coaches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="hard">Hard</option>
            </select>
            <select
              value={filterPersonality}
              onChange={(e) => setFilterPersonality(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Styles</option>
              <option value="drill-sergeant">Drill</option>
              <option value="zen">Zen</option>
              <option value="data">Data</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
            {filtered.length} {filtered.length === 1 ? "Template" : "Templates"}
          </span>
          {savedTemplates.size > 0 && (
            <span className="text-xs font-bold text-indigo-400">
              {savedTemplates.size} saved
            </span>
          )}
        </div>

        {/* Template Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((template) => {
              const diff = DIFFICULTY_CONFIG[template.difficulty];
              const pers = PERSONALITY_CONFIG[template.personality];
              const PersIcon = pers.icon;
              const themeGradient = THEME_CONFIG[template.theme] || "from-indigo-500/20 to-purple-500/20";
              const isSaved = savedTemplates.has(template.id);

              return (
                <motion.div
                  key={template.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard className="p-0 overflow-hidden group hover:border-indigo-500/30 transition-all cursor-pointer" >
                    {/* Theme gradient header */}
                    <div className={`relative h-32 bg-gradient-to-br ${themeGradient} overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSave(template.id); }}
                          className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                            isSaved
                              ? "bg-indigo-500/30 border border-indigo-500/40 text-indigo-300"
                              : "bg-black/30 border border-white/10 text-white/40 hover:text-white"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <div className="absolute bottom-3 left-4 flex items-center gap-2">
                        <PersIcon className="w-4 h-4 text-white/80" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                          {pers.label}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4" onClick={() => applyTemplate(template)}>
                      <div>
                        <h3 className="text-lg font-black text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                          {template.name}
                        </h3>
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-[10px] font-bold text-white/40">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.durationMinutes}m
                        </span>
                        <span className="flex items-center gap-1">
                          <Dumbbell className="w-3 h-3" />
                          {template.intervals} intervals
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {template.estimatedCalories} cal
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${diff.bg} ${diff.border} border ${diff.color}`}>
                          {diff.label}
                        </span>
                        {template.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
                          <span className="text-[10px] font-bold text-white/60">
                            {template.author}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-white/40">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {template.uses.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 text-amber-400">
                            ★ {template.rating}
                          </span>
                        </div>
                      </div>

                      {/* Use button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); applyTemplate(template); }}
                        className="w-full py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        Use Template
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/40 font-bold">No templates match your filters</p>
            <p className="text-white/20 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}

        {/* CTA: Create your own */}
        <div className="mt-8 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 p-8 backdrop-blur-xl text-center">
          <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white tracking-tight">
            Can&apos;t find what you need?
          </h2>
          <p className="text-white/50 mt-2 max-w-md mx-auto">
            Use AI to synthesize a custom workout plan from your goals in seconds.
          </p>
          <Link
            href="/instructor/ai"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20"
          >
            Open AI Studio
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
