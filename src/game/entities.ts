import { Vector2D, EnemySubtype, TowerLevel, StatusEffect } from './types';
import { distance, moveTowards, normalize } from './math';
import { TOWERS } from './config';
import { EffectManager } from './EffectManager';
import { audioManager } from './audioManager';

export class DamageNumber {
  x: number;
  y: number;
  damage: number;
  life: number = 1.0; // seconds to display
  vy: number = -0.5; // float upward
  color: string;
  isCrit: boolean;

  constructor(x: number, y: number, damage: number, color: string, isCrit: boolean = false) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.color = color;
    this.isCrit = isCrit;
  }

  update(dt: number): boolean {
    this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0;
  }
}

export type ParticleShape = 'circle' | 'spark' | 'tron' | 'square';

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  shape: ParticleShape;
  angle: number; // For oriented shapes like sparks

  constructor(x: number, y: number, color: string, shape: ParticleShape = 'circle') {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxLife = Math.random() * 0.5 + 0.2;
    this.life = this.maxLife;
    this.color = color;
    this.size = Math.random() * 0.15 + 0.05;
    this.shape = shape;
    this.angle = angle; // Face direction of travel
  }

  update(dt: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0;
  }
}

export class Projectile {
  x: number;
  y: number;
  target: Enemy | null;
  speed: number = 8;
  damage: number;
  color: string;
  isBeam: boolean;
  special: string;
  sourceId: string;
  life: number = 1.0; // Used for lifetime of projectiles and beams

  vx: number = 0;
  vy: number = 0;
  pierceCount: number = 0;
  chainCount: number = 0;
  hitIds: Set<string> = new Set();

  isCloud: boolean = false;
  cloudRadius: number = 0;
  tickTimer: number = 0;
  isKinetic: boolean = false; // Triangular slug projectiles
  isChainLightning: boolean = false; // Jagged lightning for Arc Pylon
  cloudPulse: number = 0; // For pulsing amorphous cloud effect
  cloudOffsets: number[] = []; // Random offsets for irregular shape
  lightningSegments: {x: number, y: number}[] = []; // For chain lightning rendering

  constructor(x: number, y: number, target: Enemy | null, damage: number, color: string, isBeam: boolean, special: string, sourceId: string, isKinetic: boolean = false) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.isBeam = isBeam;
    this.special = special;
    this.sourceId = sourceId;
    this.isKinetic = isKinetic;
    if (isBeam) this.life = 0.1;

    // Initialize piercing logic
    if (this.special.startsWith('piercing_')) {
      this.pierceCount = parseInt(this.special.split('_')[1]);
      if (target) {
        // Calculate velocity vector for linear movement
        const dist = distance(this, target);
        if (dist > 0) {
          this.vx = ((target.x - this.x) / dist) * this.speed;
          this.vy = ((target.y - this.y) / dist) * this.speed;
        }
      }
    }

    if (this.special.startsWith('chain_')) {
      this.chainCount = parseInt(this.special.split('_')[1]);
    }
  }

  update(dt: number, enemies?: Enemy[], effectManager?: EffectManager): Enemy | null {
    if (this.isCloud && enemies) {
      this.life -= dt;
      this.tickTimer -= dt;

      if (this.tickTimer <= 0) {
        this.tickTimer = 0.5; // Tick every 0.5s
        for (const enemy of enemies) {
          if (distance(this, enemy) <= this.cloudRadius) {
            enemy.takeDamage(this.damage, this.x, this.y);
            // Future: Apply cloud-specific status effects here via effectManager
          }
        }
      }
      return null;
    }

    if (this.isBeam) {
      this.life -= dt;
      return null;
    }

    // Piercing / Linear Projectile Logic
    if (this.pierceCount > 0 && enemies) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt; // Lifetime acts as range limit/cleanup

      // Check collisions with ALL enemies
      for (const enemy of enemies) {
        if (this.hitIds.has(enemy.id)) continue;
        
        const dist = distance(this, enemy);
        if (dist < 0.5) { // Hit radius
          this.hitIds.add(enemy.id);
          this.pierceCount--;
          
          if (this.pierceCount <= 0) {
             this.life = 0; // Destroy if out of pierce charges
          }
          return enemy; // Return the hit enemy to be damaged
        }
      }
      return null;
    }

    if (!this.target || this.target.health <= 0) {
      this.life = 0;
      return null;
    }

    const dist = distance(this, this.target);
    if (dist < 0.5) {
      this.life = 0;
      return this.target; // Hit!
    }

    const newPos = moveTowards(this, this.target, this.speed * dt);
    this.x = newPos.x;
    this.y = newPos.y;
    return null;
  }

  isAlive(): boolean {
    return this.life > 0;
  }
}

