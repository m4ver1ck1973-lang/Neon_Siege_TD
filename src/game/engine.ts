import { GameState, Vector2D, LevelConfig } from './types';
import { ENEMIES, TOWERS } from './config';
import { Enemy, Tower, Projectile, Particle } from './entities';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  level: LevelConfig;
  gridWidth: number;
  gridHeight: number;
  cellSize = 0;

  state: GameState;
  onStateChange: (state: GameState) => void;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  previewTower: { x: number, y: number, range: number, color: string, type: string } | null = null;
  selectedPlacedTower: Tower | null = null;

  lastTime: number = 0;
  animationFrameId: number = 0;

  waveTimer: number = 0;
  enemiesToSpawn: number = 0;
  spawnTimer: number = 0;

  setPreview(preview: { x: number, y: number, range: number, color: string, type: string } | null) {
    this.previewTower = preview;
  }

  private handleResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement, level: LevelConfig, onStateChange: (state: GameState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = level;
    this.gridWidth = level.gridWidth;
    this.gridHeight = level.gridHeight;
    this.onStateChange = onStateChange;
    
    this.state = {
      health: level.startingHealth,
      maxHealth: level.startingHealth,
      credits: level.startingCredits,
      wave: 0,
      maxPower: 100,
      usedPower: 0,
      isBrownout: false,
      status: 'planning'
    };

    this.resize();
    window.addEventListener('resize', this.handleResize);
    
    this.startWave();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
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
    // Simple line segment check for the hardcoded path
    for (let i = 0; i < this.level.path.length - 1; i++) {
      const p1 = this.level.path[i];
      const p2 = this.level.path[i+1];
      
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
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

    // Towers
    for (const tower of this.towers) {
      const proj = tower.update(dt, this.enemies, this.state.isBrownout);
      if (proj) this.projectiles.push(proj);
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const alive = p.update(dt);
      if (!alive) {
        if (!p.isBeam && p.target) {
          // Spawn explosion particles
          for(let j=0; j<5; j++) {
            this.particles.push(new Particle(p.x, p.y, p.color));
          }
        }
        this.projectiles.splice(i, 1);
      }
    }

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const alive = e.update(dt);
      
      if (e.health <= 0) {
        this.state.credits += e.subtype.bounty;
        this.notifyState();
        // Death particles
        for(let j=0; j<10; j++) {
          this.particles.push(new Particle(e.x, e.y, e.subtype.color));
        }
        this.enemies.splice(i, 1);
      } else if (!alive) {
        // Reached end
        this.state.health -= 5; // Data breach
        if (this.state.health <= 0) {
          this.state.health = 0;
          this.state.status = 'gameover';
        }
        this.notifyState();
        this.enemies.splice(i, 1);
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
        this.drawEnemyShape(ctx, px, py, r, e.subtype.id, e.subtype.color, false, 0);

        // Health bar
        const hpPercent = e.health / e.maxHealth;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(px - r, py - r - 6, r * 2, 3);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(px - r, py - r - 6, r * 2 * hpPercent, 3);
      }
      ctx.restore();
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
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

    ctx.restore();
  }

  loop = (time: number) => {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Cap dt to prevent huge jumps if tab is inactive
    if (dt < 0.1) {
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
