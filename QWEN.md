# Neon Siege TD - Project Context

## Project Overview

**Neon Siege TD** (also known as "Grid-Lock: Neon Siege") is a cyberpunk-themed tower defense game built with React, TypeScript, and Canvas API. Players act as "Grid-Watchers" defending a data vault from corporate extraction teams and AI-purge programs.

### Core Technologies
- **Frontend Framework:** React 19 with TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS 4
- **Rendering:** HTML5 Canvas API (custom game engine)
- **Animations:** Motion (Framer Motion)
- **Icons:** Lucide React

### Key Game Mechanics
- **Power Grid System:** Every tower consumes Watts. Exceeding power capacity causes "brownouts" reducing fire rates by 50%
- **5 Tower Types:** Kinetic, Debuff, Energy, Chemical, Economic (each with 3 upgrade levels)
- **Active Skills:** Monowire Trip-Mine, Holographic Decoy, EMP Charge
- **Enemy Factions:** Corporate Scripters, Heavy Construction, Bio-Hacked, Digital Anomalies, Bosses
- **20 Levels:** 4 maps × 5 difficulty levels

## Project Structure

```
Neon_Siege_TD/
├── src/
│   ├── game/
│   │   ├── engine.ts        # Main game loop, rendering, update logic
│   │   ├── entities.ts      # Enemy, Tower, Projectile, Particle, Trap, Decoy classes
│   │   ├── config.ts        # Game data: TOWERS, ENEMIES, LEVELS, ACTIVE_SKILLS
│   │   ├── types.ts         # TypeScript interfaces and type definitions
│   │   ├── effectManager.ts # Status effect application (slow, stun, corrosion, etc.)
│   │   └── math.ts          # Vector math utilities (distance, normalize, moveTowards)
│   ├── App.tsx              # Main React component with UI and game state management
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind CSS imports
│   └── ErrorBoundary.tsx    # React error boundary
├── docs/
│   ├── NeonSiege_Implementation_Plan.md  # Detailed implementation roadmap
│   └── Grid-Lock_Neon_Siege.md           # Game design document
├── sounds/                    # Audio assets directory
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## Building and Running

### Prerequisites
- Node.js (version specified in package.json dependencies)
- Gemini API key (for AI features)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Runs on `http://localhost:3000` with hot module replacement.

### Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Linting
```bash
npm run lint
```
Runs TypeScript type checking.

### Environment Variables
Copy `.env.example` to `.env.local`:
```bash
GEMINI_API_KEY="your-api-key-here"
APP_URL="http://localhost:3000"
```

## Development Conventions

### Code Style
- **TypeScript:** Strict typing with interfaces in `types.ts`
- **React:** Functional components with hooks (`useState`, `useEffect`, `useRef`)
- **Naming:** PascalCase for classes/components, camelCase for variables/functions
- **Path Aliases:** `@/` resolves to project root (configured in `tsconfig.json`)

### Game Architecture Patterns
- **Game Loop:** `requestAnimationFrame` with delta time for frame-independent updates
- **Entity System:** Class-based entities (Enemy, Tower, Projectile) with composition
- **State Management:** React state for UI, class properties for game state
- **Effect System:** Status effects (slow, stun, corrosion, nanite_plague) managed by `EffectManager`

### Key Implementation Details

#### Tower Configuration (`config.ts`)
Towers are defined with upgrade paths:
```typescript
{
  type: "Kinetic",
  levels: [
    { id: "kin_1", name: "Slug-Turret", cost: 150, powerDraw: 5, ... },
    { id: "kin_2", name: "Autocannon", cost: 400, powerDraw: 12, ... },
    { id: "kin_3", name: "Rail-Accelerator", cost: 1200, powerDraw: 35, ... }
  ]
}
```

#### Enemy Logic Tags
Enemies use `logic_tag` strings for special behaviors:
- `ignore_slow_10` - 10% slow resistance
- `stealth_active_2s` - Stealth cycle
- `front_shield_90` - 90% damage reduction from front
- `on_death_spread` - Nanite plague spreads on death

#### Power Management
```typescript
// Economic towers have negative powerDraw (e.g., -5, -20, -75)
// Total power = sum of all tower powerDraw values
// Brownout occurs when usedPower > maxPower
```

### Testing Practices
- No formal test suite currently configured
- Manual testing via game levels
- TypeScript strict mode provides compile-time type safety

## Game State Flow

1. **Menu:** Level selection screen
2. **Planning:** Pre-wave preparation phase
3. **Playing:** Wave active, enemies spawning
4. **Victory/Defeat:** End state with restart options

## UI Components

- **Top Bar:** Health, Wave, Credits, Power meter
- **Radial Menu:** Tower selection (appears on grid click)
- **Skill Bar:** Active skills with cooldown display
- **Tower Info Panel:** Upgrade/sell options for selected tower
- **Game Over Overlay:** Victory/defeat screen with stats

## Canvas Rendering

The game renders to a full-screen canvas with:
- Grid-based placement system
- Procedural geometric shapes for towers/enemies
- Neon glow effects via `shadowBlur`
- Particle systems for explosions and effects
- Scanline overlay for cyberpunk aesthetic

## Future Implementation (from docs)

- Audio system with Web Audio API
- Additional enemy logic tags (teleport, evasion, healing)
- Boss mechanics (tower hijacking, off-path movement)
- Progression system with persistent unlocks
- Map-specific mechanics (fog of war, wind gusts)
- Endless mode with leaderboard