export class Enemy implements Vector2D {
  id: string = crypto.randomUUID();
  x: number;
  y: number;
  pathIndex: number = 0;
  path: Vector2D[];
  subtype: EnemySubtype;
  health: number;
  maxHealth: number;
  rezTimer: number = 0.5;
  maxRezTimer: number = 0.5;
  isStealth: boolean = false;
  stealthMaxDuration: number = 0;
  stealthTimer: number = 0;
  hasSmokeAbility: boolean = false;
  smokeCooldown: number = 0;
  damageReduction: number = 0;
  isStunned: boolean = false;
  slowResistance: number = 0;
  isMechanical: boolean = false;
  hasShield: boolean = false;
  shieldActive: boolean = false;

  // New enemy logic tag properties
  evasionChance: number = 0; // evasion_30 - 30% dodge chance
  teleportThreshold: number = 0; // teleport_50_hp - teleport at 50% HP
  hasTeleported: boolean = false; // Track if teleport already used
  healingAuraRadius: number = 0; // healing_aura - radius for healing nearby enemies
  healingAmount: number = 0; // healing_aura - HP healed per tick
  healingTimer: number = 0; // healing_aura - timer for healing ticks
  swarmSpawnCount: number = 0; // swarm_spawn_10 - spawn 10 minions on death
  pathJumpDistance: number = 0; // path_jump - jump ahead along path (in cells)
  pathJumpTimer: number = 0; // path_jump - timer between jumps
  pathJumpInitialDelay: number = 0; // path_jump - initial delay before first jump
  cellsTraveled: number = 0; // Track cells traveled for jump trigger
  hasSplit: boolean = false; // split_on_damage - has already split
  splitHealthPercent: number = 0; // split_on_damage - HP % to split at
  splitOnHitChance: number = 0; // split_on_hit_80 - 80% chance to split on hit
  splitStunImmunity: number = 0; // Immunity timer after splitting to prevent stun-stun chains
  towerHijackRadius: number = 0; // tower_hijack - radius for hijacking towers
  hijackTimer: number = 0; // tower_hijack - timer between hijack attempts
  hijackedTowers: Set<string> = new Set(); // Track hijacked tower IDs

  decoyTarget: Decoy | null = null;
  attackCooldown: number = 0;
  effects: StatusEffect[] = [];
  // Calculated properties from effects
  speedMultiplier: number = 1.0;
  damageTakenMultiplier: number = 1.0;
  damageVulnerabilityMultiplier: number = 1.0; // From vulnerability effects
  // Visual state
  hasCorrosion: boolean = false;
  corrosionPulse: number = 0; // For pulsing glow effect
  corrosionOffsets: number[] = []; // For amorphous blob shape
  hasNanitePlague: boolean = false; // For nanite particle effects
  nanitePulse: number = 0; // For animating nanite particles
  facingAngle: number = 0; // Radians, for directional rendering
  // Shield properties
  shieldDamageReduction: number = 0.9; // Default 90% if not specified
  // Debug tracking
  damageTakenTotal: number = 0;
  damageMitigatedTotal: number = 0;
  hitCount: number = 0;
  damageNumbers: DamageNumber[] = [];
  isMinion: boolean = false; // True if spawned from another enemy (visual distinction)
  customColor: string | null = null; // Override color for visual distinction (e.g., clones)

