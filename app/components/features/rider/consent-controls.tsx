"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useAccount } from "wagmi";
import { useConsent, type ConsentScope } from "@/app/lib/privacy/consent";
import { isPersonalDataPublicationAllowed } from "@/app/lib/privacy/publication-policy";
import { useWalletAuth } from "@/app/hooks/common/use-wallet-auth";

const SCOPES: Array<{ scope: ConsentScope; title: string; detail: string }> = [
  {
    scope: "cloud_history",
    title: "Cloud ride history",
    detail: "Back up ride summaries (HR, power, zones) to your SpinChain account so they follow you across devices.",
  },
  {
    scope: "ai_voice",
    title: "AI coaching & voice",
    detail: "Send ride stats and coach lines to our AI and voice providers. Off: on-device cues and your browser's voice.",
  },
  {
    scope: "instructor_live",
    title: "Instructor live view",
    detail: "Share live HR, power and cadence with the class instructor while you ride.",
  },
  {
    scope: "public_export",
    title: "Public export",
    detail: "Publish ride data publicly (e.g. Walrus). Not available yet.",
  },
];

function ConsentRow({ scope, title, detail }: (typeof SCOPES)[number]) {
  const [granted, setGranted] = useConsent(scope);
  const [saving, setSaving] = useState(false);
  const unavailable = scope === "public_export" && !isPersonalDataPublicationAllowed();

  const toggle = async () => {
    setSaving(true);
    try {
      await setGranted(!granted);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-[11px] text-white/40">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={granted}
        aria-label={title}
        disabled={saving || unavailable}
        onClick={toggle}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:opacity-40 ${
          granted ? "border-emerald-400/60 bg-emerald-500/60" : "border-white/20 bg-white/10"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
            granted ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function DeleteCloudRides() {
  const [state, setState] = useState<"idle" | "deleting" | "done" | "failed">("idle");
  const remove = async () => {
    setState("deleting");
    try {
      const res = await fetch("/api/rides?all=true", { method: "DELETE", credentials: "include" });
      setState(res.ok ? "done" : "failed");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={remove}
        disabled={state === "deleting" || state === "done"}
        className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 transition-[transform,background-color] duration-150 active:scale-95 hover:bg-red-500/20 disabled:opacity-50"
      >
        {state === "deleting" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete my cloud rides
      </button>
      {state === "done" && <span className="text-[11px] text-emerald-400">Cloud copies deleted. Rides on this device are kept.</span>}
      {state === "failed" && <span className="text-[11px] text-red-300">Couldn&apos;t delete. Try again.</span>}
    </div>
  );
}

/** Four independent consents, all off by default. */
export function ConsentControls() {
  const { address } = useAccount();
  const { session } = useWalletAuth();
  const [cloudGranted] = useConsent("cloud_history");
  const signedIn = !!address && session?.address === address.toLowerCase();

  return (
    <div className="mb-6 rounded-3xl border border-white/5 bg-black/40 p-5">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Privacy choices</span>
      <div className="divide-y divide-white/5">
        {SCOPES.map((s) => (
          <ConsentRow key={s.scope} {...s} />
        ))}
      </div>
      {signedIn && !cloudGranted && <DeleteCloudRides />}
    </div>
  );
}
