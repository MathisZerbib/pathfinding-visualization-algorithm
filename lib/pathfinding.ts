import type { Graph } from "./osm-fetcher"
import type { Algorithm } from "./store"

interface AnimationState {
  visited: Set<string>
  frontier: Set<string>
  path: string[]
  exploredEdges: Array<[string, string]>
}

interface Stats {
  nodesInGraph?: number
  nodesExplored: number
  pathLength: number
}

class MinHeap<T> {
  private heap: { item: T; priority: number }[] = []

  push(item: T, priority: number) {
    this.heap.push({ item, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.bubbleDown(0)
    }
    return top.item
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      if (this.heap[parent].priority <= this.heap[i].priority) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private bubbleDown(i: number) {
    const n = this.heap.length
    while (true) {
      const left = 2 * i + 1
      const right = 2 * i + 2
      let smallest = i
      if (left < n && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left
      }
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right
      }
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}

function heuristic(graph: Graph, nodeId: string, goalId: string): number {
  const node = graph.nodes.get(nodeId)
  const goal = graph.nodes.get(goalId)
  if (!node || !goal) return 0

  // Haversine distance as heuristic
  const R = 6371000
  const dLat = ((goal.lat - node.lat) * Math.PI) / 180
  const dLng = ((goal.lng - node.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((node.lat * Math.PI) / 180) *
      Math.cos((goal.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function reconstructPath(cameFrom: Map<string, string>, current: string): string[] {
  const path = [current]
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!
    path.unshift(current)
  }
  return path
}

function calculatePathLength(graph: Graph, path: string[]): number {
  let length = 0
  for (let i = 0; i < path.length - 1; i++) {
    const edges = graph.adjacency.get(path[i]) || []
    const edge = edges.find((e) => e.to === path[i + 1])
    if (edge) length += edge.weight
  }
  return length
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Strategy implementations
async function dijkstra(
  graph: Graph,
  start: string,
  end: string,
  getSpeed: () => number,
  onUpdate: (state: AnimationState) => void,
  onStats: (stats: Stats) => void,
  signal?: AbortSignal,
): Promise<void> {
  console.log("Dijkstra started", { start, end, nodes: graph.nodes.size })
  const dist = new Map<string, number>()
  const cameFrom = new Map<string, string>()
  const visited = new Set<string>()
  const frontier = new MinHeap<string>()
  const exploredEdges: Array<[string, string]> = []

  dist.set(start, 0)
  frontier.push(start, 0)

  const frontierSet = new Set<string>([start])
  let explored = 0

  while (!frontier.isEmpty()) {
    if (signal?.aborted) {
      console.log("Dijkstra aborted")
      return
    }

    const current = frontier.pop()!
    frontierSet.delete(current)

    if (visited.has(current)) continue
    visited.add(current)
    explored++

    if (current === end) {
      console.log("Dijkstra found path")
      const path = reconstructPath(cameFrom, end)
      const pathLength = calculatePathLength(graph, path)
      onUpdate({ visited: new Set(visited), frontier: new Set(), path, exploredEdges: [...exploredEdges] })
      onStats({ nodesExplored: explored, pathLength })
      return
    }

    const edges = graph.adjacency.get(current) || []
    
    if (current === start) {
      console.log(`Start node ${start} has ${edges.length} edges`)
      if (edges.length === 0) {
        console.warn(`Start node ${start} is isolated!`)
      }
    }

    for (const edge of edges) {
      if (visited.has(edge.to)) continue

      const newDist = (dist.get(current) ?? Number.POSITIVE_INFINITY) + edge.weight
      const currentNeighborDist = dist.get(edge.to) ?? Number.POSITIVE_INFINITY
      
      if (current === start) {
         console.log(`Checking neighbor ${edge.to}, weight: ${edge.weight}, newDist: ${newDist}, currentDist: ${currentNeighborDist}`)
      }

      if (newDist < currentNeighborDist) {
        dist.set(edge.to, newDist)
        cameFrom.set(edge.to, current)
        frontier.push(edge.to, newDist)
        frontierSet.add(edge.to)

        exploredEdges.push([current, edge.to])
        if (current === start) console.log(`Added ${edge.to} to frontier`)
      }
    }

    const speed = getSpeed()
    const batchSize = speed > 100 ? Math.floor((speed - 100) / 2) + 1 : 1
    const delay = speed <= 100 ? Math.max(1, 100 - speed) : 1

    if (explored % batchSize === 0) {
      onUpdate({
        visited: new Set(visited),
        frontier: new Set(frontierSet),
        path: [],
        exploredEdges: [...exploredEdges],
      })
      onStats({ nodesExplored: explored, pathLength: 0 })
      await sleep(delay)
    }
  }
  
  console.log(`Dijkstra finished. Explored ${explored} nodes.`)
  onUpdate({
    visited: new Set(visited),
    frontier: new Set(frontierSet),
    path: [],
    exploredEdges: [...exploredEdges],
  })
  onStats({ nodesExplored: explored, pathLength: 0 })
}

async function astar(
  graph: Graph,
  start: string,
  end: string,
  getSpeed: () => number,
  onUpdate: (state: AnimationState) => void,
  onStats: (stats: Stats) => void,
  signal?: AbortSignal,
): Promise<void> {
  console.log("A* started", { start, end })
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()
  const cameFrom = new Map<string, string>()
  const visited = new Set<string>()
  const frontier = new MinHeap<string>()
  const exploredEdges: Array<[string, string]> = []

  gScore.set(start, 0)
  fScore.set(start, heuristic(graph, start, end))
  frontier.push(start, fScore.get(start)!)

  const frontierSet = new Set<string>([start])
  let explored = 0

  while (!frontier.isEmpty()) {
    if (signal?.aborted) return

    const current = frontier.pop()!
    frontierSet.delete(current)

    if (visited.has(current)) continue
    visited.add(current)
    explored++

    if (current === end) {
      const path = reconstructPath(cameFrom, end)
      const pathLength = calculatePathLength(graph, path)
      onUpdate({ visited: new Set(visited), frontier: new Set(), path, exploredEdges: [...exploredEdges] })
      onStats({ nodesExplored: explored, pathLength })
      return
    }

    const edges = graph.adjacency.get(current) || []
    for (const edge of edges) {
      if (visited.has(edge.to)) continue

      const tentativeG = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edge.weight
      if (tentativeG < (gScore.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(edge.to, current)
        gScore.set(edge.to, tentativeG)
        fScore.set(edge.to, tentativeG + heuristic(graph, edge.to, end))
        frontier.push(edge.to, fScore.get(edge.to)!)
        frontierSet.add(edge.to)

        exploredEdges.push([current, edge.to])
      }
    }

    const speed = getSpeed()
    const batchSize = speed > 100 ? Math.floor((speed - 100) / 2) + 1 : 1
    const delay = speed <= 100 ? Math.max(1, 100 - speed) : 1

    if (explored % batchSize === 0) {
      onUpdate({
        visited: new Set(visited),
        frontier: new Set(frontierSet),
        path: [],
        exploredEdges: [...exploredEdges],
      })
      onStats({ nodesExplored: explored, pathLength: 0 })
      await sleep(delay)
    }
  }
}

async function bidirectional(
  graph: Graph,
  start: string,
  end: string,
  getSpeed: () => number,
  onUpdate: (state: AnimationState) => void,
  onStats: (stats: Stats) => void,
  signal?: AbortSignal,
): Promise<void> {
  const distF = new Map<string, number>()
  const distB = new Map<string, number>()
  const cameFromF = new Map<string, string>()
  const cameFromB = new Map<string, string>()
  const visitedF = new Set<string>()
  const visitedB = new Set<string>()
  const frontierF = new MinHeap<string>()
  const frontierB = new MinHeap<string>()
  const exploredEdges: Array<[string, string]> = []

  distF.set(start, 0)
  distB.set(end, 0)
  frontierF.push(start, 0)
  frontierB.push(end, 0)

  const frontierSetF = new Set<string>([start])
  const frontierSetB = new Set<string>([end])
  let explored = 0
  let meetingNode: string | null = null
  let bestDist = Number.POSITIVE_INFINITY

  while (!frontierF.isEmpty() && !frontierB.isEmpty()) {
    if (signal?.aborted) return

    // Forward step
    const currentF = frontierF.pop()!
    frontierSetF.delete(currentF)

    if (!visitedF.has(currentF)) {
      visitedF.add(currentF)
      explored++

      if (visitedB.has(currentF)) {
        const totalDist = (distF.get(currentF) || 0) + (distB.get(currentF) || 0)
        if (totalDist < bestDist) {
          bestDist = totalDist
          meetingNode = currentF
        }
      }

      const edges = graph.adjacency.get(currentF) || []
      for (const edge of edges) {
        if (!visitedF.has(edge.to)) {
          const newDist = (distF.get(currentF) ?? Number.POSITIVE_INFINITY) + edge.weight
          if (newDist < (distF.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
            distF.set(edge.to, newDist)
            cameFromF.set(edge.to, currentF)
            frontierF.push(edge.to, newDist)
            frontierSetF.add(edge.to)

            exploredEdges.push([currentF, edge.to])
          }
        }
      }
    }

    // Backward step
    const currentB = frontierB.pop()!
    frontierSetB.delete(currentB)

    if (!visitedB.has(currentB)) {
      visitedB.add(currentB)
      explored++

      if (visitedF.has(currentB)) {
        const totalDist = (distF.get(currentB) || 0) + (distB.get(currentB) || 0)
        if (totalDist < bestDist) {
          bestDist = totalDist
          meetingNode = currentB
        }
      }

      const edges = graph.adjacency.get(currentB) || []
      for (const edge of edges) {
        if (!visitedB.has(edge.to)) {
          const newDist = (distB.get(currentB) ?? Number.POSITIVE_INFINITY) + edge.weight
          if (newDist < (distB.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
            distB.set(edge.to, newDist)
            cameFromB.set(edge.to, currentB)
            frontierB.push(edge.to, newDist)
            frontierSetB.add(edge.to)

            exploredEdges.push([currentB, edge.to])
          }
        }
      }
    }

    const speed = getSpeed()
    const batchSize = speed > 100 ? Math.floor((speed - 100) / 2) + 1 : 1
    const delay = speed <= 100 ? Math.max(1, 100 - speed) : 1

    if (explored % batchSize === 0) {
      const allVisited = new Set([...visitedF, ...visitedB])
      const allFrontier = new Set([...frontierSetF, ...frontierSetB])
      onUpdate({ visited: allVisited, frontier: allFrontier, path: [], exploredEdges: [...exploredEdges] })
      onStats({ nodesExplored: explored, pathLength: 0 })

      await sleep(delay)
    }

    // Check termination
    if (meetingNode && bestDist < Number.POSITIVE_INFINITY) {
      const topF = distF.get(currentF) || Number.POSITIVE_INFINITY
      const topB = distB.get(currentB) || Number.POSITIVE_INFINITY
      if (topF + topB >= bestDist) {
        break
      }
    }
  }

  if (meetingNode) {
    const pathF = reconstructPath(cameFromF, meetingNode)
    const pathB = reconstructPath(cameFromB, meetingNode)
    pathB.reverse()
    const fullPath = [...pathF, ...pathB.slice(1)]
    const pathLength = calculatePathLength(graph, fullPath)

    onUpdate({
      visited: new Set([...visitedF, ...visitedB]),
      frontier: new Set(),
      path: fullPath,
      exploredEdges: [...exploredEdges],
    })
    onStats({ nodesExplored: explored, pathLength })
  }
}

async function sstar(
  graph: Graph,
  start: string,
  end: string,
  getSpeed: () => number,
  onUpdate: (state: AnimationState) => void,
  onStats: (stats: Stats) => void,
  signal?: AbortSignal,
): Promise<void> {
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()
  const cameFrom = new Map<string, string>()
  const visited = new Set<string>()
  const frontier = new MinHeap<string>()
  const exploredEdges: Array<[string, string]> = []

  // Memory bound - cost threshold
  const costThreshold = heuristic(graph, start, end) * 2

  gScore.set(start, 0)
  fScore.set(start, heuristic(graph, start, end))
  frontier.push(start, fScore.get(start)!)

  const frontierSet = new Set<string>([start])
  let explored = 0

  while (!frontier.isEmpty()) {
    if (signal?.aborted) return

    const current = frontier.pop()!
    frontierSet.delete(current)

    if (visited.has(current)) continue

    // S* pruning - skip if over threshold
    if ((fScore.get(current) ?? Number.POSITIVE_INFINITY) > costThreshold) continue

    visited.add(current)
    explored++

    if (current === end) {
      const path = reconstructPath(cameFrom, end)
      const pathLength = calculatePathLength(graph, path)
      onUpdate({ visited: new Set(visited), frontier: new Set(), path, exploredEdges: [...exploredEdges] })
      onStats({ nodesExplored: explored, pathLength })
      return
    }

    const edges = graph.adjacency.get(current) || []
    for (const edge of edges) {
      if (visited.has(edge.to)) continue

      const tentativeG = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edge.weight
      const newF = tentativeG + heuristic(graph, edge.to, end)

      // Prune if exceeds threshold
      if (newF > costThreshold) continue

      if (tentativeG < (gScore.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(edge.to, current)
        gScore.set(edge.to, tentativeG)
        fScore.set(edge.to, newF)
        frontier.push(edge.to, newF)
        frontierSet.add(edge.to)

        exploredEdges.push([current, edge.to])
      }
    }

    const speed = getSpeed()
    const batchSize = speed > 100 ? Math.floor((speed - 100) / 2) + 1 : 1
    const delay = speed <= 100 ? Math.max(1, 100 - speed) : 1

    if (explored % batchSize === 0) {
      onUpdate({
        visited: new Set(visited),
        frontier: new Set(frontierSet),
        path: [],
        exploredEdges: [...exploredEdges],
      })
      onStats({ nodesExplored: explored, pathLength: 0 })

      await sleep(delay)
    }
  }
}

export async function runPathfinding(
  graph: Graph,
  start: string,
  end: string,
  algorithm: Algorithm,
  getSpeed: () => number,
  onUpdate: (state: AnimationState) => void,
  onStats: (stats: Stats) => void,
  signal?: AbortSignal,
): Promise<void> {
  const strategies: Record<Algorithm, typeof dijkstra> = {
    dijkstra,
    astar,
    bidirectional,
    sstar,
  }

  const strategy = strategies[algorithm]
  if (strategy) {
    await strategy(graph, start, end, getSpeed, onUpdate, onStats, signal)
  }
}
