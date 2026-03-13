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

export interface GameState {
  health: number;
  maxHealth: number;
  credits: number;
  wave: number;
  maxPower: number;
  usedPower: number;
  isBrownout: boolean;
  status: 'menu' | 'planning' | 'playing' | 'gameover' | 'victory';
}
