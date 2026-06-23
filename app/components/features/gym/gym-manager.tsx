"use client";

import { useState } from "react";
import { useGyms, useCreateGym, type Gym } from "@/app/hooks/common/use-gyms";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import { Building2, Plus, Loader2, Bike } from "lucide-react";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function GymRow({ gym }: { gym: Gym }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <Building2 className="h-5 w-5 text-blue-400" />
      <div className="flex-1">
        <p className="font-medium">{gym.name}</p>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[color:var(--text-muted)]">
          {gym.location && <span>{gym.location}</span>}
          <span className="rounded-full bg-white/5 px-2 py-0.5">{gym.brand}</span>
          {gym.power_offset !== 0 && <span>Power offset: {gym.power_offset}W</span>}
          {gym.power_scale !== 1.0 && <span>Power scale: {gym.power_scale}x</span>}
          {gym.hr_offset !== 0 && <span>HR offset: {gym.hr_offset}bpm</span>}
        </div>
      </div>
      {gym.created_by && (
        <span className="text-xs text-[color:var(--text-muted)]">{shortAddr(gym.created_by)}</span>
      )}
    </div>
  );
}

function CreateGymForm({ onCreated }: { onCreated: () => void }) {
  const { create, isCreating } = useCreateGym();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [brand, setBrand] = useState("generic");
  const [powerOffset, setPowerOffset] = useState("0");
  const [powerScale, setPowerScale] = useState("1.0");
  const [hrOffset, setHrOffset] = useState("0");
  const [hrScale, setHrScale] = useState("1.0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await create({
      name,
      location: location || undefined,
      brand,
      power_offset: Number(powerOffset) || 0,
      power_scale: Number(powerScale) || 1.0,
      hr_offset: Number(hrOffset) || 0,
      hr_scale: Number(hrScale) || 1.0,
    });
    if (result) {
      setName("");
      setLocation("");
      onCreated();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-[color:var(--text-muted)]">Gym name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Downtown Spin Studio"
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[color:var(--text-muted)]">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, Country"
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[color:var(--text-muted)]">Bike brand</label>
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="generic">Generic</option>
          <option value="peloton">Peloton</option>
          <option value="schwinn">Schwinn IC</option>
          <option value="keiser">Keiser M3</option>
          <option value="stages">Stages SC</option>
          <option value="wahoo">Wahoo Kickr</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-[color:var(--text-muted)]">Power offset (W)</label>
          <input type="number" value={powerOffset} onChange={(e) => setPowerOffset(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[color:var(--text-muted)]">Power scale</label>
          <input type="number" step="0.01" value={powerScale} onChange={(e) => setPowerScale(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[color:var(--text-muted)]">HR offset (bpm)</label>
          <input type="number" value={hrOffset} onChange={(e) => setHrOffset(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[color:var(--text-muted)]">HR scale</label>
          <input type="number" step="0.01" value={hrScale} onChange={(e) => setHrScale(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
      </div>

      <button
        type="submit"
        disabled={isCreating || !name}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/30 disabled:opacity-50"
      >
        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {isCreating ? "Creating..." : "Register gym"}
      </button>
    </form>
  );
}

export function GymManager() {
  const { gyms, isLoading, refetch } = useGyms();
  const [showForm, setShowForm] = useState(false);

  if (!isSupabaseConfigured()) return null;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold">Gym Registry</h3>
        <span className="ml-auto text-sm text-[color:var(--text-muted)]">{gyms.length} gyms</span>
      </div>

      <div className="space-y-3">
        {isLoading && gyms.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[color:var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading gyms...
          </div>
        )}

        {!isLoading && gyms.length === 0 && !showForm && (
          <div className="rounded-lg border border-dashed border-[color:var(--border)] p-6 text-center">
            <Bike className="mx-auto mb-2 h-8 w-8 text-[color:var(--text-muted)]" />
            <p className="text-sm text-[color:var(--text-muted)]">No gyms registered yet.</p>
          </div>
        )}

        {gyms.map((gym) => (
          <GymRow key={gym.id} gym={gym} />
        ))}

        {showForm && (
          <CreateGymForm onCreated={() => { void refetch(); setShowForm(false); }} />
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--text-muted)] transition hover:border-blue-500 hover:text-blue-300"
          >
            <Plus className="h-4 w-4" />
            Register a new gym
          </button>
        )}
      </div>
    </div>
  );
}
