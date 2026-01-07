"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useAppStore } from "@/lib/store"
import { Dashboard } from "@/components/dashboard"
import { StatsOverlay } from "@/components/stats-overlay"
import { fetchOSMData, buildGraph, searchLocation, type SearchResult } from "@/lib/osm-fetcher"
// import { runPathfinding } from "@/lib/pathfinding"
import { Search, Loader2 } from "lucide-react"
import L from "leaflet"

declare global {
  interface Window {
    L: typeof import("leaflet")
  }
}

export default function GeoAlgorithmLab() {
  const animationRef = useRef<number | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use selectors to avoid unnecessary re-renders
  const graph = useAppStore((state) => state.graph)
  const setGraph = useAppStore((state) => state.setGraph)
  const setStartNode = useAppStore((state) => state.setStartNode)
  const setEndNode = useAppStore((state) => state.setEndNode)
  const setPickingMode = useAppStore((state) => state.setPickingMode)
  const setAnimationState = useAppStore((state) => state.setAnimationState)
  const setStats = useAppStore((state) => state.setStats)
  const isLoading = useAppStore((state) => state.isLoading)
  const setIsLoading = useAppStore((state) => state.setIsLoading)
  const setError = useAppStore((state) => state.setError)
  

  const startNode = useAppStore((state) => state.startNode)
  const endNode = useAppStore((state) => state.endNode)
  const algorithm = useAppStore((state) => state.algorithm)
  const animationSpeed = useAppStore((state) => state.animationSpeed)

  useEffect(() => {
    const checkLeaflet = () => {
      if (typeof window !== "undefined" && window.L) {
        setLeafletLoaded(true)
      } else {
        setTimeout(checkLeaflet, 100)
      }
    }
    checkLeaflet()
  }, [])

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !leafletLoaded) return

    const map = L.map(mapContainerRef.current, {
      center: [40.758, -73.9855],
      zoom: 15,
      zoomControl: false,
      preferCanvas: true,
      tapTolerance: 20,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Create canvas overlay
    const canvas = document.createElement("canvas")
    canvas.style.position = "absolute"
    canvas.style.top = "0"
    canvas.style.left = "0"
    canvas.style.pointerEvents = "none"
    canvas.style.zIndex = "400"

    const container = map.getContainer()
    container.appendChild(canvas)
    canvasRef.current = canvas

    const resize = () => {
      const size = map.getSize()
      canvas.width = size.x
      canvas.height = size.y
    }

    resize()
    map.on("resize", resize)
    map.on("move", () => {
      if (mapRef.current) drawFrame()
    })
    map.on("zoom", () => {
      if (mapRef.current) drawFrame()
    })

    mapRef.current = map
    setMapReady(true)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [leafletLoaded])

  const handleMapInteraction = useCallback(
    (e: L.LeafletMouseEvent) => {
      // Get fresh state from store
      const currentGraph = useAppStore.getState().graph
      const currentPickingMode = useAppStore.getState().pickingMode
      const isLoading = useAppStore.getState().isLoading

      // console.log("Map clicked", {
      //   lat: e.latlng.lat,
      //   lng: e.latlng.lng,
      //   pickingMode: currentPickingMode,
      //   hasGraph: !!currentGraph,
      // })

      // if (isLoading) {
      //   setNotification("Please wait for map data to load.")
      //   setTimeout(() => setNotification(null), 3000)
      //   return
      // }

      if (!currentGraph) {
        console.log("No graph loaded yet")
        return
      }

      if (currentPickingMode === null) {
        console.log("Not in picking mode - click 'Pick Start' or 'Pick End' first")
        return
      }

      const { lat, lng } = e.latlng
      let closestNode: string | null = null
      let minDist = Number.POSITIVE_INFINITY

      // Find closest node
      for (const [nodeId, node] of currentGraph.nodes) {
        const dist = Math.sqrt(Math.pow(lat - node.lat, 2) + Math.pow(lng - node.lng, 2))
        if (dist < minDist) {
          minDist = dist
          closestNode = nodeId
        }
      }

      if (closestNode) {
        console.log("Found closest node:", closestNode, "at distance:", minDist)

        if (currentPickingMode === "start") {
          setStartNode(closestNode)
          console.log("Set start node")
        } else {
          setEndNode(closestNode)
          console.log("Set end node")
        }
        setPickingMode(null)
      } else {
        console.log("No nearby nodes found")
      }
    },
    [setStartNode, setEndNode, setPickingMode],
  )

  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    const map = mapRef.current

    console.log("Attaching map click listeners")

    // Primary click handler for both desktop and mobile (Leaflet handles tap events as clicks)
    const clickHandler = (e: L.LeafletMouseEvent) => {
      handleMapInteraction(e)
    }

    map.on("click", clickHandler)

    return () => {
      console.log("Removing map click listeners")
      map.off("click", clickHandler)
    }
  }, [mapReady, handleMapInteraction])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    const currentGraph = useAppStore.getState().graph
    const currentAnimationState = useAppStore.getState().animationState
    const currentStartNode = useAppStore.getState().startNode
    const currentEndNode = useAppStore.getState().endNode

    if (!canvas || !currentGraph || !map) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const latLngToPoint = (lat: number, lng: number) => {
      const point = map.latLngToContainerPoint([lat, lng])
      return { x: point.x, y: point.y }
    }

    // Draw explored edges as bright blue pathfinder lines
    if (currentAnimationState.exploredEdges.length > 0) {
      // console.log("Drawing explored edges:", currentAnimationState.exploredEdges.length)
      ctx.shadowColor = "#3b82f6"
      ctx.shadowBlur = 12
      ctx.strokeStyle = "rgba(59, 130, 246, 0.9)"
      ctx.lineWidth = 3
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()

      for (const [fromId, toId] of currentAnimationState.exploredEdges) {
        const fromNode = currentGraph.nodes.get(fromId)
        const toNode = currentGraph.nodes.get(toId)
        if (!fromNode || !toNode) continue
        const from = latLngToPoint(fromNode.lat, fromNode.lng)
        const to = latLngToPoint(toNode.lat, toNode.lng)
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
      }

      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Draw frontier with glow
    if (currentAnimationState.frontier.size > 0) {
      ctx.shadowColor = "#60a5fa"
      ctx.shadowBlur = 10
      ctx.fillStyle = "#60a5fa"
      ctx.beginPath()

      for (const nodeId of currentAnimationState.frontier) {
        const node = currentGraph.nodes.get(nodeId)
        if (!node) continue
        const pos = latLngToPoint(node.lat, node.lng)
        ctx.moveTo(pos.x + 2.5, pos.y)
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // Draw final path with neon green glow
    if (currentAnimationState.path.length > 1) {
      ctx.shadowColor = "#22c55e"
      ctx.shadowBlur = 20
      ctx.strokeStyle = "#22c55e"
      ctx.lineWidth = 4
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()

      const firstNode = currentGraph.nodes.get(currentAnimationState.path[0])
      if (firstNode) {
        const start = latLngToPoint(firstNode.lat, firstNode.lng)
        ctx.moveTo(start.x, start.y)

        for (let i = 1; i < currentAnimationState.path.length; i++) {
          const node = currentGraph.nodes.get(currentAnimationState.path[i])
          if (node) {
            const pos = latLngToPoint(node.lat, node.lng)
            ctx.lineTo(pos.x, pos.y)
          }
        }
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Draw start marker
    if (currentStartNode) {
      const node = currentGraph.nodes.get(currentStartNode)
      if (node) {
        const pos = latLngToPoint(node.lat, node.lng)
        ctx.shadowColor = "#22c55e"
        ctx.shadowBlur = 15
        ctx.fillStyle = "#22c55e"
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // Draw end marker
    if (currentEndNode) {
      const node = currentGraph.nodes.get(currentEndNode)
      if (node) {
        const pos = latLngToPoint(node.lat, node.lng)
        ctx.shadowColor = "#ef4444"
        ctx.shadowBlur = 15
        ctx.fillStyle = "#ef4444"
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
  }, [])

  // Animation loop
  useEffect(() => {
    if (!mapReady) return

    const animate = () => {
      drawFrame()
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [mapReady, drawFrame])

  const fetchData = useCallback(async () => {
    if (!mapRef.current) return

    setIsLoading(true)
    setError(null)
    // setNotification("Loading map data... Please wait before selecting points.")

    try {
      const bounds = mapRef.current.getBounds()
      const bbox = {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      }

      const osmData = await fetchOSMData(bbox)
      const newGraph = buildGraph(osmData)
      setGraph(newGraph)
      setStats({ nodesInGraph: newGraph.nodes.size, nodesExplored: 0, pathLength: 0 })
      setNotification(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      console.error("Failed to fetch OSM data:", error)
      setError(errorMessage)
      setNotification(null)
    } finally {
      setIsLoading(false)
    }
  }, [setGraph, setStats, setIsLoading, setError])

  // Auto-fetch map data with debounce
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    const map = mapRef.current
    let timeoutId: NodeJS.Timeout

    // Initial fetch if no graph
    if (!graph) {
      fetchData()
    }

    const onMoveEnd = () => {      if (useAppStore.getState().isRunning) return
      clearTimeout(timeoutId)
      setIsLoading(true)
      timeoutId = setTimeout(() => {
        fetchData()
      }, 2000)
    }

    map.on("moveend", onMoveEnd)

    return () => {
      map.off("moveend", onMoveEnd)
      clearTimeout(timeoutId)
    }
  }, [mapReady, graph, fetchData])

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (value.trim().length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocation(value)
        setSuggestions(results)
        setShowSuggestions(true)
      } catch (error) {
        console.error("Autocomplete failed:", error)
      }
    }, 300)
  }

  const handleSuggestionClick = (result: SearchResult) => {
    setSearchQuery(result.display_name)
    setShowSuggestions(false)
    if (mapRef.current) {
      mapRef.current.setView([parseFloat(result.lat), parseFloat(result.lon)], 15)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && suggestions.length > 0 && showSuggestions) {
      e.preventDefault()
      handleSuggestionClick(suggestions[0])
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim() || !mapRef.current) return

    setIsSearching(true)
    try {
      const results = await searchLocation(searchQuery)
      if (results.length > 0) {
        const { lat, lon } = results[0]
        mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 15)
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  if (!leafletLoaded) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-cyan-400 text-lg font-mono animate-pulse">INITIALIZING MAP ENGINE...</div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] relative overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 md:right-auto z-1000">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-blue-400 transition-colors" />
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
            className="w-full md:w-64 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 text-zinc-200 text-sm rounded-xl pl-10 pr-4 py-2.5 shadow-2xl shadow-black/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 w-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-1001">
              {suggestions.map((result, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(result)}
                  className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800/50 last:border-0 truncate"
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Notification */}
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-2000 pointer-events-none">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-blue-500/30 text-blue-200 text-sm px-4 py-2 rounded-full shadow-2xl shadow-blue-500/20 animate-in fade-in slide-in-from-top-4">
            {notification}
          </div>
        </div>
      )}

      <StatsOverlay />
      <Dashboard />
    </div>
  )
}
