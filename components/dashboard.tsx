"use client"

import { useEffect, useRef } from "react"
import { useAppStore, type Algorithm } from "@/lib/store"
import { MapPin, Zap, Play, ChevronDown, ChevronUp, RotateCcw, Square, X } from "lucide-react"
import { runPathfinding } from "@/lib/pathfinding"

const algorithms: { id: Algorithm; name: string; short: string; desc: string }[] = [
  { id: "dijkstra", name: "DIJKSTRA", short: "Dijkstra", desc: "Standard weighted" },
  { id: "astar", name: "A* STAR", short: "A*", desc: "Heuristic optimized" },
  { id: "bidirectional", name: "BI-DIRECTIONAL", short: "Bi-dir", desc: "Dual frontier" },
  { id: "sstar", name: "S* BOUNDED", short: "S*", desc: "Memory constrained" },
]

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
  const setAnimationState = useAppStore((state) => state.setAnimationState)
  const setStats = useAppStore((state) => state.setStats)
  const isDashboardVisible = useAppStore((state) => state.isDashboardVisible)
  const setIsDashboardVisible = useAppStore((state) => state.setIsDashboardVisible)
  
  const abortControllerRef = useRef<AbortController | null>(null)
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
          ? "Searching…"
          : "Ready — run the algorithm"

  const handleReset = () => {
    setStartNode(null)
    setEndNode(null)
    setAnimationState({ visited: new Set(), frontier: new Set(), path: [], exploredEdges: [] })
    setStats({ nodesExplored: 0, pathLength: 0 })
    setError(null)
    setPickingMode(null)
  }

  const handlePickStart = () => {
    const newMode = pickingMode === "start" ? null : "start"
    console.log("Pick Start clicked, new mode:", newMode)
    setPickingMode(newMode)
  }

  const handlePickEnd = () => {
    const newMode = pickingMode === "end" ? null : "end"
    console.log("Pick End clicked, new mode:", newMode)
    setPickingMode(newMode)
  }

  const handleCancelAnimation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsRunning(false)
    setIsDashboardVisible(true)
  }

  const handleStartAnimation = async () => {
    if (!graph || !startNode || !endNode || isRunning) return

    console.log("Starting animation...")
    setIsRunning(true)
    setIsDashboardVisible(false)
    setAnimationState({ visited: new Set(), frontier: new Set(), path: [], exploredEdges: [] })

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      await runPathfinding(
        graph,
        startNode,
        endNode,
        algorithm,
        () => useAppStore.getState().animationSpeed,
        (state) => {
          // console.log("Animation update", state.exploredEdges.length)
          setAnimationState(state)
        },
        (stats) => setStats(stats),
        abortController.signal
      )
      console.log("Animation finished")
    } catch (e) {
      console.log("Animation aborted or failed", e)
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
      // setIsDashboardVisible(true) // Keep dashboard hidden after animation
    }
  }

  const runButton = isRunning ? (
    <button
      onClick={handleCancelAnimation}
      className="w-full min-h-12 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors touch-manipulation"
    >
      <Square className="w-4 h-4 fill-current" />
      Cancel
    </button>
  ) : (
    <button
      onClick={handleStartAnimation}
      disabled={!graph || !startNode || !endNode}
      className="w-full min-h-12 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-cyan-600 to-green-600 hover:from-cyan-500 hover:to-green-500 transition-colors shadow-lg shadow-cyan-500/20 text-white touch-manipulation active:scale-[0.98]"
    >
      <Play className="w-4 h-4" />
      Run {algorithms.find((a) => a.id === algorithm)?.short}
    </button>
  )

  return (
    <>
      {isLoading && (
        <div className="fixed top-36 md:top-1/2 left-1/2 -translate-x-1/2 md:-translate-y-1/2 z-[2000] pointer-events-none">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-blue-500/30 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl shadow-black/50 animate-in fade-in zoom-in duration-300">
            <div className="w-4 h-4 aspect-square border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-xs md:text-sm text-blue-300 font-medium whitespace-nowrap">Loading road network…</span>
          </div>
        </div>
      )}

      <div
        ref={sheetRef}
        className="fixed z-[1000] inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-6 md:w-[400px]"
      >
        <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 md:border md:rounded-2xl rounded-t-3xl shadow-2xl shadow-black/60 px-4 md:p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                <Zap className="w-4 h-4 shrink-0 text-cyan-400" />
                <span className="text-xs font-bold tracking-wider text-cyan-400 truncate">GEOSPATIAL ALGORITHM LAB</span>
                <span className="ml-auto text-zinc-500">
                  {isDashboardVisible ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-400 truncate" aria-live="polite">{hint}</div>
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="shrink-0 w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-40 touch-manipulation"
              aria-label="Reset"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
              <div className="flex-1 text-xs text-red-300/90 leading-relaxed">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-red-400/60 hover:text-red-400 transition-colors"
                aria-label="Close error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isDashboardVisible && (
            <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Algorithm Selection */}
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Algorithm</label>
                <div className="grid grid-cols-4 md:grid-cols-2 gap-1.5 md:gap-2">
                  {algorithms.map((algo) => (
                    <button
                      key={algo.id}
                      onClick={() => setAlgorithm(algo.id)}
                      disabled={isRunning}
                      aria-pressed={algorithm === algo.id}
                      className={`min-h-11 px-2 py-2 rounded-xl text-center md:text-left transition-colors disabled:opacity-50 touch-manipulation ${
                        algorithm === algo.id
                          ? "bg-blue-500/20 border border-blue-500/50 text-blue-300"
                          : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="text-xs font-bold md:hidden">{algo.short}</div>
                      <div className="hidden md:block text-xs font-bold">{algo.name}</div>
                      <div className="hidden md:block text-[10px] text-zinc-600">{algo.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Point Selection */}
              <div className="flex gap-2">
                <button
                  onClick={handlePickStart}
                  disabled={!graph || isRunning || isLoading}
                  className={`flex-1 min-h-11 flex items-center justify-center gap-1.5 rounded-xl font-medium text-xs md:text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${
                    pickingMode === "start"
                      ? "bg-green-500/20 border border-green-500/50 text-green-400 animate-pulse"
                      : startNode
                        ? "bg-green-500/10 border border-green-500/30 text-green-400/80"
                        : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  {pickingMode === "start" ? "Tap map" : startNode ? "Move start" : "Pick start"}
                </button>
                <button
                  onClick={handlePickEnd}
                  disabled={!graph || isRunning || isLoading}
                  className={`flex-1 min-h-11 flex items-center justify-center gap-1.5 rounded-xl font-medium text-xs md:text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${
                    pickingMode === "end"
                      ? "bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse"
                      : endNode
                        ? "bg-red-500/10 border border-red-500/30 text-red-400/80"
                        : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  {pickingMode === "end" ? "Tap map" : endNode ? "Move end" : "Pick end"}
                </button>
              </div>

              {/* Speed Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="speed" className="text-[10px] text-zinc-500 uppercase tracking-wider">Speed</label>
                  <span className="text-xs text-cyan-400 font-mono">{animationSpeed}%</span>
                </div>
                <input
                  id="speed"
                  type="range"
                  min="1"
                  max="400"
                  value={animationSpeed}
                  onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-8 bg-transparent appearance-none cursor-pointer disabled:opacity-50 touch-manipulation
                [&::-webkit-slider-runnable-track]:h-1.5
                [&::-webkit-slider-runnable-track]:rounded-full
                [&::-webkit-slider-runnable-track]:bg-zinc-800
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:-mt-[7px]
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,213,0.5)]"
                />
              </div>
            </div>
          )}

          <div className="mt-3">{runButton}</div>

          {graph && isDashboardVisible && (
            <div className="mt-2 text-center text-[11px] text-zinc-500">
              <span className="text-cyan-400 font-mono">{graph.nodes.size.toLocaleString()}</span> road nodes loaded
            </div>
          )}
        </div>
      </div>
    </>
  )
}
