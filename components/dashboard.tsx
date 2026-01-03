"use client"

import { useRef } from "react"
import { useAppStore, type Algorithm } from "@/lib/store"
import { MapPin, Zap, Play, ChevronDown, ChevronUp, RotateCcw, Square } from "lucide-react"
import { runPathfinding } from "@/lib/pathfinding"

const algorithms: { id: Algorithm; name: string; desc: string }[] = [
  { id: "dijkstra", name: "DIJKSTRA", desc: "Standard weighted" },
  { id: "astar", name: "A* STAR", desc: "Heuristic optimized" },
  { id: "bidirectional", name: "BI-DIRECTIONAL", desc: "Dual frontier" },
  { id: "sstar", name: "S* BOUNDED", desc: "Memory constrained" },
]

export function Dashboard() {
  const algorithm = useAppStore((state) => state.algorithm)
  const setAlgorithm = useAppStore((state) => state.setAlgorithm)
  const pickingMode = useAppStore((state) => state.pickingMode)
  const setPickingMode = useAppStore((state) => state.setPickingMode)
  const animationSpeed = useAppStore((state) => state.animationSpeed)
  const setAnimationSpeed = useAppStore((state) => state.setAnimationSpeed)
  const isLoading = useAppStore((state) => state.isLoading)
  const setIsLoading = useAppStore((state) => state.setIsLoading)
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
    console.log("[v0] Pick Start clicked, new mode:", newMode)
    setPickingMode(newMode)
  }

  const handlePickEnd = () => {
    const newMode = pickingMode === "end" ? null : "end"
    console.log("[v0] Pick End clicked, new mode:", newMode)
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

    console.log("[v0] Starting animation...")
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
          // console.log("[v0] Animation update", state.exploredEdges.length)
          setAnimationState(state)
        },
        (stats) => setStats(stats),
        abortController.signal
      )
      console.log("[v0] Animation finished")
    } catch (e) {
      console.log("[v0] Animation aborted or failed", e)
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
      // setIsDashboardVisible(true) // Keep dashboard hidden after animation
    }
  }

  return (
    <>
      {isLoading && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2000]">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-blue-500/30 rounded-xl p-4 flex items-center gap-3 shadow-2xl shadow-black/50 animate-in fade-in zoom-in duration-300">
            <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-sm text-blue-300 font-medium">Loading map data wait before selecting points...</span>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsDashboardVisible(!isDashboardVisible)}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full p-3 shadow-2xl shadow-black/50 hover:border-cyan-500/50 transition-all"
        aria-label={isDashboardVisible ? "Hide dashboard" : "Show dashboard"}
      >
        {isDashboardVisible ? (
          <ChevronDown className="w-5 h-5 text-cyan-400" />
        ) : (
          <ChevronUp className="w-5 h-5 text-cyan-400" />
        )}
      </button>

      {isDashboardVisible && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 min-w-95 shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-500/20">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-bold tracking-wider text-cyan-400">GEOSPATIAL ALGORITHM LAB</span>
              </div>
              <button
                onClick={handleReset}
                disabled={isRunning}
                className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>



            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-red-400 mb-1">ERROR</div>
                    <div className="text-xs text-red-300/90 leading-relaxed">{error}</div>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400/60 hover:text-red-400 transition-colors"
                    aria-label="Close error"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Algorithm Selection */}
            <div className="mb-4">
              <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Algorithm</label>
              <div className="grid grid-cols-2 gap-2">
                {algorithms.map((algo) => (
                  <button
                    key={algo.id}
                    onClick={() => setAlgorithm(algo.id)}
                    disabled={isRunning}
                    className={`p-2 rounded-lg text-left transition-all disabled:opacity-50 ${
                      algorithm === algo.id
                        ? "bg-blue-500/20 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        : "bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className={`text-xs font-bold ${algorithm === algo.id ? "text-blue-400" : "text-zinc-400"}`}>
                      {algo.name}
                    </div>
                    <div className="text-[10px] text-zinc-600">{algo.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Point Selection */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handlePickStart}
                disabled={!graph || isRunning || isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  pickingMode === "start"
                    ? "bg-green-500/20 border border-green-500/50 text-green-400 animate-pulse"
                    : startNode
                      ? "bg-green-500/10 border border-green-500/30 text-green-400/70"
                      : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <MapPin className="w-4 h-4" />
                {pickingMode === "start" ? "Click Map" : startNode ? "Start Set" : "Pick Start"}
              </button>
              <button
                onClick={handlePickEnd}
                disabled={!graph || isRunning || isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  pickingMode === "end"
                    ? "bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse"
                    : endNode
                      ? "bg-red-500/10 border border-red-500/30 text-red-400/70"
                      : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <MapPin className="w-4 h-4" />
                {pickingMode === "end" ? "Click Map" : endNode ? "End Set" : "Pick End"}
              </button>
            </div>

            {isRunning ? (
              <button
                onClick={handleCancelAnimation}
                className="w-full mb-4 py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-all shadow-lg shadow-red-500/25 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                Cancel Animation
              </button>
            ) : (
              <button
                onClick={handleStartAnimation}
                disabled={!graph || !startNode || !endNode}
                className="w-full mb-4 py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-linear-to-r from-cyan-600 to-green-600 hover:from-cyan-500 hover:to-green-500 transition-all shadow-lg shadow-cyan-500/25 text-white cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Start Animation
              </button>
            )}

            {/* Speed Slider */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Animation Speed</label>
                <span className="text-xs text-cyan-400 font-mono">{animationSpeed}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="400"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                disabled={isRunning}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-cyan-400
              [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,213,0.5)]
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:disabled:cursor-not-allowed"
              />
            </div>

            {/* Map data is auto-fetched on load */}

            {/* Graph Status */}
            {graph && (
              <div className="mt-3 pt-3 border-t border-zinc-800 text-center">
                <span className="text-xs text-zinc-500">
                  Graph loaded: <span className="text-cyan-400 font-mono">{graph.nodes.size.toLocaleString()}</span>{" "}
                  nodes
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
