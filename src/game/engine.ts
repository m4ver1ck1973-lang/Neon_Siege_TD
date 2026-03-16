import { GameState, Vector2D, LevelConfig } from './types';
import { ENEMIES, TOWERS, ACTIVE_SKILLS } from './config';
import { Enemy, Tower, Projectile, Particle, Trap, Decoy, BallLightning, GridZone } from './entities';
import { EffectManager } from './EffectManager';
import { distance } from './math';
import { audioManager } from './audioManager';

// Helper function to generate jagged lightning segments
function generateLightningSegments(x1: number, y1: number, x2: number, y2: number, segmentCount: number, jaggedness: number): {x: number, y: number}[] {
  const segments: {x: number, y: number}[] = [];
  const dx = (x2 - x1) / segmentCount;
  const dy = (y2 - y1) / segmentCount;
  
  segments.push({x: x1, y: y1});
  
  for (let i = 1; i < segmentCount; i++) {
    const baseX = x1 + dx * i;
    const baseY = y1 + dy * i;
    // Add perpendicular offset for jagged effect
    const perpX = -dy / Math.sqrt(dx * dx + dy * dy);
    const perpY = dx / Math.sqrt(dx * dx + dy * dy);
    const offset = (Math.random() - 0.5) * 2 * jaggedness;
    segments.push({
      x: baseX + perpX * offset,
      y: baseY + perpY * offset
    });
  }
  
  segments.push({x: x2, y: y2});
  return segments;
}

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
  ballLightnings: BallLightning[] = [];
  gridZones: GridZone[] = [];
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

    // Don't start music here - App.tsx handles it on first user interaction
    // This prevents browser autoplay policy from blocking audio
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

    // Play voice line when brownout starts (power exceeded)
    const newBrownoutState = used > max;
    if (newBrownoutState && !this.state.isBrownout) {
      audioManager.playVoiceLine('grid_full');
    }

    this.state.isBrownout = newBrownoutState;
    
    // Update audio brownout filter
    audioManager.setBrownout(newBrownoutState);
    
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

        // Play build sound with modulated panning (50% left to 50% right, 1 second cycle)
        audioManager.play('processing', {
          modulatedPan: { frequency: 1, amplitude: 0.5 }
        });

        // Play build voice line occasionally (10% chance to avoid spam)
        if (Math.random() < 0.1) {
          audioManager.playVoiceLine('build');
        }

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
        if (skill.id === 'skl_2') { // Grid Overload
          const duration = skill.duration || 10.0;
          const damage = skill.damage || 60;

          this.gridZones.push(new GridZone(
            gridX,
            gridY,
            duration,
            damage,
            skill.color,
            this.level.path
          ));

          // Create spawn effect - digital grid burst (square particles)
          for(let i = 0; i < 15; i++) {
            const offsetX = (Math.random() - 0.5) * 0.8;
            const offsetY = (Math.random() - 0.5) * 0.8;
            this.particles.push(new Particle(gridX + 0.5 + offsetX, gridY + 0.5 + offsetY, skill.color, 'square'));
          }
          audioManager.play('skill_emp');
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
        
        // Play ultimate voice line (50% chance)
        if (Math.random() < 0.5) {
          audioManager.playVoiceLine('ultimate');
        }

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

  // Get position along path (0 = start, 1 = end)
  getPathPosition(x: number, y: number): number | null {
    let closestDist = Infinity;
    let closestT = -1;
    let totalPathLength = 0;
    let distanceAlongPath = 0;
    
    // First calculate total path length
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const p1 = this.level.path[i];
      const p2 = this.level.path[i + 1];
      totalPathLength += distance(p1, p2);
    }
    
    // Find closest point on path
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const p1 = this.level.path[i];
      const p2 = this.level.path[i + 1];
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLength = Math.sqrt(dx * dx + dy * dy);
      
      if (segLength === 0) continue;
      
      // Project point onto segment
      const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / (segLength * segLength)));
      
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      
      const distToProj = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
      
      if (distToProj < closestDist) {
        closestDist = distToProj;
        // Calculate distance along path to this projection point
        distanceAlongPath = 0;
        for (let j = 0; j < i; j++) {
          distanceAlongPath += distance(this.level.path[j], this.level.path[j + 1]);
        }
        distanceAlongPath += t * segLength;
        closestT = distanceAlongPath / totalPathLength;
      }
    }
    
    return closestT;
  }

  // Get total path length
  getPathLength(): number {
    let total = 0;
    for (let i = 0; i < this.level.path.length - 1; i++) {
      total += distance(this.level.path[i], this.level.path[i + 1]);
    }
    return total;
  }

  // Get x,y position at a given path position (0-1)
  getPositionAtPath(t: number): { x: number, y: number } | null {
    if (t < 0 || t > 1) return null;
    
    const totalLength = this.getPathLength();
    const targetDistance = t * totalLength;
    
    let distanceTraveled = 0;
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const p1 = this.level.path[i];
      const p2 = this.level.path[i + 1];
      const segLength = distance(p1, p2);
      
      if (distanceTraveled + segLength >= targetDistance) {
        // Target is on this segment
        const remainingDist = targetDistance - distanceTraveled;
        const segmentT = remainingDist / segLength;
        return {
          x: p1.x + (p2.x - p1.x) * segmentT,
          y: p1.y + (p2.y - p1.y) * segmentT
        };
      }
      
      distanceTraveled += segLength;
    }
    
    // Return last point
    const last = this.level.path[this.level.path.length - 1];
    return { x: last.x, y: last.y };
  }

  spawnEnemy() {
    // Hard cap on total enemies to prevent performance meltdown
    const MAX_ENEMIES = 150;
    if (this.enemies.length >= MAX_ENEMIES) {
      console.warn(`[Engine] Max enemies (${MAX_ENEMIES}) reached, skipping spawn`);
      return;
    }

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
        // Wave complete - check if level is complete
        if (this.state.wave >= this.level.waves.length) {
          // Level complete - play victory voice line (100% chance)
          audioManager.playVoiceLine('win_wave');
        }
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
          // Visual effect: spawn particles occasionally while active (tron style)
          if (Math.random() < 0.2) {
            this.particles.push(new Particle(t.x, t.y, '#d946ef', 'tron')); // fuchsia-500
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
      const proj = tower.update(dt, this.enemies, this.state.isBrownout, this.effectManager, this.effectParticles);
      if (proj) {
        // Generate lightning segments for chain lightning projectiles
        if (proj.isChainLightning && proj.target && proj.target.health > 0) {
          proj.lightningSegments = generateLightningSegments(
            proj.x, proj.y,
            proj.target.x, proj.target.y,
            8, // segment count
            0.3 // jaggedness
          );
        }
        
        this.projectiles.push(proj);
        // Play tower fire sound based on tower type with pitch variation and position-based panning
        const towerType = TOWERS[tower.categoryIndex].type;
        const towerPos = { x: tower.x, y: tower.y };
        
        if (towerType === 'Kinetic') {
          audioManager.play('tower_canon', { pitchVariation: 0.1, position: towerPos });
        } else if (towerType === 'Energy') {
          audioManager.play('tower_laser', { pitchVariation: 0.1, position: towerPos });
        } else if (towerType === 'Debuff') {
          audioManager.play('tower_zap', { pitchVariation: 0.1, position: towerPos });
        } else if (towerType === 'Chemical') {
          audioManager.play('sfx_zap_small', { pitchVariation: 0.1, position: towerPos });
        }
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const hitTarget = p.update(dt, this.enemies, this.effectManager);

      if (hitTarget) {
        const damageResult = hitTarget.takeDamage(p.damage, p.x, p.y);

        if (damageResult.damaged) {
          this.effectManager.applySpecial(hitTarget, p.special, p.sourceId, p.damage);
          
          // Split on Damage Logic - spawn a clone
          if (damageResult.splitSpawn && damageResult.splitSpawn.length > 0) {
            // Create a split clone with partial HP
            const clone = new Enemy(hitTarget.path, hitTarget.subtype, 0.5); // 50% of wave multiplier
            clone.x = hitTarget.x + (Math.random() - 0.5) * 0.5;
            clone.y = hitTarget.y + (Math.random() - 0.5) * 0.5;
            clone.pathIndex = hitTarget.pathIndex;
            clone.hasSplit = true; // Don't split again
            this.enemies.push(clone);
          }
        }

        // Ball Lightning: Create at impact point, travels backward along path
        if (p.special === 'ball_lightning' && damageResult.damaged) {
          const towerConfig = TOWERS.find(t => t.levels.some(l => l.id === p.sourceId));
          const towerLevel = towerConfig?.levels.find(l => l.id === p.sourceId);
          const wellDuration = towerLevel?.wellDuration || 5.0;
          const stunChance = towerLevel?.stunChance || 0.2;
          
          // Find which path segment the hit target is on and position along it
          const targetGridX = Math.floor(hitTarget.x);
          const targetGridY = Math.floor(hitTarget.y);
          let segmentIndex = 0;
          let segmentT = 0.5; // Default to middle of segment
          
          for (let i = 0; i < this.level.path.length - 1; i++) {
            const p1 = this.level.path[i];
            const p2 = this.level.path[i + 1];
            
            // Check horizontal segment
            if (p1.y === p2.y && targetGridY === p1.y) {
              if (targetGridX >= Math.min(p1.x, p2.x) && targetGridX <= Math.max(p1.x, p2.x)) {
                segmentIndex = i;
                const segLen = Math.abs(p2.x - p1.x);
                segmentT = segLen > 0 ? (targetGridX - p1.x) / segLen : 0.5;
                break;
              }
            }
            
            // Check vertical segment
            if (p1.x === p2.x && targetGridX === p1.x) {
              if (targetGridY >= Math.min(p1.y, p2.y) && targetGridY <= Math.max(p1.y, p2.y)) {
                segmentIndex = i;
                const segLen = Math.abs(p2.y - p1.y);
                segmentT = segLen > 0 ? (targetGridY - p1.y) / segLen : 0.5;
                break;
              }
            }
          }
          
          this.ballLightnings.push(new BallLightning(
            hitTarget.x,
            hitTarget.y,
            wellDuration,
            towerLevel?.damage || 100,
            stunChance,
            p.color,
            this.level.path,
            segmentIndex,
            segmentT
          ));
          
          // Create spawn effect for the ball lightning - jagged lightning bolts (tron style)
          for (let j = 0; j < 12; j++) {
            const angle = (j / 12) * Math.PI * 2;
            const dist = 0.3 + Math.random() * 0.3;
            const px = hitTarget.x + Math.cos(angle) * dist;
            const py = hitTarget.y + Math.sin(angle) * dist;
            this.particles.push(new Particle(px, py, '#a855f7', 'tron'));
          }
          
          // Play spawn sound
          audioManager.play('skill_emp');
        }

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
            chainProj.isChainLightning = true;
            // Generate jagged lightning segments
            chainProj.lightningSegments = generateLightningSegments(
              hitTarget.x, hitTarget.y,
              bestTarget.x, bestTarget.y,
              8, // segment count
              0.3 // jaggedness
            );

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
          // Generate random offsets for irregular amorphous shape (8 points around circle)
          for (let i = 0; i < 8; i++) {
            cloud.cloudOffsets.push(0.2 + Math.random() * 0.3); // 0.2 to 0.5 variation
          }
          this.projectiles.push(cloud);
        }

        // Spawn explosion particles for non-beam projectiles
        if (!p.isBeam) {
          // Spawn particles - circles for acid/corrosion effects, sparks for everything else
          const particleColor = p.special === 'corrosion_debuff' ? '#22c55e' : p.color;
          const particleShape = p.special === 'corrosion_debuff' ? 'circle' : 'spark';
          for(let j=0; j<5; j++) {
            this.particles.push(new Particle(p.x, p.y, particleColor, particleShape));
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

          // Hit detection accounts for enemy radius
          const hitRadius = 0.5 + e.subtype.radius;
          if (distance(trap, e) < hitRadius) {
            const damageResult = e.takeDamage(trap.damage, trap.x, trap.y);
            trap.hitEnemyIds.add(e.id);
            trap.triggersRemaining--;
            trapTriggered = true;

            // Visual feedback - colored particle (only if damaged)
            if (damageResult.damaged) {
              this.particles.push(new Particle(e.x, e.y, trap.color, 'circle'));

              // Add white sparks at trap location
              for (let j = 0; j < 8; j++) {
                this.particles.push(new Particle(trap.x, trap.y, '#ffffff', 'spark'));
              }
            }

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

    // Ball Lightning - travels backward along path, damaging enemies
    for (let i = this.ballLightnings.length - 1; i >= 0; i--) {
      const ball = this.ballLightnings[i];

      if (!ball.update(dt)) {
        this.ballLightnings.splice(i, 1);
        continue;
      }

      // Damage enemies in radius
      const damageRadius = 1.5;
      for (const enemy of this.enemies) {
        const distToBall = distance(ball, enemy);
        if (distToBall < damageRadius && !enemy.isStealth) {
          // Deal damage (ticks every ~0.5s)
          if (Math.random() < 0.5) {
            const damageResult = enemy.takeDamage(ball.damage * dt * 2, ball.x, ball.y);

            // Chance to stun (only if damaged)
            if (damageResult.damaged && Math.random() < ball.stunChance) {
              this.effectManager.applySpecial(enemy, 'stun_1s_proc', 'ball_lightning', 0);
            }
          }
        }
      }

      // Add trail particles - Tron-style sparks (not circles)
      if (Math.random() < 0.3) {
        const sparkAngle = Math.random() * Math.PI * 2;
        const sparkDist = 0.2 + Math.random() * 0.2;
        const px = ball.x + Math.cos(sparkAngle) * sparkDist;
        const py = ball.y + Math.sin(sparkAngle) * sparkDist;
        this.particles.push(new Particle(px, py, '#d8b4fe', 'tron'));
      }
    }

    // Grid Zones - damage enemies in 3 hex cells
    for (let i = this.gridZones.length - 1; i >= 0; i--) {
      const zone = this.gridZones[i];

      if (!zone || !zone.update(dt)) {
        this.gridZones.splice(i, 1);
        continue;
      }

      // Safety check
      if (!zone.cells || zone.cells.length === 0) {
        this.gridZones.splice(i, 1);
        continue;
      }

      // Damage enemies in any of the 3 cells
      for (const enemy of this.enemies) {
        const enemyGridX = Math.floor(enemy.x);
        const enemyGridY = Math.floor(enemy.y);

        for (const cell of zone.cells) {
          if (!cell) continue;
          if (enemyGridX === cell.x && enemyGridY === cell.y && !enemy.isStealth) {
            enemy.takeDamage(zone.damage * dt, zone.centerX, zone.centerY);
            break;
          }
        }
      }
    }

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const alive = e.update(dt);

      // Healing Aura Logic - heal nearby enemies
      if (e.healingAuraRadius > 0 && e.health > 0) {
        e.healingTimer -= dt;
        if (e.healingTimer <= 0) {
          e.healingTimer = 1.0; // Heal every 1 second
          for (const other of this.enemies) {
            if (other.id === e.id || other.health <= 0) continue;
            if (distance(e, other) <= e.healingAuraRadius) {
              other.health = Math.min(other.maxHealth, other.health + e.healingAmount);
            }
          }
        }
      }

      // Path Jump Logic - jump ahead periodically
      if (e.pathJumpDistance > 0 && e.health > 0) {
        e.pathJumpTimer -= dt;
        if (e.pathJumpTimer <= 0) {
          e.pathJumpTimer = 8.0; // Jump every 8 seconds
          const jumpAhead = Math.min(e.pathJumpDistance, e.path.length - 1 - e.pathIndex);
          if (jumpAhead > 0) {
            e.pathIndex += jumpAhead;
            const newWaypoint = e.path[e.pathIndex];
            e.x = newWaypoint.x;
            e.y = newWaypoint.y;
          }
        }
      }

      // Tower Hijack Logic - disable/hijack nearby towers
      if (e.towerHijackRadius > 0 && e.health > 0) {
        e.hijackTimer -= dt;
        if (e.hijackTimer <= 0) {
          e.hijackTimer = 3.0; // Attempt hijack every 3 seconds
          for (const tower of this.towers) {
            const towerId = `${Math.floor(tower.x)},${Math.floor(tower.y)}`;
            if (e.hijackedTowers.has(towerId)) continue;
            if (distance(e, tower) <= e.towerHijackRadius) {
              // Hijack the tower - disable it temporarily
              e.hijackedTowers.add(towerId);
              tower.fireRateMultiplier = 0; // Disable tower
              tower.specialTimer = 5.0; // For 5 seconds
            }
          }
        }
      }

      // Reactivate hijacked towers after duration
      for (const tower of this.towers) {
        if (tower.fireRateMultiplier === 0 && tower.specialTimer > 0) {
          tower.specialTimer -= dt;
          if (tower.specialTimer <= 0) {
            tower.fireRateMultiplier = 1.0;
          }
        }
      }

      if (e.health <= 0) {
        // Swarm Spawn on Death Logic - 85% chance to spawn 1-5 minions
        if (e.subtype.logic_tag.startsWith('swarm_spawn_chance_')) {
          if (Math.random() < 0.85 && this.enemies.length < 100) {
            // Spawn 1-5 minions
            const minionCount = Math.floor(Math.random() * 5) + 1; // 1 to 5
            const maxSpawns = Math.min(minionCount, Math.floor(100 - this.enemies.length));
            
            for (let s = 0; s < maxSpawns; s++) {
              const minionSubtype = e.subtype;
              const minion = new Enemy(e.path, minionSubtype, 0.15); // 15% HP of normal
              // Spawn minions directly at parent's position (no offset to avoid off-path spawning)
              minion.x = e.x;
              minion.y = e.y;
              // Clamp pathIndex to valid range and ensure minion can still move
              minion.pathIndex = Math.min(e.pathIndex, e.path.length - 2);
              minion.isMinion = true; // Mark as spawned minion for visual distinction
              // Store desired speed in a custom property (speedMultiplier is overwritten by processEffects)
              (minion as any).minionSpeedMult = 4.0 / 3.5;
              this.enemies.push(minion);
            }
          }
        }

        // Nanite Plague Spread Logic - only spread if we don't have too many enemies
        const plagueEffect = e.effects.find(eff => eff.type === 'nanite_plague');
        if (plagueEffect && this.enemies.length < 100) {
          const spreadRadius = 2.0; // Original radius
          for (const otherEnemy of this.enemies) {
            if (otherEnemy.id === e.id || otherEnemy.health <= 0) continue;
            if (distance(e, otherEnemy) <= spreadRadius) {
              // Apply a copy of the plague effect, but with a fresh duration and ID
              otherEnemy.addEffect({
                id: crypto.randomUUID(),
                sourceId: plagueEffect.sourceId,
                type: 'nanite_plague',
                value: plagueEffect.value, // Carry over the damage value
                duration: 8.0, // Original duration
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

        // Death particles - sparks
        for(let j=0; j<10; j++) {
          this.particles.push(new Particle(e.x, e.y, e.subtype.color, 'spark'));
        }
        this.enemies.splice(i, 1);
      } else if (!alive) {
        // Reached end - data breach
        this.state.health -= 5;
        audioManager.play('data_lost');
        
        // Play losing voice line when health is critical (20% chance)
        if (this.state.health <= 20 && Math.random() < 0.2) {
          audioManager.playVoiceLine('losing');
        }
        
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

    // Particles - enforce max limit to prevent runaway accumulation
    const MAX_PARTICLES = 500;
    
    // If we exceed the limit, remove oldest particles first
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawTowerShape(ctx: CanvasRenderingContext2D, px: number, py: number, size: number, type: string, color: string, facingAngle: number = 0) {
    ctx.save();

    // Rotate tower to face target
    if (facingAngle !== 0) {
      ctx.translate(px, py);
      ctx.rotate(facingAngle);
      ctx.translate(-px, -py);
    }

    // Consistent sizing: all shapes fit within ~0.38 * size radius
    // Center circle is 0.12 * size radius for all towers
    const outerScale = 0.38;
    const innerScale = 0.28;
    const coreRadius = 0.12;
    // Square needs to be scaled by 1/√2 so its corners match the diamond's vertices
    const squareScale = 1 / Math.SQRT2;

    // Base dark shape (filled)
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    switch (type) {
      case 'Kinetic': // Equilateral Triangle (pointing up)
        ctx.moveTo(px, py - size * outerScale);
        ctx.lineTo(px + size * outerScale * 0.866, py + size * outerScale * 0.5);
        ctx.lineTo(px - size * outerScale * 0.866, py + size * outerScale * 0.5);
        break;
      case 'Energy': // Hexagon (flat top/bottom)
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = px + Math.cos(angle) * size * outerScale;
          const y = py + Math.sin(angle) * size * outerScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      case 'Debuff': // Square (scaled to match diamond's corner-to-corner size)
        ctx.rect(px - size * outerScale * squareScale, py - size * outerScale * squareScale, size * outerScale * squareScale * 2, size * outerScale * squareScale * 2);
        break;
      case 'Chemical': // Circle
        ctx.arc(px, py, size * outerScale, 0, Math.PI * 2);
        break;
      case 'Economic': // Solar Array - Star shape (5-pointed)
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
          const radius = (i % 2 === 0) ? size * outerScale : size * outerScale * 0.5;
          const x = px + Math.cos(angle) * radius;
          const y = py + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      default:
        ctx.rect(px - size * outerScale * squareScale, py - size * outerScale * squareScale, size * outerScale * squareScale * 2, size * outerScale * squareScale * 2);
    }
    ctx.closePath();
    ctx.fill();

    // Colored outline shape (stroke)
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    switch (type) {
      case 'Kinetic': // Equilateral Triangle
        ctx.moveTo(px, py - size * innerScale);
        ctx.lineTo(px + size * innerScale * 0.866, py + size * innerScale * 0.5);
        ctx.lineTo(px - size * innerScale * 0.866, py + size * innerScale * 0.5);
        break;
      case 'Energy': // Hexagon
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = px + Math.cos(angle) * size * innerScale;
          const y = py + Math.sin(angle) * size * innerScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      case 'Debuff': // Square (scaled to match diamond)
        ctx.rect(px - size * innerScale * squareScale, py - size * innerScale * squareScale, size * innerScale * squareScale * 2, size * innerScale * squareScale * 2);
        break;
      case 'Chemical': // Circle
        ctx.arc(px, py, size * innerScale, 0, Math.PI * 2);
        break;
      case 'Economic': // Solar Array - Star shape (5-pointed)
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
          const radius = (i % 2 === 0) ? size * innerScale : size * innerScale * 0.5;
          const x = px + Math.cos(angle) * radius;
          const y = py + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      default:
        ctx.rect(px - size * innerScale * squareScale, py - size * innerScale * squareScale, size * innerScale * squareScale * 2, size * innerScale * squareScale * 2);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner core (consistent size for all towers)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, size * coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  drawEnemyShape(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, typeId: string, color: string, isGlitching: boolean, progress: number, facingAngle: number = 0) {
    const glitchX = isGlitching ? px + (Math.random() - 0.5) * 15 * (1 - progress) : px;
    const glitchY = isGlitching ? py + (Math.random() - 0.5) * 15 * (1 - progress) : py;

    ctx.save();
    
    // Rotate for directional enemies (Courier arrow)
    if (typeId === 'scr_1' && facingAngle !== 0) {
      ctx.translate(px, py);
      ctx.rotate(facingAngle);
      ctx.translate(-px, -py);
    }

    ctx.beginPath();

    if (typeId === 'scr_1') {
      // Courier: Fast Arrow (points right by default, rotated by facingAngle)
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
    
    ctx.restore();
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

    // Draw Path - Multi-layer cyberpunk style with animated data pulses
    const time = Date.now() * 0.001;
    
    // Layer 1: Dark base path
    ctx.strokeStyle = '#0f0f13';
    ctx.lineWidth = cellSize * 0.85;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.level.path.length; i++) {
      const p = this.level.path[i];
      if (i === 0) ctx.moveTo(p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2);
      else ctx.lineTo(p.x * cellSize + cellSize/2, p.y * cellSize + cellSize/2);
    }
    ctx.stroke();

    // Layer 2: Inner path glow
    ctx.strokeStyle = '#164e63'; // cyan-900
    ctx.lineWidth = cellSize * 0.20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0891b2';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Layer 3: Bright center line
    ctx.strokeStyle = '#22d3ee'; // cyan-400 (brighter)
    ctx.lineWidth = cellSize * 0.05;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#06b6d4';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Layer 4: Animated data pulses traveling along the path
    const pulseSpeed = 0.25; // Slower speed
    const pulseCount = 4;
    const pulseWidth = cellSize * 0.25;
    
    for (let p = 0; p < pulseCount; p++) {
      const pulseOffset = (p / pulseCount);
      const pulsePos = (time * pulseSpeed + pulseOffset) % 1;
      
      // Calculate position along path
      const totalSegments = this.level.path.length - 1;
      const segmentFloat = pulsePos * totalSegments;
      const segmentIndex = Math.floor(segmentFloat);
      const segmentT = segmentFloat - segmentIndex;
      
      if (segmentIndex >= 0 && segmentIndex < totalSegments) {
        const p1 = this.level.path[segmentIndex];
        const p2 = this.level.path[segmentIndex + 1];
        
        const x1 = p1.x * cellSize + cellSize/2;
        const y1 = p1.y * cellSize + cellSize/2;
        const x2 = p2.x * cellSize + cellSize/2;
        const y2 = p2.y * cellSize + cellSize/2;
        
        const pulseX = x1 + (x2 - x1) * segmentT;
        const pulseY = y1 + (y2 - y1) * segmentT;
        
        // Draw pulse with gradient fade
        const pulseAlpha = 0.4 + Math.sin(time * 10 + p) * 0.2;
        ctx.fillStyle = `rgba(6, 182, 212, ${pulseAlpha})`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#22d3ee';
        
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, pulseWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    
    // Layer 5: Subtle grid pattern overlay on path
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const p1 = this.level.path[i];
      const p2 = this.level.path[i + 1];
      const x1 = p1.x * cellSize + cellSize/2;
      const y1 = p1.y * cellSize + cellSize/2;
      const x2 = p2.x * cellSize + cellSize/2;
      const y2 = p2.y * cellSize + cellSize/2;
      
      // Draw dashed line along center
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

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
      this.drawTowerShape(ctx, px, py, cellSize, type, t.level.color, t.facingAngle);
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
        // trap.x and trap.y are already at cell center (gridX + 0.5, gridY + 0.5)
        const centerX = trap.x * cellSize;
        const centerY = trap.y * cellSize;
        const time = Date.now() * 0.001; // Time in seconds
        const oscillation = Math.sin(time * 30) * 0.3; // Fast oscillation

        // Calculate path direction at this cell
        let pathAngle = 0;
        let isCorner = false;
        const trapGridX = Math.floor(trap.x);
        const trapGridY = Math.floor(trap.y);

        // Find path segments this cell is on
        let onHorizontal = false;
        let onVertical = false;
        let horizontalDir = 0; // 0 = right, PI = left
        let verticalDir = 0; // PI/2 = down, -PI/2 = up

        for (let i = 0; i < this.level.path.length - 1; i++) {
          const p1 = this.level.path[i];
          const p2 = this.level.path[i + 1];

          // For horizontal segments (same y)
          if (p1.y === p2.y) {
            const minX = Math.min(p1.x, p2.x);
            const maxX = Math.max(p1.x, p2.x);
            const segY = p1.y;

            // Check if trap cell is on this segment (inclusive on both ends for corner detection)
            if (trapGridY === segY && trapGridX >= minX && trapGridX <= maxX) {
              onHorizontal = true;
              horizontalDir = p2.x > p1.x ? 0 : Math.PI;
            }
          }

          // For vertical segments (same x)
          if (p1.x === p2.x) {
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            const segX = p1.x;

            // Check if trap cell is on this segment (inclusive on both ends for corner detection)
            if (trapGridX === segX && trapGridY >= minY && trapGridY <= maxY) {
              onVertical = true;
              verticalDir = p2.y > p1.y ? Math.PI / 2 : -Math.PI / 2;
            }
          }
        }

        // Check if this is a corner cell (on both horizontal and vertical segments)
        isCorner = onHorizontal && onVertical;

        if (isCorner) {
          // Calculate diagonal wire angle based on turn direction
          // Wire runs from inside corner to outside corner, blocking the path
          if (horizontalDir === 0 && verticalDir === Math.PI / 2) {
            // Going right, then down: wire from top-left to bottom-right (/ diagonal)
            pathAngle = -Math.PI / 4;
          } else if (horizontalDir === 0 && verticalDir === -Math.PI / 2) {
            // Going right, then up: wire from bottom-left to top-right (\ diagonal)
            pathAngle = Math.PI / 4;
          } else if (horizontalDir === Math.PI && verticalDir === Math.PI / 2) {
            // Going left, then down: wire from bottom-right to top-left (/ diagonal)
            pathAngle = Math.PI / 4;
          } else if (horizontalDir === Math.PI && verticalDir === -Math.PI / 2) {
            // Going left, then up: wire from top-right to bottom-left (\ diagonal)
            pathAngle = -Math.PI / 4;
          }
          // No perpendicular rotation needed - wire IS the diagonal
        } else {
          // Standard perpendicular orientation for straight segments
          if (onHorizontal) {
            pathAngle = horizontalDir;
          } else if (onVertical) {
            pathAngle = verticalDir;
          }
          // Wire is perpendicular to path
          pathAngle = pathAngle + Math.PI / 2;
        }

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(pathAngle);

        // Draw vibrating monowire line across the cell
        // Use multiple layers for glow effect
        const baseWidth = cellSize * 0.8;
        const wireLength = baseWidth;
        
        // Outer glow layer
        ctx.strokeStyle = trap.color;
        ctx.lineWidth = 6;
        ctx.shadowBlur = 25;
        ctx.shadowColor = trap.color;
        ctx.globalAlpha = 0.3;
        
        ctx.beginPath();
        ctx.moveTo(-wireLength / 2, 0);
        ctx.lineTo(wireLength / 2, 0);
        ctx.stroke();
        
        // Middle glow layer
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 0.6;
        
        ctx.beginPath();
        ctx.moveTo(-wireLength / 2, 0);
        ctx.lineTo(wireLength / 2, 0);
        ctx.stroke();
        
        // Core wire with vibration effect
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        
        // Create tight vibration effect (both ends anchored)
        ctx.beginPath();
        ctx.moveTo(-wireLength / 2, 0);
        
        const segments = 12;
        for (let i = 1; i < segments; i++) {
          const t = i / segments; // 0 to 1 along the wire
          const x = -wireLength / 2 + wireLength * t;
          
          // Vibration amplitude fades at ends (anchored)
          const endFade = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
          const vibration = Math.sin(i * 0.8 + time * 40) * (cellSize * 0.04) * endFade;
          
          ctx.lineTo(x, vibration);
        }
        
        ctx.lineTo(wireLength / 2, 0);
        ctx.stroke();

        // Bright endpoints (anchor points)
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.arc(-wireLength / 2, 0, 2.5, 0, Math.PI * 2);
        ctx.arc(wireLength / 2, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    // Draw Ball Lightning
    const blTime = Date.now() * 0.001;
    for (const ball of this.ballLightnings) {
      const bx = ball.x * cellSize;
      const by = ball.y * cellSize;
      const lifePercent = ball.duration / ball.maxDuration;
      const baseRadius = cellSize * 0.35;

      ctx.save();
      ctx.translate(bx, by);

      // Outer crackling ring (pulsing)
      const pulseRadius = baseRadius * (1 + Math.sin(blTime * 15) * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.5 * lifePercent})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#a855f7';
      ctx.stroke();

      // Inner core (bright, flickering)
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232, 121, 249, ${0.9 * lifePercent})`;
      ctx.fill();

      // Lightning arcs (random crackling)
      for (let arc = 0; arc < 4; arc++) {
        const arcAngle = (blTime * 8 + (arc / 4) * Math.PI * 2) % (Math.PI * 2);
        const arcLength = baseRadius * (1.2 + Math.random() * 0.5);

        ctx.beginPath();
        ctx.moveTo(0, 0);

        // Jagged lightning
        const segments = 5;
        for (let i = 1; i <= segments; i++) {
          const t = i / segments;
          const jitter = (Math.random() - 0.5) * 0.3 * baseRadius;
          const perpAngle = arcAngle + Math.PI / 2;
          const x = Math.cos(arcAngle) * arcLength * t + Math.cos(perpAngle) * jitter * t;
          const y = Math.sin(arcAngle) * arcLength * t + Math.sin(perpAngle) * jitter * t;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `rgba(232, 121, 249, ${0.6 * lifePercent})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Glow aura
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.5);
      gradient.addColorStop(0, `rgba(168, 85, 247, ${0.3 * lifePercent})`);
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.restore();
    }

    // Draw Grid Zones - 3 cells with hex grid pattern masked to cell boundaries
    const gridTime = Date.now() * 0.001;
    for (const zone of this.gridZones) {
      const lifePercent = zone.duration / zone.maxDuration;
      
      // Gradient color from yellow to orange based on time
      const gradientPhase = (Math.sin(gridTime * 2) + 1) / 2; // 0 to 1
      const r = 255;
      const g = Math.floor(200 - gradientPhase * 100);
      const b = Math.floor(50 - gradientPhase * 50);
      const brightColor = `rgb(255, ${Math.floor(220 - gradientPhase * 80)}, ${Math.floor(80 - gradientPhase * 60)})`;

      // Safety check for cells array
      if (!zone.cells || zone.cells.length === 0) continue;

      for (const cell of zone.cells) {
        if (!cell) continue;
        const cx = cell.x * cellSize + cellSize / 2;
        const cy = cell.y * cellSize + cellSize / 2;
        
        ctx.save();
        
        // Clip to cell boundary (square mask)
        ctx.beginPath();
        ctx.rect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
        ctx.clip();
        
        ctx.translate(cx, cy);

        // Semi-transparent fill
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.15 * lifePercent})`;
        ctx.fillRect(-cellSize/2, -cellSize/2, cellSize, cellSize);

        // Draw hex grid pattern (small hexagons) masked to cell
        const hexSize = cellSize * 0.15; // Small hexagons
        const hexWidth = hexSize * Math.sqrt(3);
        const hexHeight = hexSize * 2;
        
        ctx.strokeStyle = brightColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4 * lifePercent;
        
        // Draw hex grid covering the cell
        for (let row = -2; row <= 2; row++) {
          for (let col = -2; col <= 2; col++) {
            const offsetX = col * hexWidth * 1.5 + (row % 2) * hexWidth * 0.75;
            const offsetY = row * hexHeight * 0.75;
            
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const hx = offsetX + Math.cos(angle) * hexSize;
              const hy = offsetY + Math.sin(angle) * hexSize;
              if (i === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }

        // Cell border (bright hexagon at cell edge)
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = brightColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20 + Math.sin(gridTime * 5) * 10;
        ctx.shadowColor = zone.color;
        
        // Draw square border at cell edge
        ctx.strokeRect(-cellSize/2, -cellSize/2, cellSize, cellSize);

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
      
      // Minion visual distinctions
      let r = e.subtype.radius * cellSize;
      let enemyColor = e.subtype.color;
      let enemyAlpha = 1.0;
      
      if (e.isMinion) {
        r = e.subtype.radius * 0.75 * cellSize; // 25% smaller
        enemyColor = '#65a30d'; // Darker green (lime-700 vs lime-500)
        enemyAlpha = 1.0; // Full opacity for visibility
      }

      ctx.save();
      ctx.globalAlpha = enemyAlpha;

      if (e.rezTimer > 0) {
        const progress = 1 - (e.rezTimer / e.maxRezTimer);
        this.drawEnemyShape(ctx, px, py, r, e.subtype.id, enemyColor, true, progress, e.facingAngle);
      } else {
        if (e.isStealth) ctx.globalAlpha = 0.25;
        this.drawEnemyShape(ctx, px, py, r, e.subtype.id, enemyColor, false, 0, e.facingAngle);

        // Health bar (skip for minions)
        if (!e.isMinion) {
          const hpPercent = e.health / e.maxHealth;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(px - r, py - r - 6, r * 2, 3);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(px - r, py - r - 6, r * 2 * hpPercent, 3);
        }
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

      // Corrosion visual effect (amorphous green blob)
      if (e.hasCorrosion && e.corrosionOffsets.length > 0) {
        // Pulse: 0 to 1 over 0.4s, using sine wave for smooth pulse
        const pulse = (Math.sin(e.corrosionPulse * Math.PI * 5) + 1) / 2; // 0.4s period
        const alpha = 0.25 + pulse * 0.25; // Pulse between 0.25 and 0.5

        ctx.shadowBlur = 20;
        ctx.shadowColor = '#22c55e'; // green-500
        ctx.fillStyle = '#22c55e';
        ctx.globalAlpha = alpha * 0.5; // Semi-transparent fill
        
        // Draw amorphous blob shape
        const baseRadius = r * 1.15 * pulse;
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const angle = (Math.PI * 2 * i) / 16;
          // Interpolate between offsets for smoother shape
          const offsetIdx = (i / 2) % 8;
          const t = offsetIdx % 1;
          const idx1 = Math.floor(offsetIdx);
          const idx2 = (idx1 + 1) % 8;
          const offset = e.corrosionOffsets[idx1] * (1 - t) + e.corrosionOffsets[idx2] * t;
          
          const blobRadius = baseRadius * offset;
          const x = px + Math.cos(angle) * blobRadius;
          const y = py + Math.sin(angle) * blobRadius;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw border
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      // Nanite plague visual effect (floating purple particles)
      if (e.hasNanitePlague) {
        const naniteCount = 8; // Full swarm for visual impact
        const particleSize = 2;

        // Batch render: set shadow once, draw all particles, clear shadow
        ctx.fillStyle = '#a855f7'; // purple-500
        ctx.shadowBlur = 4; // Reduced from 6 for performance
        ctx.shadowColor = '#a855f7';
        
        ctx.beginPath();
        for (let i = 0; i < naniteCount; i++) {
          const angle = (Math.PI * 2 * i) / naniteCount + (e.nanitePulse * 2);
          const orbitRadius = r * (0.8 + Math.sin(e.nanitePulse * 3 + i) * 0.3);
          const nx = px + Math.cos(angle) * orbitRadius;
          const ny = py + Math.sin(angle) * orbitRadius;
          
          // Create single path for all particles (batched draw call)
          ctx.moveTo(nx + particleSize, ny);
          ctx.arc(nx, ny, particleSize, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
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
        // Update pulse timer for amorphous breathing effect
        p.cloudPulse += 0.016; // Approx 60fps
        const pulse = Math.sin(p.cloudPulse * 2) * 0.1 + 1; // Pulse between 0.9 and 1.1
        
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#22c55e'; // green-500 for acid cloud
        
        // Draw irregular amorphous blob shape
        const cx = p.x * cellSize;
        const cy = p.y * cellSize;
        const baseRadius = p.cloudRadius * cellSize * pulse;
        
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const angle = (Math.PI * 2 * i) / 16;
          // Interpolate between offsets for smoother shape
          const offsetIdx = (i / 2) % 8;
          const t = offsetIdx % 1;
          const idx1 = Math.floor(offsetIdx);
          const idx2 = (idx1 + 1) % 8;
          const offset = p.cloudOffsets[idx1] * (1 - t) + p.cloudOffsets[idx2] * t;
          
          const r = baseRadius * offset;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
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
      } else if (p.isChainLightning && p.lightningSegments.length > 0) {
        // Chain lightning - jagged bolt with branches
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw main lightning bolt
        ctx.beginPath();
        const segments = p.lightningSegments;
        ctx.moveTo(segments[0].x * cellSize, segments[0].y * cellSize);
        for (let i = 1; i < segments.length; i++) {
          ctx.lineTo(segments[i].x * cellSize, segments[i].y * cellSize);
        }
        ctx.stroke();
        
        // Draw bright white core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(segments[0].x * cellSize, segments[0].y * cellSize);
        for (let i = 1; i < segments.length; i++) {
          ctx.lineTo(segments[i].x * cellSize, segments[i].y * cellSize);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      } else if (p.isKinetic) {
        // Triangular slug projectiles
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        
        const px = p.x * cellSize;
        const py = p.y * cellSize;
        const size = cellSize * 0.12;
        
        // Calculate direction angle
        let angle = 0;
        if (p.target && p.target.health > 0) {
          const dx = p.target.x - p.x;
          const dy = p.target.y - p.y;
          angle = Math.atan2(dy, dx);
        } else if (p.vx !== 0 || p.vy !== 0) {
          angle = Math.atan2(p.vy, p.vx);
        }
        
        // Draw triangle pointing in direction of travel
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(size, 0); // Tip
        ctx.lineTo(-size * 0.7, -size * 0.5); // Bottom left
        ctx.lineTo(-size * 0.7, size * 0.5); // Bottom right
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
      } else {
        // Default circular projectiles
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
      ctx.save();
      ctx.translate(p.x * cellSize, p.y * cellSize);
      ctx.rotate(p.angle);
      
      const size = p.size * cellSize;
      
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        // Isosceles triangle (spark shape)
        ctx.beginPath();
        ctx.moveTo(size * 1.5, 0); // Tip
        ctx.lineTo(-size, -size * 0.4); // Bottom left
        ctx.lineTo(-size * 0.5, 0); // Center indent
        ctx.lineTo(-size, size * 0.4); // Bottom right
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'tron') {
        // Thin rectangle (Tron style)
        ctx.fillRect(-size * 0.3, -size * 1.5, size * 0.6, size * 3);
      } else if (p.shape === 'square') {
        ctx.fillRect(-size, -size, size * 2, size * 2);
      }
      
      ctx.restore();
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

class TowerPulseEffect {
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
    const progress = 1 - (this.life / this.maxLife);
    this.radius = this.maxRadius * progress;
    return this.life > 0;
  }

  draw(ctx: CanvasRenderingContext2D, cellSize: number) {
    const progress = 1 - (this.life / this.maxLife);
    const alpha = 0.6 * (this.life / this.maxLife); // Fade out

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    ctx.beginPath();
    ctx.arc(this.x * cellSize, this.y * cellSize, this.radius * cellSize, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
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
