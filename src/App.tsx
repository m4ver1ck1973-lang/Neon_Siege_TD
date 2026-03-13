import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { GameState, LevelConfig } from './game/types';
import { TOWERS, LEVELS } from './game/config';
import { Coins, Crosshair, X, ArrowUpCircle, Trash2, Triangle, Hexagon, Square, Diamond, Play } from 'lucide-react';
import { Tower } from './game/entities';

export default function App() {
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    health: 100, maxHealth: 100, credits: 600, wave: 0,
    maxPower: 100, usedPower: 0, isBrownout: false, status: 'playing'
  });
  
  const [radialMenu, setRadialMenu] = useState<{gridX: number, gridY: number, x: number, y: number} | null>(null);
  const [hoveredTower, setHoveredTower] = useState<any>(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<Tower | null>(null);

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
      <div className="flex flex-col w-full h-screen bg-[#050505] font-mono text-cyan-500 select-none items-center p-8 overflow-y-auto">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12 shrink-0">
            <h1 className="text-5xl font-black uppercase tracking-widest text-cyan-400 mb-4 flex items-center justify-center gap-4">
              <span className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></span>
              NEON_SIEGE_OS
              <span className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></span>
            </h1>
            <p className="text-cyan-700 uppercase tracking-widest text-sm">Select Sector to Defend</p>
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
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-[#050505] overflow-hidden font-mono text-cyan-500 select-none">
      
      {/* TOP BAR - Cyberpunk Terminal Style */}
      <div className="h-10 bg-black border-b border-cyan-900/50 flex items-center justify-between px-4 text-xs shadow-[0_0_15px_rgba(0,255,255,0.05)] z-20 shrink-0 uppercase tracking-wider">
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
        />

        {/* Planning Phase Overlay */}
        {gameState.status === 'planning' && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto z-30">
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
                    {category.type === 'Economic' && <Diamond size={20} color={level1.color} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Selected Tower Panel */}
        {selectedPlacedTower && (
          <div className="absolute bottom-6 right-6 bg-zinc-950/90 border border-cyan-900/50 p-4 w-64 shadow-[0_0_20px_rgba(0,255,255,0.1)] z-30">
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

