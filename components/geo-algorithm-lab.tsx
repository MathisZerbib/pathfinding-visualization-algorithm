"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useAppStore } from "@/lib/store"
import { Dashboard } from "@/components/dashboard"
import { StatsOverlay } from "@/components/stats-overlay"
import { fetchOSMData, buildGraph } from "@/lib/osm-fetcher"
import L from "leaflet"

declare global {
  interface Window {
    L: typeof import("leaflet")
  }
}

export default function GeoAlgorithmLab() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  const {
    graph,
    setGraph,
    startNode,
    endNode,
    setStartNode,
    setEndNode,
    pickingMode,
    setPickingMode,
    animationState,
    setAnimationState,
    algorithm,
    animationSpeed,
    setStats,
    isLoading,
    setIsLoading,
    setError,
  } = useAppStore()

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
      tap: true,
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

      console.log("[v0] Map clicked", {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        pickingMode: currentPickingMode,
        hasGraph: !!currentGraph,
      })

      if (!currentGraph) {
        console.log("[v0] No graph loaded yet")
        return
      }

      if (currentPickingMode === null) {
        console.log("[v0] Not in picking mode - click 'Pick Start' or 'Pick End' first")
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
        console.log("[v0] Found closest node:", closestNode, "at distance:", minDist)

        if (currentPickingMode === "start") {
          setStartNode(closestNode)
          console.log("[v0] Set start node")
        } else {
          setEndNode(closestNode)
          console.log("[v0] Set end node")
        }
        setPickingMode(null)
      } else {
        console.log("[v0] No nearby nodes found")
      }
    },
    [setStartNode, setEndNode, setPickingMode],
  )

  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    const map = mapRef.current

    console.log("[v0] Attaching map click listeners")

    // Primary click handler for both desktop and mobile (Leaflet handles tap events as clicks)
    const clickHandler = (e: L.LeafletMouseEvent) => {
      handleMapInteraction(e)
    }

    map.on("click", clickHandler)

    return () => {
      console.log("[v0] Removing map click listeners")
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

    // Draw all edges (very faint)
    ctx.strokeStyle = "rgba(59, 130, 246, 0.1)"
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const [nodeId, edges] of currentGraph.adjacency) {
      const fromNode = currentGraph.nodes.get(nodeId)
      if (!fromNode) continue
      const from = latLngToPoint(fromNode.lat, fromNode.lng)

      for (const edge of edges) {
        const toNode = currentGraph.nodes.get(edge.to)
        if (!toNode) continue
        const to = latLngToPoint(toNode.lat, toNode.lng)
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
      }
    }
    ctx.stroke()

    // Draw visited edges
    if (currentAnimationState.visited.size > 0) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)"
      ctx.lineWidth = 2
      ctx.beginPath()

      for (const nodeId of currentAnimationState.visited) {
        const fromNode = currentGraph.nodes.get(nodeId)
        if (!fromNode) continue
        const from = latLngToPoint(fromNode.lat, fromNode.lng)

        const edges = currentGraph.adjacency.get(nodeId) || []
        for (const edge of edges) {
          if (currentAnimationState.visited.has(edge.to)) {
            const toNode = currentGraph.nodes.get(edge.to)
            if (!toNode) continue
            const to = latLngToPoint(toNode.lat, toNode.lng)
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
          }
        }
      }
      ctx.stroke()
    }

    // Draw frontier with glow
    if (currentAnimationState.frontier.size > 0) {
      ctx.shadowColor = "#3b82f6"
      ctx.shadowBlur = 15
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 3
      ctx.beginPath()

      for (const nodeId of currentAnimationState.frontier) {
        const node = currentGraph.nodes.get(nodeId)
        if (!node) continue
        const pos = latLngToPoint(node.lat, node.lng)
        ctx.moveTo(pos.x + 4, pos.y)
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Draw final path with neon glow
    if (currentAnimationState.path.length > 1) {
      ctx.shadowColor = "#00ffd5"
      ctx.shadowBlur = 20
      ctx.strokeStyle = "#00ffd5"
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

  // Fetch data handler
  useEffect(() => {
    if (!isLoading || !mapRef.current) return

    const handleFetch = async () => {
      setError(null)

      try {
        const bounds = mapRef.current!.getBounds()
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        console.error("Failed to fetch OSM data:", error)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    handleFetch()
  }, [isLoading, setGraph, setStats, setIsLoading, setError])

  // Run pathfinding when start/end change
  // useEffect(() => {
  //   if (!graph || !startNode || !endNode) return
  //
  //   setAnimationState({ visited: new Set(), frontier: new Set(), path: [] })
  //
  //   runPathfinding(
  //     graph,
  //     startNode,
  //     endNode,
  //     algorithm,
  //     animationSpeed,
  //     (state) => setAnimationState(state),
  //     (stats) => setStats(stats),
  //   )
  // }, [graph, startNode, endNode, algorithm, animationSpeed, setAnimationState, setStats])

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
      <StatsOverlay />
      <Dashboard />
    </div>
  )
}
