"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useAppStore } from "@/lib/store"
import { Dashboard } from "@/components/dashboard"
import { StatsOverlay } from "@/components/stats-overlay"
import { fetchOSMData, buildGraph, searchLocation, type SearchResult } from "@/lib/osm-fetcher"
import { Search, Loader2 } from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

const EDGES_PER_SECOND_PER_SPEED = 8 // speed 50% ≈ 400 edges/s
const FRONT_SECONDS = 0.3 // edges revealed in the last 0.3 s are drawn brighter
const PATH_SECONDS = 0.8 // time to trace the final path

export default function GeoAlgorithmLab() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Playback position: edges revealed (fractional) and path traced (0..1)
  const progressRef = useRef({ edges: 0, path: 0 })
  const [mapReady, setMapReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const graph = useAppStore((state) => state.graph)
  const search = useAppStore((state) => state.search)
  const startNode = useAppStore((state) => state.startNode)
  const endNode = useAppStore((state) => state.endNode)
  const isRunning = useAppStore((state) => state.isRunning)
  const setGraph = useAppStore((state) => state.setGraph)
  const setStartNode = useAppStore((state) => state.setStartNode)
  const setEndNode = useAppStore((state) => state.setEndNode)
  const setPickingMode = useAppStore((state) => state.setPickingMode)
  const setStats = useAppStore((state) => state.setStats)
  const setIsRunning = useAppStore((state) => state.setIsRunning)
  const setIsLoading = useAppStore((state) => state.setIsLoading)
  const setError = useAppStore((state) => state.setError)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !map || !ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const { graph, search, startNode, endNode, animationSpeed } = useAppStore.getState()
    if (!graph) return
    const point = (id: string) => {
      const node = graph.nodes.get(id)
      return node && map.latLngToContainerPoint([node.lat, node.lng])
    }

    if (search) {
      const { edges, path } = progressRef.current
      const shown = Math.floor(edges)
      const front = Math.max(0, shown - animationSpeed * EDGES_PER_SECOND_PER_SPEED * FRONT_SECONDS)

      const strokeEdges = (from: number, to: number, color: string, width: number) => {
        ctx.beginPath()
        for (let i = Math.floor(from); i < to; i++) {
          const a = point(search.edges[i][0])
          const b = point(search.edges[i][1])
          if (!a || !b) continue
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
        }
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.stroke()
      }
      strokeEdges(0, front, "rgba(96, 165, 250, 0.4)", 1.5)
      strokeEdges(front, shown, "rgba(219, 234, 254, 0.95)", 2)

      // Trace the path progressively, interpolating inside the current segment
      const points = search.path.map(point).filter((p) => p !== undefined)
      if (path > 0 && points.length > 1) {
        const t = path * (points.length - 1)
        const whole = Math.floor(t)
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i <= whole; i++) ctx.lineTo(points[i].x, points[i].y)
        if (whole < points.length - 1) {
          const [a, b] = [points[whole], points[whole + 1]]
          ctx.lineTo(a.x + (b.x - a.x) * (t - whole), a.y + (b.y - a.y) * (t - whole))
        }
        ctx.strokeStyle = "rgba(9, 9, 11, 0.9)"
        ctx.lineWidth = 7
        ctx.stroke()
        ctx.strokeStyle = "#34d399"
        ctx.lineWidth = 4
        ctx.stroke()
      }
    }

    for (const [id, color] of [
      [startNode, "#34d399"],
      [endNode, "#f87171"],
    ] as const) {
      const p = id && point(id)
      if (!p) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = "#fafafa"
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [])

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [40.758, -73.9855],
      zoom: 15,
      zoomControl: false,
      tapTolerance: 20,
    })

    // Mapbox GL basemap under Leaflet's panes, so label layers can be tuned (raster tiles bake them in)
    const glContainer = document.createElement("div")
    glContainer.style.cssText = "position:absolute;inset:0;pointer-events:none"
    map.getContainer().prepend(glContainer)
    const glMap = new mapboxgl.Map({
      container: glContainer,
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      style: "mapbox://styles/mapbox/dark-v11",
      interactive: false,
      attributionControl: false,
      center: [-73.9855, 40.758],
      zoom: 14, // Mapbox GL zoom = Leaflet zoom - 1 (512px vs 256px tiles)
    })
    // Street names only when zoomed in close (Leaflet zoom 17+)
    glMap.on("style.load", () => glMap.setLayerZoomRange("road-label-simple", 16, 24))
    map.on("move zoom", () => {
      const c = map.getCenter()
      glMap.jumpTo({ center: [c.lng, c.lat], zoom: map.getZoom() - 1 })
      draw()
    })
    map.on("zoomanim", (e: L.ZoomAnimEvent) =>
      glMap.easeTo({ center: [e.center.lng, e.center.lat], zoom: e.zoom - 1, duration: 250 }),
    )
    map.attributionControl.addAttribution(
      '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    )

    // Canvas overlay, sized for the device pixel ratio so lines stay crisp
    const canvas = document.createElement("canvas")
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:400"
    map.getContainer().appendChild(canvas)
    canvasRef.current = canvas

    const resize = () => {
      const { x, y } = map.getSize()
      const dpr = window.devicePixelRatio || 1
      canvas.width = x * dpr
      canvas.height = y * dpr
      canvas.style.width = `${x}px`
      canvas.style.height = `${y}px`
      glMap.resize()
      draw()
    }
    resize()
    map.on("resize", resize)

    mapRef.current = map
    setMapReady(true)

    return () => {
      glMap.remove()
      map.remove()
      mapRef.current = null
    }
  }, [draw])

  // Pick start then end on click (or the point chosen with Pick start / Pick end)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const onClick = (e: L.LeafletMouseEvent) => {
      const { graph, pickingMode, startNode, endNode, isRunning } = useAppStore.getState()
      if (!graph || isRunning) return
      const mode = pickingMode ?? (!startNode ? "start" : !endNode ? "end" : null)
      if (!mode) return

      let closest: string | null = null
      let minDist = Number.POSITIVE_INFINITY
      for (const [id, node] of graph.nodes) {
        const dist = (e.latlng.lat - node.lat) ** 2 + (e.latlng.lng - node.lng) ** 2
        if (dist < minDist) {
          minDist = dist
          closest = id
        }
      }
      if (!closest) return
      if (mode === "start") setStartNode(closest)
      else setEndNode(closest)
      setPickingMode(null)
    }

    map.on("click", onClick)
    return () => {
      map.off("click", onClick)
    }
  }, [mapReady, setStartNode, setEndNode, setPickingMode])

  // A new search restarts playback; any change of markers or result redraws
  useEffect(() => {
    progressRef.current = { edges: 0, path: 0 }
  }, [search])

  useEffect(() => {
    draw()
  }, [draw, graph, search, startNode, endNode])

  // Playback: reveal edges at the current speed (read every frame, so it can change mid-run), then trace the path
  useEffect(() => {
    if (!isRunning || !search) return

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000 // clamp jumps after a background tab
      last = now
      const progress = progressRef.current
      const total = search.edges.length

      if (progress.edges < total) {
        const rate = useAppStore.getState().animationSpeed * EDGES_PER_SECOND_PER_SPEED
        progress.edges = Math.min(total, progress.edges + rate * dt)
        setStats({ nodesExplored: Math.round((search.explored * progress.edges) / total) })
      } else {
        progress.path = Math.min(1, progress.path + dt / PATH_SECONDS)
      }
      draw()

      if (progress.path < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        setStats({ nodesExplored: search.explored, pathLength: search.length })
        setIsRunning(false)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isRunning, search, draw, setStats, setIsRunning])

  const fetchData = useCallback(async () => {
    const map = mapRef.current
    if (!map) return

    setIsLoading(true)
    setError(null)
    try {
      const bounds = map.getBounds()
      const newGraph = buildGraph(
        await fetchOSMData({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        }),
      )
      setGraph(newGraph)
      // Markers outside the new graph can't be routed from
      const { startNode, endNode } = useAppStore.getState()
      if (startNode && !newGraph.nodes.has(startNode)) setStartNode(null)
      if (endNode && !newGraph.nodes.has(endNode)) setEndNode(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [setGraph, setStartNode, setEndNode, setIsLoading, setError])

  // Load roads on start, then again 2 s after the map stops moving
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    if (!graph) fetchData()

    let timeoutId: NodeJS.Timeout
    const onMoveEnd = () => {
      if (useAppStore.getState().isRunning) return
      clearTimeout(timeoutId)
      setIsLoading(true)
      timeoutId = setTimeout(fetchData, 2000)
    }
    map.on("moveend", onMoveEnd)
    return () => {
      map.off("moveend", onMoveEnd)
      clearTimeout(timeoutId)
    }
  }, [mapReady, graph, fetchData, setIsLoading])

  const goTo = (result: SearchResult) => {
    setSearchQuery(result.display_name)
    setShowSuggestions(false)
    mapRef.current?.setView([parseFloat(result.lat), parseFloat(result.lon)], 15)
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (value.trim().length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSuggestions(await searchLocation(value))
        setShowSuggestions(true)
      } catch (error) {
        console.error("Autocomplete failed:", error)
      }
    }, 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && suggestions.length > 0 && showSuggestions) {
      e.preventDefault()
      goTo(suggestions[0])
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const [first] = await searchLocation(searchQuery)
      if (first) goTo(first)
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] relative overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Search Bar */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 right-4 md:right-auto z-[1002]">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-zinc-200 transition-colors" />
            )}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200)
            }}
            placeholder="Search location..."
            className="w-full md:w-64 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 text-zinc-200 text-sm rounded-xl pl-10 pr-4 py-2.5 shadow-lg shadow-black/40 focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 w-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg overflow-hidden z-[1003]">
              {suggestions.map((result, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goTo(result)}
                  className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800/50 last:border-0 truncate"
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      <StatsOverlay />
      <Dashboard />
    </div>
  )
}
