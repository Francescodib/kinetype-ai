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

/** A point in canvas space that exerts force on nearby particles. */
export interface ForcePoint {
  x: number;
  y: number;
  radius: number;   // influence radius in canvas pixels
  strength: number; // force magnitude multiplier
}

export interface SimConfig {
  particleCount: number;
  repulsionForce: number;
  friction: number;
  ease: number;
  mode: InteractionMode;
}
