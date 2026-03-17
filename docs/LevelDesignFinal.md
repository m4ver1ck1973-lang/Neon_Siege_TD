# Neon Siege TD - Level Design Document

**Game:** Grid-Lock: Neon Siege  
**Version:** Alpha (Sector-Based Progression)  
**Date:** March 16, 2026

---

## Overview

The game features **4 Sectors × 5 Nodes = 20 Levels** with structured progression. Each Sector focuses on specific enemy factions and culminates in a boss battle.

### Design Principles

- **Boss Always Last:** Every sector culminates with its boss on the final wave
- **Progressive Difficulty:** 6→7→8→9→10 waves per node within each sector
- **Themed Sectors:** Each sector focuses on specific factions
- **Mini-Bosses:** Mid-sector nodes end with elite enemies
- **Starting Credits:** Scale with difficulty (750-900)

---

## Sector Structure

| Sector | Levels | Theme | Boss |
|--------|--------|-------|------|
| **1** | 1-5 | Corporate Scripters | CEO Executive Mech |
| **2** | 6-10 | Heavy Construction + Bio-Hacked | Hive-Mind Swarm |
| **3** | 11-15 | Digital Anomalies | Project Zero-Day |
| **4** | 16-20 | All Factions - Elite Mix | Corporate Overlord |

### Node Progression

| Node | Waves | Purpose |
|------|-------|---------|
| 1 | 6 waves | Intro to sector enemies |
| 2 | 7 waves | Build complexity |
| 3 | 8 waves | Mixed threats |
| 4 | 9 waves | Elite preview |
| 5 | 10 waves | **BOSS WAVE** |

---

## Sector 1: Corporate Incursion (Levels 1-5)

**Theme:** Corporate Scripters  
**Boss:** CEO Executive Mech (boss_1)

| Node | Waves | Composition | Finale |
|------|-------|-------------|--------|
| **1** | 6 | Courier → Data-Thief | Extraction Specialist |
| **2** | 7 | Corporate mix | Extraction Specialist |
| **3** | 8 | Corporate + Specialist | Extraction Specialist |
| **4** | 9 | Corporate elite | **CEO Executive Mech** |
| **5** | 10 | Corporate gauntlet | **CEO Executive Mech** |

### Enemy Roster
- **scr_1** - Courier (40 HP, 4.5 speed, 10 bounty)
- **scr_2** - Data-Thief (65 HP, 3.8 speed, 25 bounty, stealth)
- **scr_3** - Extraction Specialist (150 HP, 3.2 speed, 40 bounty, smoke on hit)
- **boss_1** - CEO Executive Mech (5000 HP, 0.5 speed, 1000 bounty)

---

## Sector 2: Heavy Bio-Assault (Levels 6-10)

**Theme:** Heavy Construction + Bio-Hacked  
**Boss:** Hive-Mind Swarm (boss_2)

| Node | Waves | Composition | Finale |
|------|-------|-------------|--------|
| **1** | 6 | Lifter-Bot → Cyber-Rat | Chem-Hulk |
| **2** | 7 | Heavy + Bio + Leaper | Chem-Hulk |
| **3** | 8 | Heavy + Bio + Bulldozer | Chem-Hulk |
| **4** | 9 | All Heavy/Bio factions | **Hive-Mind Swarm** |
| **5** | 10 | Heavy/Bio gauntlet | **Hive-Mind Swarm** |

### Enemy Roster
- **hvy_1** - Lifter-Bot (400 HP, 1.2 speed, 50 bounty, tank)
- **hvy_2** - Bulldozer (600 HP, 1.0 speed, 75 bounty, front shield 50%)
- **hvy_3** - Wrecking Ball (500 HP, 0.8 speed, 100 bounty, burst movement)
- **bio_1** - Cyber-Rat (80 HP, 3.5 speed, 20 bounty, split on hit 80%)
- **bio_2** - Leaper (80 HP, 3.5 speed, 30 bounty, path jump 5 cells)
- **bio_3** - Chem-Hulk (350 HP, 1.5 speed, 60 bounty, death puddle slow)
- **boss_2** - Hive-Mind Swarm (3000 HP, 1.5 speed, 1200 bounty, split on damage)

---

## Sector 3: Digital Anomaly (Levels 11-15)

**Theme:** Digital Anomalies  
**Boss:** Project Zero-Day (boss_3)

| Node | Waves | Composition | Finale |
|------|-------|-------------|--------|
| **1** | 6 | Static-Wisp → Blink-Frame | Buffer-Ghost |
| **2** | 7 | Digital mix | Buffer-Ghost |
| **3** | 8 | Digital + Bio support | Buffer-Ghost |
| **4** | 9 | Digital elite | **Project Zero-Day** |
| **5** | 10 | Digital gauntlet | **Project Zero-Day** |

### Enemy Roster
- **glitch_1** - Static-Wisp (90 HP, 3.0 speed, 35 bounty, evasion 30%)
- **glitch_2** - Blink-Frame (150 HP, 2.8 speed, 55 bounty, teleport at 50% HP)
- **glitch_3** - Buffer-Ghost (200 HP, 2.0 speed, 80 bounty, healing aura)
- **boss_3** - Project Zero-Day (4500 HP, 2.5 speed, 1500 bounty, off-path movement)

