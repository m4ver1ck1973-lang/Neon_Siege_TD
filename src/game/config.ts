import { TowerConfig, EnemyFaction, WaveConfig, LevelConfig, SkillConfig } from './types';

export const TOWERS: TowerConfig[] = [
  {
    type: "Kinetic",
    levels: [
      { id: "kin_1", name: "Slug-Turret", cost: 150, powerDraw: 5, damage: 10, range: 3.5, fireRate: 1.2, special: "none", color: "#94a3b8" }, // slate-400
      { id: "kin_2", name: "Autocannon", cost: 400, powerDraw: 12, damage: 25, range: 4.0, fireRate: 2.5, special: "armor_shred", color: "#38bdf8" }, // sky-400
      { id: "kin_3", name: "Rail-Accelerator", cost: 1200, powerDraw: 35, damage: 150, range: 8.0, fireRate: 0.4, special: "piercing_3", color: "#a855f7" } // purple-500
    ]
  },
  {
    type: "Debuff",
    levels: [
      { id: "dbf_1", name: "Signal Jammer", cost: 200, powerDraw: 8, damage: 0, range: 3.0, fireRate: 1.0, special: "slow_25", color: "#94a3b8" },
      { id: "dbf_2", name: "Neural Spam Rig", cost: 500, powerDraw: 15, damage: 0, range: 3.5, fireRate: 1.0, special: "slow_45_vuln_15", color: "#38bdf8" },
      { id: "dbf_3", name: "System Crasher", cost: 1500, powerDraw: 40, damage: 0, range: 4.5, fireRate: 0.8, special: "stun_1s_proc", color: "#a855f7" }
    ]
  },
  {
    type: "Energy",
    levels: [
      { id: "nrg_1", name: "Plasma Torch", cost: 250, powerDraw: 10, damage: 40, range: 2.5, fireRate: 5.0, special: "continuous_beam", color: "#94a3b8" },
      { id: "nrg_2", name: "Arc Pylon", cost: 650, powerDraw: 25, damage: 30, range: 4.5, fireRate: 1.0, special: "chain_3", color: "#38bdf8" },
      { id: "nrg_3", name: "Ball Lightning", cost: 2000, powerDraw: 60, damage: 100, range: 5.0, fireRate: 0.4, special: "ball_lightning", wellDuration: 5.0, stunChance: 0.2, color: "#a855f7" }
    ]
  },
  {
    type: "Chemical",
    levels: [
      { id: "chm_1", name: "Acid Sprayer", cost: 175, powerDraw: 6, damage: 5, range: 3.0, fireRate: 2.0, special: "corrosion_debuff", color: "#94a3b8" },
      { id: "chm_2", name: "Bio-Hazzard Vent", cost: 550, powerDraw: 14, damage: 12, range: 3.5, fireRate: 1.5, special: "aoe_cloud", color: "#38bdf8" },
      { id: "chm_3", name: "Nanite Plague", cost: 1800, powerDraw: 30, damage: 25, range: 4.0, fireRate: 1.0, special: "on_death_spread", color: "#a855f7" }
    ]
  },
  {
    type: "Economic",
    levels: [
      { id: "eco_1", name: "Solar Array", cost: 100, powerDraw: -5, damage: 0, range: 0.0, fireRate: 0.0, special: "gen_revenue_5s", color: "#94a3b8" },
      { id: "eco_2", name: "Power Substation", cost: 450, powerDraw: -20, damage: 0, range: 2.0, fireRate: 0.0, special: "buff_nearby_speed", color: "#38bdf8" },
      { id: "eco_3", name: "The Fusion Core", cost: 2500, powerDraw: -75, damage: 0, range: 0.0, fireRate: 0.0, special: "global_overclock_active", color: "#a855f7" }
    ]
  }
];