  constructor(path: Vector2D[], subtype: EnemySubtype, waveMultiplier: number) {
    this.path = path;
    this.x = path[0].x;
    this.y = path[0].y;
    this.subtype = subtype;
    this.maxHealth = subtype.health * waveMultiplier;
    this.health = this.maxHealth;

    const category = this.subtype.id.substring(0, 3);
    if (category === 'hvy' || category === 'boss') {
      this.isMechanical = true;
    }

    if (this.subtype.logic_tag.startsWith('front_shield_')) {
      this.hasShield = true;
      this.shieldActive = true;
      // Parse shield percentage (e.g., "front_shield_75" = 75% reduction)
      const parts = this.subtype.logic_tag.split('_');
      const shieldPercent = parseFloat(parts[2]);
      this.shieldDamageReduction = shieldPercent / 100;
    }

    if (this.subtype.logic_tag.startsWith('stealth_active_')) {
      const parts = this.subtype.logic_tag.split('_');
      this.stealthMaxDuration = parseFloat(parts[2]);
      this.stealthTimer = 1.5; // Initial delay before first stealth cycle
      this.isStealth = false; // Start not stealthed
    }

    if (this.subtype.logic_tag === 'tank') {
      this.damageReduction = 0.3; // 30% flat damage reduction
    }

    if (this.subtype.logic_tag === 'smoke_on_hit') {
      this.hasSmokeAbility = true;
    }

    if (this.subtype.logic_tag.startsWith('ignore_slow_')) {
      const parts = this.subtype.logic_tag.split('_');
      this.slowResistance = parseInt(parts[2]) / 100;
    }

    // New enemy logic tags
    if (this.subtype.logic_tag.startsWith('evasion_')) {
      const parts = this.subtype.logic_tag.split('_');
      this.evasionChance = parseInt(parts[1]) / 100;
    }

    if (this.subtype.logic_tag.startsWith('teleport_')) {
      const parts = this.subtype.logic_tag.split('_');
      this.teleportThreshold = parseInt(parts[1]) / 100; // e.g., 50_hp -> 0.5
    }

    if (this.subtype.logic_tag === 'healing_aura') {
      this.healingAuraRadius = 3.0; // 3 cell radius
      this.healingAmount = 5; // 5 HP per tick
      this.healingTimer = 0;
    }

    if (this.subtype.logic_tag.startsWith('swarm_spawn_chance_')) {
      // 50% chance to spawn 1-3 minions on death
      this.swarmSpawnCount = 0; // Not used for chance-based spawning
    }

    if (this.subtype.logic_tag === 'path_jump') {
      this.pathJumpDistance = 5; // Jump 5 cells ahead
      this.pathJumpTimer = 0;
      this.pathJumpInitialDelay = 4.0; // 4 second delay before first jump
      this.cellsTraveled = 0;
    }

    if (this.subtype.logic_tag === 'split_on_damage') {
      this.splitHealthPercent = 0.5; // Split at 50% HP
    }

    if (this.subtype.logic_tag.startsWith('split_on_hit_')) {
      const parts = this.subtype.logic_tag.split('_');
      this.splitOnHitChance = parseInt(parts[3]) / 100; // e.g., split_on_hit_80 -> 0.8
    }

    if (this.subtype.logic_tag === 'tower_hijack') {
      this.towerHijackRadius = 5.0; // 5 cell radius
      this.hijackTimer = 0;
    }
  }

  addEffect(newEffect: StatusEffect) {
    // Stacking logic: for now, refresh duration of effects from the same source
    // More complex logic can be added (e.g. armor shred stacks, slow takes strongest)
    const existingEffectIndex = this.effects.findIndex(e => e.sourceId === newEffect.sourceId && e.type === newEffect.type);
    if (existingEffectIndex !== -1) {
      this.effects[existingEffectIndex].duration = newEffect.duration;
    } else {
      this.effects.push(newEffect);
    }
  }


  private processEffects(dt: number) {
    // Reset multipliers
    this.speedMultiplier = 1.0;
    this.damageTakenMultiplier = 1.0;
    this.damageVulnerabilityMultiplier = 1.0;
    this.isStunned = false; // Reset stun state
    this.hasCorrosion = false; // Reset corrosion visual state
    this.corrosionOffsets = []; // Reset amorphous blob shape
    this.splitStunImmunity -= dt; // Tick down split stun immunity
    let maxSlow = 0;
    let totalArmorShred = 0;

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.duration -= dt;

      if (effect.duration <= 0) {
        this.effects.splice(i, 1);
        continue;
      }

      if (effect.type === 'stun') {
        this.isStunned = true;
      }

      if (effect.type === 'slow') {
        const effectiveSlow = Math.max(0, effect.value * (1 - this.slowResistance));
        maxSlow = Math.max(maxSlow, effectiveSlow);
      }
      if (effect.type === 'armor_shred') {
        totalArmorShred += effect.value;
      }
      if (effect.type === 'vulnerability') {
        this.damageVulnerabilityMultiplier += effect.value;
      }

      // Track corrosion for visual effects
      if (effect.type === 'corrosion') {
        this.hasCorrosion = true;
        
        // Initialize corrosion offsets for amorphous blob shape (if not already set)
        if (this.corrosionOffsets.length === 0) {
          for (let i = 0; i < 8; i++) {
            this.corrosionOffsets.push(0.7 + Math.random() * 0.4); // 0.7 to 1.1
          }
        }
        
        // Update pulse timer for visual effect
        this.corrosionPulse += dt;
        if (this.corrosionPulse > 0.4) this.corrosionPulse = 0;
        // Initialize lastTick if undefined (track time since effect started)
        if (effect.lastTick === undefined) effect.lastTick = 0;

        effect.lastTick += dt; // Accumulate time
        if (effect.lastTick >= 0.5) { // Tick every 0.5s
          this.takeDamage(effect.value * 0.5); // Apply DoT damage (value is per second)
          effect.lastTick = 0; // Reset timer
        }
      }

      // Track nanite plague for visual effects
      if (effect.type === 'nanite_plague') {
        this.hasNanitePlague = true;
        // Update animation timer for nanite particles
        this.nanitePulse += dt;
        // Initialize lastTick if undefined (track time since effect started)
        if (effect.lastTick === undefined) effect.lastTick = 0;

        effect.lastTick += dt; // Accumulate time
        if (effect.lastTick >= 0.5) { // Tick every 0.5s
          this.takeDamage(effect.value * 0.5); // Apply DoT damage (value is per second)
          effect.lastTick = 0; // Reset timer
        }
      }
    }

