"use client";

import { useState, useMemo } from "react";

export function HookVisualizer() {
  const [ticketsSold, setTicketsSold] = useState(45); // %
  const [hoursRemaining, setHoursRemaining] = useState(2); // hours

  // The "Smart Contract" Logic recreated in JS
  const hookState = useMemo(() => {
    // 1. Scarcity Check
    if (ticketsSold >= 90) {
      return {
        fee: "5.00%",
        status: "SURGE_MODE",
        color: "text-red-400",
        borderColor: "border-red-500/50",
        bg: "bg-red-500/10",
        explanation: "Scarcity detected (>90%). Raising fees to capture premium demand."
      };
    }

    // 2. Urgency Check (Fire Sale)
    if (hoursRemaining <= 1 && ticketsSold < 50) {
      return {
        fee: "0.01%",
        status: "FIRE_SALE",
        color: "text-green-400",
        borderColor: "border-green-500/50",
        bg: "bg-green-500/10",
        explanation: "Low fill rate (<50%) and starting soon. Dropping fees to attract liquidity."
      };
    }

    // 3. Standard Market
    return {
      fee: "0.30%",
      status: "STANDARD",
      color: "text-blue-300",
      borderColor: "border-blue-500/30",
      bg: "bg-blue-500/10",
      explanation: "Market conditions normal. Standard Uniswap pool fee applied."
    };
  }, [ticketsSold, hoursRemaining]);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Uniswap v4 Hook Simulator</h3>
          <p className="text-xs text-white/50">Contract: <span className="font-mono">DemandSurgeHook.sol</span></p>
        </div>
        <div className="rounded-full bg-pink-500/20 px-3 py-1 text-xs font-medium text-pink-300 border border-pink-500/30">
          Live Logic
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <label className="text-white/80">Tickets Sold (Inventory)</label>
              <span className="font-mono text-white">{ticketsSold}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ticketsSold}
              onChange={(e) => setTicketsSold(parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-wider">
              <span>Empty</span>
              <span>Sold Out</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <label className="text-white/80">Time Until Class</label>
              <span className="font-mono text-white">{hoursRemaining}h</span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={hoursRemaining}
              onChange={(e) => setHoursRemaining(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-wider">
              <span>Starting Now</span>
              <span>24h Ahead</span>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className={`relative flex flex-col justify-between rounded-xl border ${hookState.borderColor} ${hookState.bg} p-5 transition-all duration-300`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">Current Hook State</p>
            <h4 className={`mt-2 text-4xl font-black ${hookState.color} transition-all`}>
              {hookState.fee} <span className="text-lg font-medium text-white/60">Fee</span>
            </h4>
            <div className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${hookState.color} bg-black/20`}>
              {hookState.status}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">Agent Logic</p>
            <p className="font-mono text-xs leading-relaxed text-white/80">
              {">"} {hookState.explanation}
            </p>
          </div>

          {/* Uniswap Logo Overlay */}
          <div className="absolute right-4 top-4 opacity-10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M19.0061 3.70523C16.9482 1.64455 13.9118 0.77152 10.966 1.34159C10.7497 1.38356 10.597 1.57213 10.597 1.79259V6.26257C10.597 6.64333 10.1581 6.85329 9.86657 6.61189L5.59725 3.07684C5.43445 2.94212 5.19503 2.96916 5.06648 3.13621C2.88726 5.9686 2.37397 9.84911 3.70773 13.2373C5.04018 16.6231 8.04968 19.0684 11.609 19.6453C15.1706 20.2227 18.7997 18.8459 21.134 16.0963C21.2721 15.9338 21.2365 15.6905 21.0553 15.5709L17.2023 13.0271C16.8906 12.8213 16.4674 13.0442 16.4674 13.4173V17.892C16.4674 18.1132 16.3134 18.3023 16.0959 18.3427C14.7302 18.5962 13.3138 18.5305 11.9796 18.1502C10.3756 17.693 8.98632 16.6974 8.02554 15.3175C7.06476 13.9376 6.58552 12.2505 6.66172 10.518C6.73792 8.78546 7.36537 7.10264 8.44754 5.72895L13.7937 10.1554C14.1039 10.4121 14.5681 10.1913 14.5681 9.78711V5.33301C14.5681 5.11333 14.7196 4.9255 14.9351 4.88277C16.3453 4.60333 17.7994 4.70879 19.1601 5.20323C19.366 5.27807 19.5768 5.10688 19.5392 4.89139C19.4294 4.47169 19.2486 4.07297 19.0061 3.70523Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
