import { TOWERS, ENEMIES, ACTIVE_SKILLS } from './config';

export interface CompendiumEntry {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export interface TowerEntry extends CompendiumEntry {
  type: string;
  cost: number;
  powerDraw: number;
  damage: number;
  range: number;
  fireRate: number;
  special: string;
  color: string;
}

export interface EnemyEntry extends CompendiumEntry {
  category: string;
  health: number;
  speed: number;
  bounty: number;
  logicTag: string;
  color: string;
}

export interface SkillEntry extends CompendiumEntry {
  cooldown: number;
  placementType: string;
  color: string;
  damage?: number;
  effects?: {
    radius?: number;
    stun_duration?: number;
    health?: number;
    aggro_radius?: number;
  };
}

// All towers start unlocked for now (can tie to progression later)
export const TOWER_COMPENDIUM: TowerEntry[] = [];
export const ENEMY_COMPENDIUM: EnemyEntry[] = [];
export const SKILL_COMPENDIUM: SkillEntry[] = [];

// Populate Tower Compendium
for (const tower of TOWERS) {
  for (const level of tower.levels) {
    TOWER_COMPENDIUM.push({
      id: level.id,
      name: level.name,
      description: getTowerDescription(level.id, tower.type),
      unlocked: true,
      type: tower.type,
      cost: level.cost,
      powerDraw: level.powerDraw,
      damage: level.damage,
      range: level.range,
      fireRate: level.fireRate,
      special: level.special,
      color: level.color,
    });
  }
}

// Populate Enemy Compendium
for (const faction of ENEMIES) {
  for (const subtype of faction.subtypes) {
    ENEMY_COMPENDIUM.push({
      id: subtype.id,
      name: subtype.name,
      description: getEnemyDescription(subtype.id, subtype.logic_tag),
      unlocked: true,
      category: faction.category,
      health: subtype.health,
      speed: subtype.speed,
      bounty: subtype.bounty,
      logicTag: subtype.logic_tag,
      color: subtype.color,
    });
  }
}

// Populate Skill Compendium
for (const skill of ACTIVE_SKILLS) {
  SKILL_COMPENDIUM.push({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    unlocked: true,
    cooldown: skill.cooldown,
    placementType: skill.placementType,
    color: skill.color,
    damage: skill.damage,
    effects: skill.effects,
  });
}

function getTowerDescription(id: string, type: string): string {
  const descriptions: Record<string, string> = {
    // Kinetic
    kin_1: "Basic ballistic turret. Reliable damage against all target types.",
    kin_2: "High fire-rate cannon. Shreds through armored targets.",
    kin_3: "Long-range railgun. Rounds pierce through multiple enemies.",
    // Debuff
    dbf_1: "Slows enemies within range by 25%.",
    dbf_2: "Slows enemies by 45% and makes them take 15% increased damage.",
    dbf_3: "Severely slows enemies with a chance to fully stun them.",
    // Energy
    nrg_1: "Short-range beam tower. Continuous high damage output.",
    nrg_2: "Chain lightning tower. Jumps between up to 3 targets.",
    nrg_3: "Creates a ball of lightning that travels backward along the path, dealing massive damage and stunning enemies.",
    // Chemical
    chm_1: "Sprays corrosive acid. Deals damage over time.",
    chm_2: "Releases toxic clouds that linger on the path.",
    chm_3: "Infects enemies with nanites that spread to nearby foes on death.",
    // Economic
    eco_1: "Generates power for your grid. Pays for itself over time.",
    eco_2: "Generates significant power and boosts nearby tower fire rates.",
    eco_3: "Massive power generation. Enables global overclock capability.",
  };
  return descriptions[id] || `${type} tower. Effective defense unit.`;
}

function getEnemyDescription(id: string, logicTag: string): string {
  const descriptions: Record<string, string> = {
    scr_1: "Fast courier unit. Resistant to slowing effects.",
    scr_2: "Stealthy infiltrator. Becomes invisible periodically.",
    scr_3: "Elite operative. Deploys smoke screens when damaged.",
    hvy_1: "Heavy construction bot. High health, slow movement.",
    hvy_2: "Armored bulldozer. Shielded from frontal attacks.",
    hvy_3: "Demolition unit. Moves in unpredictable bursts.",
    bio_1: "Infected vermin. 40% chance to spawn 1-2 minions on death.",
    bio_2: "Mutated leaper. Jumps 5 cells ahead every 8 seconds.",
    bio_3: "Toxic brute. Leaves corrosive puddles on death.",
    glitch_1: "Digital wisp. 30% chance to evade projectile attacks.",
    glitch_2: "Phase-shifting entity. Teleports forward when HP drops below 50%.",
    glitch_3: "Healing anomaly. Regenerates nearby enemies for 5 HP/s.",
    boss_1: "Executive enforcement mech. Disables towers with missile strikes.",
    boss_2: "Collective drone consciousness. Splits into a clone at 50% HP.",
    boss_3: "Rogue AI construct. Moves off the designated path.",
    boss_4: "Final corporate weapon. Hijacks nearby towers every 3 seconds.",
  };
  return descriptions[id] || `Hostile entity. Threat level: ${logicTag}.`;
}

export function getTowerById(id: string): TowerEntry | undefined {
  return TOWER_COMPENDIUM.find(t => t.id === id);
}

export function getEnemyById(id: string): EnemyEntry | undefined {
  return ENEMY_COMPENDIUM.find(e => e.id === id);
}

export function getSkillById(id: string): SkillEntry | undefined {
  return SKILL_COMPENDIUM.find(s => s.id === id);
}
