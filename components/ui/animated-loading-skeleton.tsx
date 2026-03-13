'use client'

import React, { useEffect, useState } from 'react'
import { motion, useAnimation, type Variants } from 'framer-motion'

interface GridConfig {
  numCards: number
  cols: number
  xBase: number
  yBase: number
  xStep: number
  yStep: number
}

const AnimatedLoadingSkeleton = () => {
  const [windowWidth, setWindowWidth] = useState(0)
  const controls = useAnimation()

  const getGridConfig = (width: number): GridConfig => {
    const numCards = 8
    const cols = width >= 1024 ? 4 : width >= 640 ? 3 : 2
    return {
      numCards,
      cols,
      xBase: 40,
      yBase: 60,
      xStep: width >= 1024 ? 200 : 170,
      yStep: 230,
    }
  }

  const generateSearchPath = (config: GridConfig) => {
    const { numCards, cols, xBase, yBase, xStep, yStep } = config
    const rows = Math.ceil(numCards / cols)
    const allPositions: { x: number; y: number }[] = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row * cols + col < numCards) {
          allPositions.push({
            x: xBase + col * xStep,
            y: yBase + row * yStep,
          })
        }
      }
    }

    const numRandomCards = 5
    const shuffledPositions = allPositions
      .sort(() => Math.random() - 0.5)
      .slice(0, numRandomCards)

    shuffledPositions.push(shuffledPositions[0])

    return {
      x: shuffledPositions.map((pos) => pos.x),
      y: shuffledPositions.map((pos) => pos.y),
      scale: Array(shuffledPositions.length).fill(1.2) as number[],
      transition: {
        duration: shuffledPositions.length * 1.8,
        repeat: Infinity,
        ease: 'easeInOut' as const,
        times: shuffledPositions.map((_, i) => i / (shuffledPositions.length - 1)),
      },
    }
  }

  useEffect(() => {
    setWindowWidth(window.innerWidth)
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (windowWidth === 0) return
    const config = getGridConfig(windowWidth)
    controls.start(generateSearchPath(config))
  }, [windowWidth, controls])

  const frameVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  const cardVariants: Variants = {
    hidden: { y: 16, opacity: 0 },
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.07, duration: 0.35 },
    }),
  }

  const config = getGridConfig(windowWidth)

  // Dark shimmer colors mapped to --surface / --card
  const shimmerFrom = '#101824'
  const shimmerTo = '#1e2d3d'

  return (
    <motion.div
      className="w-full"
      variants={frameVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header skeleton */}
      <div className="mb-8">
        <motion.div
          className="h-9 w-72 rounded-lg mb-3"
          style={{ background: shimmerFrom }}
          animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="h-4 w-96 rounded-md"
          style={{ background: shimmerFrom }}
          animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
        />
        {/* Button skeletons */}
        <div className="flex gap-3 mt-5">
          <motion.div
            className="h-8 w-40 rounded-lg"
            style={{ background: shimmerFrom }}
            animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
          />
          <motion.div
            className="h-8 w-32 rounded-lg"
            style={{ background: shimmerFrom }}
            animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
          />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <motion.div
        className="rounded-2xl p-5 mb-7 flex gap-3 flex-wrap items-end"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {[280, 180, 160, 100].map((w, i) => (
          <motion.div
            key={i}
            className="h-10 rounded-lg"
            style={{ width: w, background: shimmerFrom }}
            animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
          />
        ))}
      </motion.div>

      {/* Product grid with animated search icon */}
      <div className="relative">
        {/* Animated search cursor */}
        <motion.div
          className="absolute z-10 pointer-events-none"
          animate={controls}
          style={{ left: 20, top: 20 }}
        >
          <motion.div
            className="p-3 rounded-full"
            style={{ background: 'rgba(47,129,247,0.15)', backdropFilter: 'blur(8px)' }}
            animate={{
              boxShadow: [
                '0 0 16px rgba(47,129,247,0.25)',
                '0 0 32px rgba(47,129,247,0.5)',
                '0 0 16px rgba(47,129,247,0.25)',
              ],
              scale: [1, 1.12, 1],
            }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: 'var(--accent2)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </motion.div>
        </motion.div>

        {/* Product card skeletons */}
        <div className="products-grid">
          {[...Array(config.numCards)].map((_, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={i}
              className="product-card"
              style={{ pointerEvents: 'none' }}
            >
              {/* Image placeholder */}
              <div className="product-card-img">
                <motion.div
                  className="w-full h-full"
                  style={{ background: shimmerFrom }}
                  animate={{
                    background: [shimmerFrom, '#141e2c', shimmerTo, '#141e2c', shimmerFrom],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
                />
                {/* Badge skeleton */}
                <div className="product-card-badges">
                  <motion.div
                    className="h-5 w-14 rounded-full"
                    style={{
                      background: 'rgba(47,129,247,0.12)',
                      border: '1px solid rgba(47,129,247,0.2)',
                    }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.1 }}
                  />
                </div>
              </div>

              {/* Card body */}
              <div className="product-card-body">
                {/* Title lines */}
                <motion.div
                  className="h-4 rounded-md"
                  style={{ width: '85%', background: shimmerFrom }}
                  animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
                />
                <motion.div
                  className="h-4 rounded-md"
                  style={{ width: '65%', background: shimmerFrom }}
                  animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 + 0.1 }}
                />

                {/* Price placeholder */}
                <motion.div
                  className="h-6 w-24 rounded-md mt-1"
                  style={{
                    background: 'rgba(37,211,102,0.08)',
                    border: '1px solid rgba(37,211,102,0.1)',
                  }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.08 }}
                />

                {/* Meta badges */}
                <div className="flex gap-2 mt-auto flex-wrap">
                  <motion.div
                    className="h-5 w-16 rounded-full"
                    style={{ background: shimmerFrom }}
                    animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.06 + 0.2 }}
                  />
                  <motion.div
                    className="h-5 w-12 rounded-full"
                    style={{ background: shimmerFrom }}
                    animate={{ background: [shimmerFrom, shimmerTo, shimmerFrom] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.06 + 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default AnimatedLoadingSkeleton
