export interface Vector2D {
  x: number;
  y: number;
}

export interface TowerLevel {
  id: string;
  name: string;
  cost: number;
  powerDraw: number;
  damage: number;
  range: number;
  fireRate: number; // shots per second
  special: string;
  color: string;
}

export interface TowerConfig {
  type: string;
  levels: TowerLevel[];
}

export interface SkillConfig {
  id: string;
  name: string;
  cooldown: number;
  placementType: 'Path' | 'Point' | 'Global';
  color: string;
  description: string;
  damage?: number;
  maxTriggers?: number;
  duration?: number;
  effects?: {
    radius?: number;
    shield_strip?: boolean;
    stun_duration?: number;
    mechanical_only?: boolean;
    health?: number;
    aggro_radius?: number;
    // Can add more from GDD as needed
  }
}

export interface EnemySubtype {
  id: string;
  name: string;
  health: number;
  speed: number;
  bounty: number;
  logic_tag: string;
  color: string;
  radius: number;
}

export interface EnemyFaction {
  category: string;
  subtypes: EnemySubtype[];
}

export interface WaveConfig {
  wave: number;
  count: number;
  interval: number;
  enemyId: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  startingCredits: number;
  startingHealth: number;
  path: Vector2D[];
  waves: WaveConfig[];
  gridWidth: number;
  gridHeight: number;
}

export type StatusEffectType = 'slow' | 'stun' | 'armor_shred' | 'vulnerability' | 'corrosion' | 'nanite_plague';

export interface StatusEffect {
  id: string; // unique instance id
  sourceId: string; // tower level id that applied it
  type: StatusEffectType;
  value: number; // e.g. 0.25 for 25% slow
  duration: number;
  // Optional for DoT effects
  lastTick?: number;
}

export interface GameState {
  health: number;
  maxHealth: number;
  credits: number;
  wave: number;
  maxPower: number;
  usedPower: number;
  isBrownout: boolean;
  status: 'menu' | 'planning' | 'playing' | 'gameover' | 'victory';
  skillCooldowns: Record<string, number>;
  gameSpeed: number;
}
