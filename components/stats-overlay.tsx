"use client"

import { useAppStore } from "@/lib/store"

const algorithmLabels: Record<string, string> = {
  dijkstra: "DIJKSTRA",
  astar: "A* STAR",
  bidirectional: "BIDIRECTIONAL DIJKSTRA",
  sstar: "S* BOUNDED",
}

export function StatsOverlay() {
  const algorithm = useAppStore((state) => state.algorithm)
  const stats = useAppStore((state) => state.stats)

  return (
    <div className="absolute top-16 md:top-4 left-1/2 -translate-x-1/2 z-1000 w-[calc(100vw-2rem)] md:w-auto max-w-full px-4 md:px-0">
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl px-3 md:px-6 py-2 md:py-3 flex items-center gap-3 md:gap-8 shadow-2xl shadow-black/50">
        {/* Algorithm Name */}
        <div className="flex-1 md:flex-initial min-w-0">
          <div className="text-[10px] md:text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Algorithm</div>
          <div className="text-xs md:text-sm font-bold text-white tracking-wide truncate">{algorithmLabels[algorithm]}</div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 md:h-10 bg-zinc-700" />

        {/* Nodes Explored */}
        <div className="text-center flex-1 md:flex-initial">
          <div className="text-[10px] md:text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">EXP</div>
          <div className="text-base md:text-xl font-bold text-blue-400 tabular-nums">{stats.nodesExplored.toLocaleString()}</div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 md:h-10 bg-zinc-700" />

        {/* Path Length */}
        <div className="text-center flex-1 md:flex-initial">
          <div className="text-[10px] md:text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">DIST</div>
          <div className="text-base md:text-xl font-bold text-emerald-400 tabular-nums">
            {stats.pathLength > 0 ? `${(stats.pathLength / 1000).toFixed(1)} km` : "—"}
          </div>
        </div>
      </div>
    </div>
  )
}