---

## Sector 4: Corporate Overlord (Levels 16-20)

**Theme:** All Factions - Elite Mix  
**Boss:** Corporate Overlord (boss_4)

| Node | Waves | Composition | Finale |
|------|-------|-------------|--------|
| **1** | 6 | All factions intro | **Corporate Overlord** |
| **2** | 7 | Faction elites | **Corporate Overlord** |
| **3** | 8 | All factions + Wrecking Ball | **Corporate Overlord** |
| **4** | 9 | Elite gauntlet | **Corporate Overlord** |
| **5** | 10 | **FINAL BOSS** | **Corporate Overlord** |

### Enemy Roster
- All factions from Sectors 1-3
- **boss_4** - Corporate Overlord (10000 HP, 0.1 speed, 5000 bounty, tower hijack)

---

## Wave Structure Examples

### Level 1: Node 1 (6 waves)
```
Wave 1: 8 × Courier (2.0s interval)
Wave 2: 10 × Courier (1.8s interval)
Wave 3: 12 × Courier (1.5s interval)
Wave 4: 5 × Data-Thief (2.5s interval)
Wave 5: 8 × Data-Thief (2.2s interval)
Wave 6: 1 × Extraction Specialist (5.0s interval) - Mini-boss
```

### Level 5: Sector 1 Finale (10 waves)
```
Wave 1-3: Courier swarms (1.3-1.8s interval)
Wave 4-6: Data-Thief groups (1.8-2.2s interval)
Wave 7-8: Extraction Specialist pairs (2.5-2.8s interval)
Wave 9: 3 × Extraction Specialist (4.0s interval) - Elite gauntlet
Wave 10: CEO Executive Mech (10.0s interval) - SECTOR BOSS
```

### Level 20: Final Boss (10 waves)
```
Wave 1-2: Data-Thief swarms
Wave 3-4: Bulldozer + Wrecking Ball
Wave 5-6: Cyber-Rat + Leaper
Wave 7-8: Static-Wisp + Blink-Frame
Wave 9: 3 × Project Zero-Day (4.0s interval) - Ultimate gauntlet
Wave 10: Corporate Overlord (12.0s interval) - FINAL BOSS
```

---

## Difficulty Scaling

### Wave Count Progression
- **Node 1:** 6 waves (tutorial/intro)
- **Node 2:** 7 waves (building complexity)
- **Node 3:** 8 waves (mixed threats)
- **Node 4:** 9 waves (elite preview + boss)
- **Node 5:** 10 waves (full gauntlet + boss)

### Starting Credits
| Node | Credits | Rationale |
|------|---------|-----------|
| 1 | 850 | Generous for first sector |
| 2-3 | 800 | Standard |
| 4-5 | 750 | Tighter economy for boss fights |
| 16+ | 800-900 | Late-game economy adjustment |

### Enemy Scaling
All enemies scale with wave number:
```
actualHP = baseHP × (1 + wave × 0.1)
```

Example: Cyber-Rat (80 base HP) at wave 7:
```
80 × (1 + 7 × 0.1) = 80 × 1.7 = 136 HP
```

---

## Map Assignment

Levels are distributed across 10 unique maps:

| Map | Levels |
|-----|--------|
| The Outskirts | 1-2 |
| Data Hub Alpha | 3-4 |
| Core Memory | 5-6 |
| The Firewall | 7-8 |
| Neon Circuit | 9-10 |
| Data Labyrinth | 11-12 |
| Grid Runner | 13-14 |
| Cyber Spiral | 15-16 |
| Memory Fragment | 17-18 |
| The Gauntlet | 19-20 |

---

## Implementation Notes

### Configuration
Wave data is stored in `src/game/config.ts` within the `SECTORS` array.

### Structure
```typescript
interface SectorConfig {
  name: string;
  theme: string;
  levels: LevelWaveConfig[];
}

interface LevelWaveConfig {
  waves: { count: number; interval: number; enemyId: string }[];
  startingCredits: number;
}
```

### Key Changes from Previous System
- **Removed:** `BASE_WAVES` array with offset-based calculation
- **Removed:** `FINAL_WAVE_ENEMIES` boss selection logic
- **Added:** Explicit wave configurations per level
- **Added:** Sector-based organization with thematic progression

---

## Future Considerations

### Potential Additions
1. **Difficulty Modes:** Easy/Normal/Hard variants of each sector
2. **Endless Mode:** Infinite waves after Level 20
3. **Daily Challenges:** Modified wave compositions with modifiers
4. **Sector Unlocks:** Progressive unlocking of sectors
5. **Star Ratings:** Performance-based scoring per node

### Balance Levers
- Enemy count per wave
- Spawn interval timing
- Starting credits
- Wave count per node
- Boss spawn timing

---

*Document generated: March 16, 2026*  
*Neon Siege TD Development Team*
