import { create } from "zustand"
import type { Graph } from "./osm-fetcher"

export type Algorithm = "dijkstra" | "astar" | "bidirectional" | "sstar"

interface AnimationState {
  visited: Set<string>
  frontier: Set<string>
  path: string[]
  exploredEdges: Array<[string, string]>
}

interface Stats {
  nodesInGraph: number
  nodesExplored: number
  pathLength: number
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

  animationState: AnimationState
  setAnimationState: (state: AnimationState) => void

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

  animationState: { visited: new Set(), frontier: new Set(), path: [], exploredEdges: [] },
  setAnimationState: (state) => set({ animationState: state }),

  stats: { nodesInGraph: 0, nodesExplored: 0, pathLength: 0 },
  setStats: (stats) => set((state) => ({ stats: { ...state.stats, ...stats } })),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),

  error: null,
  setError: (error) => set({ error }),

  isDashboardVisible: false,
  setIsDashboardVisible: (visible) => set({ isDashboardVisible: visible }),
}))
