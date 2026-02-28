/**
 * 3D Audio Visualizer Component
 * 
 * WebGL-powered frequency bars using expo-gl + three.js + @react-three/fiber.
 * Gradient colors: Gold (bass) → Purple (mids) → Cyan (treble)
 * Smooth 60fps animation with lerped bar heights.
 * 
 * Falls back to a 2D bar visualizer in Expo Go where expo-gl native module
 * (ExponentGLObjectManager) is not available.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ILOWA_COLORS } from '../theme/colors';

// Detect if expo-gl native module is available (not available in Expo Go)
let hasGL = false;
let Canvas: any = null;
let useFrame: any = null;
let THREE: any = null;

try {
  const expoGL = require('expo-gl');
  hasGL = !!expoGL?.GLView;
  if (hasGL) {
    const fiber = require('@react-three/fiber/native');
    Canvas = fiber.Canvas;
    useFrame = fiber.useFrame;
    THREE = require('three');
  }
} catch {
  hasGL = false;
}

interface AudioVisualizer3DProps {
  isPlaying: boolean;
  barCount?: number;
  height?: number;
  style?: any;
}

// ── 3D Frequency Bars (only used when GL is available) ───────────
function FrequencyBars({ frequencies, barCount }: { frequencies: number[]; barCount: number }) {
  const meshRefs = useRef<any[]>([]);
  const materialRefs = useRef<any[]>([]);

  const barData = useMemo(() => {
    const data = [];
    const totalWidth = barCount * 0.7;
    for (let i = 0; i < barCount; i++) {
      const position = i / barCount;
      const x = (i * 0.7) - totalWidth / 2 + 0.35;
      
      // Color: Gold (bass) → Purple (mids) → Cyan (treble)
      let color: string;
      if (position < 0.33) {
        color = '#FFD700';
      } else if (position < 0.66) {
        color = '#8B5CF6';
      } else {
        color = '#00D9FF';
      }
      
      data.push({ x, color });
    }
    return data;
  }, [barCount]);

  useFrame(() => {
    meshRefs.current.forEach((mesh: any, i: number) => {
      if (mesh) {
        const targetY = Math.max(0.1, frequencies[i] * 8);
        mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetY, 0.2);
        mesh.position.y = mesh.scale.y / 2;
      }
    });
  });

  return (
    <group>
      {barData.map((bar, i) => (
        <mesh
          key={i}
          ref={(el: any) => { meshRefs.current[i] = el; }}
          position={[bar.x, 0, 0]}
        >
          <boxGeometry args={[0.5, 1, 0.5]} />
          <meshStandardMaterial
            ref={(el: any) => { materialRefs.current[i] = el; }}
            color={bar.color}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Premium Translucent Wave Visualizer (for Expo Go) ─────────────────────────
function FallbackVisualizer({ frequencies, barCount, height }: { frequencies: number[]; barCount: number; height: number }) {
  const LinearGradient = require('expo-linear-gradient').LinearGradient;
  const barWidth = 100 / barCount;

  // Create smooth wave path points
  const wavePoints = frequencies.map((freq, i) => {
    const position = i / barCount;
    return {
      height: Math.max(8, freq * height * 0.9),
      position,
      // Smooth color transition
      colors: position < 0.33 
        ? ['rgba(255, 215, 0, 0.9)', 'rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.05)']
        : position < 0.66
        ? ['rgba(139, 92, 246, 0.9)', 'rgba(139, 92, 246, 0.3)', 'rgba(139, 92, 246, 0.05)']
        : ['rgba(0, 217, 255, 0.9)', 'rgba(0, 217, 255, 0.3)', 'rgba(0, 217, 255, 0.05)'],
    };
  });

  return (
    <View style={[styles.fallbackContainer, { height }]}>
      {/* Background glow layer */}
      <View style={styles.glowLayer}>
        {wavePoints.map((point, i) => (
          <View
            key={`glow-${i}`}
            style={{
              width: `${barWidth}%`,
              height: point.height * 1.4,
              opacity: 0.15,
            }}
          >
            <LinearGradient
              colors={point.colors}
              style={{ flex: 1, borderRadius: 20 }}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
            />
          </View>
        ))}
      </View>
      
      {/* Main wave bars */}
      <View style={styles.waveContainer}>
        {wavePoints.map((point, i) => (
          <View
            key={i}
            style={{
              width: `${barWidth * 0.65}%`,
              height: point.height,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={point.colors}
              style={styles.waveBar}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
            />
            {/* Inner highlight for glass effect */}
            <View style={styles.waveHighlight} />
          </View>
        ))}
      </View>
      
      {/* Reflection layer */}
      <View style={styles.reflectionLayer}>
        {wavePoints.map((point, i) => (
          <View
            key={`ref-${i}`}
            style={{
              width: `${barWidth * 0.65}%`,
              height: point.height * 0.3,
              opacity: 0.2,
              transform: [{ scaleY: -1 }],
            }}
          >
            <LinearGradient
              colors={[point.colors[2], 'transparent']}
              style={{ flex: 1, borderRadius: 8 }}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export function AudioVisualizer3D({
  isPlaying,
  barCount = 32,
  height = 150,
  style,
}: AudioVisualizer3DProps) {
  const [frequencies, setFrequencies] = useState<number[]>(
    Array(barCount).fill(0)
  );
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setFrequencies(Array(barCount).fill(0));
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Simulate FFT frequencies with bass boost
    animationRef.current = setInterval(() => {
      const time = Date.now() / 1000;
      const newFreqs = Array.from({ length: barCount }, (_, i) => {
        const position = i / barCount;
        const bassBoost = position < 0.33 ? 1.5 : position < 0.66 ? 1.2 : 1;
        const wave1 = Math.sin(time * 3 + i * 0.4) * 0.2;
        const wave2 = Math.cos(time * 5 + i * 0.2) * 0.15;
        const random = Math.random() * 0.3;
        return Math.max(0, Math.min(1, (0.4 + wave1 + wave2 + random) * bassBoost));
      });
      setFrequencies(newFreqs);
    }, 50);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, barCount]);

  // Use 3D Canvas if GL is available, otherwise fall back to 2D bars
  if (hasGL && Canvas) {
    return (
      <View style={[styles.container, { height }, style]}>
        <Canvas
          camera={{ position: [0, 6, 14], fov: 50 }}
          style={styles.canvas}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} color="#FFD700" intensity={0.8} />
          <pointLight position={[-10, 8, -5]} color="#8B5CF6" intensity={0.5} />
          <pointLight position={[0, 5, -10]} color="#00D9FF" intensity={0.5} />
          <FrequencyBars frequencies={frequencies} barCount={barCount} />
        </Canvas>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <FallbackVisualizer frequencies={frequencies} barCount={barCount} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 15, 0.8)',
  },
  canvas: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  glowLayer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    zIndex: 2,
  },
  waveBar: {
    flex: 1,
    borderRadius: 12,
  },
  waveHighlight: {
    position: 'absolute',
    top: 2,
    left: '15%',
    right: '50%',
    height: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 10,
  },
  reflectionLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    opacity: 0.3,
  },
});

export default AudioVisualizer3D;