export const ACTIVE_SKILLS: SkillConfig[] = [
  {
    id: "skl_1",
    name: "Monowire Trip-Mine",
    cooldown: 25.0,
    placementType: "Path",
    color: "#f43f5e", // rose-500
    description: "Deploys a molecular-thin wire. Shreds the first 5 enemies that cross it.",
    damage: 250,
    maxTriggers: 5
  },
  {
    id: "skl_2",
    name: "Grid Overload",
    cooldown: 35.0,
    placementType: "Path",
    color: "#f97316", // orange-500
    description: "Overloads a path segment with raw data. Enemies take damage while standing in it.",
    damage: 60,
    duration: 10.0,
    effects: {
      radius: 2.5
    }
  },
  {
    id: "skl_3",
    name: "EMP Charge",
    cooldown: 60.0,
    placementType: "Point",
    color: "#38bdf8", // sky-400
    description: "Detonates a charge, stunning mechanical units and disabling shields in a radius.",
    effects: {
      radius: 4.0,
      shield_strip: true,
      stun_duration: 3.0,
      mechanical_only: true
    }
  }
];

export const ENEMIES: EnemyFaction[] = [
  {
    category: "Corporate Scripters",
    subtypes: [
      { id: "scr_1", name: "Courier", health: 40, speed: 4.5, bounty: 10, logic_tag: "ignore_slow_10", color: "#f43f5e", radius: 0.3 }, // rose-500
      { id: "scr_2", name: "Data-Thief", health: 65, speed: 3.8, bounty: 25, logic_tag: "stealth_active_2s", color: "#be123c", radius: 0.25 }, // rose-700
      { id: "scr_3", name: "Extraction Specialist", health: 150, speed: 3.2, bounty: 40, logic_tag: "smoke_on_hit", color: "#881337", radius: 0.3 } // rose-900
    ]
  },
  {
    category: "Heavy Construction",
    subtypes: [
      { id: "hvy_1", name: "Lifter-Bot", health: 400, speed: 1.2, bounty: 50, logic_tag: "tank", color: "#f97316", radius: 0.45 }, // orange-500
      { id: "hvy_2", name: "Bulldozer", health: 600, speed: 1.0, bounty: 75, logic_tag: "front_shield_50", color: "#c2410c", radius: 0.5 }, // orange-700
      { id: "hvy_3", name: "Wrecking Ball", health: 500, speed: 0.8, bounty: 100, logic_tag: "burst_movement", color: "#7c2d12", radius: 0.55 } // orange-900
    ]
  },
  {
    category: "Bio-Hacked",
    subtypes: [
      { id: "bio_1", name: "Cyber-Rat", health: 80, speed: 3.5, bounty: 20, logic_tag: "split_on_hit_80", color: "#84cc16", radius: 0.2 }, // lime-500
      { id: "bio_2", name: "Leaper", health: 80, speed: 3.5, bounty: 30, logic_tag: "path_jump", color: "#4d7c0f", radius: 0.3 }, // lime-700
      { id: "bio_3", name: "Chem-Hulk", health: 350, speed: 1.5, bounty: 60, logic_tag: "death_puddle_slow", color: "#365314", radius: 0.5 } // lime-900
    ]
  },
  {
    category: "Digital Anomalies",
    subtypes: [
      { id: "glitch_1", name: "Static-Wisp", health: 90, speed: 3.0, bounty: 35, logic_tag: "evasion_30", color: "#06b6d4", radius: 0.25 }, // cyan-500
      { id: "glitch_2", name: "Blink-Frame", health: 150, speed: 2.8, bounty: 55, logic_tag: "teleport_50_hp", color: "#0e7490", radius: 0.3 }, // cyan-700
      { id: "glitch_3", name: "Buffer-Ghost", health: 200, speed: 2.0, bounty: 80, logic_tag: "healing_aura", color: "#164e63", radius: 0.35 } // cyan-900
    ]
  },
  {
    category: "Bosses",
    subtypes: [
      { id: "boss_1", name: "The CEO Executive Mech", health: 5000, speed: 0.5, bounty: 1000, logic_tag: "disable_tower_missile", color: "#d946ef", radius: 0.7 }, // fuchsia-500
      { id: "boss_2", name: "The Hive-Mind Swarm", health: 3000, speed: 1.5, bounty: 1200, logic_tag: "split_on_damage", color: "#c026d3", radius: 0.6 }, // fuchsia-600
      { id: "boss_3", name: "Project Zero-Day", health: 4500, speed: 2.5, bounty: 1500, logic_tag: "off_path_movement", color: "#a21caf", radius: 0.65 }, // fuchsia-700
      { id: "boss_4", name: "The Corporate Overlord", health: 10000, speed: 0.1, bounty: 5000, logic_tag: "tower_hijack", color: "#86198f", radius: 0.8 } // fuchsia-800
    ]
  }
];