    // Apply accumulated armor_shred after processing all effects
    this.damageTakenMultiplier += totalArmorShred;

    if (this.isStunned) {
      this.speedMultiplier = 0;
    } else {
      this.speedMultiplier = 1 - maxSlow;
    }
  }

  update(dt: number): boolean {
    if (this.health <= 0) return false;

    if (this.rezTimer > 0) {
      this.rezTimer -= dt;
      return true; // Still rezzing, don't move
    }

    // Update damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      if (!this.damageNumbers[i].update(dt)) {
        this.damageNumbers.splice(i, 1);
      }
    }

    // Update stealth timer
    if (this.isStealth && this.stealthTimer > 0) {
      this.stealthTimer -= dt;
      if (this.stealthTimer <= 0) {
        this.isStealth = false;
        // If this is periodic stealth, start the cooldown phase
        if (this.stealthMaxDuration > 0) {
          this.stealthTimer = this.stealthMaxDuration; // Cooldown period before next stealth
        }
      }
    } else if (!this.isStealth && this.stealthMaxDuration > 0 && this.stealthTimer > 0) {
      // Periodic stealth cooldown - when timer reaches 0, go stealth again
      this.stealthTimer -= dt;
      if (this.stealthTimer <= 0) {
        this.isStealth = true;
        this.stealthTimer = this.stealthMaxDuration; // Stealth duration
      }
    }

    // Update smoke cooldown
    if (this.smokeCooldown > 0) {
      this.smokeCooldown -= dt;
    }

    this.processEffects(dt);

    // Decoy Logic
    if (this.decoyTarget) {
      if (this.decoyTarget.health <= 0 || this.decoyTarget.duration <= 0) {
        // Decoy is gone - resume normal pathing
        this.decoyTarget = null;
        // Fall through to normal pathing below
      } else {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // Find closest path point to DECOY using enemy's path (which is already centered)
        let decoyClosestIdx = 0;
        let decoyClosestDist = Infinity;
        for (let i = 0; i < this.path.length; i++) {
          const d = distance(this.decoyTarget, this.path[i]);
          if (d < decoyClosestDist) {
            decoyClosestDist = d;
            decoyClosestIdx = i;
          }
        }

        // Move along path toward decoy's closest waypoint
        if (this.pathIndex < decoyClosestIdx) {
          // Decoy is ahead - move forward along path
          // Apply minion speed multiplier if set
          const minionSpeed = (this as any).minionSpeedMult || 1.0;
          const currentSpeed = this.subtype.speed * this.speedMultiplier * minionSpeed;
          const target = this.path[this.pathIndex + 1];
          if (target) {
            const newPos = moveTowards(this, target, currentSpeed * dt);
            
            // Update facing angle based on movement direction
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
              this.facingAngle = Math.atan2(dy, dx);
            }
            
            this.x = newPos.x;
            this.y = newPos.y;
            if (distance(this, target) < 0.1) {
              this.pathIndex++;
            }
          }
        } else {
          // Reached the decoy's closest waypoint - stop and attack
          // Face the decoy when attacking
          const dx = this.decoyTarget.x - this.x;
          const dy = this.decoyTarget.y - this.y;
          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            this.facingAngle = Math.atan2(dy, dx);
          }
          
          // Enemy stays ON THE PATH, attacking from the closest waypoint
          const distToDecoy = distance(this, this.decoyTarget);
          const attackRange = 1.5; // Can attack decoy from path
          if (distToDecoy <= attackRange && this.attackCooldown <= 0) {
            this.decoyTarget.takeDamage(20);
            this.attackCooldown = 1.0;
          }
          // Don't move - waiting at the waypoint
        }

        return true;
      }
    }

    // Normal pathing logic (only runs when no decoy or decoy expired)
    const target = this.path[this.pathIndex + 1];
    if (!target) return false; // Reached the end

    // Apply minion speed multiplier if set (stored as custom property)
    const minionSpeed = (this as any).minionSpeedMult || 1.0;
    const currentSpeed = this.subtype.speed * this.speedMultiplier * minionSpeed;
    const newPos = moveTowards(this, target, currentSpeed * dt);
    
    // Update facing angle based on movement direction
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      this.facingAngle = Math.atan2(dy, dx);
    }
    
    this.x = newPos.x;
    this.y = newPos.y;

    // Check if we reached the waypoint
    if (distance(this, target) < 0.1) {
      this.pathIndex++;
    }

    return true; // Still alive and moving
  }

  takeDamage(amount: number, sourceX?: number, sourceY?: number): { damaged: boolean, splitSpawn?: Enemy[] } {
    // Evasion: Chance to completely dodge the attack
    if (this.evasionChance > 0 && Math.random() < this.evasionChance) {
      return { damaged: false, splitSpawn: [] }; // Dodged!
    }

    // Teleport: Teleport forward when HP drops below threshold (only once)
    if (this.teleportThreshold > 0 && !this.hasTeleported) {
      const hpPercent = this.health / this.maxHealth;
      if (hpPercent <= this.teleportThreshold && amount > 0) {
        this.hasTeleported = true;
        // Teleport forward by jumping pathIndex ahead
        const jumpAhead = Math.min(10, this.path.length - 1 - this.pathIndex);
        if (jumpAhead > 0) {
          this.pathIndex += jumpAhead;
          // Snap to new waypoint position
          const newWaypoint = this.path[this.pathIndex];
          this.x = newWaypoint.x;
          this.y = newWaypoint.y;
        }
      }
    }

    // Split on damage: Spawn a clone when damaged below threshold (only once)
    if (this.splitHealthPercent > 0 && !this.hasSplit && amount > 0) {
      const hpPercent = this.health / this.maxHealth;
      if (hpPercent <= this.splitHealthPercent) {
        this.hasSplit = true;
        // Return signal to spawn a split clone
        return { damaged: true, splitSpawn: [this] }; // Signal to engine to create a clone
      }
    }

    let multiplier = (1 - this.damageReduction) * this.damageTakenMultiplier * this.damageVulnerabilityMultiplier;

    // Shield only applies if we have a valid damage source position
    if (this.shieldActive && sourceX !== undefined && sourceY !== undefined) {
      const nextNode = this.path[this.pathIndex + 1];
      // Determine forward vector
      if (nextNode) {
        const dx = nextNode.x - this.x;
        const dy = nextNode.y - this.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len > 0.001) {
          const fwdX = dx / len;
          const fwdY = dy / len;

          // Determine vector TO the damage source
          const sx = sourceX - this.x;
          const sy = sourceY - this.y;
          const slen = Math.sqrt(sx * sx + sy * sy);

          if (slen > 0.001) {
            const toSourceX = sx / slen;
            const toSourceY = sy / slen;

            // Dot product: 1.0 = directly in front, -1.0 = directly behind
            const dot = fwdX * toSourceX + fwdY * toSourceY;

            // Shield only blocks attacks from a 120° cone in front (dot > 0.5)
            if (dot > 0.5) {
              multiplier *= (1 - this.shieldDamageReduction);
            }
          }
        }
      }
    }

    // Ensure we always deal at least some damage
    multiplier = Math.max(0.1, multiplier);
    
    const finalDamage = amount * multiplier;
    const mitigated = amount - finalDamage;
    
    // Track damage
    this.damageTakenTotal += finalDamage;
    this.damageMitigatedTotal += mitigated;
    this.hitCount++;
    
    // Spawn floating damage number (show actual damage, minimum 1 for display)
    // Scale up damage display for visual clarity
    const displayDamage = Math.max(1, Math.floor(finalDamage * 5));
    // Color: Red if >80% of base damage, yellow if 40-80%, orange if <40%
    const damageRatio = finalDamage / amount;
    let damageColor: string;
    if (damageRatio >= 0.8) damageColor = '#ef4444'; // Red - near full damage
    else if (damageRatio >= 0.4) damageColor = '#fbbf24'; // Yellow - moderate mitigation
    else damageColor = '#f97316'; // Orange - heavily mitigated
    this.damageNumbers.push(new DamageNumber(
      this.x,
      this.y - 0.3,
      displayDamage,
      damageColor,
      damageRatio >= 0.9 // Crit if >90% damage
    ));
    
    this.health -= finalDamage;

    // Smoke on Hit Logic
    if (this.hasSmokeAbility && this.smokeCooldown <= 0 && this.health > 0) {
      this.isStealth = true;
      this.stealthTimer = 2.0; // Smoke lasts 2 seconds
      this.smokeCooldown = 5.0; // Cooldown before it can trigger again
    }

    // Split on Hit Logic - 80% chance to spawn a clone and stun original for 0.5s
    if (this.splitOnHitChance > 0 && this.health > 0 && amount > 0 && this.splitStunImmunity <= 0) {
      if (Math.random() < this.splitOnHitChance) {
        // Return health data for clone creation
        return { damaged: true, splitSpawn: [{ health: this.health, maxHealth: this.maxHealth, pathIndex: this.pathIndex } as any] };
      }
    }

    return { damaged: true, splitSpawn: [] };
  }
}


