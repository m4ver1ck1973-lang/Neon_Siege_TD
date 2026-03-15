## **1\. Concept Overview: "Grid-Lock: Neon Siege"**

**Setting:** The sprawl of *Neo-Kowloon 2.0*. Players act as "Grid-Watchers," rogue sysadmins defending a decentralized data-vault from Corporate Extraction Teams and AI-Purge programs. 
**Core Mechanic:** **The Power Grid.** Every tower requires **Watts**. Players must balance "Revenue" (to buy towers) and "Power" (to keep them online). If total Power consumption exceeds supply, the defense grid browns out, reducing fire rates by 50% across the board. 
**Visual Style:** Isometric, high-contrast neon on dark, rain-slicked asphalt.

## **2\. Tower Arsenal (Upgrade Paths)**

| Tower Type | Level 1 | Level 2 | Level 3 (Final) |
| :---- | :---- | :---- | :---- |
| **Kinetic** | **Slug-Turret:** Standard rapid-fire ballistic rounds. | **Autocannon:** High fire rate; shreds basic armor. | **Rail-Accelerator:** Massive range; rounds pierce through 3 targets. |
| **Debuff** | **Signal Jammer:** 25% Movement slow in a small AoE. | **Neural Spam Rig:** 45% Slow; adds 15% miss chance to enemies. | **System Crasher:** 70% Slow; intermittent 1s "Brick" (Full Stun). |
| **Energy** | **Plasma Torch:** Short range, high damage beam. | **Arc Pylon:** Chain lightning; hits up to 3 adjacent targets. | **Singularity Well:** Pulls enemies toward the center of the beam. |
| **Chemical** | **Acid Sprayer:** Corrosive mist; slows armor regen. | **Bio-Hazzard Vent:** Lingering poison clouds on the path. | **Nanite Plague:** Toxin spreads from dead enemies to living ones. |
| **Economic** | **Solar Array:** Generates 5 Watts every 10s. | **Power Substation:** Generates 15 Watts; buffs nearby fire rate. | **The Fusion Core:** Massive Watt output; grants "Global Overclock" skill. |

## **3\. Utility / Active Skills (Path-Placed)**

*Cooldown-based abilities placed directly on the road.*

1. **Monowire Trip-Mine:** Deploys a temporary invisible wire. The first 5 enemies to pass take massive "Slice" damage.  
2. **Holographic Decoy:** Creates a "High-Priority Target" on the path. Enemies stop to attack the decoy for 4 seconds before moving on.  
3. **EMP Charge:** A manual detonator. Instantly disables all mechanical enemy shields in a medium radius and "Bricks" them for 3 seconds.

## **4\. Enemy Fractions**

## **A. The "Glass-Cannons" (Corporate Scripters)**

* **Courier:** Fast, low health. Ignores 10% of slows.  
* **Data-Thief:** Can "Stealth" (invisible to towers) for 2 seconds.  
* **Extraction Specialist:** High speed; drops a smoke screen when hit.

## **B. The "Tank-Bots" (Heavy Construction Units)**

* **Lifter-Bot:** High HP, slow.  
* **Bulldozer:** Front-facing shield; ignores damage from the front.  
* **Wrecking Ball:** Fast movement speed but moves in "Bursts."

## **C. The "Bio-Hacked" (Sewer Dwellers)**

* **Cyber-Rat:** Small, comes in swarms of 10+.  
* **Leaper:** Can jump over a 1-tile section of the path.  
* **Chem-Hulks:** On death, leaves a puddle of slowing sludge.

## **D. The "Glitch-Wraiths" (Digital Anomalies)**

* **Static-Wisp:** High evasion; 30% chance to dodge projectiles.  
* **Blink-Frame:** Teleports forward 2 tiles when health reaches 50%.  
* **Buffer-Ghost:** Heals nearby enemies by "re-coding" their health.

## **5\. The Bosses (End of Sector)**

