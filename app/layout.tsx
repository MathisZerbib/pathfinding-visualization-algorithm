import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Pathfinding Visualization Algorithm",
  description: "Explore Dijkstra and A* algorithms in real-time on interactive maps powered by OpenStreetMap",
  keywords: ["pathfinding", "algorithm visualization", "Dijkstra", "A*", "graph algorithms", "OpenStreetMap", "interactive learning"],
  authors: [{ name: "Mathis Zerbib" }],
  creator: "Mathis Zerbib",
  publisher: "Mathis Zerbib",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon.ico",
        sizes: "any",
      },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://pathfinding-visualization-algorithm.vercel.app",
    siteName: "Pathfinding Visualization",
    title: "Pathfinding Visualization | Dijkstra & A* Algorithms on Real Maps",
    description: "Explore and visualize Dijkstra and A* pathfinding algorithms in real-time on interactive maps. Educational tool built with OpenStreetMap and Next.js.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pathfinding Visualization - Interactive Dijkstra and A* algorithms demonstration on real map data",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@MathisZerbib",
    creator: "@MathisZerbib",
    title: "Pathfinding Visualization | Dijkstra & A* Algorithms",
    description: "Explore and visualize Dijkstra and A* pathfinding algorithms in real-time on interactive maps. Educational tool built with OpenStreetMap and Next.js.",
    images: [
      {
        url: "/og-image.png",
        alt: "Pathfinding Visualization - Interactive Dijkstra and A* algorithms demonstration on real map data",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className={`font-sans antialiased`}>
        <Script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossOrigin=""
          strategy="beforeInteractive"
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