export class Tower implements Vector2D {
  x: number;
  y: number;
  categoryIndex: number;
  levelIndex: number;
  level: TowerLevel;
  cooldown: number = 0;
  fireRateMultiplier: number = 1.0;
  specialTimer: number = 0;
  activeTimer: number = 0;
  pulseTimer: number = 0; // For debuff tower visual pulses
  facingAngle: number = 0; // Radians, for directional rendering

  constructor(x: number, y: number, categoryIndex: number, levelIndex: number = 0) {
    this.x = x;
    this.y = y;
    this.categoryIndex = categoryIndex;
    this.levelIndex = levelIndex;
    this.level = TOWERS[categoryIndex].levels[levelIndex];
    this.facingAngle = -Math.PI / 2; // Default facing up (270 degrees)
  }

  update(dt: number, enemies: Enemy[], isBrownout: boolean, effectManager: EffectManager, effectParticles?: any[]): Projectile | null {
    if (this.level.fireRate === 0) return null; // Economic towers don't fire

    // Brownout reduces fire rate by 50% (cooldown recovers half as fast)
    // Buffs apply to recovery speed
    let speedMult = this.fireRateMultiplier;
    if (isBrownout) speedMult *= 0.5;

    const effectiveDt = dt * speedMult;

    // Debuff towers emit visual pulses and apply AOE effects
    const towerType = TOWERS[this.categoryIndex].type;
    const isDebuff = towerType === 'Debuff';

    if (isDebuff) {
      // Scale pulse intensity with tower tier (levelIndex 0, 1, 2)
      const pulseIntensity = 0.4 + (this.levelIndex * 0.2); // 0.4, 0.6, 0.8
      this.pulseTimer -= dt;
      if (this.pulseTimer <= 0) {
        this.pulseTimer = 1.0; // Pulse every 1 second
        
        // Play debuff pulse sound
        audioManager.play('debuff');

        // Apply AOE effect to ALL enemies in range
        for (const enemy of enemies) {
          if (enemy.isStealth) continue;
          const dist = distance(this, enemy);
          if (dist <= this.level.range) {
            effectManager.applySpecial(enemy, this.level.special, this.level.id, 0);
          }
        }
        
        // Emit pulse effect (caller will add to effectParticles)
        if (effectParticles) {
          const towerLevelIndex = this.levelIndex; // Capture for anonymous class
          effectParticles.push(new (class {
            x: number; y: number; radius: number; maxRadius: number;
            life: number; maxLife: number; color: string; levelIndex: number;
            constructor(x: number, y: number, radius: number, duration: number, color: string, levelIndex: number) {
              this.x = x; this.y = y; this.maxRadius = radius; this.maxLife = duration;
              this.life = duration; this.color = color; this.radius = 0; this.levelIndex = levelIndex;
            }
            update(dt: number): boolean { this.life -= dt; this.radius = this.maxRadius * (1 - this.life / this.maxLife); return this.life > 0; }
            draw(ctx: CanvasRenderingContext2D, cellSize: number) {
              const alpha = pulseIntensity * (this.life / this.maxLife);
              ctx.globalAlpha = alpha; ctx.strokeStyle = this.color; ctx.lineWidth = 3;
              ctx.shadowBlur = 10 + (this.levelIndex * 5); // More blur for higher tiers
              ctx.shadowColor = this.color;
              ctx.beginPath(); ctx.arc(this.x * cellSize, this.y * cellSize, this.radius * cellSize, 0, Math.PI * 2); ctx.stroke();
              ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
            }
          })(this.x, this.y, this.level.range, 0.8, this.level.color, towerLevelIndex));
        }
      }
      return null; // Debuff towers don't fire projectiles
    }

    if (this.cooldown > 0) {
      this.cooldown -= effectiveDt;
      return null;
    }

    // Find target
    let target: Enemy | null = null;
    let minDistance = this.level.range;

    for (const enemy of enemies) {
      if (enemy.isStealth) continue;
      const dist = distance(this, enemy);
      if (dist <= this.level.range) {
        // Simple targeting: closest
        if (dist < minDistance) {
          minDistance = dist;
          target = enemy;
        }
      }
    }

    if (target) {
      this.cooldown = 1 / this.level.fireRate;

      // Update facing angle to point at target
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        this.facingAngle = Math.atan2(dy, dx);
      }

      const isBeam = this.level.special === 'continuous_beam';
      const isKinetic = towerType === 'Kinetic';
      const isChain = this.level.special.startsWith('chain_');

      if (isBeam) {
        // Continuous beam: deal full damage per shot (fireRate determines shots/second)
        target.takeDamage(this.level.damage, this.x, this.y);
        effectManager.applySpecial(target, this.level.special, this.level.id, this.level.damage);
      }
      
      const proj = new Projectile(this.x, this.y, target, this.level.damage, this.level.color, isBeam, this.level.special, this.level.id, isKinetic);
      if (isChain) {
        proj.isChainLightning = true;
        // Will be populated by engine when chain bounces
      }
      return proj;
    }