1. **The "CEO" Executive Mech:** A towering bipod that fires missiles at your towers, temporarily disabling them.  
2. **The Hive-Mind Swarm:** A massive cloud of 500 micro-drones. You must use AoE (Chemical/Energy) to whittle it down; Kinetic is useless.  
3. **Project "Zero-Day":** A digital snake that moves through the *walls* instead of the path, forcing players to rotate tower coverage.  
4. **The Corporate Overlord:** The final encounter. It doesn't move. It "hacks" your towers and turns them against you until you deal enough damage to its uplink nodes.

**How the Enemies affect towers and plate resources**

In a classic Tower Defense (TD) loop, the "attack" is usually a tug-of-war between the enemies' goal and the player's resources. In **Grid-Lock: Neon Siege**, we can split this into two distinct systems to make the gameplay more engaging than just "marching to the exit."

## **1\. The Primary Target: The Data Vault (The Player)**

Most enemies are not interested in the towers; they are programmed to reach the **Data Vault** at the end of the path.

* **The "Life" Mechanic:** Each enemy that successfully enters the Vault "steals" or "corrupts" a portion of your Data. When your **Data Integrity** reaches **0%**, it's Game Over.  
* **The Twist:** Some enemies (like the *Data-Thief*) don't just take 1 life; they might steal **Revenue** or **Power** as they exit, making it harder to rebuild.

## **2\. The Secondary Target: The Towers (The Obstacles)**

To keep the player from just "setting and forgetting," certain enemy types specifically target your towers to create openings.

* **Sabotage (Temporary Disable):** Most "attacking" enemies shouldn't destroy towers (which can be frustrating and break the economy). Instead, they **Glitch** or **Stun** them.  
  * *Example:* The **Executive Mech** boss fires "Logic Bombs" that lock a tower for 5 seconds.  
* **Target Prioritization:**  
  * **Passives:** 90% of enemies ignore towers and just run the path.  
  * **Aggressives:** Only "Specialists" or "Bosses" attack. They usually target the tower with the *Highest Damage* or the *Nearest Power Substation*.

## **How "Attacking" Functions (for Programmers)**

From a development perspective, you would implement an **Aggro Logic** on the enemy prefabs:

| Enemy Action | Target | Result |
| :---- | :---- | :---- |
| **Breach** | Data Vault (End of Path) | Subtracts from PlayerHealth. Enemy is destroyed. |
| **Disrupt** | Nearest Tower | Tower enters Disabled state. Fire rate becomes 0 for $X$ seconds. |
| **Siphon** | Power Substation | Decreases global MaxPower while the enemy is within range. |
| **Aggro-Draw** | Holographic Decoy | Enemy stops pathing and plays an Attack animation until Decoy health is 0\. |

## **Optional: "Tower Health" Mechanic (perhaps for hardcore mode)**

If you want a more hardcore experience where towers *can* be destroyed:

* **Repair Logic:** Towers have a "Shield" bar. If an enemy attacks it, the shield drops. If it hits zero, the tower goes "Offline" and requires a **Manual Reboot** (costing Revenue and a 10-second timer) to come back.  
* **The Decoy Strategy:** This makes the **Holographic Decoy** skill essential. You place the decoy so the Boss attacks the hologram instead of your expensive Rail-Accelerator.

Towers.json

