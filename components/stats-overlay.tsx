"use client"

import { Fragment } from "react"
import { useAppStore, ALGORITHMS } from "@/lib/store"

export function StatsOverlay() {
  const algorithm = useAppStore((state) => state.algorithm)
  const { nodesExplored, pathLength, computeMs } = useAppStore((state) => state.stats)

  const cells = [
    { label: "Algorithm", value: ALGORITHMS.find((a) => a.id === algorithm)?.name, className: "text-zinc-100" },
    { label: "Explored", value: nodesExplored.toLocaleString(), className: "text-blue-300" },
    { label: "Distance", value: pathLength > 0 ? `${(pathLength / 1000).toFixed(2)} km` : "—", className: "text-emerald-300" },
    // Wall-clock time of the search itself, independent of the animation speed
    { label: "Compute", value: computeMs === null ? "—" : `${computeMs.toFixed(1)} ms`, className: "text-zinc-100" },
  ]

  return (
    <div className="absolute top-[calc(max(1rem,env(safe-area-inset-top))+3.25rem)] md:top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[999]">
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-xl px-3 md:px-5 py-2 flex items-center gap-3 md:gap-5 shadow-lg shadow-black/40">
        {cells.map((cell, i) => (
          <Fragment key={cell.label}>
            {i > 0 && <div className="w-px h-8 bg-zinc-800" />}
            <div className="flex-1 md:flex-initial min-w-0">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{cell.label}</div>
              <div className={`text-sm font-semibold tabular-nums truncate ${cell.className}`}>{cell.value}</div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