    return null;
  }
}

export class Trap {
  id: string = crypto.randomUUID();
  type: string; // 'monowire'
  x: number;
  y: number;
  damage: number;
  triggersRemaining: number;
  color: string;
  hitEnemyIds: Set<string> = new Set();

  constructor(x: number, y: number, type: string, damage: number, triggers: number, color: string) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.damage = damage;
    this.triggersRemaining = triggers;
    this.color = color;
  }
}

export class Decoy {
  id: string = crypto.randomUUID();
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  duration: number;
  maxDuration: number;
  radius: number;
  color: string;

  constructor(x: number, y: number, health: number, duration: number, radius: number, color: string) {
    this.x = x;
    this.y = y;
    this.health = health;
    this.maxHealth = health;
    this.duration = duration;
    this.maxDuration = duration;
    this.radius = radius;
    this.color = color;
  }

  update(dt: number): boolean {
    this.duration -= dt;
    return this.duration > 0 && this.health > 0;
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
  }
}

export class BallLightning {
  id: string = crypto.randomUUID();
  x: number;
  y: number;
  duration: number;
  maxDuration: number;
  damage: number;
  stunChance: number;
  color: string;
  moveSpeed: number;
  pathIndex: number; // Current path segment index
  path: { x: number, y: number }[]; // Reference to path waypoints
  t: number; // Position along current segment (0-1)
  direction: number; // 1 = forward along path, -1 = backward

