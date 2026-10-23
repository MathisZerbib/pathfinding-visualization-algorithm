import { create } from "zustand"
import type { Graph } from "./osm-fetcher"
import type { SearchResult } from "./pathfinding"

export type Algorithm = "dijkstra" | "astar" | "bidirectional" | "sstar"

export const ALGORITHMS: { id: Algorithm; name: string; short: string }[] = [
  { id: "dijkstra", name: "Dijkstra", short: "Dijkstra" },
  { id: "astar", name: "A*", short: "A*" },
  { id: "bidirectional", name: "Bidirectional", short: "Bi-dir" },
  { id: "sstar", name: "S* bounded", short: "S*" },
]

interface Stats {
  nodesExplored: number
  pathLength: number
  computeMs: number | null
}

interface AppState {
  graph: Graph | null
  setGraph: (graph: Graph | null) => void

  startNode: string | null
  setStartNode: (node: string | null) => void

  endNode: string | null
  setEndNode: (node: string | null) => void

  pickingMode: "start" | "end" | null
  setPickingMode: (mode: "start" | "end" | null) => void

  algorithm: Algorithm
  setAlgorithm: (algo: Algorithm) => void

  animationSpeed: number
  setAnimationSpeed: (speed: number) => void

  search: SearchResult | null
  setSearch: (search: SearchResult | null) => void

  stats: Stats
  setStats: (stats: Partial<Stats>) => void

  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  isRunning: boolean
  setIsRunning: (running: boolean) => void

  error: string | null
  setError: (error: string | null) => void

  isDashboardVisible: boolean
  setIsDashboardVisible: (visible: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  graph: null,
  setGraph: (graph) => set({ graph }),

  startNode: null,
  setStartNode: (node) => set({ startNode: node }),

  endNode: null,
  setEndNode: (node) => set({ endNode: node }),

  pickingMode: null,
  setPickingMode: (mode) => set({ pickingMode: mode }),

  algorithm: "dijkstra",
  setAlgorithm: (algo) => set({ algorithm: algo }),

  animationSpeed: 50,
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  search: null,
  setSearch: (search) => set({ search }),

  stats: { nodesExplored: 0, pathLength: 0, computeMs: null },
  setStats: (stats) => set((state) => ({ stats: { ...state.stats, ...stats } })),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),

  error: null,
  setError: (error) => set({ error }),

  isDashboardVisible: true,
  setIsDashboardVisible: (visible) => set({ isDashboardVisible: visible }),
}))
