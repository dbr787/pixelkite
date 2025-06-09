"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"

interface MosaicTile {
  id: string
  radius: number
  color: string
  originalColor: string
  hoverColor: string
  x: number
  y: number
  centerX: number
  centerY: number
  originalCenterX: number
  originalCenterY: number
  section: number | null
  animationOffset: number
  floatDistance: number
  isClosest: boolean
  isTouchingHovered: boolean
  distanceFromCursor: number
  zIndex: number
  glowIntensity: number
  // Animation properties
  scale: number
  // Shape morphing - smooth transitions
  morphProgress: number
  targetMorphProgress: number
  morphStartTime: number
  morphStartProgress: number
  transitionDelay: number
  transitionDuration: number
  // Heart-specific properties
  heartBeat: number
  heartBeatPhase: number
  heartBeatSpeed: number
  isMainHeart: boolean
  // Ripple effect properties
  lastRippleTime: number
  rippleDelay: number
  rippleIntensity: number
  // Color transition - synchronized with morphing
  originalR: number
  originalG: number
  originalB: number
  targetR: number
  targetG: number
  targetB: number
  // Sparkly random transitions
  sparkleTimer: number
  sparkleInterval: number
  sparkleColorIndex: number
  nextSparkleTime: number
  // Squeeze layer for progressive sizing
  squeezeLayer: number
  // Color transition timing
  colorTransitionStartTime: number
  // Transition state tracking
  isTransitioning: boolean
  lastUpdateTime: number
}

interface MouseMovement {
  x: number
  y: number
  prevX: number
  prevY: number
  isInMosaic: boolean
}

// Simple size configurations - just 3 sizes
const SIMPLE_CONFIGS = {
  mobile: {
    logoScale: 0.7,
    tileRadius: 2.2,
    tileSpacing: 9,
    mainHeartRadius: 12, // Reduced from 15 to 12
    surroundingHeartRadius: 25, // Reduced from 35 to 25
  },
  tablet: {
    logoScale: 1.0,
    tileRadius: 3.5,
    tileSpacing: 15,
    mainHeartRadius: 45,
    surroundingHeartRadius: 90,
  },
  desktop: {
    logoScale: 1.2,
    tileRadius: 4,
    tileSpacing: 18,
    mainHeartRadius: 50,
    surroundingHeartRadius: 99,
  },
}

// Simple function to get config based on width
const getSimpleConfig = (width: number) => {
  if (width < 768) return SIMPLE_CONFIGS.mobile
  if (width < 1024) return SIMPLE_CONFIGS.tablet
  return SIMPLE_CONFIGS.desktop
}

// Buildkite logo colors - more contrast
const BUILDKITE_COLORS = {
  darkGreen: "#0A8A5A", // Much darker green
  lightGreen: "#40FF80", // Much brighter/lighter green
}

// Different hover color palettes for different sections
// Dark green sections get vibrant citrus colors (orange/yellow)
const darkGreenHoverColors = [
  "#FF8C00", // Dark Orange
  "#FF7F00", // Orange
  "#FFB347", // Peach
  "#FFA500", // Orange
  "#FF6347", // Tomato
  "#FF4500", // Orange Red
  "#FFD700", // Gold
  "#FFA000", // Amber
]

// Light green sections get rich dark berry colors
const lightGreenHoverColors = [
  "#8B0000", // Dark Red
  "#800080", // Purple
  "#4B0082", // Indigo
  "#663399", // Rebecca Purple
  "#722F37", // Wine
  "#8B008B", // Dark Magenta
  "#9932CC", // Dark Orchid
  "#6A0DAD", // Blue Violet
]

// Always red for the hovered heart
const HOVERED_HEART_COLOR = "#FF0033" // Bright Red

// Transition times - SYNCHRONIZED
const HOVER_ON_TRANSITION_TIME = 200 // Reduced from 300ms
const HOVER_OFF_TRANSITION_TIME = 300 // Keep same for hover off
const MAIN_HEART_TRANSITION_TIME = 0 // Instant for main heart hover-on

// Sparkle timing ranges (in milliseconds)
const SPARKLE_MIN_INTERVAL = 800
const SPARKLE_MAX_INTERVAL = 2500
const SPARKLE_TRANSITION_TIME = 400

// Heart size multiplier (slightly larger than before)
const HEART_SIZE_MULTIPLIER = 1.6 // Was 1.5

// Heartbeat timing - exactly 1000ms between beats
const HEARTBEAT_INTERVAL = 1000 // 1 second exactly
const HEARTBEAT_DURATION = 400 // How long each heartbeat lasts

// Transition delay increment per distance unit - REDUCED
const TRANSITION_DELAY_INCREMENT = 15 // Reduced from 30ms to 15ms per layer

// Ripple effect settings
const RIPPLE_SPEED = 0.3 // Even faster ripple travel
const RIPPLE_LAYERS = 5 // Number of ripple layers
const RIPPLE_LAYER_DISTANCE = 25 // Distance between ripple layers
const RIPPLE_DURATION = 300 // Even shorter duration for snappier ripple