  constructor(x: number, y: number, duration: number, damage: number, stunChance: number, color: string, path: { x: number, y: number }[], startPathIndex: number, startT: number) {
    this.x = x;
    this.y = y;
    this.duration = duration;
    this.maxDuration = duration;
    this.damage = damage;
    this.stunChance = stunChance;
    this.color = color;
    this.moveSpeed = 2.5; // Grid units per second
    this.pathIndex = startPathIndex;
    this.path = path;
    this.t = startT;
    this.direction = -1; // Move backward (toward path start)
  }

  update(dt: number): boolean {
    this.duration -= dt;
    
    if (this.pathIndex < 0 || this.pathIndex >= this.path.length - 1) {
      return false; // Reached end of path
    }

    // Move along current segment
    const p1 = this.path[this.pathIndex];
    const p2 = this.path[this.pathIndex + 1];
    const segLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    
    if (segLength === 0) {
      this.pathIndex += this.direction;
      return this.duration > 0;
    }

    // Move backward along segment
    this.t -= (this.moveSpeed * dt) / segLength;

    // Check if we've reached the start of this segment
    if (this.t <= 0 && this.direction < 0) {
      this.pathIndex--;
      this.t = 1; // Start at end of previous segment
      
      if (this.pathIndex < 0) {
        return false; // Reached start of path
      }
    }
    // Check if we've reached the end of this segment (shouldn't happen going backward)
    else if (this.t >= 1 && this.direction > 0) {
      this.pathIndex++;
      this.t = 0;
      
      if (this.pathIndex >= this.path.length - 1) {
        return false; // Reached end of path
      }
    }

    // Update position (path coords are grid indices, add 0.5 for cell center)
    const currentP1 = this.path[this.pathIndex];
    const currentP2 = this.path[this.pathIndex + 1];
    this.x = currentP1.x + (currentP2.x - currentP1.x) * this.t + 0.5;
    this.y = currentP1.y + (currentP2.y - currentP1.y) * this.t + 0.5;

    return this.duration > 0;
  }
}

