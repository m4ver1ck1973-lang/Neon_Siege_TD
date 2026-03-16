import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Save, Upload, Download, Trash2, Plus, Undo, Redo, Shuffle, Play, Grid3X3, Eraser, MousePointer2, X } from 'lucide-react';

interface Waypoint {
  x: number;
  y: number;
}

interface MapMetadata {
  name: string;
  description: string;
}

interface MapData {
  name: string;
  description: string;
  gridWidth: number;
  gridHeight: number;
  path: Waypoint[];
}

type ToolType = 'select' | 'add' | 'insert' | 'move' | 'delete';

const DEFAULT_GRID_WIDTH = 20;
const DEFAULT_GRID_HEIGHT = 12;
const CELL_SIZE = 40;
const WAYPOINT_RADIUS = 8;

export default function MapEditor({ onClose }: { onClose?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID_WIDTH);
  const [gridHeight, setGridHeight] = useState(DEFAULT_GRID_HEIGHT);
  const [path, setPath] = useState<Waypoint[]>([]);
  const [metadata, setMetadata] = useState<MapMetadata>({ name: '', description: '' });
  const [currentTool, setCurrentTool] = useState<ToolType>('add');
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<Waypoint[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showGrid, setShowGrid] = useState(true);
  const [generatedMap, setGeneratedMap] = useState<MapData | null>(null);

  // Handle exit
  const handleExit = () => {
    if (onClose) {
      onClose();
    } else {
      // Fallback: reload page if no onClose handler
      window.location.reload();
    }
  };

  // Save state to history for undo/redo
  const saveToHistory = useCallback((newPath: Waypoint[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newPath)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPath(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPath(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([[]]);
      setHistoryIndex(0);
    }
  }, []);

  // Validate map
  const validateMap = useCallback(() => {
    const errors: string[] = [];

    if (path.length < 2) {
      errors.push('Path must have at least 2 waypoints (start and end)');
    }

    for (const wp of path) {
      if (wp.x < 0 || wp.x >= gridWidth) {
        errors.push(`Waypoint (${wp.x}, ${wp.y}) is outside grid bounds (x)`);
      }
      if (wp.y < 0 || wp.y >= gridHeight) {
        errors.push(`Waypoint (${wp.x}, ${wp.y}) is outside grid bounds (y)`);
      }
    }

    // Check for consecutive duplicate waypoints
    for (let i = 1; i < path.length; i++) {
      if (path[i].x === path[i - 1].x && path[i].y === path[i - 1].y) {
        errors.push(`Duplicate waypoint at index ${i}`);
      }
    }

    // Check for diagonal segments (not supported)
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const isHorizontal = prev.y === curr.y;
      const isVertical = prev.x === curr.x;
      
      if (!isHorizontal && !isVertical) {
        errors.push(`Diagonal segment detected (from (${prev.x}, ${prev.y}) to (${curr.x}, ${curr.y})). Only horizontal and vertical segments are supported.`);
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [path, gridWidth, gridHeight]);

  useEffect(() => {
    validateMap();
  }, [path, gridWidth, gridHeight, validateMap]);

  // Convert canvas coordinates to grid coordinates
  const getGridCoords = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX / CELL_SIZE);
    const y = Math.floor((clientY - rect.top) * scaleY / CELL_SIZE);
    return { x, y };
  };

  // Find waypoint at grid position
  const findWaypointAt = (x: number, y: number) => {
    return path.findIndex(wp => wp.x === x && wp.y === y);
  };

  // Find nearest waypoint to grid position
  const findNearestWaypoint = (x: number, y: number, maxDistance = 1.5) => {
    let nearestIndex = -1;
    let minDistance = maxDistance;

    for (let i = 0; i < path.length; i++) {
      const dx = path[i].x - x;
      const dy = path[i].y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  };

  // Find nearest path segment and return the index to insert after
  const findNearestSegment = (targetX: number, targetY: number, maxDistance = 2) => {
    if (path.length < 2) return -1;

    let nearestSegmentIndex = -1;
    let minDistance = maxDistance;

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];

      // Calculate distance from point to line segment
      const distance = pointToSegmentDistance(targetX, targetY, p1.x, p1.y, p2.x, p2.y);

      if (distance < minDistance) {
        minDistance = distance;
        nearestSegmentIndex = i;
      }
    }

    return nearestSegmentIndex;
  };

  // Calculate distance from point to line segment
  const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      for (let x = 0; x <= gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, gridHeight * CELL_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(gridWidth * CELL_SIZE, y * CELL_SIZE);
        ctx.stroke();
      }
    }
    
    // Draw path
    if (path.length > 0) {
      // Draw path line
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#06b6d4';
      
      ctx.beginPath();
      ctx.moveTo(path[0].x * CELL_SIZE + CELL_SIZE / 2, path[0].y * CELL_SIZE + CELL_SIZE / 2);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * CELL_SIZE + CELL_SIZE / 2, path[i].y * CELL_SIZE + CELL_SIZE / 2);
      }
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      
      // Draw waypoints
      path.forEach((wp, index) => {
        const cx = wp.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = wp.y * CELL_SIZE + CELL_SIZE / 2;
        
        // Waypoint circle
        ctx.beginPath();
        ctx.arc(cx, cy, WAYPOINT_RADIUS, 0, Math.PI * 2);
        
        if (index === selectedWaypointIndex) {
          ctx.fillStyle = '#f43f5e';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#f43f5e';
        } else if (index === 0) {
          ctx.fillStyle = '#22c55e'; // Start - green
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#22c55e';
        } else if (index === path.length - 1) {
          ctx.fillStyle = '#ef4444'; // End - red
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ef4444';
        } else {
          ctx.fillStyle = '#06b6d4';
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#06b6d4';
        }
        
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw index number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index.toString(), cx, cy);
      });
    }
    
    // Draw hover preview
    if (hoveredCell && currentTool === 'add') {
      const { x, y } = hoveredCell;
      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x * CELL_SIZE + 5, y * CELL_SIZE + 5, CELL_SIZE - 10, CELL_SIZE - 10);
        ctx.setLineDash([]);
      }
    }

    // Draw hover for move tool
    if (hoveredCell && currentTool === 'move' && selectedWaypointIndex !== null) {
      const { x, y } = hoveredCell;
      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(
          x * CELL_SIZE + CELL_SIZE / 2,
          y * CELL_SIZE + CELL_SIZE / 2,
          WAYPOINT_RADIUS,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw insertion preview for insert tool
    if (hoveredCell && currentTool === 'insert' && path.length >= 2) {
      const { x, y } = hoveredCell;
      const segmentIndex = findNearestSegment(x, y);
      if (segmentIndex !== -1) {
        // Draw preview waypoint at hovered position
        const cx = x * CELL_SIZE + CELL_SIZE / 2;
        const cy = y * CELL_SIZE + CELL_SIZE / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, WAYPOINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw insertion indicator on the segment
        const p1 = path[segmentIndex];
        const p2 = path[segmentIndex + 1];
        const midX = (p1.x + p2.x) / 2 * CELL_SIZE + CELL_SIZE / 2;
        const midY = (p1.y + p2.y) / 2 * CELL_SIZE + CELL_SIZE / 2;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(midX - 10, midY);
        ctx.lineTo(midX + 10, midY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [path, gridWidth, gridHeight, hoveredCell, currentTool, selectedWaypointIndex, showGrid, insertAfterIndex]);

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getGridCoords(e.clientX, e.clientY, canvas);

    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;

    // Right-click always deselects in move tool
    if (e.button === 2 && currentTool === 'move') {
      setSelectedWaypointIndex(null);
      setIsDragging(false);
      return;
    }

    if (currentTool === 'add') {
      // Add new waypoint at end of path (for setting start/end points)
      const newPath = [...path, { x, y }];
      setPath(newPath);
      saveToHistory(newPath);
      setSelectedWaypointIndex(newPath.length - 1);
    } else if (currentTool === 'insert') {
      // Insert waypoint at nearest path segment
      if (path.length >= 2) {
        const segmentIndex = findNearestSegment(x, y);
        if (segmentIndex !== -1) {
          const newPath = [...path];
          newPath.splice(segmentIndex + 1, 0, { x, y });
          setPath(newPath);
          saveToHistory(newPath);
          setSelectedWaypointIndex(segmentIndex + 1);
        } else {
          // If no segment found (click far from path), append to end
          const newPath = [...path, { x, y }];
          setPath(newPath);
          saveToHistory(newPath);
          setSelectedWaypointIndex(newPath.length - 1);
        }
      } else if (path.length === 1) {
        // Only one point exists, just append
        const newPath = [...path, { x, y }];
        setPath(newPath);
        saveToHistory(newPath);
        setSelectedWaypointIndex(newPath.length - 1);
      } else {
        // Path is empty, start new path
        const newPath = [{ x, y }];
        setPath(newPath);
        saveToHistory(newPath);
        setSelectedWaypointIndex(0);
      }
    } else if (currentTool === 'select' || currentTool === 'move') {
      const index = findNearestWaypoint(x, y);
      if (index !== -1) {
        // If already selected, clicking again deselects
        if (selectedWaypointIndex === index) {
          setSelectedWaypointIndex(null);
        } else {
          setSelectedWaypointIndex(index);
          if (currentTool === 'move') {
            setIsDragging(true);
          }
        }
      } else {
        // Clicking empty space deselects
        setSelectedWaypointIndex(null);
      }
    } else if (currentTool === 'delete') {
      const index = findNearestWaypoint(x, y);
      if (index !== -1) {
        const newPath = path.filter((_, i) => i !== index);
        setPath(newPath);
        saveToHistory(newPath);
        setSelectedWaypointIndex(null);
      }
    }
  };

  // Handle context menu (prevent default right-click menu)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  // Handle mouse move
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getGridCoords(e.clientX, e.clientY, canvas);
    setHoveredCell({ x, y });

    if (isDragging && currentTool === 'move' && selectedWaypointIndex !== null) {
      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        const newPath = [...path];
        newPath[selectedWaypointIndex] = { x, y };
        setPath(newPath);
      }
    }
  };

  // Handle mouse up
  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      saveToHistory(path);
      // Don't deselect on mouse up - keep selected for further moves
    }
  };

  // Handle mouse leave
  const handleCanvasMouseLeave = () => {
    setHoveredCell(null);
    if (isDragging) {
      setIsDragging(false);
      saveToHistory(path);
    }
  };

  // Clear path
  const handleClearPath = () => {
    setPath([]);
    saveToHistory([]);
    setSelectedWaypointIndex(null);
  };

  // Export to JSON
  const handleExport = () => {
    if (!validateMap()) {
      alert('Please fix validation errors before exporting');
      return;
    }
    
    const mapData: MapData = {
      name: metadata.name || 'Custom Map',
      description: metadata.description || 'A custom created map',
      gridWidth,
      gridHeight,
      path
    };
    
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(metadata.name || 'map').toLowerCase().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import from JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.gridWidth && data.gridHeight && Array.isArray(data.path)) {
          setGridWidth(data.gridWidth);
          setGridHeight(data.gridHeight);
          setPath(data.path);
          saveToHistory(data.path);
          if (data.name) setMetadata(m => ({ ...m, name: data.name }));
          if (data.description) setMetadata(m => ({ ...m, description: data.description }));
          setSelectedWaypointIndex(null);
        } else {
          alert('Invalid map file format');
        }
      } catch (err) {
        alert('Failed to parse map file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Generate random map
  const handleGenerateMap = () => {
    const newGridWidth = 16 + Math.floor(Math.random() * 8); // 16-24
    const newGridHeight = 10 + Math.floor(Math.random() * 6); // 10-16
    
    setGridWidth(newGridWidth);
    setGridHeight(newGridHeight);
    
    // Generate a random path using a simple algorithm
    const newPath: Waypoint[] = [];
    let x = 0;
    let y = Math.floor(Math.random() * newGridHeight);
    
    newPath.push({ x, y });
    
    const maxWaypoints = 6 + Math.floor(Math.random() * 6); // 6-12 waypoints
    let direction = 'right';
    
    for (let i = 0; i < maxWaypoints; i++) {
      // Move towards the right side of the map
      const progress = x / newGridWidth;
      
      if (progress < 0.3) {
        // Early: mostly right, some up/down
        const rand = Math.random();
        if (rand < 0.6) direction = 'right';
        else if (rand < 0.8) direction = 'up';
        else direction = 'down';
      } else if (progress < 0.7) {
        // Middle: mix of directions
        const rand = Math.random();
        if (rand < 0.4) direction = 'right';
        else if (rand < 0.6) direction = 'up';
        else if (rand < 0.8) direction = 'down';
        else direction = Math.random() < 0.5 ? 'left' : 'right';
      } else {
        // Late: push towards right edge
        const rand = Math.random();
        if (rand < 0.7) direction = 'right';
        else if (rand < 0.85) direction = 'up';
        else direction = 'down';
      }
      
      const stepSize = 2 + Math.floor(Math.random() * 3); // 2-4 cells
      
      switch (direction) {
        case 'right':
          x = Math.min(x + stepSize, newGridWidth - 1);
          break;
        case 'left':
          x = Math.max(x - stepSize, 0);
          break;
        case 'up':
          y = Math.max(y - stepSize, 0);
          break;
        case 'down':
          y = Math.min(y + stepSize, newGridHeight - 1);
          break;
      }
      
      // Avoid duplicate waypoints
      const lastWp = newPath[newPath.length - 1];
      if (lastWp.x !== x || lastWp.y !== y) {
        newPath.push({ x, y });
      }
    }
    
    // Ensure last waypoint is on the right edge
    const lastWp = newPath[newPath.length - 1];
    if (lastWp.x < newGridWidth - 1) {
      newPath.push({ x: newGridWidth - 1, y: lastWp.y });
    }
    
    setPath(newPath);
    saveToHistory(newPath);
    setMetadata({
      name: `Generated Map ${Date.now().toString().slice(-4)}`,
      description: 'Procedurally generated map'
    });
    setSelectedWaypointIndex(null);
  };

  // Copy to clipboard
  const handleCopyToClipboard = () => {
    if (!validateMap()) {
      alert('Please fix validation errors before copying');
      return;
    }
    
    const mapData: MapData = {
      name: metadata.name || 'Custom Map',
      description: metadata.description || 'A custom created map',
      gridWidth,
      gridHeight,
      path
    };
    
    navigator.clipboard.writeText(JSON.stringify(mapData, null, 2))
      .then(() => alert('Map JSON copied to clipboard!'))
      .catch(() => alert('Failed to copy to clipboard'));
  };

  // Load generated map
  const handleLoadGenerated = () => {
    if (generatedMap) {
      setGridWidth(generatedMap.gridWidth);
      setGridHeight(generatedMap.gridHeight);
      setPath(generatedMap.path);
      saveToHistory(generatedMap.path);
      setMetadata({ name: generatedMap.name, description: generatedMap.description });
      setGeneratedMap(null);
    }
  };

  return (
    <div className="flex flex-row w-full h-screen bg-[#050505] font-mono text-cyan-500 select-none overflow-hidden">
      {/* Left Sidebar - Tools */}
      <div className="w-64 bg-zinc-950 border-r border-cyan-900/50 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
            <Grid3X3 size={20} /> Map Editor
          </h2>
          <button
            onClick={handleExit}
            className="text-cyan-700 hover:text-cyan-400 transition-colors"
            title="Exit to Menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Limitation Notice */}
        <div className="bg-amber-950/30 border border-amber-700/50 p-2 rounded">
          <div className="text-amber-400 text-[9px] font-bold uppercase tracking-widest mb-1">⚠ Limitation</div>
          <div className="text-amber-500 text-[9px] leading-tight">
            Diagonal paths are <strong className="text-amber-300">not supported</strong> in-game. Use only horizontal and vertical segments.
          </div>
        </div>

        {/* Tools */}
        <div>
          <div className="text-cyan-700 text-[10px] font-bold uppercase tracking-widest mb-2">Tools</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCurrentTool('select')}
              className={`py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                currentTool === 'select'
                  ? 'bg-cyan-900 border-cyan-400 text-cyan-400'
                  : 'bg-cyan-950/50 border-cyan-700 text-cyan-700 hover:border-cyan-500'
              }`}
            >
              <MousePointer2 size={14} /> Select
            </button>
            <button
              onClick={() => setCurrentTool('add')}
              className={`py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                currentTool === 'add'
                  ? 'bg-cyan-900 border-cyan-400 text-cyan-400'
                  : 'bg-cyan-950/50 border-cyan-700 text-cyan-700 hover:border-cyan-500'
              }`}
            >
              <Plus size={14} /> Add
            </button>
            <button
              onClick={() => setCurrentTool('insert')}
              className={`py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                currentTool === 'insert'
                  ? 'bg-emerald-900 border-emerald-400 text-emerald-400'
                  : 'bg-cyan-950/50 border-cyan-700 text-cyan-700 hover:border-cyan-500'
              }`}
            >
              <Plus size={14} /> Insert
            </button>
            <button
              onClick={() => setCurrentTool('move')}
              className={`py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                currentTool === 'move'
                  ? 'bg-cyan-900 border-cyan-400 text-cyan-400'
                  : 'bg-cyan-950/50 border-cyan-700 text-cyan-700 hover:border-cyan-500'
              }`}
            >
              <MousePointer2 size={14} /> Move
            </button>
            <button
              onClick={() => setCurrentTool('delete')}
              className={`py-2 px-3 border text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                currentTool === 'delete'
                  ? 'bg-rose-900 border-rose-400 text-rose-400'
                  : 'bg-cyan-950/50 border-cyan-700 text-cyan-700 hover:border-cyan-500'
              }`}
            >
              <Eraser size={14} /> Delete
            </button>
          </div>
        </div>
        
        {/* Actions */}
        <div>
          <div className="text-cyan-700 text-[10px] font-bold uppercase tracking-widest mb-2">Actions</div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="flex-1 py-2 bg-cyan-950/50 border border-cyan-700 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:bg-cyan-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="flex-1 py-2 bg-cyan-950/50 border border-cyan-700 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:bg-cyan-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
            >
              <Redo size={14} />
            </button>
          </div>
          <button
            onClick={handleGenerateMap}
            className="w-full py-2 mb-2 bg-purple-950/50 border border-purple-700 text-purple-400 font-bold uppercase tracking-widest text-xs hover:bg-purple-900 transition-all flex items-center justify-center gap-2"
          >
            <Shuffle size={14} /> Generate Random
          </button>
          <button
            onClick={handleClearPath}
            className="w-full py-2 bg-rose-950/50 border border-rose-700 text-rose-400 font-bold uppercase tracking-widest text-xs hover:bg-rose-900 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Clear Path
          </button>
        </div>
        
        {/* Grid Settings */}
        <div>
          <div className="text-cyan-700 text-[10px] font-bold uppercase tracking-widest mb-2">Grid Size</div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-cyan-600 w-16">Width:</label>
            <input
              type="number"
              value={gridWidth}
              onChange={(e) => setGridWidth(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
              className="flex-1 bg-black border border-cyan-900/50 text-cyan-400 px-2 py-1 text-xs"
              min="5"
              max="50"
            />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-cyan-600 w-16">Height:</label>
            <input
              type="number"
              value={gridHeight}
              onChange={(e) => setGridHeight(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
              className="flex-1 bg-black border border-cyan-900/50 text-cyan-400 px-2 py-1 text-xs"
              min="5"
              max="50"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-cyan-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="accent-cyan-500"
            />
            Show Grid
          </label>
        </div>
        
        {/* Validation */}
        {validationErrors.length > 0 && (
          <div className="bg-rose-950/30 border border-rose-700/50 p-2 rounded">
            <div className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mb-1">Validation Errors</div>
            <ul className="text-rose-500 text-[10px] list-disc list-inside space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Stats */}
        <div className="mt-auto">
          <div className="bg-black border border-cyan-900/30 p-3">
            <div className="text-cyan-800 text-[10px] uppercase mb-2">Map Stats</div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-cyan-700">Waypoints</div>
                <div className="text-white font-bold">{path.length}</div>
              </div>
              <div>
                <div className="text-cyan-700">Grid Size</div>
                <div className="text-white font-bold">{gridWidth}×{gridHeight}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <canvas
            ref={canvasRef}
            width={gridWidth * CELL_SIZE}
            height={gridHeight * CELL_SIZE}
            onClick={handleCanvasClick}
            onContextMenu={handleContextMenu}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
            className="border border-cyan-900/50 shadow-[0_0_50px_rgba(0,255,255,0.05)] cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        
        {/* Tool hint */}
        <div className="h-8 bg-black border-t border-cyan-900/50 flex items-center px-4 text-[10px] text-cyan-600">
          {currentTool === 'add' && 'Click to set start/end points. Waypoints are appended to the path end.'}
          {currentTool === 'insert' && 'Click near a path segment to insert a waypoint between existing points.'}
          {currentTool === 'select' && 'Click a waypoint to select it. Click again or click empty space to deselect.'}
          {currentTool === 'move' && 'Drag waypoints to move. Click selected waypoint again, right-click, or click empty space to deselect.'}
          {currentTool === 'delete' && 'Click on a waypoint to remove it from the path.'}
        </div>
      </div>
      
      {/* Right Sidebar - Metadata & Export */}
      <div className="w-72 bg-zinc-950 border-l border-cyan-900/50 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        <h2 className="text-lg font-black uppercase tracking-widest text-cyan-400">Properties</h2>
        
        {/* Map Metadata */}
        <div>
          <div className="text-cyan-700 text-[10px] font-bold uppercase tracking-widest mb-2">Map Info</div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-cyan-600 block mb-1">Name</label>
              <input
                type="text"
                value={metadata.name}
                onChange={(e) => setMetadata(m => ({ ...m, name: e.target.value }))}
                placeholder="My Custom Map"
                className="w-full bg-black border border-cyan-900/50 text-cyan-400 px-2 py-1 text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-cyan-600 block mb-1">Description</label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata(m => ({ ...m, description: e.target.value }))}
                placeholder="A custom created map..."
                rows={3}
                className="w-full bg-black border border-cyan-900/50 text-cyan-400 px-2 py-1 text-xs focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>
        
        {/* Export/Import */}
        <div>
          <div className="text-cyan-700 text-[10px] font-bold uppercase tracking-widest mb-2">Save / Load</div>
          <div className="space-y-2">
            <button
              onClick={handleExport}
              disabled={validationErrors.length > 0}
              className="w-full py-2 bg-emerald-950/50 border border-emerald-700 text-emerald-400 font-bold uppercase tracking-widest text-xs hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Download size={14} /> Export JSON
            </button>
            <button
              onClick={handleCopyToClipboard}
              disabled={validationErrors.length > 0}
              className="w-full py-2 bg-cyan-950/50 border border-cyan-700 text-cyan-400 font-bold uppercase tracking-widest text-xs hover:bg-cyan-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Save size={14} /> Copy to Clipboard
            </button>
            <label className="w-full py-2 bg-amber-950/50 border border-amber-700 text-amber-400 font-bold uppercase tracking-widest text-xs hover:bg-amber-900 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Upload size={14} /> Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {/* Path Preview */}
        {path.length > 0 && (
          <div>
            <div className="text-cyan-700 text-[10px] font-bold uppercase tracking-widest mb-2">Path Preview</div>
            <div className="bg-black border border-cyan-900/30 p-2 rounded max-h-48 overflow-y-auto">
              <div className="text-[10px] text-cyan-600 mb-1">Waypoints:</div>
              {path.map((wp, i) => (
                <div
                  key={i}
                  className={`text-[9px] font-mono py-0.5 px-1 rounded ${
                    i === selectedWaypointIndex ? 'bg-cyan-900 text-cyan-300' : 'text-cyan-700'
                  }`}
                >
                  {i}: ({wp.x}, {wp.y})
                  {i === 0 && ' ← START'}
                  {i === path.length - 1 && ' ← END'}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Help */}
        <div className="mt-auto">
          <div className="bg-black border border-cyan-900/30 p-3 rounded">
            <div className="text-cyan-800 text-[10px] font-bold uppercase tracking-widest mb-2">Quick Help</div>
            <ul className="text-cyan-700 text-[9px] space-y-1">
              <li>• <strong className="text-cyan-500">Add:</strong> Set start/end points (appends to path)</li>
              <li>• <strong className="text-emerald-500">Insert:</strong> Add nodes between existing points</li>
              <li>• <strong className="text-cyan-500">Move:</strong> Drag waypoints to reposition</li>
              <li>• <strong className="text-rose-500">Delete:</strong> Click to remove waypoints</li>
              <li>• <strong className="text-green-500">Green</strong> = Start point</li>
              <li>• <strong className="text-red-500">Red</strong> = End point</li>
              <li>• Export creates a JSON file for use in config.ts</li>
            </ul>
            <div className="mt-2 pt-2 border-t border-cyan-900/30">
              <div className="text-amber-500 text-[9px] font-bold uppercase tracking-widest mb-1">⚠ Important</div>
              <div className="text-amber-600 text-[9px]">
                Only use <strong className="text-amber-400">horizontal</strong> and <strong className="text-amber-400">vertical</strong> path segments. Diagonal paths are not supported.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