const MAPS = [
  // Original 4 maps for levels 1-8 (2 difficulties each)
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
  },
  // 6 new maps for levels 9-20 (2 difficulties each)
  {
    name: "Neon Circuit",
    desc: "A twisting circuit board of death. Enemies navigate tight corners.",
    gridWidth: 19, gridHeight: 15,
    path: [
      { x: 0, y: 11 }, { x: 2, y: 11 }, { x: 2, y: 2 },
      { x: 8, y: 2 }, { x: 8, y: 5 }, { x: 4, y: 5 },
      { x: 4, y: 12 }, { x: 10, y: 12 }, { x: 10, y: 9 },
      { x: 7, y: 9 }, { x: 7, y: 7 }, { x: 11, y: 7 },
      { x: 11, y: 2 }, { x: 17, y: 2 }, { x: 17, y: 7 },
      { x: 14, y: 7 }, { x: 14, y: 10 }, { x: 18, y: 10 }
    ]
  },
  {
    name: "Data Labyrinth",
    desc: "A confusing maze of pathways. Strategic tower placement is key.",
    gridWidth: 18, gridHeight: 13,
    path: [
      { x: 2, y: 1 }, { x: 2, y: 6 }, { x: 7, y: 6 },
      { x: 7, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 10 },
      { x: 15, y: 10 }, { x: 15, y: 8 }, { x: 10, y: 8 },
      { x: 10, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 2 },
      { x: 13, y: 2 }, { x: 13, y: 6 }, { x: 15, y: 6 },
      { x: 15, y: 1 }
    ]
  },
  {
    name: "Grid Runner",
    desc: "Fast-paced map with multiple direction changes.",
    gridWidth: 16, gridHeight: 10,
    path: [
      { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 1 },
      { x: 5, y: 1 }, { x: 5, y: 7 }, { x: 6, y: 7 },
      { x: 6, y: 8 }, { x: 9, y: 8 }, { x: 9, y: 5 },
      { x: 7, y: 5 }, { x: 7, y: 1 }, { x: 11, y: 1 },
      { x: 11, y: 9 }, { x: 13, y: 9 }, { x: 13, y: 4 },
      { x: 15, y: 4 }
    ]
  },
  {
    name: "Cyber Spiral",
    desc: "A spiraling descent into digital chaos.",
    gridWidth: 20, gridHeight: 10,
    path: [
      { x: 0, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 5 },
      { x: 4, y: 5 }, { x: 4, y: 3 }, { x: 2, y: 3 },
      { x: 2, y: 1 }, { x: 12, y: 1 }, { x: 12, y: 4 },
      { x: 8, y: 4 }, { x: 8, y: 8 }, { x: 15, y: 8 },
      { x: 15, y: 1 }, { x: 17, y: 1 }, { x: 17, y: 7 },
      { x: 19, y: 7 }
    ]
  },
  {
    name: "Memory Fragment",
    desc: "Fragmented pathways through corrupted memory sectors.",
    gridWidth: 16, gridHeight: 11,
    path: [
      { x: 0, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 4 },
      { x: 2, y: 4 }, { x: 2, y: 8 }, { x: 13, y: 8 },
      { x: 13, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 4 },
      { x: 11, y: 4 }, { x: 11, y: 6 }, { x: 6, y: 6 },
      { x: 6, y: 2 }, { x: 6, y: 1 }
    ]
  },
  {
    name: "The Gauntlet",
    desc: "The ultimate test. Long winding path with many turns.",
    gridWidth: 20, gridHeight: 15,
    path: [
      { x: 0, y: 13 }, { x: 0, y: 10 }, { x: 2, y: 10 },
      { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 12 },
      { x: 9, y: 12 }, { x: 9, y: 3 }, { x: 12, y: 3 },
      { x: 12, y: 2 }, { x: 17, y: 2 }, { x: 17, y: 6 },
      { x: 12, y: 6 }, { x: 12, y: 12 }, { x: 17, y: 12 },
      { x: 17, y: 8 }, { x: 19, y: 8 }
    ]
  }
];

// ============================================================================
// SECTOR-BASED WAVE PROGRESSION
// 4 Sectors × 5 Nodes = 20 Levels
// Each Sector culminates in a Boss wave
// ============================================================================