export class GridZone {
  id: string = crypto.randomUUID();
  cells: { x: number, y: number }[]; // 3 grid cell INDICES (integers)
  duration: number;
  maxDuration: number;
  damage: number;
  color: string;
  centerX: number; // Center position for rendering
  centerY: number;

  constructor(gridX: number, gridY: number, duration: number, damage: number, color: string, path: {x: number, y: number}[]) {
    this.duration = duration;
    this.maxDuration = duration;
    this.damage = damage;
    this.color = color;
    this.centerX = gridX + 0.5;
    this.centerY = gridY + 0.5;
    
    // Find 3 consecutive cells along the path, following the path around corners
    this.cells = this.getCellsAlongPath(gridX, gridY, path);
  }

  private getCellsAlongPath(gridX: number, gridY: number, path: {x: number, y: number}[]): {x: number, y: number}[] {
    const cells: {x: number, y: number}[] = [];
    
    // First, find which path segment contains the placement cell
    let segmentIndex = -1;
    let bestDistance = Infinity;
    
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      
      // Check horizontal segment
      if (p1.y === p2.y && gridY === p1.y) {
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        if (gridX >= minX && gridX <= maxX) {
          const distFromStart = p2.x > p1.x ? (gridX - p1.x) : (p1.x - gridX);
          if (distFromStart < bestDistance) {
            bestDistance = distFromStart;
            segmentIndex = i;
          }
        }
      }
      
      // Check vertical segment
      if (p1.x === p2.x && gridX === p1.x) {
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);
        if (gridY >= minY && gridY <= maxY) {
          const distFromStart = p2.y > p1.y ? (gridY - p1.y) : (p1.y - gridY);
          if (distFromStart < bestDistance) {
            bestDistance = distFromStart;
            segmentIndex = i;
          }
        }
      }
    }
    
    if (segmentIndex === -1) {
      // Fallback: just use 3 cells to the right
      return [
        { x: gridX, y: gridY },
        { x: gridX + 1, y: gridY },
        { x: gridX + 2, y: gridY }
      ];
    }
    
    // Now trace 3 cells along the path from the placement position
    let currentX = gridX;
    let currentY = gridY;
    let currentSegment = segmentIndex;
    let cellsAdded = 0;
    
    // Add the first cell (placement position)
    cells.push({ x: currentX, y: currentY });
    cellsAdded++;
    
    while (cellsAdded < 3 && currentSegment < path.length - 1) {
      const p1 = path[currentSegment];
      const p2 = path[currentSegment + 1];
      
      if (p1.y === p2.y) { // Horizontal segment
        const direction = p2.x > p1.x ? 1 : -1;
        const segmentEnd = direction > 0 ? Math.max(p1.x, p2.x) : Math.min(p1.x, p2.x);
        
        // Add cells along this segment until we reach the end or have 3 cells
        while (cellsAdded < 3) {
          const nextX = currentX + direction;
          
          // Check if we've reached/passed the end of this segment
          if ((direction > 0 && nextX > segmentEnd) || (direction < 0 && nextX < segmentEnd)) {
            break; // Move to next segment
          }
          
          currentX = nextX;
          cells.push({ x: currentX, y: currentY });
          cellsAdded++;
        }
      } else if (p1.x === p2.x) { // Vertical segment
        const direction = p2.y > p1.y ? 1 : -1;
        const segmentEnd = direction > 0 ? Math.max(p1.y, p2.y) : Math.min(p1.y, p2.y);
        
        // Add cells along this segment until we reach the end or have 3 cells
        while (cellsAdded < 3) {
          const nextY = currentY + direction;
          
          // Check if we've reached/passed the end of this segment
          if ((direction > 0 && nextY > segmentEnd) || (direction < 0 && nextY < segmentEnd)) {
            break; // Move to next segment
          }
          
          currentY = nextY;
          cells.push({ x: currentX, y: currentY });
          cellsAdded++;
        }
      }
      
      // Move to next segment
      currentSegment++;
    }
    
    return cells;
  }

  update(dt: number): boolean {
    this.duration -= dt;
    return this.duration > 0;
  }
}
