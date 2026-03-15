import { GameState, Vector2D, LevelConfig } from './types';
import { ENEMIES, TOWERS, ACTIVE_SKILLS } from './config';
import { Enemy, Tower, Projectile, Particle, Trap, Decoy } from './entities';
import { EffectManager } from './EffectManager';
import { distance } from './math';
import { audioManager } from './audioManager';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  level: LevelConfig;
  effectManager: EffectManager;
  gridWidth: number;
  gridHeight: number;
  cellSize = 0;

  state: GameState;
  onStateChange: (state: GameState) => void;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  traps: Trap[] = [];
  decoys: Decoy[] = [];
  particles: Particle[] = [];
  effectParticles: { update(dt: number): boolean; draw(ctx: CanvasRenderingContext2D, cellSize: number): void; }[] = [];
  previewTower: { x: number, y: number, range: number, color: string, type: string } | null = null;
  previewSkill: { x: number, y: number, radius: number, color: string, type: string } | null = null;
  selectedPlacedTower: Tower | null = null;

  lastTime: number = 0;
  animationFrameId: number = 0;

  waveTimer: number = 0;
  enemiesToSpawn: number = 0;
  spawnTimer: number = 0;
  gameSpeed: number = 1.0;

  setGameSpeed(speed: number) {
    this.gameSpeed = speed;
    this.state.gameSpeed = speed;
    this.notifyState();
  }

  setPreview(preview: { x: number, y: number, range: number, color: string, type: string } | null) {
    this.previewTower = preview;
  }

  setSkillPreview(preview: { x: number, y: number, radius: number, color: string, type: string } | null) {
    this.previewSkill = preview;
  }

  private handleResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement, level: LevelConfig, onStateChange: (state: GameState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = level;
    this.gridWidth = level.gridWidth;
    this.gridHeight = level.gridHeight;
    this.onStateChange = onStateChange;
    this.effectManager = new EffectManager();

    this.state = {
      health: level.startingHealth,
      maxHealth: level.startingHealth,
      credits: level.startingCredits,
      wave: 0,
      maxPower: 100,
      usedPower: 0,
      isBrownout: false,
      status: 'planning',
      skillCooldowns: {},
      gameSpeed: 1.0
    };

    // Initialize audio (will actually start on first user interaction)
    audioManager.initialize();

    this.resize();
    window.addEventListener('resize', this.handleResize);

    this.startWave();
    this.lastTime = performance.now();
    this.loop(this.lastTime);

    // Start background music (will be blocked by browser until user interaction)
    setTimeout(() => {
      audioManager.playMusic();
    }, 500);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
      this.cellSize = Math.min(this.canvas.width / this.gridWidth, this.canvas.height / this.gridHeight);
    }
  }

  startWave() {
    if (this.state.wave >= this.level.waves.length) {
      this.state.status = 'victory';
      this.notifyState();
      return;
    }
    
    this.state.status = 'planning';
    this.state.wave++;
    this.notifyState();
  }

  beginWave() {
    if (this.state.status === 'planning') {
      this.state.status = 'playing';
      const waveConfig = this.level.waves[this.state.wave - 1];
      this.enemiesToSpawn = waveConfig.count;
      this.spawnTimer = waveConfig.interval;
      this.notifyState();
    }
  }

  updatePower() {
    let max = 100;
    let used = 0;
    
    for (const t of this.towers) {
      if (t.level.powerDraw < 0) {
        max += Math.abs(t.level.powerDraw);
      } else {
        used += t.level.powerDraw;
      }
    }
    
    this.state.maxPower = max;
    this.state.usedPower = used;
    this.state.isBrownout = used > max;
    this.notifyState();
  }

  placeTower(x: number, y: number, categoryIndex: number): boolean {
    const level = TOWERS[categoryIndex].levels[0];
    if (this.state.credits >= level.cost) {
      // Check if space is occupied
      const occupied = this.towers.some(t => Math.floor(t.x) === x && Math.floor(t.y) === y);
      // Check if on path
      const onPath = this.isPath(x, y);
      
      if (!occupied && !onPath) {
        this.state.credits -= level.cost;
        this.towers.push(new Tower(x + 0.5, y + 0.5, categoryIndex, 0));
        this.updatePower();
        return true;
      }
    }
    return false;
  }

  useSkill(skillId: string, x: number, y: number): boolean {
    const gridX = Math.floor(x);
    const gridY = Math.floor(y);

    const skill = ACTIVE_SKILLS.find(s => s.id === skillId);
    if (!skill) return false;

    // Check Cooldown
    if ((this.state.skillCooldowns[skillId] || 0) > 0) return false;

    if (skill.placementType === 'Path') {
      if (this.isPath(gridX, gridY)) {
        if (skill.id === 'skl_1') { // Monowire
          this.traps.push(new Trap(
            gridX + 0.5,
            gridY + 0.5,
            'monowire',
            skill.damage || 250,
            skill.maxTriggers || 5,
            skill.color
          ));
          audioManager.play('skill_emp');
        }
        if (skill.id === 'skl_2' && skill.effects) { // Holographic Decoy
          this.decoys.push(new Decoy(
            gridX + 0.5,
            gridY + 0.5,
            skill.effects.health || 500,
            skill.duration || 8.0,
            skill.effects.aggro_radius || 3.0,
            skill.color
          ));
          // Create a visual spawn effect for the decoy
          for(let i = 0; i < 20; i++) {
            this.particles.push(new Particle(gridX + 0.5, gridY + 0.5, skill.color));
          }
          audioManager.play('skill_fall');
        }

        this.state.skillCooldowns[skillId] = skill.cooldown;
        this.notifyState();
        return true;
      }
    } else if (skill.placementType === 'Point') {
      if (skill.id === 'skl_3' && skill.effects) { // EMP Charge
        const blastRadius = skill.effects.radius || 4.0;
        const stunDuration = skill.effects.stun_duration || 3.0;
        const blastCenter = { x: gridX + 0.5, y: gridY + 0.5 };

        // Create visual effect
        this.effectParticles.push(new EmpBlastEffect(blastCenter.x, blastCenter.y, blastRadius, 0.5, skill.color));
        audioManager.play('skill_emp');

        for (const enemy of this.enemies) {
          if (distance(blastCenter, enemy) <= blastRadius) {
            if (enemy.isMechanical) {
              if (skill.effects.shield_strip && enemy.hasShield) {
                enemy.shieldActive = false;
                // TODO: Add a particle effect on the enemy itself to show shield break
              }
              enemy.addEffect({
                id: crypto.randomUUID(),
                sourceId: skill.id,
                type: 'stun',
                value: 1,
                duration: stunDuration,
              });
            }
          }
        }

        this.state.skillCooldowns[skillId] = skill.cooldown;
        this.notifyState();
        return true;
      }
    }
    return false;
  }

  upgradeTower(tower: Tower): boolean {
    const category = TOWERS[tower.categoryIndex];
    if (tower.levelIndex + 1 < category.levels.length) {
      const nextLevel = category.levels[tower.levelIndex + 1];
      if (this.state.credits >= nextLevel.cost) {
        this.state.credits -= nextLevel.cost;
        tower.levelIndex++;
        tower.level = nextLevel;
        this.updatePower();
        this.notifyState();
        return true;
      }
    }
    return false;
  }

  sellTower(tower: Tower) {
    const index = this.towers.indexOf(tower);
    if (index !== -1) {
      let totalCost = 0;
      const category = TOWERS[tower.categoryIndex];
      for (let i = 0; i <= tower.levelIndex; i++) {
        totalCost += category.levels[i].cost;
      }
      this.state.credits += Math.floor(totalCost * 0.5);
      this.towers.splice(index, 1);
      if (this.selectedPlacedTower === tower) {
        this.selectedPlacedTower = null;
      }
      this.updatePower();
      this.notifyState();
    }
  }

  isPath(x: number, y: number): boolean {
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const p1 = this.level.path[i];
      const p2 = this.level.path[i+1];
      
      const isHorizontal = p1.y === p2.y;
      const isVertical = p1.x === p2.x;

      if (isHorizontal) {
        if (y === p1.y && x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x)) {
          return true;
        }
      } else if (isVertical) {
        if (x === p1.x && y >= Math.min(p1.y, p2.y) && y <= Math.max(p1.y, p2.y)) {
          return true;
        }
      }
    }
    return false;
  }

  spawnEnemy() {
    const waveConfig = this.level.waves[this.state.wave - 1];
    let subtype = ENEMIES[0].subtypes[0]; // fallback
    
    for (const faction of ENEMIES) {
      const found = faction.subtypes.find(s => s.id === waveConfig.enemyId);
      if (found) subtype = found;
    }
    
    const waveMultiplier = 1 + (this.state.wave * 0.1);
    const centeredPath = this.level.path.map(p => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    this.enemies.push(new Enemy(centeredPath, subtype, waveMultiplier));
  }

  update(dt: number) {
    if (this.state.status === 'gameover' || this.state.status === 'victory') return;

    if (this.state.status === 'playing') {
      // Spawning
      // Update Skill Cooldowns
      for (const id in this.state.skillCooldowns) {
        if (this.state.skillCooldowns[id] > 0) {
          this.state.skillCooldowns[id] = Math.max(0, this.state.skillCooldowns[id] - dt);
        }
      }
      // Note: We notify state in loop only if needed, but usually UI polls or we trigger on change.
      // For smooth CD timers, UI might need frequent updates or handle interpolation.

      if (this.enemiesToSpawn > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnEnemy();
          this.enemiesToSpawn--;
          this.spawnTimer = this.level.waves[this.state.wave - 1].interval;
        }
      } else if (this.enemies.length === 0) {
        this.startWave();
      }
    }

    // Apply Tower Buffs (e.g. Power Substation & Global Overclock)
    let globalOverclockActive = false;

    // First pass: Reset multipliers and process active effects
    for (const t of this.towers) {
      t.fireRateMultiplier = 1.0;

      // Fusion Core: Global Overclock Logic
      if (t.level.special === 'global_overclock_active') {
        if (t.activeTimer > 0) {
          t.activeTimer -= dt;
          globalOverclockActive = true;
          // Visual effect: spawn particles occasionally while active
          if (Math.random() < 0.2) {
            this.particles.push(new Particle(t.x, t.y, '#d946ef')); // fuchsia-500
          }
        } else {
          t.specialTimer -= dt;
          if (t.specialTimer <= 0) {
            t.activeTimer = 10.0; // 10s Duration
            t.specialTimer = 120.0; // 120s Cooldown
          }
        }
      }

      // Power Substation Logic
      if (t.level.special === 'buff_nearby_speed') {
        for (const other of this.towers) {
          if (t === other) continue;
          // Apply buff if in range
          if (distance(t, other) <= t.level.range) {
            other.fireRateMultiplier = Math.max(other.fireRateMultiplier, 1.25); // 25% boost
          }
        }
      }
    }

    // Second pass: Apply global buffs
    if (globalOverclockActive) {
      for (const t of this.towers) {
        t.fireRateMultiplier *= 1.5; // 50% Global Boost
      }
    }

    // Decoys
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const decoy = this.decoys[i];
      if (!decoy.update(dt)) {
        this.decoys.splice(i, 1);
      }
    }

    // Taunt Application
    for (const decoy of this.decoys) {
      for (const enemy of this.enemies) {
        if (!enemy.decoyTarget && distance(decoy, enemy) <= decoy.radius) {
          enemy.decoyTarget = decoy;
        }
      }
    }

    // Towers
    for (const tower of this.towers) {
      const proj = tower.update(dt, this.enemies, this.state.isBrownout, this.effectManager);
      if (proj) {
        this.projectiles.push(proj);
        // Play tower fire sound based on tower type
        const towerType = TOWERS[tower.categoryIndex].type;
        if (towerType === 'Kinetic') audioManager.play('tower_canon');
        else if (towerType === 'Energy') audioManager.play('tower_laser');
        else if (towerType === 'Debuff') audioManager.play('tower_zap');
        else if (towerType === 'Chemical') audioManager.play('sfx_zap_small');
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const hitTarget = p.update(dt, this.enemies, this.effectManager);

      if (hitTarget) {
        hitTarget.takeDamage(p.damage, p.x, p.y);
        this.effectManager.applySpecial(hitTarget, p.special, p.sourceId, p.damage);

        // Chain Logic
        if (p.chainCount > 0) {
          let bestTarget: Enemy | null = null;
          let minDst = 5.0; // Chain search radius

          for (const e of this.enemies) {
            // Don't chain to the enemy we just hit, or anyone we hit before in this chain
            if (e.id === hitTarget.id || p.hitIds.has(e.id)) continue;

            const dst = distance(hitTarget, e);
            if (dst < minDst) {
              minDst = dst;
              bestTarget = e;
            }
          }

          if (bestTarget) {
            const nextChainCount = p.chainCount - 1;
            const chainProj = new Projectile(
              hitTarget.x,
              hitTarget.y,
              bestTarget,
              p.damage, 
              p.color, 
              p.isBeam, 
              `chain_${nextChainCount}`, 
              p.sourceId
            );
            // Pass on the hit history so we don't bounce back to previous targets
            chainProj.hitIds = new Set(p.hitIds);
            chainProj.hitIds.add(hitTarget.id);
            
            this.projectiles.push(chainProj);
          }
        }

        // AoE Cloud Logic (Bio-Hazzard Vent)
        if (p.special === 'aoe_cloud') {
          const cloud = new Projectile(
            hitTarget.x, hitTarget.y, null, 
            p.damage, // Damage per tick
            p.color, 
            false, 
            "cloud_effect", 
            p.sourceId
          );
          cloud.isCloud = true;
          cloud.life = 4.0; // Duration 4s
          cloud.cloudRadius = 1.5; // Radius 1.5 tiles
          this.projectiles.push(cloud);
        }

        // Spawn explosion particles for non-beam projectiles
        if (!p.isBeam) {
          // Spawn explosion particles
          for(let j=0; j<5; j++) {
            this.particles.push(new Particle(p.x, p.y, p.color));
          }
        }
      }

      if (!p.isAlive()) {
        this.projectiles.splice(i, 1);
      }
    }

    // Traps (Active Skills)
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i];
      let trapTriggered = false;

      if (trap.type === 'monowire') {
        for (const e of this.enemies) {
          if (trap.hitEnemyIds.has(e.id)) continue;

          if (distance(trap, e) < 0.5) {
            e.takeDamage(trap.damage, trap.x, trap.y);
            trap.hitEnemyIds.add(e.id);
            trap.triggersRemaining--;
            trapTriggered = true;

            // Visual feedback
            this.particles.push(new Particle(e.x, e.y, trap.color));
            
            if (trap.triggersRemaining <= 0) break;
          }
        }
      }

      if (trap.triggersRemaining <= 0) {
        this.traps.splice(i, 1);
      } else if (trapTriggered) {
        // Keep trap but it used a charge
      }
    }

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const alive = e.update(dt);

      if (e.health <= 0) {
        // Nanite Plague Spread Logic
        const plagueEffect = e.effects.find(eff => eff.type === 'nanite_plague');
        if (plagueEffect) {
          const spreadRadius = 2.0; // Spread radius in grid units
          for (const otherEnemy of this.enemies) {
            if (otherEnemy.id === e.id || otherEnemy.health <= 0) continue;
            if (distance(e, otherEnemy) <= spreadRadius) {
              // Apply a copy of the plague effect, but with a fresh duration and ID
              otherEnemy.addEffect({
                id: crypto.randomUUID(),
                sourceId: plagueEffect.sourceId,
                type: 'nanite_plague',
                value: plagueEffect.value, // Carry over the damage value
                duration: 8.0, // Reset to full duration
                lastTick: 0
              });
            }
          }
        }

        this.state.credits += e.subtype.bounty;
        this.notifyState();
        
        // Play death sound based on enemy type
        const category = e.subtype.id.substring(0, 3);
        if (category === 'boss') audioManager.play('death_bzap');
        else if (category === 'hvy') audioManager.play('death_zap2');
        else audioManager.play('death_zoink');
        
        // Death particles
        for(let j=0; j<10; j++) {
          this.particles.push(new Particle(e.x, e.y, e.subtype.color));
        }
        this.enemies.splice(i, 1);
      } else if (!alive) {
        // Reached end - data breach
        this.state.health -= 5;
        audioManager.play('data_lost');
        if (this.state.health <= 0) {
          this.state.health = 0;
          this.state.status = 'gameover';
        }
        this.notifyState();
        this.enemies.splice(i, 1);
      }
    }

    // Effect Particles
    for (let i = this.effectParticles.length - 1; i >= 0; i--) {
      if (!this.effectParticles[i].update(dt)) {
        this.effectParticles.splice(i, 1);
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawTowerShape(ctx: CanvasRenderingContext2D, px: number, py: number, size: number, type: string, color: string) {
    // Base dark shape
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    switch (type) {
      case 'Kinetic':
        ctx.moveTo(px, py - size * 0.35);
        ctx.lineTo(px + size * 0.35, py + size * 0.25);
        ctx.lineTo(px - size * 0.35, py + size * 0.25);
        break;
      case 'Energy':
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const x = px + Math.cos(angle) * size * 0.4;
          const y = py + Math.sin(angle) * size * 0.4;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      case 'Debuff':
        ctx.rect(px - size * 0.4, py - size * 0.4, size * 0.8, size * 0.8);
        break;
      case 'Chemical':
        // Circle with droplet pattern
        ctx.arc(px, py, size * 0.35, 0, Math.PI * 2);
        break;
      case 'Economic':
        ctx.moveTo(px, py - size * 0.45);
        ctx.lineTo(px + size * 0.45, py);
        ctx.lineTo(px, py + size * 0.45);
        ctx.lineTo(px - size * 0.45, py);
        break;
      default:
        ctx.rect(px - size * 0.4, py - size * 0.4, size * 0.8, size * 0.8);
    }
    ctx.closePath();
    ctx.fill();

    // Colored outline shape
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    switch (type) {
      case 'Kinetic':
        ctx.moveTo(px, py - size * 0.3);
        ctx.lineTo(px + size * 0.3, py + size * 0.2);
        ctx.lineTo(px - size * 0.3, py + size * 0.2);
        break;
      case 'Energy':
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const x = px + Math.cos(angle) * size * 0.3;
          const y = py + Math.sin(angle) * size * 0.3;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      case 'Debuff':
        ctx.rect(px - size * 0.3, py - size * 0.3, size * 0.6, size * 0.6);
        break;
      case 'Chemical':
        // Circle outline
        ctx.arc(px, py, size * 0.3, 0, Math.PI * 2);
        // Center dot
        ctx.moveTo(px + size * 0.12, py);
        ctx.arc(px, py, size * 0.12, 0, Math.PI * 2);
        break;
      case 'Economic':
        ctx.moveTo(px, py - size * 0.35);
        ctx.lineTo(px + size * 0.35, py);
        ctx.lineTo(px, py + size * 0.35);
        ctx.lineTo(px - size * 0.35, py);
        break;
      default:
        ctx.rect(px - size * 0.3, py - size * 0.3, size * 0.6, size * 0.6);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawEnemyShape(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, typeId: string, color: string, isGlitching: boolean, progress: number) {
    const glitchX = isGlitching ? px + (Math.random() - 0.5) * 15 * (1 - progress) : px;
    const glitchY = isGlitching ? py + (Math.random() - 0.5) * 15 * (1 - progress) : py;

    ctx.beginPath();
    
    if (typeId === 'scr_1') {
      // Courier: Fast Arrow
      ctx.moveTo(glitchX + r, glitchY);
      ctx.lineTo(glitchX - r, glitchY - r * 0.8);
      ctx.lineTo(glitchX - r * 0.5, glitchY);
      ctx.lineTo(glitchX - r, glitchY + r * 0.8);
    } else if (typeId === 'scr_2') {
      // Data-Thief: Sleek Diamond
      ctx.moveTo(glitchX, glitchY - r * 1.2);
      ctx.lineTo(glitchX + r * 0.6, glitchY);
      ctx.lineTo(glitchX, glitchY + r * 1.2);
      ctx.lineTo(glitchX - r * 0.6, glitchY);
    } else if (typeId === 'hvy_1') {
      // Lifter-Bot: Bulky Hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = glitchX + Math.cos(angle) * r;
        const y = glitchY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      // Default: Diamond
      ctx.moveTo(glitchX, glitchY - r);
      ctx.lineTo(glitchX + r, glitchY);
      ctx.lineTo(glitchX, glitchY + r);
      ctx.lineTo(glitchX - r, glitchY);
    }
    
    ctx.closePath();

    if (isGlitching) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Scanlines
      if (Math.random() > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(glitchX - r, glitchY + (Math.random() - 0.5) * r, r * 2, 2);
      }
    } else {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fill();
      
      // Inner detail
      ctx.fillStyle = '#18181b'; // Dark core
      ctx.shadowBlur = 0;
      ctx.beginPath();
      if (typeId === 'scr_1') {
        ctx.moveTo(glitchX + r * 0.5, glitchY);
        ctx.lineTo(glitchX - r * 0.5, glitchY - r * 0.4);
        ctx.lineTo(glitchX - r * 0.2, glitchY);
        ctx.lineTo(glitchX - r * 0.5, glitchY + r * 0.4);
      } else if (typeId === 'scr_2') {
        ctx.moveTo(glitchX, glitchY - r * 0.6);
        ctx.lineTo(glitchX + r * 0.3, glitchY);
        ctx.lineTo(glitchX, glitchY + r * 0.6);
        ctx.lineTo(glitchX - r * 0.3, glitchY);
      } else if (typeId === 'hvy_1') {
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = glitchX + Math.cos(angle) * r * 0.5;
          const y = glitchY + Math.sin(angle) * r * 0.5;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        ctx.arc(glitchX, glitchY, r * 0.4, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  draw() {
    const { ctx, canvas, cellSize } = this;
    
    // Clear background
    ctx.fillStyle = '#09090b'; // zinc-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center the grid if canvas is larger
    const offsetX = (canvas.width - (this.gridWidth * cellSize)) / 2;
    const offsetY = (canvas.height - (this.gridHeight * cellSize)) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Grid lines
    ctx.strokeStyle = '#27272a'; // zinc-800
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.gridWidth; x++) {
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, this.gridHeight * cellSize);
    }
    for (let y = 0; y <= this.gridHeight; y++) {
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(this.gridWidth * cellSize, y * cellSize);
    }
    ctx.stroke();

    // Draw Path
    ctx.strokeStyle = '#18181b'; // zinc-900
    ctx.lineWidth = cellSize * 0.8;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (let i = 0; i < this.level.path.length; i++) {
      const p = this.level.path[i];
      if (i === 0) ctx.moveTo(p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2);
      else ctx.lineTo(p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2);
    }
    ctx.stroke();
    
    // Path glow
    ctx.strokeStyle = '#0284c733';
    ctx.lineWidth = cellSize * 0.2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#0284c7';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Data Vault
    const vaultPos = this.level.path[this.level.path.length - 1];
    const vx = vaultPos.x * cellSize + cellSize / 2;
    const vy = vaultPos.y * cellSize + cellSize / 2;
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#06b6d4'; // cyan-500
    ctx.fillStyle = '#083344'; // cyan-950
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(vx, vy - cellSize * 0.4);
    ctx.lineTo(vx + cellSize * 0.35, vy - cellSize * 0.2);
    ctx.lineTo(vx + cellSize * 0.35, vy + cellSize * 0.2);
    ctx.lineTo(vx, vy + cellSize * 0.4);
    ctx.lineTo(vx - cellSize * 0.35, vy + cellSize * 0.2);
    ctx.lineTo(vx - cellSize * 0.35, vy - cellSize * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(vx - cellSize * 0.15, vy - cellSize * 0.15, cellSize * 0.3, cellSize * 0.3);
    ctx.shadowBlur = 0;

    // Draw Towers
    for (const t of this.towers) {
      const px = t.x * cellSize;
      const py = t.y * cellSize;
      const type = TOWERS[t.categoryIndex].type;
      this.drawTowerShape(ctx, px, py, cellSize, type, t.level.color);
    }

    if (this.selectedPlacedTower) {
      const px = this.selectedPlacedTower.x * cellSize;
      const py = this.selectedPlacedTower.y * cellSize;
      const r = this.selectedPlacedTower.level.range * cellSize;

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = this.selectedPlacedTower.level.color + '11';
      ctx.fill();
      ctx.strokeStyle = this.selectedPlacedTower.level.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Traps
    for (const trap of this.traps) {
      if (trap.type === 'monowire') {
        const tx = trap.x * cellSize;
        const ty = trap.y * cellSize;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.strokeStyle = trap.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = trap.color;
        ctx.beginPath();
        ctx.moveTo(-cellSize * 0.4, -cellSize * 0.4);
        ctx.lineTo(cellSize * 0.4, cellSize * 0.4);
        ctx.moveTo(cellSize * 0.4, -cellSize * 0.4);
        ctx.lineTo(-cellSize * 0.4, cellSize * 0.4);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw Decoys
    for (const decoy of this.decoys) {
      const px = decoy.x * cellSize;
      const py = decoy.y * cellSize;
      const lifePercent = decoy.duration / decoy.maxDuration;

      ctx.save();
      // Make it flicker
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;

      // Draw a simple humanoid shape
      ctx.fillStyle = decoy.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = decoy.color;
      // Head
      ctx.beginPath();
      ctx.arc(px, py - cellSize * 0.2, cellSize * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.moveTo(px, py - cellSize * 0.1);
      ctx.lineTo(px - cellSize * 0.15, py + cellSize * 0.3);
      ctx.lineTo(px + cellSize * 0.15, py + cellSize * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (this.previewTower) {
      const px = this.previewTower.x * cellSize + cellSize / 2;
      const py = this.previewTower.y * cellSize + cellSize / 2;
      const r = this.previewTower.range * cellSize;

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = this.previewTower.color + '22';
      ctx.fill();
      ctx.strokeStyle = this.previewTower.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.globalAlpha = 0.5;
      this.drawTowerShape(ctx, px, py, cellSize, this.previewTower.type, this.previewTower.color);
      ctx.globalAlpha = 1.0;
    }

    if (this.previewSkill) {
      const px = this.previewSkill.x * cellSize + cellSize / 2;
      const py = this.previewSkill.y * cellSize + cellSize / 2;
      
      ctx.strokeStyle = this.previewSkill.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      // Draw a crosshair or indicator
      ctx.moveTo(px - cellSize * 0.4, py);
      ctx.lineTo(px + cellSize * 0.4, py);
      ctx.moveTo(px, py - cellSize * 0.4);
      ctx.lineTo(px, py + cellSize * 0.4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Enemies
    for (const e of this.enemies) {
      const px = e.x * cellSize;
      const py = e.y * cellSize;
      const r = e.subtype.radius * cellSize;
      
      ctx.save();
      
      if (e.rezTimer > 0) {
        const progress = 1 - (e.rezTimer / e.maxRezTimer);
        ctx.globalAlpha = progress;
        this.drawEnemyShape(ctx, px, py, r, e.subtype.id, e.subtype.color, true, progress);
      } else {
        if (e.isStealth) ctx.globalAlpha = 0.25;
        this.drawEnemyShape(ctx, px, py, r, e.subtype.id, e.subtype.color, false, 0);

        // Health bar
        const hpPercent = e.health / e.maxHealth;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(px - r, py - r - 6, r * 2, 3);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(px - r, py - r - 6, r * 2 * hpPercent, 3);
      }

      // Stun visual effect
      if (e.isStunned) {
        ctx.strokeStyle = '#fef08a'; // yellow-200
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#fef08a';
        const stunR = r * 1.2;
        // Draw some zappy lines that flicker
        if (Math.random() > 0.3) {
          for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = angle1 + (Math.random() - 0.5) * Math.PI;
            ctx.moveTo(px + Math.cos(angle1) * stunR, py + Math.sin(angle1) * stunR);
            ctx.lineTo(px + Math.cos(angle2) * stunR * 0.6, py + Math.sin(angle2) * stunR * 0.6);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // Draw damage numbers
      for (const dn of e.damageNumbers) {
        const dx = dn.x * cellSize;
        const dy = dn.y * cellSize;
        ctx.save();
        ctx.globalAlpha = dn.life; // Fade out
        ctx.fillStyle = dn.color;
        ctx.font = dn.isCrit ? 'bold 14px monospace' : '12px monospace';
        ctx.shadowBlur = 4;
        ctx.shadowColor = dn.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        const dmgText = Math.floor(dn.damage);
        ctx.strokeText(dmgText.toString(), dx - 10, dy);
        ctx.fillText(dmgText.toString(), dx - 10, dy);
        ctx.restore();
      }
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
      if (p.isCloud) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * cellSize, p.y * cellSize, p.cloudRadius * cellSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Optional: Draw cloud wisps/particles here for flavor
        continue;
      }

      if (p.isBeam && p.target) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x * cellSize, p.y * cellSize);
        ctx.lineTo(p.target.x * cellSize, p.target.y * cellSize);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * cellSize, p.y * cellSize, cellSize * 0.1, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * cellSize, p.y * cellSize, p.size * cellSize, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Effect Particles
    for (const p of this.effectParticles) {
      p.draw(ctx, cellSize);
    }

    ctx.restore();
  }

  loop = (time: number) => {
    let dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Cap dt to prevent huge jumps if tab is inactive
    if (dt < 0.1) {
      dt *= this.gameSpeed;  // Apply game speed multiplier
      this.update(dt);
      this.draw();
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.handleResize);
  }

  notifyState() {
    // Throttle state updates or clone to trigger React
    this.onStateChange({ ...this.state });
  }
}

class EmpBlastEffect {
  x: number;
  y: number;
  radius: number = 0;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;

  constructor(x: number, y: number, maxRadius: number, duration: number, color: string) {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.maxLife = duration;
    this.life = duration;
    this.color = color;
  }

  update(dt: number): boolean {
    this.life -= dt;
    // Ease out cubic for a nice feel
    const progress = 1 - (this.life / this.maxLife);
    this.radius = this.maxRadius * (1 - Math.pow(1 - progress, 3));
    return this.life > 0;
  }

  draw(ctx: CanvasRenderingContext2D, cellSize: number) {
    const progress = 1 - (this.life / this.maxLife);
    const alpha = 1 - progress; // Fade out
    
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    
    ctx.beginPath();
    ctx.arc(this.x * cellSize, this.y * cellSize, this.radius * cellSize, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }
}