interface SectorConfig {
  name: string;
  theme: string;
  levels: LevelWaveConfig[];
}

interface LevelWaveConfig {
  waves: { count: number; interval: number; enemyId: string }[];
  startingCredits: number;
}

const SECTORS: SectorConfig[] = [
  // ==========================================================================
  // SECTOR 1: CORPORATE INCURSION (Levels 1-5)
  // Theme: Corporate Scripters
  // Boss: CEO Executive Mech
  // ==========================================================================
  {
    name: "Corporate Incursion",
    theme: "Corporate Scripters",
    levels: [
      // Level 1: Node 1 (6 waves) - Intro to Corporate
      {
        waves: [
          { count: 8, interval: 2.0, enemyId: "scr_1" },   // Courier
          { count: 10, interval: 1.8, enemyId: "scr_1" },
          { count: 12, interval: 1.5, enemyId: "scr_1" },
          { count: 5, interval: 2.5, enemyId: "scr_2" },   // Data-Thief
          { count: 8, interval: 2.2, enemyId: "scr_2" },
          { count: 1, interval: 5.0, enemyId: "scr_3" },   // Extraction Specialist (mini-boss)
        ],
        startingCredits: 850
      },
      // Level 2: Node 2 (7 waves)
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "scr_1" },
          { count: 12, interval: 1.5, enemyId: "scr_1" },
          { count: 15, interval: 1.3, enemyId: "scr_1" },
          { count: 6, interval: 2.5, enemyId: "scr_2" },
          { count: 8, interval: 2.2, enemyId: "scr_2" },
          { count: 3, interval: 3.0, enemyId: "scr_3" },
          { count: 1, interval: 5.0, enemyId: "scr_3" },   // Mini-boss
        ],
        startingCredits: 800
      },
      // Level 3: Node 3 (8 waves)
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "scr_1" },
          { count: 12, interval: 1.5, enemyId: "scr_1" },
          { count: 8, interval: 2.2, enemyId: "scr_2" },
          { count: 10, interval: 2.0, enemyId: "scr_2" },
          { count: 5, interval: 2.8, enemyId: "scr_3" },
          { count: 8, interval: 2.0, enemyId: "scr_1" },   // Mixed
          { count: 3, interval: 3.0, enemyId: "scr_3" },
          { count: 1, interval: 5.0, enemyId: "scr_3" },   // Mini-boss
        ],
        startingCredits: 800
      },
      // Level 4: Node 4 (9 waves)
      {
        waves: [
          { count: 12, interval: 1.6, enemyId: "scr_1" },
          { count: 15, interval: 1.4, enemyId: "scr_1" },
          { count: 10, interval: 2.0, enemyId: "scr_2" },
          { count: 12, interval: 1.8, enemyId: "scr_2" },
          { count: 6, interval: 2.8, enemyId: "scr_3" },
          { count: 8, interval: 2.5, enemyId: "scr_3" },
          { count: 10, interval: 1.8, enemyId: "scr_1" },  // Mixed elite
          { count: 5, interval: 2.5, enemyId: "scr_2" },
          { count: 1, interval: 8.0, enemyId: "boss_1" },  // CEO (SECTOR BOSS)
        ],
        startingCredits: 750
      },
      // Level 5: Node 5 (10 waves) - Sector 1 Finale
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "scr_1" },
          { count: 12, interval: 1.5, enemyId: "scr_1" },
          { count: 15, interval: 1.3, enemyId: "scr_1" },
          { count: 8, interval: 2.2, enemyId: "scr_2" },
          { count: 10, interval: 2.0, enemyId: "scr_2" },
          { count: 12, interval: 1.8, enemyId: "scr_2" },
          { count: 6, interval: 2.8, enemyId: "scr_3" },
          { count: 8, interval: 2.5, enemyId: "scr_3" },
          { count: 3, interval: 4.0, enemyId: "scr_3" },  // Elite gauntlet
          { count: 1, interval: 10.0, enemyId: "boss_1" }, // CEO (SECTOR BOSS)
        ],
        startingCredits: 750
      }
    ]
  },

  // ==========================================================================
  // SECTOR 2: HEAVY BIO-ASSAULT (Levels 6-10)
  // Theme: Heavy Construction + Bio-Hacked
  // Boss: Hive-Mind Swarm
  // ==========================================================================
  {
    name: "Heavy Bio-Assault",
    theme: "Heavy Construction + Bio-Hacked",
    levels: [
      // Level 6: Node 1 (6 waves) - Intro to Heavy/Bio
      {
        waves: [
          { count: 5, interval: 3.0, enemyId: "hvy_1" },   // Lifter-Bot
          { count: 6, interval: 2.8, enemyId: "hvy_1" },
          { count: 8, interval: 2.5, enemyId: "hvy_1" },
          { count: 8, interval: 1.5, enemyId: "bio_1" },   // Cyber-Rat
          { count: 10, interval: 1.3, enemyId: "bio_1" },
          { count: 1, interval: 5.0, enemyId: "bio_3" },   // Chem-Hulk (mini-boss)
        ],
        startingCredits: 850
      },
      // Level 7: Node 2 (7 waves)
      {
        waves: [
          { count: 6, interval: 2.8, enemyId: "hvy_1" },
          { count: 8, interval: 2.5, enemyId: "hvy_1" },
          { count: 10, interval: 1.5, enemyId: "bio_1" },
          { count: 12, interval: 1.3, enemyId: "bio_1" },
          { count: 5, interval: 2.5, enemyId: "bio_2" },   // Leaper
          { count: 3, interval: 3.0, enemyId: "bio_3" },
          { count: 1, interval: 5.0, enemyId: "bio_3" },   // Mini-boss
        ],
        startingCredits: 800
      },
      // Level 8: Node 3 (8 waves)
      {
        waves: [
          { count: 6, interval: 2.8, enemyId: "hvy_1" },
          { count: 8, interval: 2.5, enemyId: "hvy_1" },
          { count: 5, interval: 2.5, enemyId: "hvy_2" },   // Bulldozer
          { count: 10, interval: 1.5, enemyId: "bio_1" },
          { count: 12, interval: 1.3, enemyId: "bio_1" },
          { count: 6, interval: 2.5, enemyId: "bio_2" },
          { count: 4, interval: 3.0, enemyId: "bio_3" },
          { count: 1, interval: 5.0, enemyId: "bio_3" },   // Mini-boss
        ],
        startingCredits: 800
      },
      // Level 9: Node 4 (9 waves)
      {
        waves: [
          { count: 8, interval: 2.5, enemyId: "hvy_1" },
          { count: 6, interval: 2.8, enemyId: "hvy_2" },
          { count: 4, interval: 3.5, enemyId: "hvy_3" },   // Wrecking Ball
          { count: 12, interval: 1.4, enemyId: "bio_1" },
          { count: 8, interval: 2.2, enemyId: "bio_2" },
          { count: 5, interval: 2.8, enemyId: "bio_3" },
          { count: 8, interval: 2.0, enemyId: "hvy_1" },   // Mixed elite
          { count: 5, interval: 2.5, enemyId: "bio_2" },
          { count: 1, interval: 8.0, enemyId: "boss_2" },  // Hive-Mind (SECTOR BOSS)
        ],
        startingCredits: 750
      },
      // Level 10: Node 5 (10 waves) - Sector 2 Finale
      {
        waves: [
          { count: 8, interval: 2.5, enemyId: "hvy_1" },
          { count: 10, interval: 2.3, enemyId: "hvy_1" },
          { count: 6, interval: 3.0, enemyId: "hvy_2" },
          { count: 4, interval: 3.5, enemyId: "hvy_3" },
          { count: 15, interval: 1.3, enemyId: "bio_1" },
          { count: 10, interval: 2.0, enemyId: "bio_1" },
          { count: 8, interval: 2.2, enemyId: "bio_2" },
          { count: 6, interval: 2.8, enemyId: "bio_3" },
          { count: 3, interval: 4.0, enemyId: "bio_3" },  // Elite gauntlet
          { count: 1, interval: 10.0, enemyId: "boss_2" }, // Hive-Mind (SECTOR BOSS)
        ],
        startingCredits: 750
      }
    ]
  },

  // ==========================================================================
  // SECTOR 3: DIGITAL ANOMALY (Levels 11-15)
  // Theme: Digital Anomalies
  // Boss: Project Zero-Day
  // ==========================================================================
  {
    name: "Digital Anomaly",
    theme: "Digital Anomalies",
    levels: [
      // Level 11: Node 1 (6 waves) - Intro to Digital
      {
        waves: [
          { count: 8, interval: 2.0, enemyId: "glitch_1" }, // Static-Wisp
          { count: 10, interval: 1.8, enemyId: "glitch_1" },
          { count: 12, interval: 1.5, enemyId: "glitch_1" },
          { count: 5, interval: 2.5, enemyId: "glitch_2" }, // Blink-Frame
          { count: 8, interval: 2.2, enemyId: "glitch_2" },
          { count: 1, interval: 5.0, enemyId: "glitch_3" }, // Buffer-Ghost (mini-boss)
        ],
        startingCredits: 850
      },
      // Level 12: Node 2 (7 waves)
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "glitch_1" },
          { count: 12, interval: 1.5, enemyId: "glitch_1" },
          { count: 15, interval: 1.3, enemyId: "glitch_1" },
          { count: 6, interval: 2.5, enemyId: "glitch_2" },
          { count: 8, interval: 2.2, enemyId: "glitch_2" },
          { count: 3, interval: 3.0, enemyId: "glitch_3" },
          { count: 1, interval: 5.0, enemyId: "glitch_3" },  // Mini-boss
        ],
        startingCredits: 800
      },
      // Level 13: Node 3 (8 waves)
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "glitch_1" },
          { count: 12, interval: 1.5, enemyId: "glitch_1" },
          { count: 8, interval: 2.2, enemyId: "glitch_2" },
          { count: 10, interval: 2.0, enemyId: "glitch_2" },
          { count: 5, interval: 2.8, enemyId: "glitch_3" },
          { count: 8, interval: 2.0, enemyId: "bio_1" },    // Bio support
          { count: 3, interval: 3.0, enemyId: "glitch_3" },
          { count: 1, interval: 5.0, enemyId: "glitch_3" },  // Mini-boss
        ],
        startingCredits: 800
      },
      // Level 14: Node 4 (9 waves)
      {
        waves: [
          { count: 12, interval: 1.6, enemyId: "glitch_1" },
          { count: 15, interval: 1.4, enemyId: "glitch_1" },
          { count: 10, interval: 2.0, enemyId: "glitch_2" },
          { count: 12, interval: 1.8, enemyId: "glitch_2" },
          { count: 6, interval: 2.8, enemyId: "glitch_3" },
          { count: 8, interval: 2.5, enemyId: "glitch_3" },
          { count: 10, interval: 1.8, enemyId: "bio_1" },   // Mixed elite
          { count: 5, interval: 2.5, enemyId: "bio_2" },
          { count: 1, interval: 8.0, enemyId: "boss_3" },   // Zero-Day (SECTOR BOSS)
        ],
        startingCredits: 750
      },
      // Level 15: Node 5 (10 waves) - Sector 3 Finale
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "glitch_1" },
          { count: 12, interval: 1.5, enemyId: "glitch_1" },
          { count: 15, interval: 1.3, enemyId: "glitch_1" },
          { count: 8, interval: 2.2, enemyId: "glitch_2" },
          { count: 10, interval: 2.0, enemyId: "glitch_2" },
          { count: 12, interval: 1.8, enemyId: "glitch_2" },
          { count: 6, interval: 2.8, enemyId: "glitch_3" },
          { count: 8, interval: 2.5, enemyId: "glitch_3" },
          { count: 3, interval: 4.0, enemyId: "glitch_3" }, // Elite gauntlet
          { count: 1, interval: 10.0, enemyId: "boss_3" },  // Zero-Day (SECTOR BOSS)
        ],
        startingCredits: 750
      }
    ]
  },

  // ==========================================================================
  // SECTOR 4: CORPORATE OVERLORD (Levels 16-20)
  // Theme: All Factions - Elite Mix
  // Boss: The Corporate Overlord
  // ==========================================================================
  {
    name: "Corporate Overlord",
    theme: "All Factions - Elite Mix",
    levels: [
      // Level 16: Node 1 (6 waves) - Intro to Elite Mix
      {
        waves: [
          { count: 8, interval: 2.0, enemyId: "scr_2" },   // Corporate
          { count: 6, interval: 2.8, enemyId: "hvy_2" },   // Heavy
          { count: 10, interval: 1.5, enemyId: "bio_1" },  // Bio
          { count: 8, interval: 2.0, enemyId: "glitch_1" }, // Digital
          { count: 5, interval: 2.5, enemyId: "scr_3" },   // Elite Corporate
          { count: 1, interval: 8.0, enemyId: "boss_4" },  // Overlord (SECTOR BOSS)
        ],
        startingCredits: 900
      },
      // Level 17: Node 2 (7 waves)
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "scr_2" },
          { count: 8, interval: 2.5, enemyId: "hvy_2" },
          { count: 12, interval: 1.4, enemyId: "bio_1" },
          { count: 10, interval: 1.8, enemyId: "glitch_1" },
          { count: 6, interval: 2.5, enemyId: "scr_3" },
          { count: 4, interval: 3.0, enemyId: "bio_3" },
          { count: 1, interval: 8.0, enemyId: "boss_4" },  // Overlord (SECTOR BOSS)
        ],
        startingCredits: 850
      },
      // Level 18: Node 3 (8 waves)
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "scr_2" },
          { count: 8, interval: 2.5, enemyId: "hvy_2" },
          { count: 5, interval: 3.0, enemyId: "hvy_3" },
          { count: 12, interval: 1.4, enemyId: "bio_1" },
          { count: 8, interval: 2.0, enemyId: "bio_2" },
          { count: 10, interval: 1.8, enemyId: "glitch_2" },
          { count: 5, interval: 2.5, enemyId: "glitch_3" },
          { count: 1, interval: 8.0, enemyId: "boss_4" },  // Overlord (SECTOR BOSS)
        ],
        startingCredits: 850
      },
      // Level 19: Node 4 (9 waves)
      {
        waves: [
          { count: 12, interval: 1.6, enemyId: "scr_2" },
          { count: 8, interval: 2.5, enemyId: "hvy_2" },
          { count: 6, interval: 3.0, enemyId: "hvy_3" },
          { count: 15, interval: 1.3, enemyId: "bio_1" },
          { count: 10, interval: 2.0, enemyId: "bio_2" },
          { count: 12, interval: 1.8, enemyId: "glitch_1" },
          { count: 8, interval: 2.2, enemyId: "glitch_2" },
          { count: 5, interval: 2.8, enemyId: "scr_3" },   // Elite gauntlet
          { count: 1, interval: 8.0, enemyId: "boss_4" },  // Overlord (SECTOR BOSS)
        ],
        startingCredits: 800
      },
      // Level 20: Node 5 (10 waves) - FINAL BOSS
      {
        waves: [
          { count: 10, interval: 1.8, enemyId: "scr_2" },
          { count: 12, interval: 1.6, enemyId: "scr_2" },
          { count: 8, interval: 2.5, enemyId: "hvy_2" },
          { count: 6, interval: 3.0, enemyId: "hvy_3" },
          { count: 15, interval: 1.3, enemyId: "bio_1" },
          { count: 10, interval: 2.0, enemyId: "bio_2" },
          { count: 12, interval: 1.8, enemyId: "glitch_1" },
          { count: 8, interval: 2.2, enemyId: "glitch_2" },
          { count: 3, interval: 4.0, enemyId: "boss_3" },  // Ultimate gauntlet
          { count: 1, interval: 12.0, enemyId: "boss_4" }, // OVERLORD (FINAL BOSS)
        ],
        startingCredits: 800
      }
    ]
  }
];

export const LEVELS: LevelConfig[] = [];

let levelIdCounter = 1;
for (let sectorIndex = 0; sectorIndex < SECTORS.length; sectorIndex++) {
  const sector = SECTORS[sectorIndex];
  for (let nodeIndex = 0; nodeIndex < sector.levels.length; nodeIndex++) {
    const levelConfig = sector.levels[nodeIndex];
    const map = MAPS[Math.floor(levelIdCounter / 2) % MAPS.length]; // Distribute across maps

    LEVELS.push({
      id: `level_${levelIdCounter}`,
      name: `${sector.name} - Node ${nodeIndex + 1}`,
      description: `${sector.theme}. Wave ${levelConfig.waves.length}.`,
      startingCredits: levelConfig.startingCredits,
      startingHealth: 100,
      gridWidth: map.gridWidth,
      gridHeight: map.gridHeight,
      path: map.path,
      waves: levelConfig.waves
    });
    levelIdCounter++;
  }
}
