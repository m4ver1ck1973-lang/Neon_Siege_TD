import { Vector2D, EnemySubtype, TowerLevel } from './types';
import { distance, moveTowards, normalize } from './math';
import { TOWERS } from './config';

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
  life: number = 0.1; // For beams

  constructor(x: number, y: number, target: Enemy, damage: number, color: string, isBeam: boolean = false) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.isBeam = isBeam;
  }

  update(dt: number): boolean {
    if (this.isBeam) {
      this.life -= dt;
      return this.life > 0;
    }

    if (!this.target || this.target.health <= 0) return false;

    const dist = distance(this, this.target);
    if (dist < 0.5) {
      this.target.takeDamage(this.damage);
      return false; // Hit
    }

    const newPos = moveTowards(this, this.target, this.speed * dt);
    this.x = newPos.x;
    this.y = newPos.y;
    return true;
  }
}

export class Enemy implements Vector2D {
  x: number;
  y: number;
  pathIndex: number = 0;
  path: Vector2D[];
  subtype: EnemySubtype;
  health: number;
  maxHealth: number;
  slowTimer: number = 0;
  rezTimer: number = 0.5;
  maxRezTimer: number = 0.5;

  constructor(path: Vector2D[], subtype: EnemySubtype, waveMultiplier: number) {
    this.path = path;
    this.x = path[0].x;
    this.y = path[0].y;
    this.subtype = subtype;
    this.maxHealth = subtype.health * waveMultiplier;
    this.health = this.maxHealth;
  }

  update(dt: number): boolean {
    if (this.health <= 0) return false;

    if (this.rezTimer > 0) {
      this.rezTimer -= dt;
      return true; // Still rezzing, don't move
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
    }

    const target = this.path[this.pathIndex + 1];
    if (!target) return false; // Reached end

    let currentSpeed = this.subtype.speed;
    if (this.slowTimer > 0) {
      currentSpeed *= 0.5; // 50% slow
    }

    const newPos = moveTowards(this, target, currentSpeed * dt);
    this.x = newPos.x;
    this.y = newPos.y;

    if (this.x === target.x && this.y === target.y) {
      this.pathIndex++;
    }

    return true;
  }

  takeDamage(amount: number) {
    this.health -= amount;
  }

  applySlow(duration: number) {
    this.slowTimer = Math.max(this.slowTimer, duration);
  }
}

export class Tower implements Vector2D {
  x: number;
  y: number;
  categoryIndex: number;
  levelIndex: number;
  level: TowerLevel;
  cooldown: number = 0;

  constructor(x: number, y: number, categoryIndex: number, levelIndex: number = 0) {
    this.x = x;
    this.y = y;
    this.categoryIndex = categoryIndex;
    this.levelIndex = levelIndex;
    this.level = TOWERS[categoryIndex].levels[levelIndex];
  }

  update(dt: number, enemies: Enemy[], isBrownout: boolean): Projectile | null {
    if (this.level.fireRate === 0) return null; // Economic towers don't fire

    // Brownout reduces fire rate by 50% (cooldown recovers half as fast)
    const effectiveDt = isBrownout ? dt * 0.5 : dt;
    
    if (this.cooldown > 0) {
      this.cooldown -= effectiveDt;
      return null;
    }

    // Find target
    let target: Enemy | null = null;
    let minDistance = this.level.range;

    for (const enemy of enemies) {
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
      
      if (this.level.special.startsWith('slow')) {
        target.applySlow(2.0);
      }

      if (isBeam) {
        target.takeDamage(this.level.damage * effectiveDt * this.level.fireRate); // Continuous damage
      }
      
      return new Projectile(this.x, this.y, target, this.level.damage, this.level.color, isBeam);
    }

    return null;
  }
}
