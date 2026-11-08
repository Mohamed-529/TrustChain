/**
 * LuminousWaveCanvas — 60fps High-DPI Canvas Rendering
 *
 * Implements:
 * 1. Deep obsidian backdrop with subtle dynamic depth particles.
 * 2. Ethereal luminous blue/cyan sine wave & energy arc emerging from darkness.
 * 3. Mouse-responsive parallax and energy pulse.
 * 4. Respects `prefers-reduced-motion` with an elegant static luminous render.
 * 5. Memory-safe: cancels requestAnimationFrame on unmount.
 */

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  vx: number;
  vy: number;
  pulseSpeed: number;
  pulsePhase: number;
}

interface LuminousWaveCanvasProps {
  className?: string;
  intensity?: number; // 0.0 to 1.0 (controls wave energy)
  interactive?: boolean;
}

export function LuminousWaveCanvas({
  className = '',
  intensity = 1.0,
  interactive = true,
}: LuminousWaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth ?? window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight ?? window.innerHeight);

    // Check system preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Resize listener with High-DPI support
    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = canvas.parentElement?.clientWidth ?? window.innerWidth;
      const displayHeight = canvas.parentElement?.clientHeight ?? window.innerHeight;

      width = displayWidth;
      height = displayHeight;
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Interactive mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Initialize depth particles
    const particleCount = prefersReducedMotion ? 25 : 65;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const z = Math.random() * 0.8 + 0.2; // depth factor
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        radius: (Math.random() * 1.5 + 0.8) * z,
        baseAlpha: Math.random() * 0.45 + 0.15,
        alpha: 0.3,
        vx: (Math.random() - 0.5) * 0.25 * z,
        vy: (Math.random() - 0.5) * 0.25 * z,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.015;

      // 1. Ultra-deep obsidian background
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle radial atmospheric lighting
      const gradBg = ctx.createRadialGradient(
        width * 0.5,
        height * 0.4,
        50,
        width * 0.5,
        height * 0.45,
        Math.max(width, height) * 0.75
      );
      gradBg.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
      gradBg.addColorStop(0.5, 'rgba(6, 12, 28, 0.4)');
      gradBg.addColorStop(1, 'rgba(2, 4, 10, 0.95)');
      ctx.fillStyle = gradBg;
      ctx.fillRect(0, 0, width, height);

      // 3. Render depth particles
      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Wrap edges
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Pulse brightness
          p.pulsePhase += p.pulseSpeed;
          p.alpha = p.baseAlpha + Math.sin(p.pulsePhase) * 0.12;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        // Cyan-indigo depth tints
        ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.05, p.alpha * intensity)})`;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = p.radius * 3;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 4. Render Luminous Blue/Cyan Wave & Energy Arc
      const waveCount = 3;
      const centerY = height * 0.55;

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const waveOffset = w * 0.45;
        const currentIntensity = intensity * (1 - w * 0.22);

        // Gradient for each wave line
        const waveGrad = ctx.createLinearGradient(0, centerY - 100, width, centerY + 100);
        if (w === 0) {
          waveGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
          waveGrad.addColorStop(0.3, `rgba(56, 189, 248, ${0.75 * currentIntensity})`);
          waveGrad.addColorStop(0.6, `rgba(99, 102, 241, ${0.85 * currentIntensity})`);
          waveGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (w === 1) {
          waveGrad.addColorStop(0, 'rgba(99, 102, 241, 0)');
          waveGrad.addColorStop(0.4, `rgba(56, 189, 248, ${0.45 * currentIntensity})`);
          waveGrad.addColorStop(0.7, `rgba(168, 85, 247, ${0.5 * currentIntensity})`);
          waveGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        } else {
          waveGrad.addColorStop(0, 'rgba(14, 165, 233, 0)');
          waveGrad.addColorStop(0.5, `rgba(16, 185, 129, ${0.35 * currentIntensity})`);
          waveGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }

        ctx.strokeStyle = waveGrad;
        ctx.lineWidth = w === 0 ? 3.5 : 1.8;
        ctx.shadowColor = w === 0 ? '#38bdf8' : '#6366f1';
        ctx.shadowBlur = w === 0 ? 18 : 10;

        const points = 60;
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * width;
          const normalX = (x / width) * 2 - 1; // -1 to 1

          // Bell envelope to taper the wave smoothly at the screen edges
          const envelope = Math.exp(-Math.pow(normalX * 1.65, 2));

          // Multi-frequency harmonic sine waves
          const freq1 = 0.0035;
          const freq2 = 0.007;
          const speed1 = time * (0.85 + w * 0.2);
          const speed2 = time * (0.45 + w * 0.15);

          const harmonic1 = Math.sin(x * freq1 + speed1 + waveOffset);
          const harmonic2 = Math.cos(x * freq2 - speed2 + waveOffset * 1.5) * 0.5;

          // Subtle mouse pull
          let mouseInfluence = 0;
          if (interactive && !prefersReducedMotion) {
            const dx = x - mousePosRef.current.x;
            const dist = Math.abs(dx);
            if (dist < 260) {
              const pull = Math.cos((dist / 260) * (Math.PI / 2));
              mouseInfluence = (mousePosRef.current.y - centerY) * pull * 0.15;
            }
          }

          const amplitude = (75 - w * 15) * intensity;
          const y = centerY + (harmonic1 + harmonic2) * amplitude * envelope + mouseInfluence;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [intensity, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${className}`}
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
}