| {   "towers": \[     {       "type": "Kinetic",       "levels": \[         { "id": "kin\_1", "name": "Slug-Turret", "cost": 150, "powerDraw": 5, "damage": 10, "range": 3.5, "fireRate": 1.2, "special": "none" },         { "id": "kin\_2", "name": "Autocannon", "cost": 400, "powerDraw": 12, "damage": 25, "range": 4.0, "fireRate": 2.5, "special": "armor\_shred" },         { "id": "kin\_3", "name": "Rail-Accelerator", "cost": 1200, "powerDraw": 35, "damage": 150, "range": 8.0, "fireRate": 0.4, "special": "piercing\_3" }       \]     },     {       "type": "Debuff",       "levels": \[         { "id": "dbf\_1", "name": "Signal Jammer", "cost": 200, "powerDraw": 8, "damage": 0, "range": 3.0, "fireRate": 1.0, "special": "slow\_25" },         { "id": "dbf\_2", "name": "Neural Spam Rig", "cost": 500, "powerDraw": 15, "damage": 2, "range": 3.5, "fireRate": 1.0, "special": "slow\_45\_miss\_15" },         { "id": "dbf\_3", "name": "System Crasher", "cost": 1500, "powerDraw": 40, "damage": 5, "range": 4.5, "fireRate": 0.8, "special": "stun\_1s\_proc" }       \]     },     {       "type": "Energy",       "levels": \[         { "id": "nrg\_1", "name": "Plasma Torch", "cost": 250, "powerDraw": 10, "damage": 40, "range": 2.5, "fireRate": 5.0, "special": "continuous\_beam" },         { "id": "nrg\_2", "name": "Arc Pylon", "cost": 650, "powerDraw": 25, "damage": 30, "range": 4.5, "fireRate": 1.0, "special": "chain\_3" },         { "id": "nrg\_3", "name": "Singularity Well", "cost": 2000, "powerDraw": 60, "damage": 60, "range": 5.0, "fireRate": 0.5, "special": "pull\_vortex" }       \]     },     {       "type": "Chemical",       "levels": \[         { "id": "chm\_1", "name": "Acid Sprayer", "cost": 175, "powerDraw": 6, "damage": 5, "range": 3.0, "fireRate": 2.0, "special": "corrosion\_debuff" },         { "id": "chm\_2", "name": "Bio-Hazzard Vent", "cost": 550, "powerDraw": 14, "damage": 12, "range": 3.5, "fireRate": 1.5, "special": "aoe\_cloud" },         { "id": "chm\_3", "name": "Nanite Plague", "cost": 1800, "powerDraw": 30, "damage": 25, "range": 4.0, "fireRate": 1.0, "special": "on\_death\_spread" }       \]     },     {       "type": "Economic",       "levels": \[         { "id": "eco\_1", "name": "Solar Array", "cost": 100, "powerDraw": \-5, "damage": 0, "range": 0.0, "fireRate": 0.0, "special": "gen\_revenue\_5s" },         { "id": "eco\_2", "name": "Power Substation", "cost": 450, "powerDraw": \-20, "damage": 0, "range": 2.0, "fireRate": 0.0, "special": "buff\_nearby\_speed" },         { "id": "eco\_3", "name": "The Fusion Core", "cost": 2500, "powerDraw": \-75, "damage": 0, "range": 0.0, "fireRate": 0.0, "special": "global\_overclock\_active" }       \]     }   \] }  |
| :---- |

## **Notes for Implementation:**

* **PowerDraw:** Notice the **Economic** towers have *negative* values. This allows your PowerManager script to simply sum up the powerDraw of all active towers. If the total is $\> 0$, you are consuming; if it's $\< 0$, you are over-producing.  
* **Special Tags:** These strings are meant to be parsed by your **Effect Engine** to apply specific logic (like the chain\_3 for the Arc Pylon).  
* **Balancing:** The costs and damage numbers follow a standard progression curve, but you'll likely want to tweak these during playtesting.

Enemies.json

