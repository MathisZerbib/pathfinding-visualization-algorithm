"use client"

import dynamic from "next/dynamic"

const GeoAlgorithmLab = dynamic(() => import("@/components/geo-algorithm-lab"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-cyan-400 font-mono text-sm flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
        Initializing Geospatial Algorithm Lab...
      </div>
    </div>
  ),
})

export default function Page() {
  return <GeoAlgorithmLab />
}
