import { Vector2D, EnemySubtype, TowerLevel, StatusEffect } from './types';
import { distance, moveTowards, normalize } from './math';
import { TOWERS } from './config';
import { EffectManager } from './EffectManager';

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

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;

  constructor(x: number, y: number, color: string) {
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

  constructor(x: number, y: number, target: Enemy | null, damage: number, color: string, isBeam: boolean, special: string, sourceId: string) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.isBeam = isBeam;
    this.special = special;
    this.sourceId = sourceId;
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

  decoyTarget: Decoy | null = null;
  attackCooldown: number = 0;
  effects: StatusEffect[] = [];
  // Calculated properties from effects
  speedMultiplier: number = 1.0;
  damageTakenMultiplier: number = 1.0;
  // Shield properties
  shieldDamageReduction: number = 0.9; // Default 90% if not specified
  // Debug tracking
  damageTakenTotal: number = 0;
  damageMitigatedTotal: number = 0;
  hitCount: number = 0;
  damageNumbers: DamageNumber[] = [];

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
    this.isStunned = false; // Reset stun state
    let maxSlow = 0;

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
      if (effect.type === 'armor_shred') this.damageTakenMultiplier += effect.value;

      // Handle Corrosion (DoT)
      if (effect.type === 'corrosion' || effect.type === 'nanite_plague') {
        // Initialize lastTick if undefined (track time since effect started)
        if (effect.lastTick === undefined) effect.lastTick = 0;

        effect.lastTick += dt; // Accumulate time
        if (effect.lastTick >= 0.5) { // Tick every 0.5s
          this.takeDamage(effect.value * 0.5); // Apply DoT damage (value is per second)
          effect.lastTick = 0; // Reset timer
        }
      }
    }
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
          const currentSpeed = this.subtype.speed * this.speedMultiplier;
          const target = this.path[this.pathIndex + 1];
          if (target) {
            const newPos = moveTowards(this, target, currentSpeed * dt);
            this.x = newPos.x;
            this.y = newPos.y;
            if (distance(this, target) < 0.1) {
              this.pathIndex++;
            }
          }
        } else {
          // Reached the decoy's closest waypoint - stop and attack
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

    const currentSpeed = this.subtype.speed * this.speedMultiplier;
    const newPos = moveTowards(this, target, currentSpeed * dt);
    this.x = newPos.x;
    this.y = newPos.y;

    // Check if we reached the waypoint
    if (distance(this, target) < 0.1) {
      this.pathIndex++;
    }

    return true; // Still alive and moving
  }

  takeDamage(amount: number, sourceX?: number, sourceY?: number) {
    let multiplier = (1 - this.damageReduction) * this.damageTakenMultiplier;

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
    this.damageNumbers.push(new DamageNumber(
      this.x, 
      this.y - 0.3, 
      displayDamage, 
      finalDamage >= amount * 0.9 ? '#ef4444' : '#f59e0b', // Red if full damage, orange if mitigated
      finalDamage >= amount * 0.9 // Crit if >90% damage
    ));
    
    this.health -= finalDamage;

    // Smoke on Hit Logic
    if (this.hasSmokeAbility && this.smokeCooldown <= 0 && this.health > 0) {
      this.isStealth = true;
      this.stealthTimer = 2.0; // Smoke lasts 2 seconds
      this.smokeCooldown = 5.0; // Cooldown before it can trigger again
    }
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

  constructor(x: number, y: number, categoryIndex: number, levelIndex: number = 0) {
    this.x = x;
    this.y = y;
    this.categoryIndex = categoryIndex;
    this.levelIndex = levelIndex;
    this.level = TOWERS[categoryIndex].levels[levelIndex];
  }

  update(dt: number, enemies: Enemy[], isBrownout: boolean, effectManager: EffectManager): Projectile | null {
    if (this.level.fireRate === 0) return null; // Economic towers don't fire

    // Brownout reduces fire rate by 50% (cooldown recovers half as fast)
    // Buffs apply to recovery speed
    let speedMult = this.fireRateMultiplier;
    if (isBrownout) speedMult *= 0.5;

    const effectiveDt = dt * speedMult;

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
      const isBeam = this.level.special === 'continuous_beam';

      // For towers with 0 damage (pure debuff), just apply the effect
      if (this.level.damage === 0) {
        effectManager.applySpecial(target, this.level.special, this.level.id, 0);
        return null;
      }

      if (isBeam) {
        target.takeDamage(this.level.damage * effectiveDt * this.level.fireRate, this.x, this.y); // Continuous damage
        effectManager.applySpecial(target, this.level.special, this.level.id, this.level.damage);
      }
      return new Projectile(this.x, this.y, target, this.level.damage, this.level.color, isBeam, this.level.special, this.level.id);
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
