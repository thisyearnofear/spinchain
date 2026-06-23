"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Download, Trash2, Cloud, HardDrive, Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getRideHistory } from "@/app/lib/analytics/ride-history";
import { useRiderProfile } from "@/app/stores/rider-profile-store";
import { useProfileSync, persistProfileToWalrus, getProfileBlobId } from "@/app/lib/walrus/profile-persistence";
import { useAccount } from "wagmi";

export function DataOwnershipDashboard() {
  const { address } = useAccount();
  const profile = useRiderProfile();
  const profileSync = useProfileSync();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rides = useMemo(() => getRideHistory(), []);
  const profileBlobId = useMemo(() => getProfileBlobId(), []);

  const localStorageKeys = useMemo(() => {
    if (typeof window === "undefined") return [];
    const keys = [
      "spinchain:rides:history:v2",
      "spinchain-rider-profile",
      "spinchain-ride-store",
      "spinchain-rider-quiz-completed",
      "spinchain:walrus:ride-blobs:v1",
      "spinchain:walrus:profile-blob:v1",
      "spinchain-profile-sync",
      "spinchain:rides:sync-queue:v1",
    ];
    return keys.filter((k) => localStorage.getItem(k) !== null).map((k) => ({
      key: k,
      size: new Blob([localStorage.getItem(k) ?? ""]).size,
    }));
  }, []);

  const totalLocalStorageBytes = localStorageKeys.reduce((s, k) => s + k.size, 0);

  const walrusRidesCount = useMemo(() => {
    if (typeof window === "undefined") return 0;
    try {
      const index = JSON.parse(localStorage.getItem("spinchain:walrus:ride-blobs:v1") ?? "{}");
      return Object.keys(index).length;
    } catch {
      return 0;
    }
  }, []);

  const handleExport = useCallback(() => {
    setExporting(true);
    const data = {
      exportedAt: new Date().toISOString(),
      address: address ?? "guest",
      profile: {
        goal: profile.goal,
        experience: profile.experience,
        frequency: profile.frequency,
        motivation: profile.motivation,
        coachPersonality: profile.coachPersonality,
        displayName: profile.displayName,
        createdAt: profile.createdAt,
      },
      rides,
      walrusProfileBlobId: profileBlobId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `spinchain-data-export-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(false), 500);
  }, [address, profile, rides, profileBlobId]);

  const handleDeleteAll = useCallback(() => {
    setDeleting(true);
    const keys = [
      "spinchain:rides:history:v2",
      "spinchain:rides:history:v1",
      "spinchain-rider-profile",
      "spinchain-ride-store",
      "spinchain-rider-quiz-completed",
      "spinchain:walrus:ride-blobs:v1",
      "spinchain:walrus:profile-blob:v1",
      "spinchain-profile-sync",
      "spinchain:rides:sync-queue:v1",
    ];
    keys.forEach((k) => localStorage.removeItem(k));
    setTimeout(() => {
      setDeleting(false);
      setConfirmDelete(false);
      window.location.href = "/?reset=true";
    }, 500);
  }, []);

  const handleSyncProfile = useCallback(async () => {
    if (!address || !profile.isComplete()) return;
    setSyncingProfile(true);
    profileSync.setSyncing();
    const blobId = await persistProfileToWalrus(
      {
        goal: profile.goal,
        experience: profile.experience,
        frequency: profile.frequency,
        motivation: profile.motivation,
        coachPersonality: profile.coachPersonality,
        displayName: profile.displayName,
        createdAt: profile.createdAt,
      },
      address
    );
    if (blobId) {
      profileSync.setSynced(blobId);
    } else {
      profileSync.setFailed();
    }
    setSyncingProfile(false);
  }, [address, profile, profileSync]);

  return (
    <div className="rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Database className="w-32 h-32 text-emerald-500 rotate-12" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xl font-black text-white tracking-tight">
              Your Data
            </h3>
            <p className="text-xs text-emerald-500/60 font-bold uppercase tracking-widest">
              Ownership & Control
            </p>
          </div>
        </div>

        {/* Storage breakdown */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Local storage */}
          <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-4 h-4 text-white/40" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                Local Storage
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black text-white tracking-tighter">
                {(totalLocalStorageBytes / 1024).toFixed(1)}
              </span>
              <span className="text-xs text-white/40">KB</span>
            </div>
            <div className="space-y-1">
              {localStorageKeys.map((entry) => (
                <div key={entry.key} className="flex items-center justify-between text-[10px] text-white/30">
                  <span className="font-mono truncate max-w-[180px]">{entry.key}</span>
                  <span className="text-white/20">{(entry.size / 1024).toFixed(1)}KB</span>
                </div>
              ))}
              {localStorageKeys.length === 0 && (
                <p className="text-[10px] text-white/20">No local data</p>
              )}
            </div>
          </div>

          {/* Walrus storage */}
          <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="w-4 h-4 text-emerald-400/60" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                Walrus Decentralized
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Rides anchored</span>
                <span className="text-sm font-bold text-emerald-400">{walrusRidesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Profile synced</span>
                {profileSync.syncStatus === "synced" && profileSync.walrusBlobId ? (
                  <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Yes
                  </span>
                ) : profileSync.syncStatus === "syncing" ? (
                  <span className="flex items-center gap-1 text-sm font-bold text-amber-400">
                    <Loader2 className="w-3 h-3 animate-spin" /> Syncing
                  </span>
                ) : (
                  <span className="text-sm font-bold text-white/30">No</span>
                )}
              </div>
              {profileSync.lastSyncedAt && (
                <p className="text-[10px] text-white/20">
                  Last synced: {new Date(profileSync.lastSyncedAt).toLocaleDateString()}
                </p>
              )}
              {profileBlobId && (
                <p className="text-[8px] font-mono text-white/20 truncate">
                  Blob: {profileBlobId}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Sync profile to Walrus */}
          {address && profile.isComplete() && profileSync.syncStatus !== "synced" && (
            <button
              onClick={handleSyncProfile}
              disabled={syncingProfile}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition-[transform,background-color] duration-150 active:scale-95 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {syncingProfile ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              Sync Profile to Walrus
            </button>
          )}

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting || rides.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition-[transform,background-color] duration-150 active:scale-95 hover:bg-white/10 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export My Data
          </button>

          {/* Delete */}
          <AnimatePresence mode="wait">
            {!confirmDelete ? (
              <motion.button
                key="delete"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-300 transition-[transform,background-color] duration-150 active:scale-95 hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All Data
              </motion.button>
            ) : (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <span className="text-xs text-red-300 font-medium">Are you sure?</span>
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-500/80 px-3 py-2 text-xs font-bold text-white transition-[transform,opacity] duration-150 active:scale-95 hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Yes, Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info note */}
        <div className="mt-4 flex items-start gap-2 text-[10px] text-white/30">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <p>
            Local data is stored in your browser. Walrus data is decentralized and persists across devices.
            Exporting gives you a JSON backup of everything. Deleting clears local data only — Walrus blobs remain on-chain until they expire.
          </p>
        </div>
      </div>
    </div>
  );
}
