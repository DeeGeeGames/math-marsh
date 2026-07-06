# Math Marsh

A modern educational math game inspired by the classic "Number Munchers", built with TypeScript, Bun, and the ECSpresso ECS library.

## 🎮 Game Features

- **Grid-based Movement**: Classic Number Munchers-style movement with keyboard, gamepad, and optional touch controls
- **AI Enemies**: Lizard, spider, and frog enemies with chase, patrol, random, and guard behaviors
- **Equation Gameplay**: Addition, subtraction, multiplication, division, and mixed-operation modes
- **Adaptive Problem Prompts**: Alternates between selecting results and selecting operands as levels advance
- **Screen-based UI**: Menu, mode selection, settings, pause, level-complete, and game-over flows backed by ECSpresso screens
- **Canvas Presentation**: Pond board rendering, sprite-sheet character animation, equation feedback, and damage/level-complete effects

## 🏗️ Architecture

### ECS (Entity Component System)
- **ECSpresso Library**: Modern ECS implementation for game logic
- **Component-based Design**: Modular entity composition
- **System Priorities**: Optimized execution order for performance

### Core Systems
- **Movement System**: Processes queued player movement
- **AI System**: Chooses enemy movement and web placement behavior
- **Collision System**: Handles enemy, frog tongue, spider web, and equation selection interactions
- **Problem Management System**: Populates and advances equation boards
- **Sprite/Animation Systems**: Drive player, enemy, frog tongue, tween, and shake presentation
- **UI/Input Prompt Systems**: Keep DOM HUD, menu focus, and controller glyph prompts in sync
- **Render System**: Draws the board, entities, effects, and level-complete overlay on Canvas2D

### Key Components
- **Position**: Entity coordinates
- **Renderable**: Visual representation
- **Player**: Player-specific data (lives and death state)
- **Enemy**: AI behavior configuration
- **MathProblem**: Problem data and correctness
- **Collider**: Collision detection bounds
- **Health**: Life and invulnerability system
- **Timers / Tweens / Coroutines**: ECSpresso scripting-plugin components for delayed effects and animations

## 🚀 Getting Started

### Prerequisites
- Bun 1.3 or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/deegeegames/math-marsh.git
cd math-marsh

# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## 🎯 Gameplay

1. **Choose** a math mode and difficulty from the menu
2. **Navigate** the lily-pad grid using keyboard, gamepad, or touch controls
3. **Select** answer tiles with Space, Enter, or the primary gamepad button
4. **Avoid** enemies, frog tongues, and spider webs while solving equations
5. **Clear** enough prompts to advance to the next level

### Controls
- **WASD / Arrow Keys / D-pad / left stick**: Move
- **Space / Enter / primary gamepad button**: Eat or select
- **Escape / Start**: Pause or go back
- **F1**: Open settings
- **Touch controls**: Optional on-screen D-pad and Eat button, configurable in settings

## 🛠️ Development

### Project Structure
```
src/
├── assets/              # Runtime images, sprite sheets, and input glyph SVGs
├── ecs/                 # ECSpresso engine setup, types, entities, queries, plugins, and systems
│   └── systems/render/  # Canvas2D render helpers by visual concern
├── math/                # Equation generation, selection, and tests
├── types/               # Small shared type definitions
├── ui/                  # DOM screen specs, HUD, input prompts, fullscreen, and touch controls
├── config.ts            # Game balance, sizing, color, enemy, render, and animation constants
├── main.ts              # Browser entry point
└── style.css            # Global and screen-specific styles
```

### Configuration
Game settings can be modified in `src/config.ts`:
- Grid dimensions
- Entity sizes and colors
- Game mechanics (lives and run timing)
- Enemy behavior tuning
- Render margins and animation timing

### Adding New Features
1. **Components and resources**: Define in `src/ecs/types.ts`, then register them through `src/ecs/Engine.ts`
2. **Systems**: Create in `src/ecs/systems/` directory
3. **Entities**: Add factories in `src/ecs/entities.ts` and prefer ECSpresso command buffers from systems
4. **Screens/UI**: Add screen markup and wiring in `src/ui/screenSpecs.ts`; keep routing in `src/ui/UIManager.ts`
5. **Rendering**: Add focused helpers under `src/ecs/systems/render/` and compose draw order in `RenderSystem.ts`

## 🎨 Customization

### Visual Themes
Modify colors and styling in:
- `src/config.ts` - Entity colors and render constants
- `src/style.css` - CSS custom properties
- `src/ecs/systems/render/` - Canvas board and effect drawing

### Game Balance
Adjust difficulty in:
- `src/config.ts` - Core game, enemy, and animation settings
- `src/math/equations.ts` - Equation ranges and operation rules
- `src/ecs/systemConfigs.ts` - System priorities, spawn timing, and problem counts
- `src/ecs/systems/AISystem.ts` - Enemy behavior

## 🧪 Testing

```bash
# Run linting
bun run lint

# Type checking
bun run typecheck

# Build verification
bun run build

# Full project check
bun run check
```

## 🚀 Deployment

### Automatic GitHub Pages Deployment

This repository includes GitHub Actions for automatic deployment to GitHub Pages:

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Set Source to "GitHub Actions"

2. **Update Repository Base Path** if different from "/math-marsh/":
   ```bash
   BASE_PATH=/your-repo-name/ bun run build
   ```

3. **Push to master branch** to trigger automatic deployment:
   ```bash
   git push origin master
   ```

4. **Access your game** at: `https://deegeegames.github.io/math-marsh/`

### Manual Deployment

The game can also be deployed to any static hosting service:
- Netlify
- Vercel
- GitHub Pages (manual)
- Any static file server

```bash
bun run build
# Deploy the 'dist' folder to your hosting service
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the classic "Number Munchers" educational game
- Built with [ECSpresso](https://github.com/pedronasser/ecspresso) ECS library
- Powered by [Bun](https://bun.sh/) for development and build tooling

## 📈 Roadmap

### Completed Features
- ✅ Core gameplay mechanics
- ✅ AI enemy system
- ✅ Math problem generation
- ✅ ECSpresso screen flow
- ✅ Keyboard, gamepad, and touch controls
- ✅ Sprite-sheet character animation
- ✅ Pond-board visual presentation

### Planned Features
- 🎵 Audio system (sound effects, background music)
- 🏆 Achievement system
- 💾 Save game functionality
- 🌐 Online leaderboards
- Mobile app version
