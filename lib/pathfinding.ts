import { haversineDistance, type Graph } from "./osm-fetcher.ts"
import type { Algorithm } from "./store"

export interface SearchResult {
  edges: Array<[string, string]> // relaxed edges, in exploration order
  path: string[]
  explored: number
  length: number // meters
}

class MinHeap<T> {
  private heap: { item: T; priority: number }[] = []

  get size() {
    return this.heap.length
  }

  peekPriority(): number {
    return this.heap[0]?.priority ?? Number.POSITIVE_INFINITY
  }

  push(item: T, priority: number) {
    this.heap.push({ item, priority })
    let i = this.heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.heap[parent].priority <= this.heap[i].priority) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  pop(): T | undefined {
    const top = this.heap[0]
    const last = this.heap.pop()
    if (this.heap.length > 0 && last) {
      this.heap[0] = last
      let i = 0
      while (true) {
        const [left, right] = [2 * i + 1, 2 * i + 2]
        let smallest = i
        if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) smallest = left
        if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) smallest = right
        if (smallest === i) break
        ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
        i = smallest
      }
    }
    return top?.item
  }
}

function reconstructPath(cameFrom: Map<string, string>, node: string): string[] {
  const path = [node]
  while (cameFrom.has(node)) {
    node = cameFrom.get(node)!
    path.unshift(node)
  }
  return path
}

// Dijkstra (h = 0), A* (h = straight-line distance) and S* (A* pruned above a cost bound)
function bestFirst(graph: Graph, start: string, end: string, h: (id: string) => number, bound = Infinity): SearchResult {
  const cost = new Map([[start, 0]])
  const cameFrom = new Map<string, string>()
  const done = new Set<string>()
  const heap = new MinHeap<string>()
  const edges: Array<[string, string]> = []
  heap.push(start, h(start))

  while (heap.size > 0) {
    const current = heap.pop()!
    if (done.has(current)) continue
    done.add(current)
    if (current === end) {
      return { edges, path: reconstructPath(cameFrom, end), explored: done.size, length: cost.get(end)! }
    }
    for (const { to, weight } of graph.adjacency.get(current) ?? []) {
      const next = cost.get(current)! + weight
      if (done.has(to) || next >= (cost.get(to) ?? Infinity) || next + h(to) > bound) continue
      cost.set(to, next)
      cameFrom.set(to, current)
      heap.push(to, next + h(to))
      edges.push([current, to])
    }
  }
  return { edges, path: [], explored: done.size, length: 0 }
}

// Two Dijkstra searches, from start and from end, until their frontiers can no longer improve the best meeting point
function bidirectional(graph: Graph, start: string, end: string): SearchResult {
  const sides = [start, end].map((origin) => {
    const heap = new MinHeap<string>()
    heap.push(origin, 0)
    return { heap, cost: new Map([[origin, 0]]), cameFrom: new Map<string, string>(), done: new Set<string>() }
  })
  const edges: Array<[string, string]> = []
  let best = Infinity
  let meeting: string | null = null

  while (sides.every((s) => s.heap.size > 0) && sides[0].heap.peekPriority() + sides[1].heap.peekPriority() < best) {
    sides.forEach((side, i) => {
      const other = sides[1 - i]
      const current = side.heap.pop()
      if (current === undefined || side.done.has(current)) return
      side.done.add(current)
      for (const { to, weight } of graph.adjacency.get(current) ?? []) {
        const next = side.cost.get(current)! + weight
        if (next < (side.cost.get(to) ?? Infinity)) {
          side.cost.set(to, next)
          side.cameFrom.set(to, current)
          side.heap.push(to, next)
          edges.push([current, to])
        }
        const total = side.cost.get(to)! + (other.cost.get(to) ?? Infinity)
        if (total < best) {
          best = total
          meeting = to
        }
      }
    })
  }

  const explored = sides[0].done.size + sides[1].done.size
  if (!meeting) return { edges, path: [], explored, length: 0 }
  const path = [...reconstructPath(sides[0].cameFrom, meeting), ...reconstructPath(sides[1].cameFrom, meeting).reverse().slice(1)]
  return { edges, path, explored, length: best }
}

export function findPath(graph: Graph, start: string, end: string, algorithm: Algorithm): SearchResult {
  if (start === end) return { edges: [], path: [start], explored: 1, length: 0 }

  const goal = graph.nodes.get(end)!
  const straightLine = (id: string) => {
    const node = graph.nodes.get(id)!
    return haversineDistance(node.lat, node.lng, goal.lat, goal.lng)
  }

  switch (algorithm) {
    case "dijkstra":
      return bestFirst(graph, start, end, () => 0)
    case "astar":
      return bestFirst(graph, start, end, straightLine)
    case "sstar":
      return bestFirst(graph, start, end, straightLine, straightLine(start) * 2)
    case "bidirectional":
      return bidirectional(graph, start, end)
  }
}