| {   "enemy\_factions": \[     {       "category": "Corporate Scripters",       "subtypes": \[         { "id": "scr\_1", "name": "Courier", "health": 40, "speed": 4.5, "bounty": 10, "logic\_tag": "ignore\_slow\_10" },         { "id": "scr\_2", "name": "Data-Thief", "health": 65, "speed": 3.8, "bounty": 25, "logic\_tag": "stealth\_active\_2s" },         { "id": "scr\_3", "name": "Extraction Specialist", "health": 120, "speed": 3.2, "bounty": 40, "logic\_tag": "smoke\_on\_hit" }       \]     },     {       "category": "Heavy Construction",       "subtypes": \[         { "id": "hvy\_1", "name": "Lifter-Bot", "health": 400, "speed": 1.2, "bounty": 50, "logic\_tag": "tank" },         { "id": "hvy\_2", "name": "Bulldozer", "health": 600, "speed": 1.0, "bounty": 75, "logic\_tag": "front\_shield\_90" },         { "id": "hvy\_3", "name": "Wrecking Ball", "health": 500, "speed": 0.8, "bounty": 100, "logic\_tag": "burst\_movement" }       \]     },     {       "category": "Bio-Hacked",       "subtypes": \[         { "id": "bio\_1", "name": "Cyber-Rat", "health": 15, "speed": 5.0, "bounty": 5, "logic\_tag": "swarm\_spawn\_10" },         { "id": "bio\_2", "name": "Leaper", "health": 80, "speed": 3.5, "bounty": 30, "logic\_tag": "path\_jump" },         { "id": "bio\_3", "name": "Chem-Hulk", "health": 350, "speed": 1.5, "bounty": 60, "logic\_tag": "death\_puddle\_slow" }       \]     },     {       "category": "Digital Anomalies",       "subtypes": \[         { "id": "glitch\_1", "name": "Static-Wisp", "health": 90, "speed": 3.0, "bounty": 35, "logic\_tag": "evasion\_30" },         { "id": "glitch\_2", "name": "Blink-Frame", "health": 150, "speed": 2.8, "bounty": 55, "logic\_tag": "teleport\_50\_hp" },         { "id": "glitch\_3", "name": "Buffer-Ghost", "health": 200, "speed": 2.0, "bounty": 80, "logic\_tag": "healing\_aura" }       \]     }   \],   "bosses": \[     {       "id": "boss\_1",       "name": "The CEO Executive Mech",       "health": 5000,       "speed": 0.5,       "bounty": 1000,       "logic\_tag": "disable\_tower\_missile",       "description": "Fires Logic Bombs that stun the player's highest-DPS tower."     },     {       "id": "boss\_2",       "name": "The Hive-Mind Swarm",       "health": 3000,       "speed": 1.5,       "bounty": 1200,       "logic\_tag": "split\_on\_damage",       "description": "Actually 500 micro-targets; immune to single-target Kinetic damage."     },     {       "id": "boss\_3",       "name": "Project Zero-Day",       "health": 4500,       "speed": 2.5,       "bounty": 1500,       "logic\_tag": "off\_path\_movement",       "description": "Slithers through environmental geometry, bypassing path-based traps."     },     {       "id": "boss\_4",       "name": "The Corporate Overlord",       "health": 10000,       "speed": 0.1,       "bounty": 5000,       "logic\_tag": "tower\_hijack",       "description": "End-game boss. Hacks player towers to fire on the Data Vault."     }   \] }  |
| :---- |

## **Implementation Guide for Programmers:**

* **Bounty:** The currency reward given to the player upon the enemy's `OnDeath()` event.  
* **logic\_tag:** Use a `switch` statement or a `Strategy Pattern` in your code to handle these tags. For example, `front_shield_90` should check the dot product of the incoming projectile and the enemy's forward vector to reduce damage by 90%.  
* **Speed:** These units are relative. If your grid tiles are 1 unit wide, a speed of `1.0` means the enemy crosses 1 tile per second.

## **Wave Spawner & Difficulty Progression**

| Wave | Primary Enemy Focus | Introduction | Difficulty Spike / Notes |
| :---- | :---- | :---- | :---- |
| **1-3** | Corporate Scripters | **Courier** | Basic pathing check. Player builds 1-2 Slug Turrets. |
| **4** | Corporate Scripters | **Data-Thief** | First stealth unit. Tests player reaction time. |
| **5** | **MINI-BOSS** | **Extraction Specialist** | High speed \+ smoke. Requires more than one turret. |
| **6-7** | Heavy Construction | **Lifter-Bot** | The "Tank" check. High HP requires multiple towers. |
| **8** | Heavy Construction | **Bulldozer** | **Strategic Shift:** Requires towers on curves to hit sides/back. |
| **9** | Mixed Wave | Swarms | First wave where "Power" vs "Damage" becomes a choice. |
| **10** | **BOSS 1** | **The CEO** | **The Stun Check.** Player must have 3+ towers to survive stuns. |
| **11-12** | Bio-Hacked | **Cyber-Rat** | Introduction of AoE needs (Acid Sprayer / Arc Pylon). |
| **13** | Bio-Hacked | **Leaper** | Enemies jumping tiles; forces mid-path coverage. |
| **14** | Bio-Hacked | **Chem-Hulk** | Death puddles. Tests "Skill" placement (EMP/Decoy). |
| **15** | **BOSS 2** | **The Hive-Mind** | **AoE Mandatory.** Kinetic towers will fail here. |
| **16-17** | Digital Anomalies | **Static-Wisp** | Evasion focus. High fire-rate towers are best. |
| **18** | Digital Anomalies | **Blink-Frame** | Teleportation; requires deep defense near the Vault. |
| **19** | Mixed Elite | **Buffer-Ghost** | Healers in the back. Requires "Rail-Accelerator" sniping. |
| **20** | **BOSS 3** | **Project Zero-Day** | **Geometry Check.** Enemy ignores the path entirely. |

