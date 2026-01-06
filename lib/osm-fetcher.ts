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

function calculateBBoxArea(bbox: BBox): number {
  // Approximate area in square degrees
  const latDiff = bbox.north - bbox.south
  const lngDiff = bbox.east - bbox.west
  return latDiff * lngDiff
}

function isValidBBoxSize(bbox: BBox): { valid: boolean; area: number } {
  const area = calculateBBoxArea(bbox)
  // Limit to approximately 0.01 square degrees (~1.2km x 1.1km at equator)
  const MAX_AREA = 0.01
  return { valid: area <= MAX_AREA, area }
}

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
]

export async function fetchOSMData(bbox: BBox): Promise<OSMData> {
  const { valid, area } = isValidBBoxSize(bbox)
  if (!valid) {
    throw new Error(
      `Area too large (${area.toFixed(4)} sq degrees). Please zoom in closer. Maximum area: 0.01 sq degrees.`,
    )
  }

  const query = `
    [out:json][timeout:60];
    (
      way["highway"]["highway"!="footway"]["highway"!="path"]["highway"!="steps"]["highway"!="cycleway"]["highway"!="pedestrian"]
      (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    (._;>;);
    out skel;
  `

  let lastError: Error | null = null

  for (let serverIndex = 0; serverIndex < OVERPASS_SERVERS.length; serverIndex++) {
    const server = OVERPASS_SERVERS[serverIndex]

    try {
      console.log(`Fetching OSM data from ${server} (attempt ${serverIndex + 1}/${OVERPASS_SERVERS.length})`)
      console.log(`BBox area: ${area.toFixed(4)} sq degrees`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 65000) // 65s client timeout

      const response = await fetch(server, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.elements || data.elements.length === 0) {
        throw new Error("No road data found in this area. Try a different location.")
      }

      console.log(`Successfully fetched ${data.elements.length} elements`)

      const nodes = new Map<number, OSMNode>()
      const ways: OSMWay[] = []

      for (const element of data.elements) {
        if (element.type === "node") {
          nodes.set(element.id, {
            id: element.id,
            lat: element.lat,
            lng: element.lon,
          })
        } else if (element.type === "way") {
          ways.push({
            id: element.id,
            nodes: element.nodes,
          })
        }
      }

      console.log(`Parsed ${nodes.size} nodes and ${ways.length} ways`)

      return { nodes, ways }
    } catch (error) {
      lastError = error as Error
      console.warn(`Failed to fetch from ${server}:`, error)

      // If it's not the last server, wait a bit before trying the next one
      if (serverIndex < OVERPASS_SERVERS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  throw new Error(
    `Failed to fetch road data from all servers. ${lastError?.message || "Unknown error"}. Try zooming in to a smaller area or try again later.`,
  )
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
