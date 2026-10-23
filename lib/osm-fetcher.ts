import { VectorTile } from "@mapbox/vector-tile"
import { PbfReader } from "pbf"

export interface OSMNode {
  id: number
  lat: number
  lng: number
}

export interface OSMWay {
  id: number
  nodes: number[]
}

export interface OSMData {
  nodes: Map<number, OSMNode>
  ways: OSMWay[]
}

export interface GraphNode {
  id: string
  lat: number
  lng: number
}

export interface GraphEdge {
  to: string
  weight: number
}

export interface Graph {
  nodes: Map<string, GraphNode>
  adjacency: Map<string, GraphEdge[]>
}

interface BBox {
  south: number
  west: number
  north: number
  east: number
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
// Road network comes from Mapbox Streets v8 vector tiles (Overpass public servers are saturated)
const TILE_ZOOM = 14
const EXTENT = 4096
const WORLD = 2 ** TILE_ZOOM * EXTENT
const MAX_TILES = 16
const DRIVABLE = new Set([
  "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
  "secondary", "secondary_link", "tertiary", "tertiary_link", "street", "street_limited", "service",
])

const lngToTile = (lng: number) => Math.floor(((lng + 180) / 360) * 2 ** TILE_ZOOM)
const latToTile = (lat: number) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** TILE_ZOOM)
}

export async function fetchOSMData(bbox: BBox): Promise<OSMData> {
  if (!MAPBOX_TOKEN) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is missing.")

  const [x0, x1, y0, y1] = [lngToTile(bbox.west), lngToTile(bbox.east), latToTile(bbox.north), latToTile(bbox.south)]
  const tiles: [number, number][] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([x, y])
  if (tiles.length > MAX_TILES) throw new Error("Area too large. Zoom in closer to load the road network.")

  const lines: number[][][] = [] // world coordinates [wx, wy]
  const levels: number[] = [] // bridge 1 / ground 0 / tunnel -1: only same-level roads cross

  await Promise.all(
    tiles.map(async ([tx, ty]) => {
      const res = await fetch(
        `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${TILE_ZOOM}/${tx}/${ty}.vector.pbf?access_token=${MAPBOX_TOKEN}`,
      )
      if (res.status === 404 || res.status === 204) return // empty tile (sea)
      if (!res.ok) throw new Error(`Mapbox tiles: HTTP ${res.status}`)
      const roads = new VectorTile(new PbfReader(await res.arrayBuffer())).layers.road
      if (!roads) return

      for (let i = 0; i < roads.length; i++) {
        const feature = roads.feature(i)
        if (!DRIVABLE.has(String(feature.properties.class))) continue
        const structure = feature.properties.structure
        const level = structure === "bridge" ? 1 : structure === "tunnel" ? -1 : 0
        for (const line of feature.loadGeometry()) {
          for (const piece of clipToTile(line.map((p) => [p.x, p.y]))) {
            lines.push(piece.map(([x, y]) => [tx * EXTENT + x, ty * EXTENT + y]))
            levels.push(level)
          }
        }
      }
    }),
  )

  splitAtCrossings(lines, levels)
  snapDanglingEnds(lines)

  const nodes = new Map<number, OSMNode>()
  const ways: OSMWay[] = lines.map((line, index) => ({
    id: index,
    nodes: line.map(([wx, wy]) => {
      const id = wx * WORLD + wy
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          lng: (wx / WORLD) * 360 - 180,
          lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * wy) / WORLD))) * 180) / Math.PI,
        })
      }
      return id
    }),
  }))

  if (ways.length === 0) throw new Error("No road data found in this area. Try a different location.")
  return { nodes, ways }
}

// Tiles overlap by a buffer: cut each road at the exact tile edge so neighbours meet on a shared vertex
export function clipToTile(line: number[][]): number[][][] {
  const pieces: number[][][] = []
  let current: number[][] = []
  for (let i = 0; i < line.length - 1; i++) {
    const [a, b] = [line[i], line[i + 1]]
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
    let [t0, t1] = [0, 1]
    // Liang–Barsky against 0 <= x, y <= EXTENT
    for (const [p, q] of [[-dx, a[0]], [dx, EXTENT - a[0]], [-dy, a[1]], [dy, EXTENT - a[1]]]) {
      if (p === 0) {
        if (q < 0) t0 = 2
      } else if (p < 0) t0 = Math.max(t0, q / p)
      else t1 = Math.min(t1, q / p)
    }
    if (t0 > t1) {
      if (current.length > 1) pieces.push(current)
      current = []
      continue
    }
    const at = (t: number) => [Math.round(a[0] + t * dx), Math.round(a[1] + t * dy)]
    const [start, end] = [at(t0), at(t1)]
    const last = current[current.length - 1]
    if (!last || last[0] !== start[0] || last[1] !== start[1]) {
      if (current.length > 1) pieces.push(current)
      current = [start]
    }
    current.push(end)
  }
  if (current.length > 1) pieces.push(current)
  return pieces
}

// Tiles simplify straight roads, so crossings often have no shared vertex: add one on both lines.
const CELL = 256

