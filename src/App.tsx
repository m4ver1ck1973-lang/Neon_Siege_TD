import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { GameState, LevelConfig } from './game/types';
import { TOWERS, LEVELS, ACTIVE_SKILLS } from './game/config';
import { Coins, Crosshair, X, ArrowUpCircle, Trash2, Triangle, Hexagon, Square, Diamond, Play, Zap, BookOpen, Circle } from 'lucide-react';
import { Tower } from './game/entities';
import { TOWER_COMPENDIUM, ENEMY_COMPENDIUM, SKILL_COMPENDIUM, TowerEntry, EnemyEntry, SkillEntry } from './game/compendium';
import { audioManager } from './game/audioManager';

function TowerCard({ tower }: { tower: TowerEntry; key?: React.Key }) {
  return (
    <div className="bg-zinc-950 border border-cyan-900/50 p-4 hover:border-cyan-500/50 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tower.color }}></div>
        <h3 className="text-sm font-bold text-white">{tower.name}</h3>
      </div>
      <p className="text-cyan-700 text-[10px] mb-3">{tower.description}</p>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="text-cyan-800">COST</div>
        <div className="text-amber-400 text-right flex items-center justify-end gap-1">
          <Coins size={10} /> {tower.cost}
        </div>
        <div className="text-cyan-800">POWER</div>
        <div className={`text-right ${tower.powerDraw < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {tower.powerDraw > 0 ? '-' : '+'}{Math.abs(tower.powerDraw)}W
        </div>
        <div className="text-cyan-800">DMG</div>
        <div className="text-white text-right">{tower.damage}</div>
        <div className="text-cyan-800">RANGE</div>
        <div className="text-white text-right">{tower.range}</div>
        <div className="text-cyan-800">SPD</div>
        <div className="text-white text-right">{tower.fireRate}/s</div>
      </div>
    </div>
  );
}

function EnemyCard({ enemy }: { enemy: EnemyEntry; key?: React.Key }) {
  return (
    <div className="bg-zinc-950 border border-cyan-900/50 p-4 hover:border-cyan-500/50 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: enemy.color }}></div>
        <h3 className="text-sm font-bold text-white">{enemy.name}</h3>
      </div>
      <p className="text-cyan-700 text-[10px] mb-2">{enemy.category}</p>
      <p className="text-cyan-700 text-[10px] mb-3">{enemy.description}</p>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="text-center">
          <div className="text-cyan-800 text-[8px] uppercase">HP</div>
          <div className="text-white">{enemy.health}</div>
        </div>
        <div className="text-center">
          <div className="text-cyan-800 text-[8px] uppercase">SPD</div>
          <div className="text-white">{enemy.speed}</div>
        </div>
        <div className="text-center">
          <div className="text-cyan-800 text-[8px] uppercase">$</div>
          <div className="text-amber-400">{enemy.bounty}</div>
        </div>
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillEntry; key?: React.Key }) {
  return (
    <div className="bg-zinc-950 border border-cyan-900/50 p-4 hover:border-cyan-500/50 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded border flex items-center justify-center font-bold text-lg" style={{ backgroundColor: skill.color + '20', borderColor: skill.color, color: skill.color }}>
          {skill.name[0]}
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{skill.name}</h3>
          <div className="text-cyan-700 text-[10px]">{skill.placementType} • {skill.cooldown}s CD</div>
        </div>
      </div>
      <p className="text-cyan-700 text-[10px]">{skill.description}</p>
    </div>
  );
}

export default function App() {
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    health: 100, maxHealth: 100, credits: 600, wave: 0,
    maxPower: 100, usedPower: 0, isBrownout: false, status: 'playing',
    skillCooldowns: {}
  });
  
  const [radialMenu, setRadialMenu] = useState<{gridX: number, gridY: number, x: number, y: number} | null>(null);
  const [hoveredTower, setHoveredTower] = useState<any>(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<Tower | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showCompendium, setShowCompendium] = useState(false);
  const [compendiumTab, setCompendiumTab] = useState<'towers' | 'enemies' | 'skills'>('towers');
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Enable audio on first user interaction
  useEffect(() => {
    const enableAudioOnInteraction = async () => {
      await audioManager.enableAudio();
      setAudioEnabled(true);
      document.removeEventListener('click', enableAudioOnInteraction);
      document.removeEventListener('keydown', enableAudioOnInteraction);
    };

    document.addEventListener('click', enableAudioOnInteraction, { once: true });
    document.addEventListener('keydown', enableAudioOnInteraction, { once: true });

    return () => {
      document.removeEventListener('click', enableAudioOnInteraction);
      document.removeEventListener('keydown', enableAudioOnInteraction);
    };
  }, []);

  useEffect(() => {
    if (currentLevelIndex === null || !canvasRef.current) return;
    
    const level = LEVELS[currentLevelIndex];
    const engine = new GameEngine(canvasRef.current, level, (newState) => {
      setGameState(newState);
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [currentLevelIndex]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!engineRef.current || !selectedSkillId) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const offsetX = (canvasRef.current!.width - (engineRef.current.gridWidth * engineRef.current.cellSize)) / 2;
    const offsetY = (canvasRef.current!.height - (engineRef.current.gridHeight * engineRef.current.cellSize)) / 2;
    const gridX = Math.floor((x - offsetX) / engineRef.current.cellSize);
    const gridY = Math.floor((y - offsetY) / engineRef.current.cellSize);

    const skill = ACTIVE_SKILLS.find(s => s.id === selectedSkillId);
    if (skill) {
      let radius = 0.5;
      if (skill.effects?.radius) radius = skill.effects.radius;
      if (skill.effects?.aggro_radius) radius = skill.effects.aggro_radius;
      
      engineRef.current.setSkillPreview({
        x: gridX,
        y: gridY,
        radius: radius,
        color: skill.color,
        type: skill.placementType
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;
    
    // If radial menu is open, close it
    if (radialMenu) {
      setRadialMenu(null);
      engine.setPreview(null);
      setHoveredTower(null);
      return;
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const offsetX = (canvasRef.current!.width - (engine.gridWidth * engine.cellSize)) / 2;
    const offsetY = (canvasRef.current!.height - (engine.gridHeight * engine.cellSize)) / 2;
    
    const gridX = Math.floor((x - offsetX) / engine.cellSize);
    const gridY = Math.floor((y - offsetY) / engine.cellSize);
    
    if (gridX >= 0 && gridX < engine.gridWidth && gridY >= 0 && gridY < engine.gridHeight) {
      // Handle Skill Placement
      if (selectedSkillId) {
        if (engine.useSkill(selectedSkillId, gridX, gridY)) {
          setSelectedSkillId(null);
          engine.setSkillPreview(null);
        }
        return;
      }

      const clickedTower = engine.towers.find(t => Math.floor(t.x) === gridX && Math.floor(t.y) === gridY);
      
      if (clickedTower) {
        // Toggle selection
        const newSelection = engine.selectedPlacedTower === clickedTower ? null : clickedTower;
        engine.selectedPlacedTower = newSelection;
        setSelectedPlacedTower(newSelection);
      } else {
        engine.selectedPlacedTower = null;
        setSelectedPlacedTower(null);
        const isPath = engine.isPath(gridX, gridY);
        
        if (!isPath) {
          // Clamp radial menu position to keep it fully on screen
          const MENU_RADIUS = 120; // 75px radius + button size + padding
          const safeX = Math.max(MENU_RADIUS, Math.min(window.innerWidth - MENU_RADIUS, e.clientX));
          const safeY = Math.max(MENU_RADIUS + 50, Math.min(window.innerHeight - MENU_RADIUS, e.clientY)); // +50 for top bar

          setRadialMenu({
            gridX, gridY,
            x: safeX,
            y: safeY
          });
        }
      }
    }
  };

  const powerPercent = Math.min(100, (gameState.usedPower / gameState.maxPower) * 100) || 0;

  if (currentLevelIndex === null) {
    return (
      <>
        <div className="flex flex-col w-full h-screen bg-[#050505] font-mono text-cyan-500 select-none items-center p-8 overflow-y-auto">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12 shrink-0">
            <h1 className="text-5xl font-black uppercase tracking-widest text-cyan-400 mb-4 flex items-center justify-center gap-4">
              <span className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></span>
              NEON_SIEGE_OS
              <span className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></span>
            </h1>
            <p className="text-cyan-700 uppercase tracking-widest text-sm">Select Sector to Defend</p>
            <button
              onClick={() => setShowCompendium(true)}
              className="mt-4 px-6 py-2 bg-cyan-950/50 border border-cyan-700 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:bg-cyan-900 hover:border-cyan-400 transition-all flex items-center gap-2 mx-auto"
            >
              <BookOpen size={16} /> Open Compendium
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {LEVELS.map((level, index) => (
              <div 
                key={level.id}
                className="bg-zinc-950 border border-cyan-900/50 p-4 flex flex-col hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all cursor-pointer group"
                onClick={() => setCurrentLevelIndex(index)}
              >
                <h2 className="text-sm font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{level.name}</h2>
                <p className="text-cyan-700 text-[10px] mb-4 flex-grow">{level.description}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
                  <div className="bg-black p-1.5 border border-cyan-900/30">
                    <div className="text-cyan-800 uppercase mb-0.5 text-[8px]">Waves</div>
                    <div className="text-white">{level.waves.length}</div>
                  </div>
                  <div className="bg-black p-1.5 border border-cyan-900/30">
                    <div className="text-cyan-800 uppercase mb-0.5 text-[8px]">Credits</div>
                    <div className="text-amber-400 flex items-center gap-1"><Coins size={10}/> {level.startingCredits}</div>
                  </div>
                </div>
                
                <button className="w-full py-2 bg-cyan-950 group-hover:bg-cyan-900 border border-cyan-500/50 text-cyan-400 font-bold transition-colors uppercase tracking-widest text-[10px] flex items-center justify-center gap-1">
                  <Play size={12} /> Init
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compendium Modal - Menu Level */}
      {showCompendium && (
        <div
          className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50"
          onClick={() => setShowCompendium(false)}
        >
          <div
            className="bg-zinc-950 border border-cyan-900/50 max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="h-14 bg-black border-b border-cyan-900/50 flex items-center justify-between px-6">
              <h2 className="text-xl font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                <BookOpen size={20} /> Data Compendium
              </h2>
              <button
                onClick={() => setShowCompendium(false)}
                className="text-cyan-700 hover:text-cyan-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-cyan-900/50">
              <button
                onClick={() => setCompendiumTab('towers')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  compendiumTab === 'towers'
                    ? 'bg-cyan-950/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-cyan-700 hover:text-cyan-500'
                }`}
              >
                Towers
              </button>
              <button
                onClick={() => setCompendiumTab('enemies')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  compendiumTab === 'enemies'
                    ? 'bg-cyan-950/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-cyan-700 hover:text-cyan-500'
                }`}
              >
                Enemies
              </button>
              <button
                onClick={() => setCompendiumTab('skills')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  compendiumTab === 'skills'
                    ? 'bg-cyan-950/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-cyan-700 hover:text-cyan-500'
                }`}
              >
                Skills
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-14rem)]">
              {compendiumTab === 'towers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TOWER_COMPENDIUM.map((tower) => (
                    <TowerCard key={tower.id} tower={tower} />
                  ))}
                </div>
              )}
              {compendiumTab === 'enemies' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ENEMY_COMPENDIUM.map((enemy) => (
                    <EnemyCard key={enemy.id} enemy={enemy} />
                  ))}
                </div>
              )}
              {compendiumTab === 'skills' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SKILL_COMPENDIUM.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="flex flex-row w-full h-screen bg-[#050505] overflow-hidden font-mono text-cyan-500 select-none">

      {/* TOP BAR - Cyberpunk Terminal Style */}
      <div className="absolute top-0 left-0 right-64 h-10 bg-black border-b border-cyan-900/50 flex items-center justify-between px-4 text-xs shadow-[0_0_15px_rgba(0,255,255,0.05)] z-20 shrink-0 uppercase tracking-wider">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setCurrentLevelIndex(null)}
            className="text-cyan-400 font-bold flex items-center gap-2 hover:text-white transition-colors"
          >
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
            NEON_SIEGE_OS
          </button>
          <div className="flex items-center gap-6 text-cyan-700">
            <span>SECTOR: <span className="text-white">{LEVELS[currentLevelIndex].name.split(':')[0]}</span></span>
            <span>INTEGRITY: <span className={gameState.health > 20 ? "text-emerald-400" : "text-rose-500 animate-pulse"}>{gameState.health}%</span></span>
            <span>WAVE: <span className="text-white">{gameState.wave} / {LEVELS[currentLevelIndex].waves.length}</span></span>
            <span>CREDITS: <span className="text-amber-400">{gameState.credits}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span>GRID.LOAD</span>
          <div className="w-48 h-3 bg-zinc-950 border border-cyan-900/50 relative overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${gameState.isBrownout ? 'bg-red-500 animate-pulse' : 'bg-cyan-500/80'}`}
              style={{ width: `${powerPercent}%` }}
            />
            {/* Scanline overlay */}
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)' }}></div>
          </div>
          <span className={gameState.isBrownout ? 'text-red-500 font-bold' : 'text-cyan-400'}>
            {gameState.usedPower}/{gameState.maxPower}W
          </span>
        </div>
      </div>

      {/* Game Canvas Container */}
      <div className="flex-1 relative w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
        />

        {/* Planning Phase Overlay */}
        {gameState.status === 'planning' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto z-30">
            <button
              onClick={() => engineRef.current?.beginWave()}
              className="px-8 py-3 bg-cyan-950/80 border-2 border-cyan-400 text-cyan-400 font-bold uppercase tracking-widest hover:bg-cyan-900 hover:text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all"
            >
              Initialize Wave {gameState.wave}
            </button>
          </div>
        )}

        {/* Radial Menu Overlay */}
        {radialMenu && (
          <div 
            className="absolute inset-0 z-40" 
            onClick={() => { setRadialMenu(null); engineRef.current?.setPreview(null); setHoveredTower(null); }}
            onContextMenu={(e) => { e.preventDefault(); setRadialMenu(null); engineRef.current?.setPreview(null); setHoveredTower(null); }}
          >
            <div className="absolute" style={{ left: radialMenu.x, top: radialMenu.y }}>
              
              {/* Center Info Panel */}
              <div className="absolute -ml-16 -mt-16 w-32 h-32 rounded-full flex flex-col items-center justify-center pointer-events-none text-center bg-black/60 backdrop-blur-sm border border-cyan-900/50 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                {hoveredTower ? (
                  <>
                    <span className="text-[11px] text-white font-bold leading-tight mb-1">{hoveredTower.name}</span>
                    <span className="text-[11px] text-amber-400 flex items-center gap-1"><Coins size={10}/> {hoveredTower.cost}</span>
                    <span className={`text-[10px] ${hoveredTower.powerDraw < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {hoveredTower.powerDraw > 0 ? '-' : '+'}{Math.abs(hoveredTower.powerDraw)}W
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-cyan-700 uppercase tracking-widest animate-pulse">Deploy</span>
                )}
              </div>

              {/* Radial Buttons */}
              {TOWERS.map((category, i) => {
                const level1 = category.levels[0];
                const angle = (i * Math.PI * 2) / TOWERS.length - Math.PI / 2;
                const radius = 75;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const canAfford = gameState.credits >= level1.cost;
                const isHovered = hoveredTower?.id === level1.id;

                return (
                  <button
                    key={level1.id}
                    className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full border border-cyan-900/50 bg-zinc-950 flex items-center justify-center transition-all duration-200 ${canAfford ? 'cursor-pointer hover:bg-zinc-900 hover:scale-110' : 'opacity-40 cursor-not-allowed grayscale'}`}
                    style={{ 
                      left: x, 
                      top: y, 
                      borderColor: isHovered ? level1.color : undefined,
                      boxShadow: isHovered ? `0 0 15px ${level1.color}60` : 'none'
                    }}
                    onMouseEnter={() => {
                      setHoveredTower(level1);
                      engineRef.current?.setPreview({ x: radialMenu.gridX, y: radialMenu.gridY, range: level1.range, color: level1.color, type: category.type });
                    }}
                    onMouseLeave={() => {
                      setHoveredTower(null);
                      engineRef.current?.setPreview(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canAfford) {
                        const success = engineRef.current?.placeTower(radialMenu.gridX, radialMenu.gridY, i);
                        if (success) {
                          audioManager.play('ui_shot');
                          setRadialMenu(null);
                          engineRef.current?.setPreview(null);
                          setHoveredTower(null);
                        }
                      }
                    }}
                  >
                    {category.type === 'Kinetic' && <Triangle size={20} color={level1.color} />}
                    {category.type === 'Energy' && <Hexagon size={20} color={level1.color} />}
                    {category.type === 'Debuff' && <Square size={20} color={level1.color} />}
                    {category.type === 'Chemical' && <Circle size={20} color={level1.color} />}
                    {category.type === 'Economic' && <Diamond size={20} color={level1.color} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Selected Tower Panel */}
        {selectedPlacedTower && (
          <div className="absolute bottom-6 left-6 bg-zinc-950/90 border border-cyan-900/50 p-4 w-64 shadow-[0_0_20px_rgba(0,255,255,0.1)] z-30">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold uppercase tracking-wider text-sm" style={{ color: selectedPlacedTower.level.color }}>{selectedPlacedTower.level.name}</h3>
              <button 
                onClick={() => {
                  if (engineRef.current) engineRef.current.selectedPlacedTower = null;
                  setSelectedPlacedTower(null);
                }}
                className="text-cyan-700 hover:text-cyan-400"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-mono text-cyan-700 mb-4">
              <div>DMG: <span className="text-white">{selectedPlacedTower.level.damage}</span></div>
              <div>RNG: <span className="text-white">{selectedPlacedTower.level.range}</span></div>
              <div>SPD: <span className="text-white">{selectedPlacedTower.level.fireRate}/s</span></div>
              <div className={selectedPlacedTower.level.powerDraw < 0 ? 'text-emerald-400' : 'text-rose-400'}>
                PWR: {selectedPlacedTower.level.powerDraw > 0 ? '-' : '+'}{Math.abs(selectedPlacedTower.level.powerDraw)}W
              </div>
            </div>

            {/* Upgrade / Sell Buttons */}
            <div className="flex flex-col gap-2">
              {(() => {
                const category = TOWERS[selectedPlacedTower.categoryIndex];
                const isMaxLevel = selectedPlacedTower.levelIndex >= category.levels.length - 1;
                if (isMaxLevel) {
                  return (
                    <div className="py-2 text-center text-xs font-bold text-cyan-700 uppercase border border-cyan-900/30 bg-black">
                      Max Level Reached
                    </div>
                  );
                }
                const nextLevel = category.levels[selectedPlacedTower.levelIndex + 1];
                const canAfford = gameState.credits >= nextLevel.cost;
                return (
                  <button
                    onClick={() => {
                      if (canAfford && engineRef.current) {
                        engineRef.current.upgradeTower(selectedPlacedTower);
                        audioManager.play('ui_shot2');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                      canAfford
                        ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-400 hover:bg-cyan-900'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1"><ArrowUpCircle size={14}/> Upgrade</span>
                    <span className="flex items-center gap-1 text-amber-400"><Coins size={12}/> {nextLevel.cost}</span>
                  </button>
                );
              })()}

              <button
                onClick={() => {
                  if (engineRef.current) {
                    engineRef.current.sellTower(selectedPlacedTower);
                    audioManager.play('ui_shot');
                    setSelectedPlacedTower(null);
                  }
                }}
                className="flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider border border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 transition-colors"
              >
                <span className="flex items-center gap-1"><Trash2 size={14}/> Sell</span>
                <span className="flex items-center gap-1 text-amber-400">
                  <Coins size={12}/> 
                  {(() => {
                    let total = 0;
                    const cat = TOWERS[selectedPlacedTower.categoryIndex];
                    for(let i=0; i<=selectedPlacedTower.levelIndex; i++) total += cat.levels[i].cost;
                    return Math.floor(total * 0.5);
                  })()}
                </span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR - Skills & Controls */}
      <div className="w-64 bg-black border-l border-cyan-900/50 flex flex-col z-20 shrink-0">
        {/* Game Speed Controls */}
        <div className="p-4 border-b border-cyan-900/50">
          <div className="text-cyan-700 text-xs font-bold uppercase tracking-widest mb-3">Sim Speed</div>
          <div className="flex gap-2">
            {[1, 2, 3].map((speed) => (
              <button
                key={speed}
                onClick={() => engineRef.current?.setGameSpeed(speed)}
                className={`flex-1 py-2 text-xs font-bold border transition-all ${
                  gameState.gameSpeed === speed
                    ? 'bg-cyan-900 border-cyan-400 text-cyan-400 shadow-[0_0_10px_cyan]'
                    : 'bg-zinc-950 border-cyan-900/50 text-cyan-700 hover:border-cyan-500 hover:text-cyan-400'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Active Skills */}
        <div className="p-4 border-b border-cyan-900/50 flex-grow">
          <div className="text-cyan-700 text-xs font-bold uppercase tracking-widest mb-3">Active Skills</div>
          <div className="flex flex-col gap-3">
            {ACTIVE_SKILLS.map(skill => {
              const cooldown = gameState.skillCooldowns[skill.id] || 0;
              const isSelected = selectedSkillId === skill.id;
              return (
                <button
                  key={skill.id}
                  onClick={() => {
                    if (cooldown <= 0) {
                      setSelectedSkillId(isSelected ? null : skill.id);
                      if (isSelected && engineRef.current) engineRef.current.setSkillPreview(null);
                    }
                  }}
                  className={`w-full h-14 border bg-black flex items-center gap-3 px-3 relative group transition-all ${
                    isSelected ? 'border-cyan-400 shadow-[0_0_10px_cyan]' : 'border-cyan-900/50 hover:border-cyan-500'
                  } ${cooldown > 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="w-10 h-10 rounded border flex items-center justify-center font-bold text-lg shrink-0" 
                    style={{ backgroundColor: skill.color + '20', borderColor: skill.color, color: skill.color }}>
                    {skill.name[0]}
                  </div>
                  <div className="flex-grow text-left">
                    <div className="text-xs font-bold text-white">{skill.name}</div>
                    <div className="text-[9px] text-cyan-700">{skill.cooldown}s CD</div>
                  </div>

                  {cooldown > 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm font-mono text-white font-bold">
                      {Math.ceil(cooldown)}s
                    </div>
                  )}

                  {/* Tooltip on hover - positioned to left so it doesn't block canvas */}
                  <div className="absolute left-full top-0 ml-2 hidden group-hover:block bg-black border border-cyan-900 p-2 w-48 z-50 rounded shadow-lg">
                    <div className="text-xs font-bold mb-1" style={{ color: skill.color }}>{skill.name}</div>
                    <div className="text-[10px] text-cyan-400">{skill.description}</div>
                    <div className="text-[9px] text-cyan-700 mt-1 uppercase">{skill.placementType} Placement</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pause Button */}
        <div className="p-4 border-t border-cyan-900/50">
          <button
            onClick={() => engineRef.current?.setGameSpeed(gameState.gameSpeed === 0 ? 1 : 0)}
            className={`w-full py-3 border font-bold uppercase tracking-widest text-xs transition-all ${
              gameState.gameSpeed === 0
                ? 'bg-amber-900/50 border-amber-500 text-amber-400'
                : 'bg-zinc-950 border-cyan-900/50 text-cyan-700 hover:border-cyan-500 hover:text-cyan-400'
            }`}
          >
            {gameState.gameSpeed === 0 ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>

        {/* Dev Tools */}
        <div className="p-4 border-t border-cyan-900/50">
          <div className="text-rose-700 text-[10px] font-bold uppercase tracking-widest mb-2">Dev Tools</div>
          <button
            onClick={() => {
              if (engineRef.current) {
                engineRef.current.state.credits += 500;
                engineRef.current.notifyState();
              }
            }}
            className="w-full py-2 bg-rose-950/50 border border-rose-700 text-rose-400 font-bold uppercase tracking-widest text-xs hover:bg-rose-900 hover:border-rose-500 transition-all flex items-center justify-center gap-2"
          >
            <Coins size={12} /> +500 Credits
          </button>
        </div>
      </div>

      {/* Compendium Modal - Game Level */}
      {showCompendium && (
        <div
          className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50"
          onClick={() => setShowCompendium(false)}
        >
          <div
            className="bg-zinc-950 border border-cyan-900/50 max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="h-14 bg-black border-b border-cyan-900/50 flex items-center justify-between px-6">
              <h2 className="text-xl font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                <BookOpen size={20} /> Data Compendium
              </h2>
              <button
                onClick={() => setShowCompendium(false)}
                className="text-cyan-700 hover:text-cyan-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-cyan-900/50">
              <button
                onClick={() => setCompendiumTab('towers')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  compendiumTab === 'towers'
                    ? 'bg-cyan-950/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-cyan-700 hover:text-cyan-500'
                }`}
              >
                Towers
              </button>
              <button
                onClick={() => setCompendiumTab('enemies')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  compendiumTab === 'enemies'
                    ? 'bg-cyan-950/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-cyan-700 hover:text-cyan-500'
                }`}
              >
                Enemies
              </button>
              <button
                onClick={() => setCompendiumTab('skills')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  compendiumTab === 'skills'
                    ? 'bg-cyan-950/50 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-cyan-700 hover:text-cyan-500'
                }`}
              >
                Skills
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-14rem)]">
              {compendiumTab === 'towers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TOWER_COMPENDIUM.map((tower) => (
                    <TowerCard key={tower.id} tower={tower} />
                  ))}
                </div>
              )}
              {compendiumTab === 'enemies' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ENEMY_COMPENDIUM.map((enemy) => (
                    <EnemyCard key={enemy.id} enemy={enemy} />
                  ))}
                </div>
              )}
              {compendiumTab === 'skills' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SKILL_COMPENDIUM.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Victory Overlay */}
      {(gameState.status === 'gameover' || gameState.status === 'victory') && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50">
          <div className="bg-zinc-950 border border-cyan-900/50 p-8 text-center max-w-md w-full shadow-[0_0_50px_rgba(0,255,255,0.1)]">
            <h2 className={`text-4xl font-black uppercase tracking-widest mb-2 ${gameState.status === 'victory' ? 'text-emerald-500' : 'text-rose-500'}`}>
              {gameState.status === 'victory' ? 'System Secured' : 'Data Breach'}
            </h2>
            <p className="text-cyan-700 mb-8 font-mono text-sm">
              {gameState.status === 'victory' ? 'All threats neutralized.' : 'Critical system failure.'}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-black p-4 border border-cyan-900/30">
                <div className="text-cyan-800 text-[10px] font-bold uppercase mb-1">Waves Cleared</div>
                <div className="text-2xl font-mono text-white">{gameState.wave}</div>
              </div>
              <div className="bg-black p-4 border border-cyan-900/30">
                <div className="text-cyan-800 text-[10px] font-bold uppercase mb-1">Final Credits</div>
                <div className="text-2xl font-mono text-amber-400">{gameState.credits}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {gameState.status === 'victory' && currentLevelIndex < LEVELS.length - 1 && (
                <button 
                  onClick={() => setCurrentLevelIndex(currentLevelIndex + 1)}
                  className="w-full py-4 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-400 font-bold transition-colors uppercase tracking-widest text-sm"
                >
                  Proceed to Next Sector
                </button>
              )}
              {gameState.status === 'gameover' && (
                <button 
                  onClick={() => {
                    // Quick hack to force re-mount of the engine with the same level
                    const temp = currentLevelIndex;
                    setCurrentLevelIndex(null);
                    setTimeout(() => setCurrentLevelIndex(temp), 10);
                  }}
                  className="w-full py-4 bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-400 font-bold transition-colors uppercase tracking-widest text-sm"
                >
                  Retry Sector
                </button>
              )}
              <button 
                onClick={() => setCurrentLevelIndex(null)}
                className="w-full py-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-700 text-zinc-400 font-bold transition-colors uppercase tracking-widest text-sm"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