## **Logic Integration for your Programmers**

To use the JSON data provided earlier with this wave table, your WaveManager script should look for these two variables:

1. **Spawn Interval:** The time between individual enemy spawns (decreases as waves go up).  
2. **Health Multiplier:** $Health\_{final} \= BaseHealth \\times (1 \+ (WaveNumber \\times 0.1))$. This ensures that even "Courier" units remain relevant in later waves.

## **Implementation Checklist**

* \[ \] **Pathfinding:** Implement A\* or Waypoint system for standard enemies.  
* \[ \] **State Machine:** Handle Stealth, Stunned, and Hacked states on enemies.  
* \[ \] **Power Manager:** A global singleton that listens for OnBuilt and OnDestroyed events from towers to update the UI Watts meter.

To round out your design documentation, here is the JSON configuration for the **Active Skills**.

I’ve designed these with a `placement_type` field so your programmers know whether the skill is a **Point** (hits a specific spot), **Path** (must be placed on the road), or **Global** (affects the whole map).

Active\_Skills.json

| {   "active\_skills": \[     {       "id": "skl\_1",       "name": "Monowire Trip-Mine",       "cooldown": 25.0,       "placement\_type": "Path",       "duration": 0,       "effects": {         "damage": 250,         "max\_triggers": 5,         "damage\_type": "Slashing"       },       "description": "Deploys a molecular-thin wire. Shreds the first 5 enemies that cross it."     },     {       "id": "skl\_2",       "name": "Holographic Decoy",       "cooldown": 45.0,       "placement\_type": "Path",       "duration": 8.0,       "effects": {         "health": 500,         "aggro\_radius": 2.5,         "status": "Taunt"       },       "description": "Project a high-priority target. Enemies stop to attack the decoy instead of moving."     },     {       "id": "skl\_3",       "name": "EMP Charge",       "cooldown": 60.0,       "placement\_type": "Point",       "duration": 3.0,       "effects": {         "radius": 4.0,         "shield\_strip": true,         "stun\_duration": 3.0,         "mechanical\_only": true       },       "description": "A manual detonation that instantly bricks mechanical units and strips all shields."     }   \],   "global\_overclock": {     "id": "skl\_ult",     "name": "System Overload",     "requirement": "Fusion Core Tower",     "cooldown": 120.0,     "duration": 10.0,     "effects": {       "fire\_rate\_mult": 1.5,       "power\_cost\_mult": 0,       "status": "GodMode\_Towers"     },     "description": "Available only with a Fusion Core. All towers fire 50% faster at zero power cost for 10s."   } }  |
| :---- |

## **Final Integration Steps for Your Team:**

1. **Config Loader:** Have the programmers create a `GameConfig` class that deserializes these JSON files into a List of Objects at runtime.  
2. **UI Data Binding:** The `name`, `cost`, and `description` fields should be used to automatically populate the "Build Menu" and "Skill Bar" tooltips.  
3. **The "Watt" Logic:** Ensure the `PowerManager` constantly checks the `powerDraw` sum.  
   * **If Sum \< 0:** Display "Grid Surplus" (Bonus to fire rate).  
   * **If Sum \> Max:** Display "Grid Warning" (Towers begin flickering).

