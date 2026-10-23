import { ImageResponse } from "next/og"

export const alt = "Geospatial Algorithm Lab — pathfinding algorithms animated on real road networks"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// A tilted street grid (Manhattan-style) with an explored area and the shortest path on top
const STREETS = Array.from({ length: 24 }, (_, i) => i * 60 - 300)
const EXPLORED_X = Array.from({ length: 10 }, (_, i) => 600 + i * 60)
const EXPLORED_Y = Array.from({ length: 6 }, (_, i) => 300 + i * 60)
const PATH = "M 660 540 L 780 540 L 780 480 L 900 480 L 900 420 L 1020 420 L 1020 360 L 1080 360"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0a0f", position: "relative" }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          <g transform="rotate(-29 600 315)">
            {STREETS.map((x) => (
              <line key={`v${x}`} x1={x + 300} y1="-400" x2={x + 300} y2="1000" stroke="#27272a" strokeWidth="2" />
            ))}
            {STREETS.map((y) => (
              <line key={`h${y}`} x1="-400" y1={y + 300} x2="1600" y2={y + 300} stroke="#27272a" strokeWidth="2" />
            ))}
            {EXPLORED_X.map((x) => (
              <line key={`ev${x}`} x1={x} y1="300" x2={x} y2="600" stroke="#60a5fa" strokeOpacity="0.55" strokeWidth="3" />
            ))}
            {EXPLORED_Y.map((y) => (
              <line key={`eh${y}`} x1="600" y1={y} x2="1140" y2={y} stroke="#60a5fa" strokeOpacity="0.55" strokeWidth="3" />
            ))}
            <path d={PATH} fill="none" stroke="#09090b" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d={PATH} fill="none" stroke="#34d399" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="660" cy="540" r="14" fill="#34d399" stroke="#fafafa" strokeWidth="4" />
            <circle cx="1080" cy="360" r="14" fill="#f87171" stroke="#fafafa" strokeWidth="4" />
          </g>
        </svg>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "72px",
            width: "100%",
            height: "100%",
            background: "linear-gradient(90deg, #0a0a0f 0%, rgba(10,10,15,0.92) 45%, rgba(10,10,15,0) 75%)",
          }}
        >
          <div style={{ fontSize: 28, color: "#a1a1aa", marginBottom: 20 }}>Dijkstra · A* · Bidirectional · S*</div>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#fafafa", lineHeight: 1.05, letterSpacing: -2 }}>
            Geospatial
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#fafafa", lineHeight: 1.05, letterSpacing: -2 }}>
            Algorithm Lab
          </div>
          <div style={{ fontSize: 30, color: "#d4d4d8", marginTop: 28, maxWidth: 560 }}>
            Watch pathfinding algorithms search real city streets.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
