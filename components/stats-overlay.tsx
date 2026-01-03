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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000">
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl px-6 py-3 flex items-center gap-8 shadow-2xl shadow-black/50">
        {/* Algorithm Name */}
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Algorithm</div>
          <div className="text-sm font-bold text-white tracking-wide">{algorithmLabels[algorithm]}</div>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-zinc-700" />

        {/* Nodes Explored */}
        <div className="text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">EXP</div>
          <div className="text-xl font-bold text-blue-400 tabular-nums">{stats.nodesExplored.toLocaleString()}</div>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-zinc-700" />

        {/* Path Length */}
        <div className="text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">DIST</div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums">
            {stats.pathLength > 0 ? `${(stats.pathLength / 1000).toFixed(1)} km` : "—"}
          </div>
        </div>
      </div>
    </div>
  )
}
