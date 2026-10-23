"use client"

import { useEffect, useRef } from "react"
import { useAppStore, ALGORITHMS } from "@/lib/store"
import { ChevronDown, ChevronUp, Play, RotateCcw, Square, X } from "lucide-react"
import { findPath } from "@/lib/pathfinding"

export function Dashboard() {
  const algorithm = useAppStore((state) => state.algorithm)
  const setAlgorithm = useAppStore((state) => state.setAlgorithm)
  const pickingMode = useAppStore((state) => state.pickingMode)
  const setPickingMode = useAppStore((state) => state.setPickingMode)
  const animationSpeed = useAppStore((state) => state.animationSpeed)
  const setAnimationSpeed = useAppStore((state) => state.setAnimationSpeed)
  const isLoading = useAppStore((state) => state.isLoading)
  const graph = useAppStore((state) => state.graph)
  const startNode = useAppStore((state) => state.startNode)
  const setStartNode = useAppStore((state) => state.setStartNode)
  const endNode = useAppStore((state) => state.endNode)
  const setEndNode = useAppStore((state) => state.setEndNode)
  const error = useAppStore((state) => state.error)
  const setError = useAppStore((state) => state.setError)
  const isRunning = useAppStore((state) => state.isRunning)
  const setIsRunning = useAppStore((state) => state.setIsRunning)
  const setSearch = useAppStore((state) => state.setSearch)
  const setStats = useAppStore((state) => state.setStats)
  const isDashboardVisible = useAppStore((state) => state.isDashboardVisible)
  const setIsDashboardVisible = useAppStore((state) => state.setIsDashboardVisible)

  const sheetRef = useRef<HTMLDivElement>(null)

  // Expose the sheet height so map attributions stay above it on mobile
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty("--sheet-h", `${sheet.offsetHeight}px`),
    )
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [])

  const hint = !graph
    ? "Loading road network…"
    : pickingMode === "start" || !startNode
      ? "Select the start on the map"
      : pickingMode === "end" || !endNode
        ? "Select the destination on the map"
        : isRunning
          ? "Animating the search…"
          : "Ready to run"

  const handleReset = () => {
    setIsRunning(false)
    setSearch(null)
    setStartNode(null)
    setEndNode(null)
    setStats({ nodesExplored: 0, pathLength: 0, computeMs: null })
    setError(null)
    setPickingMode(null)
  }

  const handleRun = () => {
    if (!graph || !startNode || !endNode) return
    const started = performance.now()
    const result = findPath(graph, startNode, endNode, algorithm)
    setStats({ nodesExplored: 0, pathLength: 0, computeMs: performance.now() - started })
    setSearch(result)
    setIsRunning(true)
    setIsDashboardVisible(false)
  }

  const pickButton = (mode: "start" | "end", label: string, dot: string, isSet: boolean) => (
    <button
      onClick={() => setPickingMode(pickingMode === mode ? null : mode)}
      disabled={!graph || isRunning || isLoading}
      className={`flex-1 min-h-11 flex items-center justify-center gap-2 rounded-xl border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${
        pickingMode === mode
          ? "border-zinc-500 bg-zinc-800 text-zinc-50"
          : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {pickingMode === mode ? "Click the map" : `${isSet ? "Move" : "Pick"} ${label}`}
    </button>
  )

  return (
    <>
      {isLoading && (
        <div className="fixed top-36 md:top-1/2 left-1/2 -translate-x-1/2 md:-translate-y-1/2 z-[2000] pointer-events-none">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg shadow-black/40">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
            <span className="text-xs md:text-sm text-zinc-300 whitespace-nowrap">Loading road network…</span>
          </div>
        </div>
      )}

      <div
        ref={sheetRef}
        className="fixed z-[1000] inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-6 md:w-[400px]"
      >
        <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 md:border md:rounded-2xl rounded-t-3xl shadow-2xl shadow-black/50 px-4 md:p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Header doubles as the collapse toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDashboardVisible(!isDashboardVisible)}
              className="flex-1 min-w-0 text-left pt-2 pb-3 md:py-0 touch-manipulation"
              aria-expanded={isDashboardVisible}
              aria-label={isDashboardVisible ? "Hide controls" : "Show controls"}
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-700 md:hidden" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-100 truncate">Geospatial Algorithm Lab</span>
                <span className="ml-auto text-zinc-500">
                  {isDashboardVisible ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-400 truncate" aria-live="polite">{hint}</div>
            </button>
            <button
              onClick={handleReset}
              className="shrink-0 w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors touch-manipulation"
              aria-label="Reset"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
              <div className="flex-1 text-xs text-red-300 leading-relaxed">{error}</div>
              <button onClick={() => setError(null)} className="text-red-300/70 hover:text-red-300" aria-label="Close error">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isDashboardVisible && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-950/60 border border-zinc-800">
                {ALGORITHMS.map((algo) => (
                  <button
                    key={algo.id}
                    onClick={() => setAlgorithm(algo.id)}
                    disabled={isRunning}
                    aria-pressed={algorithm === algo.id}
                    className={`min-h-9 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed touch-manipulation ${
                      algorithm === algo.id ? "bg-zinc-800 text-zinc-50 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {algo.short}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {pickButton("start", "start", "bg-emerald-400", !!startNode)}
                {pickButton("end", "end", "bg-red-400", !!endNode)}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <label htmlFor="speed" className="text-xs text-zinc-400 shrink-0">
              Speed
            </label>
            <input
              id="speed"
              type="range"
              min="1"
              max="400"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(Number(e.target.value))}
              className="flex-1 h-8 bg-transparent appearance-none cursor-pointer touch-manipulation
                [&::-webkit-slider-runnable-track]:h-1
                [&::-webkit-slider-runnable-track]:rounded-full
                [&::-webkit-slider-runnable-track]:bg-zinc-700
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:-mt-1.5
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-zinc-100"
            />
            <span className="w-11 text-right text-xs text-zinc-300 tabular-nums">{animationSpeed}%</span>
          </div>

          {isRunning ? (
            <button
              onClick={() => setIsRunning(false)}
              className="mt-2 w-full min-h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-colors touch-manipulation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!graph || !startNode || !endNode}
              className="mt-2 w-full min-h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run {ALGORITHMS.find((a) => a.id === algorithm)?.short}
            </button>
          )}

          {graph && isDashboardVisible && (
            <div className="mt-2 text-center text-[11px] text-zinc-500">
              {graph.nodes.size.toLocaleString()} road nodes loaded
            </div>
          )}
        </div>
      </div>
    </>
  )
}
