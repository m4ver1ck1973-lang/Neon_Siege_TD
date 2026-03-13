import { TowerConfig, EnemyFaction, WaveConfig, LevelConfig } from './types';

export const TOWERS: TowerConfig[] = [
  {
    type: "Kinetic",
    levels: [
      { id: "kin_1", name: "Slug-Turret", cost: 150, powerDraw: 5, damage: 15, range: 3.5, fireRate: 1.5, special: "none", color: "#94a3b8" }, // slate-400
      { id: "kin_2", name: "Autocannon", cost: 400, powerDraw: 12, damage: 30, range: 4.0, fireRate: 2.5, special: "armor_shred", color: "#38bdf8" } // sky-400
    ]
  },
  {
    type: "Energy",
    levels: [
      { id: "nrg_1", name: "Plasma Torch", cost: 250, powerDraw: 15, damage: 40, range: 2.5, fireRate: 3.0, special: "continuous_beam", color: "#94a3b8" }, // slate-400
      { id: "nrg_2", name: "Plasma Cannon", cost: 600, powerDraw: 30, damage: 80, range: 3.0, fireRate: 4.0, special: "continuous_beam", color: "#38bdf8" } // sky-400
    ]
  },
  {
    type: "Debuff",
    levels: [
      { id: "dbf_1", name: "Signal Jammer", cost: 200, powerDraw: 8, damage: 2, range: 3.0, fireRate: 1.0, special: "slow_25", color: "#94a3b8" }, // slate-400
      { id: "dbf_2", name: "Neural Disruptor", cost: 500, powerDraw: 18, damage: 5, range: 4.0, fireRate: 1.5, special: "slow_50", color: "#38bdf8" } // sky-400
    ]
  },
  {
    type: "Economic",
    levels: [
      { id: "eco_1", name: "Solar Array", cost: 100, powerDraw: -15, damage: 0, range: 0.0, fireRate: 0.0, special: "gen_revenue_5s", color: "#94a3b8" }, // slate-400
      { id: "eco_2", name: "Power Substation", cost: 450, powerDraw: -40, damage: 0, range: 0.0, fireRate: 0.0, special: "none", color: "#38bdf8" } // sky-400
    ]
  }
];

export const ENEMIES: EnemyFaction[] = [
  {
    category: "Corporate Scripters",
    subtypes: [
      { id: "scr_1", name: "Courier", health: 40, speed: 2.5, bounty: 10, logic_tag: "none", color: "#f43f5e", radius: 0.3 }, // rose-500
      { id: "scr_2", name: "Data-Thief", health: 65, speed: 3.0, bounty: 25, logic_tag: "stealth", color: "#9f1239", radius: 0.25 },
    ]
  },
  {
    category: "Heavy Construction",
    subtypes: [
      { id: "hvy_1", name: "Lifter-Bot", health: 250, speed: 1.0, bounty: 30, logic_tag: "tank", color: "#f97316", radius: 0.45 }, // orange-500
    ]
  }
];

const MAPS = [
  {
    name: "The Outskirts",
    desc: "A simple path. Good for testing new defense algorithms.",
    gridWidth: 20, gridHeight: 10,
    path: [
      { x: 0, y: 2 }, { x: 11, y: 2 }, { x: 11, y: 5 }, 
      { x: 4, y: 5 }, { x: 4, y: 7 }, { x: 16, y: 7 }
    ]
  },
  {
    name: "Data Hub Alpha",
    desc: "A winding path with multiple switchbacks. Prepare for heavy resistance.",
    gridWidth: 20, gridHeight: 12,
    path: [
      { x: 2, y: 0 }, { x: 2, y: 8 }, { x: 8, y: 8 }, 
      { x: 8, y: 2 }, { x: 14, y: 2 }, { x: 14, y: 10 }, { x: 18, y: 10 }
    ]
  },
  {
    name: "Core Memory",
    desc: "A long spiral path leading directly to the mainframe.",
    gridWidth: 24, gridHeight: 14,
    path: [
      { x: 0, y: 1 }, { x: 22, y: 1 }, { x: 22, y: 12 }, 
      { x: 2, y: 12 }, { x: 2, y: 4 }, { x: 18, y: 4 }, 
      { x: 18, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 6 }, { x: 14, y: 6 }
    ]
  },
  {
    name: "The Firewall",
    desc: "A zigzagging gauntlet designed to test your ultimate defenses.",
    gridWidth: 22, gridHeight: 12,
    path: [
      { x: 1, y: 1 }, { x: 1, y: 10 }, { x: 5, y: 10 }, 
      { x: 5, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 10 }, 
      { x: 13, y: 10 }, { x: 13, y: 1 }, { x: 17, y: 1 }, 
      { x: 17, y: 10 }, { x: 20, y: 10 }
    ]
  }
];

const BASE_WAVES = [
  { count: 10, interval: 1.5, enemyId: "scr_1" },
  { count: 15, interval: 1.2, enemyId: "scr_1" },
  { count: 5, interval: 2.0, enemyId: "hvy_1" },
  { count: 20, interval: 1.0, enemyId: "scr_2" },
  { count: 10, interval: 1.5, enemyId: "hvy_1" },
  { count: 30, interval: 0.8, enemyId: "scr_1" },
  { count: 15, interval: 1.2, enemyId: "scr_2" },
  { count: 12, interval: 1.5, enemyId: "hvy_1" }
];

export const LEVELS: LevelConfig[] = [];

let levelIdCounter = 1;
for (let mapIndex = 0; mapIndex < MAPS.length; mapIndex++) {
  const map = MAPS[mapIndex];
  for (let difficulty = 1; difficulty <= 5; difficulty++) {
    const waves: WaveConfig[] = [];
    const numWaves = 4 + difficulty * 2; // 6, 8, 10, 12, 14 waves
    
    for (let w = 0; w < numWaves; w++) {
      const baseWave = BASE_WAVES[w % BASE_WAVES.length];
      waves.push({
        wave: w + 1,
        count: Math.floor(baseWave.count * (1 + difficulty * 0.2 + w * 0.1)),
        interval: Math.max(0.3, baseWave.interval * Math.pow(0.9, difficulty)),
        enemyId: baseWave.enemyId
      });
    }

    LEVELS.push({
      id: `level_${levelIdCounter}`,
      name: `Map ${mapIndex + 1}: ${map.name} - Level ${difficulty}`,
      description: `Difficulty ${difficulty}/5. ${map.desc}`,
      startingCredits: 800 - (difficulty * 50),
      startingHealth: 100,
      gridWidth: map.gridWidth,
      gridHeight: map.gridHeight,
      path: map.path,
      waves: waves
    });
    levelIdCounter++;
  }
}