export function splitAtCrossings(lines: number[][][], levels: number[]) {
  const grid = new Map<string, [number, number][]>() // [line, segment]
  lines.forEach((line, li) => {
    for (let si = 0; si < line.length - 1; si++) {
      const [a, b] = [line[si], line[si + 1]]
      for (let cx = Math.floor(Math.min(a[0], b[0]) / CELL); cx <= Math.floor(Math.max(a[0], b[0]) / CELL); cx++)
        for (let cy = Math.floor(Math.min(a[1], b[1]) / CELL); cy <= Math.floor(Math.max(a[1], b[1]) / CELL); cy++) {
          const c = `${cx},${cy}`
          if (!grid.has(c)) grid.set(c, [])
          grid.get(c)!.push([li, si])
        }
    }
  })

  const inserts = new Map<string, { t: number; p: number[] }[]>() // "line,segment" -> points to insert
  const add = (li: number, si: number, t: number, p: number[]) => {
    const k = `${li},${si}`
    if (!inserts.has(k)) inserts.set(k, [])
    inserts.get(k)!.push({ t, p })
  }
  const done = new Set<string>()

  for (const segments of grid.values()) {
    for (let i = 0; i < segments.length; i++)
      for (let j = i + 1; j < segments.length; j++) {
        const [l1, s1] = segments[i]
        const [l2, s2] = segments[j]
        if (l1 === l2 || levels[l1] !== levels[l2]) continue
        const pair = `${l1},${s1},${l2},${s2}`
        if (done.has(pair)) continue
        done.add(pair)
        const [a, b, c, d] = [lines[l1][s1], lines[l1][s1 + 1], lines[l2][s2], lines[l2][s2 + 1]]
        const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
        if (den === 0) continue
        const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den
        const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den
        if (t < 0 || t > 1 || u < 0 || u > 1) continue
        const p = [Math.round(a[0] + t * (b[0] - a[0])), Math.round(a[1] + t * (b[1] - a[1]))]
        add(l1, s1, t, p)
        add(l2, s2, u, p)
      }
  }

  // Insert from the last segment backwards so earlier indices stay valid
  for (const [li, line] of lines.entries()) {
    for (let si = line.length - 2; si >= 0; si--) {
      const points = inserts.get(`${li},${si}`)
      if (!points) continue
      points.sort((x, y) => x.t - y.t)
      line.splice(si + 1, 0, ...points.map((x) => x.p))
    }
  }
}

// Vector tiles don't carry topology: a road end that stops a few meters from another road
// (or at a tile seam) is moved onto the nearest vertex of another line.
const SNAP = 10 // tile units at z14 ≈ 6 m

export function snapDanglingEnds(lines: number[][][]) {
  const key = (p: number[]) => p[0] * WORLD + p[1]
  const degree = new Map<number, number>()
  const grid = new Map<string, { p: number[]; line: number }[]>()
  const cell = (x: number, y: number) => `${Math.floor(x / SNAP)},${Math.floor(y / SNAP)}`

  lines.forEach((line, li) => {
    line.forEach((p, i) => {
      degree.set(key(p), (degree.get(key(p)) ?? 0) + (i === 0 || i === line.length - 1 ? 1 : 2))
      const c = cell(p[0], p[1])
      if (!grid.has(c)) grid.set(c, [])
      grid.get(c)!.push({ p, line: li })
    })
  })

  lines.forEach((line, li) => {
    for (const i of [0, line.length - 1]) {
      const end = line[i]
      if (degree.get(key(end)) !== 1) continue
      let best: number[] | null = null
      let bestDist = SNAP * SNAP
      const cx = Math.floor(end[0] / SNAP)
      const cy = Math.floor(end[1] / SNAP)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const candidate of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
            if (candidate.line === li) continue
            const d = (candidate.p[0] - end[0]) ** 2 + (candidate.p[1] - end[1]) ** 2
            if (d <= bestDist) {
              bestDist = d
              best = candidate.p
            }
          }
      if (best) line[i] = [best[0], best[1]]
    }
  })
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function buildGraph(osmData: OSMData): Graph {
  const nodes = new Map<string, GraphNode>()
  const adjacency = new Map<string, GraphEdge[]>()

  // Add all nodes from ways
  for (const way of osmData.ways) {
    for (const nodeId of way.nodes) {
      const osmNode = osmData.nodes.get(nodeId)
      if (osmNode) {
        const id = `n${nodeId}`
        if (!nodes.has(id)) {
          nodes.set(id, {
            id,
            lat: osmNode.lat,
            lng: osmNode.lng,
          })
          adjacency.set(id, [])
        }
      }
    }
  }

  // Build edges from ways
  for (const way of osmData.ways) {
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromOsm = osmData.nodes.get(way.nodes[i])
      const toOsm = osmData.nodes.get(way.nodes[i + 1])

      if (fromOsm && toOsm) {
        const fromId = `n${fromOsm.id}`
        const toId = `n${toOsm.id}`
        const weight = haversineDistance(fromOsm.lat, fromOsm.lng, toOsm.lat, toOsm.lng)

        // Bidirectional edges
        const fromEdges = adjacency.get(fromId) || []
        fromEdges.push({ to: toId, weight })
        adjacency.set(fromId, fromEdges)

        const toEdges = adjacency.get(toId) || []
        toEdges.push({ to: fromId, weight })
        adjacency.set(toId, toEdges)
      }
    }
  }

  // Keep only the largest connected component so any picked start/end has a path
  const seen = new Set<string>()
  let largest: string[] = []
  for (const id of nodes.keys()) {
    if (seen.has(id)) continue
    const component = [id]
    seen.add(id)
    for (let i = 0; i < component.length; i++) {
      for (const edge of adjacency.get(component[i]) ?? []) {
        if (!seen.has(edge.to)) {
          seen.add(edge.to)
          component.push(edge.to)
        }
      }
    }
    if (component.length > largest.length) largest = component
  }
  const keep = new Set(largest)
  for (const id of nodes.keys()) {
    if (!keep.has(id)) {
      nodes.delete(id)
      adjacency.delete(id)
    }
  }

  return { nodes, adjacency }
}

export interface SearchResult {
  lat: string
  lon: string
  display_name: string
}

export async function searchLocation(query: string): Promise<SearchResult[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent": "PathfindingVisualizer/1.0",
      },
    },
  )
  if (!response.ok) {
    throw new Error("Failed to search location")
  }
  return response.json()
}
