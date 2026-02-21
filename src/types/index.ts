export interface Vec2 {
  x: number;
  y: number;
}

export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  color: number; // Pixi hex color
  alpha: number;
  radius: number;
}

export type SegmentationMask = {
  data: Uint8Array;
  width: number;
  height: number;
};

export type InteractionMode = 'repulse' | 'attract' | 'vortex' | 'freeze';

export interface SimConfig {
  particleCount: number;
  repulsionForce: number;
  friction: number;
  ease: number;
  mode: InteractionMode;
}
