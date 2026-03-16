# Future Audio Implementation Plan

## Overview
This document outlines planned enhancements to the Neon Siege TD audio system, focusing on BGM (Background Music) variety and player control.

---

## Current State (As of 2026-03-15)

### File Structure
```
/public/sounds/
├── /sfx/     - Sound effects (24 files)
├── /bgm/     - Background music (2 files)
│   ├── Cpunk_log.ogg
│   └── neonsiege-2.ogg
└── /voice/   - Voice lines (15 files)
```

### Current Features
- **BGM Playlist**: 2 tracks play sequentially in loop
- **Auto-transition**: When one track ends, the next begins automatically
- **Volume Controls**: Music and SFX can be muted/unmuted independently
- **Voice Lines**: Contextual voice acting (grid full, losing, wave complete, build, ultimate)
- **Particle SFX**: Different particle shapes (circle, spark, tron, square) with appropriate sounds

### Known Limitations
- No BGM variety between playthroughs
- No player control over track selection
- No thematic connection between maps and music
- Long tracks (e.g., Cpunk_log.ogg ~5+ minutes) can cause monotony

---

## Recommended Implementation: Hybrid BGM System

### Concept
Combine **map-specific BGM** with **randomization** and **player control** to provide variety while maintaining thematic audio identity.

---

## 1. Track Discovery & Configuration

### Option A: Manual Track List (Recommended)
```typescript
// config.ts
export const ALL_BGM_TRACKS = [
  { id: 'bgm_1', file: 'Cpunk_log.ogg', name: 'CPunk Log', duration: 320 },
  { id: 'bgm_2', file: 'neonsiege-2.ogg', name: 'Neon Siege 2', duration: 245 },
  // Add new tracks here as they're added to /bgm/
];
```

**Pros:** Simple, reliable, no server dependencies
**Cons:** Requires manual updates when adding tracks

### Option B: Auto-Discovery (Future)
```typescript
// Fetch directory listing from server
async function loadBGMTracks() {
  const response = await fetch('/sounds/bgm/');
  const files = await response.text();
  // Parse HTML directory listing for .ogg files
}
```

**Pros:** Automatic, no maintenance
**Cons:** Requires server support, CORS configuration

---

## 2. Map-Specific BGM Configuration

```typescript
const MAPS = [
  {
    name: "The Outskirts",
    desc: "A simple path. Good for testing new defense algorithms.",
    bgm: ['bgm_1', 'bgm_2'], // Track IDs from ALL_BGM_TRACKS
    gridWidth: 20,
    gridHeight: 10,
    path: [...]
  },
  {
    name: "Data Hub Alpha",
    desc: "A winding path with multiple switchbacks.",
    bgm: ['bgm_1', 'bgm_2', 'bgm_3'], // Could have unique tracks
    gridWidth: 20,
    gridHeight: 12,
    path: [...]
  },
  {
    name: "The Firewall",
    desc: "A zigzagging gauntlet.",
    bgm: ['bgm_4', 'bgm_5'], // High-intensity boss tracks
    gridWidth: 22,
    gridHeight: 12,
    path: [...]
  }
];
```

---

## 3. Audio Settings State

```typescript
// App.tsx or dedicated settings store
type BGMMode = 'map-specific' | 'random-all' | 'single-track';

interface AudioSettings {
  mode: BGMMode;
  selectedTrack?: string; // For 'single-track' mode
  shuffleEnabled: boolean; // Shuffle map playlist
  musicVolume: number; // 0.0 - 1.0
  sfxVolume: number; // 0.0 - 1.0
  voiceVolume: number; // 0.0 - 1.0
}
```

### Persistence
```typescript
// Save to localStorage
localStorage.setItem('neonSiege_audioSettings', JSON.stringify(settings));

// Load on game start
const saved = localStorage.getItem('neonSiege_audioSettings');
const settings = saved ? JSON.parse(saved) : defaultSettings;
```

---

## 4. BGM Selection Logic

```typescript
function getNextTrack(
  mode: BGMMode,
  currentMap: LevelConfig,
  userSelectedTrack?: string
): string {
  switch (mode) {
    case 'map-specific':
      // Pick random from map's playlist
      const mapTracks = currentMap.bgm || ['bgm_1', 'bgm_2'];
      return mapTracks[Math.floor(Math.random() * mapTracks.length)];
    
    case 'random-all':
      // Pick random from ALL_BGM_TRACKS
      const allTracks = ALL_BGM_TRACKS.map(t => t.id);
      return allTracks[Math.floor(Math.random() * allTracks.length)];
    
    case 'single-track':
      // User selected specific track
      return userSelectedTrack || 'bgm_1';
  }
}
```

---

## 5. UI Implementation

### Audio Settings Panel
```
┌─ Audio Settings ─────────────────────────┐
│                                          │
│  Music Volume:  [====|====] 50%          │
│  SFX Volume:    [======|==] 75%          │
│  Voice Volume:  [========|=] 90%         │
│                                          │
│  BGM Mode:      [Map-Specific ▼]         │
│                 ┌──────────────────┐     │
│                 │ Map-Specific     │     │
│                 │ Random All       │     │
│                 │ Cpunk Log        │     │
│                 │ Neon Siege 2     │     │
│                 │ [New Track...]   │     │
│                 └──────────────────┘     │
│                                          │
│  [✓] Shuffle map tracks                  │
│                                          │
│  [Reset to Defaults]  [Close]            │
└──────────────────────────────────────────┘
```

