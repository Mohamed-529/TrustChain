/**
 * LuminousWaveCanvas — 60fps High-DPI Aurora Energy Wave
 *
 * Visual Palette:
 * - Rich obsidian charcoal foundation (#09090b)
 * - Radiant emerald, mint jade, champagne gold, and soft amethyst aurora arcs
 * - Atmospheric particle depth field with smooth mouse parallax
 * - Respects prefers-reduced-motion with an elegant static render
 * - Cancels requestAnimationFrame on unmount
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
  colorType: 'emerald' | 'gold' | 'mint';
}

interface LuminousWaveCanvasProps {
  className?: string;
  intensity?: number;
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

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Initialize depth particles with Emerald & Champagne Gold hues
    const particleCount = prefersReducedMotion ? 20 : 60;
    const particles: Particle[] = [];
    const colorTypes: ('emerald' | 'gold' | 'mint')[] = ['emerald', 'gold', 'mint'];

    for (let i = 0; i < particleCount; i++) {
      const z = Math.random() * 0.8 + 0.2;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        radius: (Math.random() * 1.6 + 0.8) * z,
        baseAlpha: Math.random() * 0.4 + 0.15,
        alpha: 0.3,
        vx: (Math.random() - 0.5) * 0.2 * z,
        vy: (Math.random() - 0.5) * 0.2 * z,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
        colorType: colorTypes[i % colorTypes.length],
      });
    }

    let time = 0;

    const render = () => {
      time += 0.014;

      // 1. Deep Obsidian Charcoal Background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle Radial Warm Champagne & Emerald Glow
      const gradBg = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        40,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      gradBg.addColorStop(0, 'rgba(16, 185, 129, 0.08)'); // subtle emerald glow
      gradBg.addColorStop(0.4, 'rgba(245, 158, 11, 0.05)'); // warm champagne amber
      gradBg.addColorStop(1, 'rgba(9, 9, 11, 0.98)');
      ctx.fillStyle = gradBg;
      ctx.fillRect(0, 0, width, height);

      // 3. Render Particles
      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          p.pulsePhase += p.pulseSpeed;
          p.alpha = p.baseAlpha + Math.sin(p.pulsePhase) * 0.12;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        let colorRgba = `rgba(52, 211, 153, ${Math.max(0.05, p.alpha * intensity)})`;
        if (p.colorType === 'gold') {
          colorRgba = `rgba(251, 191, 36, ${Math.max(0.05, p.alpha * intensity)})`;
        } else if (p.colorType === 'mint') {
          colorRgba = `rgba(110, 231, 183, ${Math.max(0.05, p.alpha * intensity)})`;
        }

        ctx.fillStyle = colorRgba;
        ctx.shadowColor = p.colorType === 'gold' ? '#fbbf24' : '#10b981';
        ctx.shadowBlur = p.radius * 2.5;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 4. Render Emerald, Gold & Soft Violet Harmonic Aurora Waves
      const waveCount = 3;
      const centerY = height * 0.52;

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const waveOffset = w * 0.42;
        const currentIntensity = intensity * (1 - w * 0.2);

        const waveGrad = ctx.createLinearGradient(0, centerY - 80, width, centerY + 80);
        if (w === 0) {
          // Primary Emerald -> Champagne Gold arc
          waveGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
          waveGrad.addColorStop(0.3, `rgba(52, 211, 153, ${0.8 * currentIntensity})`);
          waveGrad.addColorStop(0.65, `rgba(245, 158, 11, ${0.75 * currentIntensity})`);
          waveGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (w === 1) {
          // Mint Jade -> Amethyst Violet arc
          waveGrad.addColorStop(0, 'rgba(110, 231, 183, 0)');
          waveGrad.addColorStop(0.4, `rgba(16, 185, 129, ${0.5 * currentIntensity})`);
          waveGrad.addColorStop(0.75, `rgba(139, 92, 246, ${0.55 * currentIntensity})`);
          waveGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else {
          // Warm Champagne Gold undertone
          waveGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
          waveGrad.addColorStop(0.5, `rgba(251, 191, 36, ${0.4 * currentIntensity})`);
          waveGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        }

        ctx.strokeStyle = waveGrad;
        ctx.lineWidth = w === 0 ? 3.2 : 1.6;
        ctx.shadowColor = w === 0 ? '#10b981' : '#f59e0b';
        ctx.shadowBlur = w === 0 ? 20 : 12;

        const points = 60;
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * width;
          const normalX = (x / width) * 2 - 1;
          const envelope = Math.exp(-Math.pow(normalX * 1.65, 2));

          const freq1 = 0.0032;
          const freq2 = 0.0065;
          const speed1 = time * (0.8 + w * 0.18);
          const speed2 = time * (0.42 + w * 0.12);

          const harmonic1 = Math.sin(x * freq1 + speed1 + waveOffset);
          const harmonic2 = Math.cos(x * freq2 - speed2 + waveOffset * 1.4) * 0.5;

          let mouseInfluence = 0;
          if (interactive && !prefersReducedMotion) {
            const dx = x - mousePosRef.current.x;
            const dist = Math.abs(dx);
            if (dist < 260) {
              const pull = Math.cos((dist / 260) * (Math.PI / 2));
              mouseInfluence = (mousePosRef.current.y - centerY) * pull * 0.14;
            }
          }

          const amplitude = (70 - w * 14) * intensity;
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