// Progressive squeeze layers - simplified
const SQUEEZE_LAYERS = [
  { maxDistance: 30, sizeMultiplier: 1.8, pushForce: 3.0 },
  { maxDistance: 50, sizeMultiplier: 1.4, pushForce: 2.2 },
  { maxDistance: 70, sizeMultiplier: 1.1, pushForce: 1.6 },
  { maxDistance: 90, sizeMultiplier: 0.9, pushForce: 1.2 },
  { maxDistance: 120, sizeMultiplier: 0.7, pushForce: 0.8 },
]

// Define heart colors for sparkles
const heartColors = [
  "#FF0033", // Red
  "#FF3366", // Coral
  "#FF6699", // Pink
  "#FF99CC", // Light Pink
  "#CC0033", // Dark Red
  "#CC3366", // Dark Coral
  "#CC6699", // Dark Pink
]

export default function BuildkiteMosaic() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [tiles, setTiles] = useState<MosaicTile[]>([])
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 })
  const [config, setConfig] = useState(SIMPLE_CONFIGS.desktop)
  const [mouseMovement, setMouseMovement] = useState<MouseMovement>({
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    isInMosaic: false,
  })
  const lastUpdateTime = useRef<number>(0)
  const lastMainHeartBeat = useRef<number>(0)
  const lastRippleTime = useRef<number>(0)
  const mainHeartStartTime = useRef<number>(0) // Track when main heart became active
  const lastRippleTriggerTime = useRef<number>(0) // Track last ripple trigger to prevent duplicates

  // Cache for heart detection - using the EXACT same path as the drawn hearts
  const heartDetectionCanvas = useRef<HTMLCanvasElement | null>(null)
  const heartDetectionCtx = useRef<CanvasRenderingContext2D | null>(null)

  // Initialize heart detection canvas once
  useEffect(() => {
    heartDetectionCanvas.current = document.createElement("canvas")
    heartDetectionCtx.current = heartDetectionCanvas.current.getContext("2d")
  }, [])

  // Precise heart-shaped detection using the EXACT same SVG path as the drawn hearts
  const isPointInHeartShape = (tileX: number, tileY: number, cursorX: number, cursorY: number, radius: number) => {
    if (!heartDetectionCanvas.current || !heartDetectionCtx.current) return false

    const dx = tileX - cursorX
    const dy = tileY - cursorY

    // Quick distance check for performance
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > radius * 1.3) return false

    const canvas = heartDetectionCanvas.current
    const ctx = heartDetectionCtx.current

    // Set canvas size for detection (smaller for performance)
    const detectionSize = 200
    canvas.width = detectionSize
    canvas.height = detectionSize

    ctx.clearRect(0, 0, detectionSize, detectionSize)

    // Center the heart path on the canvas
    ctx.save()
    ctx.translate(detectionSize / 2, detectionSize / 2)

    // Scale the heart to match the detection radius
    const svgWidth = 122.88
    const svgHeight = 107.41
    const scale = (radius * 1.8) / Math.max(svgWidth, svgHeight) // Slightly larger scale for better detection

    ctx.scale(scale, scale)
    ctx.translate(-svgWidth / 2, -svgHeight / 2)

    // Draw the EXACT same heart path as in drawShape
    ctx.beginPath()
    ctx.moveTo(60.83, 17.19)
    ctx.bezierCurveTo(68.84, 8.84, 74.45, 1.62, 86.79, 0.21)
    ctx.bezierCurveTo(86.79 + 23.17, 0.21 - 2.66, 86.79 + 44.48, 0.21 + 21.06, 86.79 + 32.78, 0.21 + 44.41)

    const currentX1 = 86.79 + 32.78
    const currentY1 = 0.21 + 44.41
    ctx.bezierCurveTo(
      currentX1 - 3.33,
      currentY1 + 6.65,
      currentX1 - 10.11,
      currentY1 + 14.56,
      currentX1 - 17.61,
      currentY1 + 22.32,
    )

    const currentX2 = currentX1 - 17.61
    const currentY2 = currentY1 + 22.32
    ctx.bezierCurveTo(
      currentX2 - 8.23,
      currentY2 + 8.52,
      currentX2 - 17.34,
      currentY2 + 16.87,
      currentX2 - 23.72,
      currentY2 + 23.2,
    )

    const currentX3 = currentX2 - 23.72
    const currentY3 = currentY2 + 23.2
    ctx.lineTo(currentX3 - 17.4, currentY3 + 17.26)
    ctx.lineTo(46.46, 93.56)
    ctx.bezierCurveTo(29.16, 76.9, 0.95, 55.93, 0.02, 29.95)
    ctx.bezierCurveTo(-0.63, 11.75, 13.73, 0.09, 30.25, 0.3)
    ctx.bezierCurveTo(45.01, 0.5, 51.22, 7.84, 60.83, 17.19)
    ctx.closePath()

    ctx.restore()

    // Test if the tile position is inside this heart path
    const localX = dx + detectionSize / 2
    const localY = dy + detectionSize / 2

    return ctx.isPointInPath(localX, localY)
  }

  // Get all tiles within heart-shaped area around cursor
  const getTilesInHeartArea = (cursorX: number, cursorY: number, tiles: MosaicTile[], radius: number) => {
    return tiles.filter((tile) => isPointInHeartShape(tile.x, tile.y, cursorX, cursorY, radius))
  }

  // Function to check if a point is inside a polygon using ray casting
  const pointInPolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (
        polygon[i].y > y !== polygon[j].y > y &&
        x < ((polygon[j].x - polygon[i].x) * (y - polygon[i].y)) / (polygon[j].y - polygon[i].y) + polygon[i].x
      ) {
        inside = !inside
      }
    }
    return inside
  }

  // Function to determine which section of the logo a point is in
  const getLogoSection = (x: number, y: number, width: number, height: number) => {
    const logoScale = config.logoScale
    const logoWidth = 480 * logoScale
    const logoHeight = 320 * logoScale
    const logoLeft = width / 2 - logoWidth / 2
    const logoTop = height / 2 - logoHeight / 2

    const logoX = (x - logoLeft) / logoScale
    const logoY = (y - logoTop) / logoScale

    if (logoX < 0 || logoX > 480 || logoY < 0 || logoY > 320) {
      return { inLogo: false, section: null }
    }

    const shape1 = [
      { x: 320, y: 160 },
      { x: 320, y: 320 },
      { x: 480, y: 240 },
      { x: 480, y: 80 },
    ]

    const shape2 = [
      { x: 320, y: 0 },
      { x: 320, y: 160 },
      { x: 480, y: 80 },
    ]

    const shape3 = [
      { x: 160, y: 80 },
      { x: 160, y: 240 },
      { x: 320, y: 160 },
      { x: 320, y: 0 },
    ]

    const shape4 = [
      { x: 0, y: 0 },
      { x: 0, y: 160 },
      { x: 160, y: 240 },
      { x: 160, y: 80 },
    ]

    if (pointInPolygon(logoX, logoY, shape1)) return { inLogo: true, section: 1 }
    if (pointInPolygon(logoX, logoY, shape2)) return { inLogo: true, section: 2 }
    if (pointInPolygon(logoX, logoY, shape3)) return { inLogo: true, section: 3 }
    if (pointInPolygon(logoX, logoY, shape4)) return { inLogo: true, section: 4 }

    return { inLogo: false, section: null }
  }

  // Check if mouse is in mosaic area
  const isMouseInMosaic = (x: number, y: number, width: number, height: number) => {
    const logoInfo = getLogoSection(x, y, width, height)
    return logoInfo.inLogo
  }

  // Convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 }
  }

  // Smooth easing function
  const easeInOutCubic = (t: number) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // Realistic heartbeat easing - sharp attack, soft decay
  const heartbeatEasing = (t: number) => {
    if (t <= 0.3) {
      // Sharp attack - quick rise
      return Math.pow(t / 0.3, 0.5) // Square root for quick rise
    } else {
      // Soft decay - slow fall
      const decayT = (t - 0.3) / 0.7
      return Math.pow(1 - decayT, 2) // Quadratic decay for soft fall
    }
  }

  // Time-based heartbeat calculation - much more reliable
  const calculateMainHeartbeat = (currentTime: number, startTime: number) => {
    if (startTime === 0) return 0

    const timeSinceStart = currentTime - startTime
    const cyclePosition = timeSinceStart % HEARTBEAT_INTERVAL

    // Only beat during the first part of the cycle
    if (cyclePosition < HEARTBEAT_DURATION) {
      const beatProgress = cyclePosition / HEARTBEAT_DURATION
      return heartbeatEasing(beatProgress) * 1.3
    }

    return 0
  }

  // Ripple heartbeat - triggered by main heart beats
  const calculateRippleHeartbeat = (
    currentTime: number,
    lastRippleTime: number,
    rippleDelay: number,
    intensity: number,
  ) => {
    if (lastRippleTime === 0) return 0

    const timeSinceRipple = currentTime - lastRippleTime - rippleDelay
    if (timeSinceRipple < 0 || timeSinceRipple > RIPPLE_DURATION) return 0

    const beatPhase = timeSinceRipple / RIPPLE_DURATION
    return heartbeatEasing(beatPhase) * intensity
  }

  // Check if a tile is currently experiencing a ripple
  const isRippleActive = (tile: MosaicTile, currentTime: number) => {
    if (tile.lastRippleTime === 0) return false
    const timeSinceRipple = currentTime - tile.lastRippleTime - tile.rippleDelay
    return timeSinceRipple >= 0 && timeSinceRipple <= RIPPLE_DURATION
  }

  // Trigger ripple effect from main heart - MUCH MORE RELIABLE
  const triggerRipple = useCallback((mainHeartPos: { x: number; y: number }, currentTime: number) => {
    setTiles((prevTiles) =>
      prevTiles.map((tile) => {
        if (tile.isMainHeart) return tile

        const distance = Math.sqrt((tile.x - mainHeartPos.x) ** 2 + (tile.y - mainHeartPos.y) ** 2)
        const rippleLayer = Math.floor(distance / RIPPLE_LAYER_DISTANCE)

        // More lenient conditions for ripple triggering
        if (rippleLayer < RIPPLE_LAYERS) {
          // Check if this tile already has an active ripple
          const hasActiveRipple = isRippleActive(tile, currentTime)

          // Only trigger new ripple if no active ripple exists OR if enough time has passed
          const timeSinceLastRipple = currentTime - tile.lastRippleTime
          const canTriggerNewRipple = !hasActiveRipple || timeSinceLastRipple > RIPPLE_DURATION * 0.5

          if (canTriggerNewRipple) {
            const rippleDelay = distance / RIPPLE_SPEED
            const intensity = Math.max(0.3, 1 - rippleLayer * 0.15) // Higher base intensity, less falloff

            return {
              ...tile,
              lastRippleTime: currentTime,
              rippleDelay: rippleDelay,
              rippleIntensity: intensity,
            }
          }
        }

        return tile
      }),
    )
  }, [])

  // Draw either a circle or a heart - no blending
  const drawShape = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    morphProgress: number,
    beat: number,
  ) => {
    // Binary decision - either circle or heart
    const isHeart = morphProgress > 0.5

    ctx.save()
    ctx.translate(x, y)

    if (!isHeart) {
      // Pure circle
      ctx.beginPath()
      ctx.arc(0, 0, size, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Pure heart shape with dramatic heartbeat scaling
      const beatScale = 1 + beat * 0.4 // Increased from 0.35 to 0.4 for more dramatic effect
      const heartSize = size * beatScale

      const svgWidth = 122.88
      const svgHeight = 107.41
      const scale = (heartSize * 2) / Math.max(svgWidth, svgHeight)

      ctx.scale(scale, scale)
      ctx.translate(-svgWidth / 2, -svgHeight / 2)

      ctx.beginPath()
      // Your exact SVG path
      ctx.moveTo(60.83, 17.19)
      ctx.bezierCurveTo(68.84, 8.84, 74.45, 1.62, 86.79, 0.21)
      ctx.bezierCurveTo(86.79 + 23.17, 0.21 - 2.66, 86.79 + 44.48, 0.21 + 21.06, 86.79 + 32.78, 0.21 + 44.41)

      const currentX1 = 86.79 + 32.78
      const currentY1 = 0.21 + 44.41
      ctx.bezierCurveTo(
        currentX1 - 3.33,
        currentY1 + 6.65,
        currentX1 - 10.11,
        currentY1 + 14.56,
        currentX1 - 17.61,
        currentY1 + 22.32,
      )

      const currentX2 = currentX1 - 17.61
      const currentY2 = currentY1 + 22.32
      ctx.bezierCurveTo(
        currentX2 - 8.23,
        currentY2 + 8.52,
        currentX2 - 17.34,
        currentY2 + 16.87,
        currentX2 - 23.72,
        currentY2 + 23.2,
      )

      const currentX3 = currentX2 - 23.72
      const currentY3 = currentY2 + 23.2
      ctx.lineTo(currentX3 - 17.4, currentY3 + 17.26)
      ctx.lineTo(46.46, 93.56)
      ctx.bezierCurveTo(29.16, 76.9, 0.95, 55.93, 0.02, 29.95)
      ctx.bezierCurveTo(-0.63, 11.75, 13.73, 0.09, 30.25, 0.3)
      ctx.bezierCurveTo(45.01, 0.5, 51.22, 7.84, 60.83, 17.19)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  // Initialize tiles - simplified
  useEffect(() => {
    const generateTiles = () => {
      const newTiles: MosaicTile[] = []
      const { width, height } = dimensions

      const { logoScale, tileRadius, tileSpacing } = config

      const cols = Math.floor(width / tileSpacing)
      const rows = Math.floor(height / tileSpacing)

      const offsetX = (width - (cols - 1) * tileSpacing) / 2
      const offsetY = (height - (rows - 1) * tileSpacing) / 2

      let tileIndex = 0

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = offsetX + i * tileSpacing
          const y = offsetY + j * tileSpacing

          const logoInfo = getLogoSection(x, y, width, height)

          if (logoInfo.inLogo) {
            const section = logoInfo.section
            const originalColor =
              section === 2 || section === 4 ? BUILDKITE_COLORS.lightGreen : BUILDKITE_COLORS.darkGreen
            const hoverColor =
              section === 2 || section === 4
                ? lightGreenHoverColors[Math.floor(Math.random() * lightGreenHoverColors.length)]
                : darkGreenHoverColors[Math.floor(Math.random() * darkGreenHoverColors.length)]

            const originalRgb = hexToRgb(originalColor)

            newTiles.push({
              id: `tile-${tileIndex}`,
              radius: tileRadius,
              color: originalColor,
              originalColor,
              hoverColor,
              x,
              y,
              centerX: x,
              centerY: y,
              originalCenterX: x,
              originalCenterY: y,
              section,
              animationOffset: Math.random() * Math.PI * 2,
              floatDistance: 1 + Math.random() * 2,
              isClosest: false,
              isTouchingHovered: false,
              distanceFromCursor: Number.POSITIVE_INFINITY,
              zIndex: 1,
              glowIntensity: 0,
              scale: 1,
              morphProgress: 0,
              targetMorphProgress: 0,
              morphStartTime: 0,
              morphStartProgress: 0,
              transitionDelay: 0,
              transitionDuration: HOVER_ON_TRANSITION_TIME,
              heartBeat: 0,
              heartBeatPhase: Math.random() * Math.PI * 2,
              heartBeatSpeed: 0.8 + Math.random() * 0.4,
              isMainHeart: false,
              lastRippleTime: 0,
              rippleDelay: 0,
              rippleIntensity: 0,
              originalR: originalRgb.r,
              originalG: originalRgb.g,
              originalB: originalRgb.b,
              targetR: originalRgb.r,
              targetG: originalRgb.g,
              targetB: originalRgb.b,
              sparkleTimer: 0,
              sparkleInterval: SPARKLE_MIN_INTERVAL + Math.random() * (SPARKLE_MAX_INTERVAL - SPARKLE_MIN_INTERVAL),
              sparkleColorIndex: Math.floor(Math.random() * heartColors.length),
              nextSparkleTime: 0,
              squeezeLayer: -1,
              colorTransitionStartTime: 0,
              isTransitioning: false,
              lastUpdateTime: 0,
            })

            tileIndex++
          }
        }
      }

      setTiles(newTiles)
    }

    generateTiles()
  }, [dimensions, config])

  // Progressive squeeze calculation - simplified
  const calculateProgressiveDisplacements = useCallback(
    (tiles: MosaicTile[], mainHeartPos: { x: number; y: number } | null) => {
      const displacements = new Map<string, { x: number; y: number; sizeMultiplier: number }>()

      // Initialize displacements
      tiles.forEach((tile) => {
        displacements.set(tile.id, { x: 0, y: 0, sizeMultiplier: 1 })
      })

      if (!mainHeartPos) return displacements

      // First pass: Assign squeeze layers based on distance from main heart
      tiles.forEach((tile) => {
        if (tile.isMainHeart) {
          tile.squeezeLayer = -1 // Main heart has no layer
          displacements.set(tile.id, { x: 0, y: 0, sizeMultiplier: 2.2 }) // Biggest
          return
        }

        const distance = Math.sqrt((tile.x - mainHeartPos.x) ** 2 + (tile.y - mainHeartPos.y) ** 2)

        // Find which squeeze layer this tile belongs to
        let layer = -1
        for (let i = 0; i < SQUEEZE_LAYERS.length; i++) {
          if (distance <= SQUEEZE_LAYERS[i].maxDistance) {
            layer = i
            break
          }
        }

        tile.squeezeLayer = layer

        if (layer >= 0) {
          const layerConfig = SQUEEZE_LAYERS[layer]
          displacements.set(tile.id, {
            x: 0,
            y: 0,
            sizeMultiplier: layerConfig.sizeMultiplier * tile.morphProgress + (1 - tile.morphProgress),
          })
        }
      })

      // Second pass: Calculate progressive pushing from inner to outer layers
      for (let currentLayer = 0; currentLayer < SQUEEZE_LAYERS.length; currentLayer++) {
        const currentLayerTiles = tiles.filter((tile) => tile.squeezeLayer === currentLayer)
        const layerConfig = SQUEEZE_LAYERS[currentLayer]

        currentLayerTiles.forEach((tile) => {
          const tileDisp = displacements.get(tile.id)!

          // Push away from main heart
          const dx = tile.x - mainHeartPos.x
          const dy = tile.y - mainHeartPos.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance > 0) {
            const pushDirection = { x: dx / distance, y: dy / distance }
            const pushAmount = layerConfig.pushForce * tile.morphProgress

            tileDisp.x += pushDirection.x * pushAmount
            tileDisp.y += pushDirection.y * pushAmount
          }

          // Also push away from tiles in inner layers (cascading effect)
          for (let innerLayer = currentLayer - 1; innerLayer >= 0; innerLayer--) {
            const innerTiles = tiles.filter((tile) => tile.squeezeLayer === innerLayer)

            innerTiles.forEach((innerTile) => {
              const innerDisp = displacements.get(innerTile.id)!
              const dx = tile.x - (innerTile.x + innerDisp.x)
              const dy = tile.y - (innerTile.y + innerDisp.y)
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance > 0 && distance < 30) {
                // Only if close enough
                const pushDirection = { x: dx / distance, y: dy / distance }
                const pushAmount = (30 - distance) * 0.3 * tile.morphProgress

                tileDisp.x += pushDirection.x * pushAmount
                tileDisp.y += pushDirection.y * pushAmount
              }
            })
          }
        })
      }

      return displacements
    },
    [],
  )

  // Canvas drawing function - simplified
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height)

      // Find main heart position
      const mainHeart = tiles.find((tile) => tile.isMainHeart)
      const mainHeartPos = mainHeart ? { x: mainHeart.x, y: mainHeart.y } : null

      // Calculate progressive displacements
      const displacements = calculateProgressiveDisplacements(tiles, mainHeartPos)

      // Sort tiles by z-index to ensure proper layering
      const sortedTiles = [...tiles].sort((a, b) => a.zIndex - b.zIndex)

      // Handle main heart timing - IMPROVED RIPPLE TRIGGERING
      if (mainHeart && mainHeart.morphProgress > 0.5) {
        // Initialize start time if not set
        if (mainHeartStartTime.current === 0) {
          mainHeartStartTime.current = currentTime
          lastRippleTriggerTime.current = 0 // Reset ripple trigger tracking
        }

        // Calculate heartbeat based on time
        mainHeart.heartBeat = calculateMainHeartbeat(currentTime, mainHeartStartTime.current)

        // More reliable ripple triggering - check for heartbeat cycle boundaries
        const timeSinceStart = currentTime - mainHeartStartTime.current
        const currentCycle = Math.floor(timeSinceStart / HEARTBEAT_INTERVAL)
        const cycleStartTime = mainHeartStartTime.current + currentCycle * HEARTBEAT_INTERVAL
        const timeSinceCycleStart = currentTime - cycleStartTime

        // Trigger ripple at the very beginning of each heartbeat cycle
        // Only trigger once per cycle and ensure we haven't already triggered for this cycle
        const shouldTriggerRipple =
          timeSinceCycleStart < 50 && // Within first 50ms of cycle
          (lastRippleTriggerTime.current === 0 ||
            currentTime - lastRippleTriggerTime.current > HEARTBEAT_INTERVAL * 0.8) // Enough time since last trigger

        if (shouldTriggerRipple && mainHeartPos) {
          triggerRipple(mainHeartPos, currentTime)
          lastRippleTriggerTime.current = currentTime
        }
      } else {
        // Reset start time when main heart is not active
        mainHeartStartTime.current = 0
        lastRippleTriggerTime.current = 0
      }

      sortedTiles.forEach((tile) => {
        ctx.save()

        // Handle sparkly random transitions for surrounding hearts
        if (tile.isTouchingHovered && !tile.isMainHeart && tile.morphProgress > 0.5) {
          if (currentTime > tile.nextSparkleTime) {
            // Time for a sparkle transition
            tile.sparkleColorIndex = Math.floor(Math.random() * heartColors.length)
            const newColor = heartColors[tile.sparkleColorIndex]
            const newColorRgb = hexToRgb(newColor)

            // Start a quick color transition
            tile.targetR = newColorRgb.r
            tile.targetG = newColorRgb.g
            tile.targetB = newColorRgb.b
            tile.morphStartTime = currentTime
            tile.morphStartProgress = tile.morphProgress
            tile.transitionDuration = SPARKLE_TRANSITION_TIME

            // Set next sparkle time
            tile.nextSparkleTime =
              currentTime + SPARKLE_MIN_INTERVAL + Math.random() * (SPARKLE_MAX_INTERVAL - SPARKLE_MIN_INTERVAL)
          }
        }

        // Get displacement for this tile
        const displacement = displacements.get(tile.id) || { x: 0, y: 0, sizeMultiplier: 1 }

        // Apply displacement to center position
        tile.centerX = tile.x + displacement.x
        tile.centerY = tile.y + displacement.y

        // Calculate base floating animation - DISABLE FOR MAIN HEART
        let drawX = tile.centerX
        let drawY = tile.centerY

        if (!tile.isMainHeart) {
          // Only apply floating animation to non-main hearts
          const floatOffset = Math.sin(currentTime * 0.001 + tile.animationOffset) * tile.floatDistance
          drawX += floatOffset * 0.5
          drawY += floatOffset
        }

        // Update heartbeat animation
        if (tile.morphProgress > 0.5) {
          if (!tile.isMainHeart) {
            // Surrounding hearts use ripple effect
            tile.heartBeat = calculateRippleHeartbeat(
              currentTime,
              tile.lastRippleTime,
              tile.rippleDelay,
              tile.rippleIntensity,
            )
          }
          // Main heart beat is calculated above
        } else {
          tile.heartBeat = 0
        }

        // Handle smooth morphing transition with delay
        if (tile.morphStartTime > 0) {
          const elapsed = currentTime - tile.morphStartTime - tile.transitionDelay

          if (elapsed >= 0) {
            // Only start transition after delay
            const progress = Math.min(elapsed / tile.transitionDuration, 1)

            // Smooth interpolation from start to target
            tile.morphProgress =
              tile.morphStartProgress + (tile.targetMorphProgress - tile.morphStartProgress) * easeInOutCubic(progress)

            if (progress >= 1) {
              tile.morphStartTime = 0
              tile.morphProgress = tile.targetMorphProgress
              tile.isTransitioning = false
            } else {
              tile.isTransitioning = true
            }
          }
        }

        // Calculate color - PERFECTLY synchronized with shape
        let r, g, b
        if (tile.morphProgress > 0.5 && tile.isTouchingHovered) {
          // When it's a heart, use pure vibrant colors (no mixing with green)
          r = tile.targetR
          g = tile.targetG
          b = tile.targetB
        } else {
          // When transitioning or as circles, interpolate normally
          // Use the EXACT same progress as morphing for perfect sync
          const colorProgress = tile.morphProgress
          r = Math.round(tile.originalR + colorProgress * (tile.targetR - tile.originalR))
          g = Math.round(tile.originalG + colorProgress * (tile.targetG - tile.originalG))
          b = Math.round(tile.originalB + colorProgress * (tile.targetB - tile.originalB))
        }

        // Use calculated color directly
        const currentColor = `rgb(${r}, ${g}, ${b})`

        // Set up glow effect
        if (tile.glowIntensity > 0) {
          ctx.shadowColor = currentColor
          ctx.shadowBlur = tile.glowIntensity * 10
        } else {
          ctx.shadowBlur = 0
        }

        // Set colors
        ctx.fillStyle = currentColor

        // Calculate final size using progressive displacement size multiplier
        const baseSize = tile.radius
        const heartSize = baseSize * HEART_SIZE_MULTIPLIER

        // Binary decision - either circle or heart size
        const isHeart = tile.morphProgress > 0.5
        const size = isHeart ? heartSize : baseSize

        const finalSize = size * displacement.sizeMultiplier

        drawShape(ctx, drawX, drawY, finalSize, tile.morphProgress, tile.heartBeat)

        // Update last update time
        tile.lastUpdateTime = currentTime

        ctx.restore()
      })
    },
    [tiles, dimensions, calculateProgressiveDisplacements, triggerRipple],
  )

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const animate = (currentTime: number) => {
      draw(ctx, currentTime)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw])

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * dimensions.width
      const y = ((event.clientY - rect.top) / rect.height) * dimensions.height

      const now = performance.now()
      if (now - lastUpdateTime.current < 16) return
      lastUpdateTime.current = now

      const inMosaic = isMouseInMosaic(x, y, dimensions.width, dimensions.height)

      setTiles((prevTiles) => {
        if (!inMosaic) {
          // Mouse is outside mosaic - reset everything
          mainHeartStartTime.current = 0 // Reset heartbeat timing
          lastRippleTriggerTime.current = 0 // Reset ripple trigger tracking
          return prevTiles.map((tile) => {
            // Only start reset transition if not already resetting and currently animated
            const needsReset = tile.targetMorphProgress !== 0 && !tile.isTransitioning

            return {
              ...tile,
              isClosest: false,
              isTouchingHovered: false,
              distanceFromCursor: Number.POSITIVE_INFINITY,
              zIndex: 1,
              glowIntensity: 0,
              scale: 1,
              isMainHeart: false,
              targetMorphProgress: 0,
              morphStartTime: needsReset ? now : tile.morphStartTime,
              morphStartProgress: needsReset ? tile.morphProgress : tile.morphStartProgress,
              transitionDelay: 0,
              transitionDuration: HOVER_OFF_TRANSITION_TIME,
              targetR: tile.originalR,
              targetG: tile.originalG,
              targetB: tile.originalB,
              nextSparkleTime: 0,
              squeezeLayer: -1,
              lastRippleTime: 0,
              rippleDelay: 0,
              rippleIntensity: 0,
              colorTransitionStartTime: needsReset ? now : tile.colorTransitionStartTime,
              isTransitioning: needsReset ? true : tile.isTransitioning,
            }
          })
        }

        // Use optimized heart-shaped detection for both areas
        const mainHeartCandidates = getTilesInHeartArea(x, y, prevTiles, config.mainHeartRadius)
        const surroundingHeartCandidates = getTilesInHeartArea(x, y, prevTiles, config.surroundingHeartRadius)

        // Find the closest tile within main heart area
        let closestTile: MosaicTile | null = null
        let closestDistance = Number.POSITIVE_INFINITY

        mainHeartCandidates.forEach((tile) => {
          const distance = Math.sqrt((tile.x - x) ** 2 + (tile.y - y) ** 2)
          if (distance < closestDistance) {
            closestDistance = distance
            closestTile = tile
          }
        })

        return prevTiles.map((tile) => {
          const distance = Math.sqrt((tile.x - x) ** 2 + (tile.y - y) ** 2)
          const isInMainHeartArea = mainHeartCandidates.includes(tile)
          const isInSurroundingArea = surroundingHeartCandidates.includes(tile)
          const isClosest = tile.id === closestTile?.id

          if (isClosest && isInMainHeartArea) {
            // Main heart - closest tile within heart-shaped area
            const hoverRgb = hexToRgb(HOVERED_HEART_COLOR)
            const needsTransition = Math.abs(tile.targetMorphProgress - 1) > 0.05 && !tile.isTransitioning

            // Initialize heartbeat timing when main heart becomes active
            if (!tile.isMainHeart && mainHeartStartTime.current === 0) {
              mainHeartStartTime.current = now
              lastRippleTriggerTime.current = 0
            }

            return {
              ...tile,
              isClosest: true,
              isTouchingHovered: true,
              distanceFromCursor: distance,
              zIndex: 1000,
              glowIntensity: 1,
              scale: 1.0,
              isMainHeart: true,
              targetMorphProgress: 1,
              morphStartTime: needsTransition ? now : tile.morphStartTime,
              morphStartProgress: needsTransition ? tile.morphProgress : tile.morphStartProgress,
              transitionDelay: 0,
              transitionDuration: MAIN_HEART_TRANSITION_TIME,
              targetR: hoverRgb.r,
              targetG: hoverRgb.g,
              targetB: hoverRgb.b,
              nextSparkleTime: 0,
              squeezeLayer: -1,
              lastRippleTime: 0,
              rippleDelay: 0,
              rippleIntensity: 0,
              colorTransitionStartTime: needsTransition ? now : tile.colorTransitionStartTime,
              isTransitioning: needsTransition ? true : tile.isTransitioning,
            }
          } else if (isInSurroundingArea) {
            // Surrounding hearts - within heart-shaped area
            const intensity = Math.max(0, 1 - distance / config.surroundingHeartRadius)
            const hoverRgb = hexToRgb(tile.hoverColor)
            const targetMorph = Math.max(0.8, intensity)

            const needsTransition = tile.targetMorphProgress < 0.5 && targetMorph >= 0.5 && !tile.isTransitioning

            // Reduced transition delay for faster response
            const transitionLayer = Math.floor(distance / 25)
            const transitionDelay = needsTransition
              ? transitionLayer * TRANSITION_DELAY_INCREMENT
              : tile.transitionDelay

            return {
              ...tile,
              isClosest: false,
              isTouchingHovered: true,
              distanceFromCursor: distance,
              zIndex: 500 + Math.floor(intensity * 400),
              glowIntensity: intensity * 0.8,
              scale: 1.0,
              isMainHeart: false,
              targetMorphProgress: targetMorph,
              morphStartTime: needsTransition ? now : tile.morphStartTime,
              morphStartProgress: needsTransition ? tile.morphProgress : tile.morphStartProgress,
              transitionDelay: transitionDelay,
              transitionDuration: HOVER_ON_TRANSITION_TIME,
              targetR: hoverRgb.r,
              targetG: hoverRgb.g,
              targetB: hoverRgb.b,
              nextSparkleTime: needsTransition ? now + tile.sparkleInterval : tile.nextSparkleTime,
              squeezeLayer: -1,
              colorTransitionStartTime: needsTransition ? now : tile.colorTransitionStartTime,
              isTransitioning: needsTransition ? true : tile.isTransitioning,
            }
          } else {
            // Reset to dots - ONLY if not currently transitioning
            const needsReset = tile.targetMorphProgress !== 0 && !tile.isTransitioning

            return {
              ...tile,
              isClosest: false,
              isTouchingHovered: false,
              distanceFromCursor: distance,
              zIndex: 1,
              glowIntensity: 0,
              scale: 1,
              isMainHeart: false,
              targetMorphProgress: 0,
              morphStartTime: needsReset ? now : tile.morphStartTime,
              morphStartProgress: needsReset ? tile.morphProgress : tile.morphStartProgress,
              transitionDelay: 0,
              transitionDuration: HOVER_OFF_TRANSITION_TIME,
              targetR: tile.originalR,
              targetG: tile.originalG,
              targetB: tile.originalB,
              nextSparkleTime: 0,
              squeezeLayer: -1,
              lastRippleTime: 0,
              rippleDelay: 0,
              rippleIntensity: 0,
              colorTransitionStartTime: needsReset ? now : tile.colorTransitionStartTime,
              isTransitioning: needsReset ? true : tile.isTransitioning,
            }
          }
        })
      })
    },
    [dimensions, config],
  )

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    const now = performance.now()
    mainHeartStartTime.current = 0 // Reset heartbeat timing
    lastRippleTriggerTime.current = 0 // Reset ripple trigger tracking

    setTiles((prevTiles) =>
      prevTiles.map((tile) => {
        const needsReset = tile.targetMorphProgress !== 0 && !tile.isTransitioning

        return {
          ...tile,
          isClosest: false,
          isTouchingHovered: false,
          distanceFromCursor: Number.POSITIVE_INFINITY,
          zIndex: 1,
          glowIntensity: 0,
          scale: 1,
          isMainHeart: false,
          targetMorphProgress: 0,
          morphStartTime: needsReset ? now : tile.morphStartTime,
          morphStartProgress: needsReset ? tile.morphProgress : tile.morphStartProgress,
          transitionDelay: 0,
          transitionDuration: HOVER_OFF_TRANSITION_TIME,
          targetR: tile.originalR,
          targetG: tile.originalG,
          targetB: tile.originalB,
          nextSparkleTime: 0,
          squeezeLayer: -1,
          lastRippleTime: 0,
          rippleDelay: 0,
          rippleIntensity: 0,
          colorTransitionStartTime: needsReset ? now : tile.colorTransitionStartTime,
          isTransitioning: needsReset ? true : tile.isTransitioning,
        }
      }),
    )
  }, [])

  // Handle canvas resize - simplified
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }

      setDimensions({ width: rect.width, height: rect.height })

      // Simple config switching - only when needed
      const newConfig = getSimpleConfig(rect.width)
      if (newConfig !== config) {
        setConfig(newConfig)
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [config])

  return (
    <div className="h-screen w-full bg-gray-900 flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  )
}