### Integration Points
1. **Main Menu** - Settings button → Audio tab
2. **Pause Menu** - Quick audio adjustments during gameplay
3. **Map Select Screen** - Preview map-specific BGM

---

## 6. AudioManager Updates

### Current Playlist System
```typescript
musicPlaylist: string[] = ['music_bgm_1', 'music_bgm_2'];
currentMusicIndex: number = 0;
```

### Enhanced System
```typescript
class AudioManager {
  private settings: AudioSettings;
  private currentMap: LevelConfig | null;
  
  setAudioSettings(settings: AudioSettings) {
    this.settings = settings;
    this.applyVolumes();
  }
  
  setMap(map: LevelConfig) {
    this.currentMap = map;
    if (this.settings.mode === 'map-specific') {
      this.queueNextTrack();
    }
  }
  
  private queueNextTrack() {
    const trackId = getNextTrack(
      this.settings.mode,
      this.currentMap,
      this.settings.selectedTrack
    );
    this.playTrack(trackId);
  }
}
```

---

## 7. Implementation Priority

### Phase 1: Foundation (High Priority)
- [ ] Add `ALL_BGM_TRACKS` config array
- [ ] Add `bgm` array to map configs
- [ ] Update AudioManager to support track selection
- [ ] Add basic mode switching (map-specific vs random-all)

### Phase 2: Player Control (Medium Priority)
- [ ] Create audio settings UI panel
- [ ] Add volume sliders for Music/SFX/Voice
- [ ] Implement single-track selection mode
- [ ] Add localStorage persistence

### Phase 3: Polish (Low Priority)
- [ ] Add BGM preview in map select screen
- [ ] Implement crossfade between tracks
- [ ] Add "Now Playing" indicator during gameplay
- [ ] Support dynamic intensity switching (boss waves)

---

## 8. Future Enhancements

### Dynamic Intensity System
```typescript
// Track intensity based on wave number
const intensity = waveNumber / totalWaves; // 0.0 - 1.0

// Select BGM based on intensity
if (intensity > 0.8) {
  playTrack('bgm_boss_battle');
} else if (intensity > 0.5) {
  playTrack('bgm_moderate');
} else {
  playTrack('bgm_calm');
}
```

### Adaptive Audio
- Reduce music volume during voice lines
- Increase SFX volume during intense combat
- Pause music during pause menu

### Achievement Unlocks
- Unlock new BGM tracks by completing challenges
- "Complete Map 1 on Level 5" → Unlock `bgm_map1_boss.ogg`
- Display unlocked tracks in a "Jukebox" menu

---

## 9. File Organization Recommendations

### Suggested BGM Structure
```
/sounds/bgm/
├── /ambient/      - Calm, exploratory tracks
│   ├── outskirts_1.ogg
│   └── datahub_ambient.ogg
├── /action/       - Moderate intensity combat
│   ├── siege_1.ogg
│   └── siege_2.ogg
├── /boss/         - High intensity boss battles
│   ├── boss_mech.ogg
│   └── boss_ai.ogg
└── /special/      - Event-specific tracks
    ├── victory.ogg
    └── gameover.ogg
```

### Naming Convention
```
{map}_{type}_{number}.ogg
Examples:
- outskirts_ambient_1.ogg
- datahub_action_2.ogg
- firewall_boss_1.ogg
```

---

## 10. Technical Considerations

### Browser Autoplay Policy
- Music must start on user interaction (click, keypress)
- Implement "Click to Start" overlay if needed
- Resume AudioContext on first interaction

### Memory Management
- Large BGM files can consume significant memory
- Consider streaming for very long tracks (>5 min)
- Unload unused tracks when changing maps

### Loading Optimization
- Load BGM files asynchronously
- Prioritize current map's tracks
- Show loading indicator for large files

### Cross-Browser Compatibility
- Test on Chrome, Firefox, Safari, Edge
- Fallback to MP3 for Safari (if needed)
- Handle AudioContext state changes

---

## 11. Testing Checklist

- [ ] Music transitions smoothly between tracks
- [ ] Volume changes apply immediately
- [ ] Settings persist across page reloads
- [ ] Map-specific BGM changes when switching maps
- [ ] Random-all mode provides good variety
- [ ] Single-track mode loops correctly
- [ ] Audio works on all supported browsers
- [ ] Mobile touch interactions enable audio
- [ ] No audio glitches or stuttering

---

## Contact & Credits

**Discussion Date:** 2026-03-15
**Participants:** Developer
**Status:** Planned / Ready for Implementation

---

## Related Documentation
- `Development_Status_Report.md` - Current project status
- `Grid-Lock_Neon_Siege.md` - Game design document
- `NeonSiege_Implementation_Plan.md` - Original implementation roadmap
