# Conventions — F1 Pit Stop Strategy Optimizer

## General

- All documentation is written in sentence case — no Title Case headings inside prose
- No em dashes anywhere in code comments or documentation
- Commit messages follow conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`

## Python (Backend)

### Style
- Follow PEP 8. Use `black` for formatting, `ruff` for linting.
- Max line length: 88 characters (black default)
- Type hints on all function signatures

### Naming
- Functions and variables: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Pydantic models: `PascalCase` with descriptive suffix — `LapData`, `StrategyResponse`, `DegradationCurve`

### Compound names
Always uppercase strings. Use the module-level constant set:
```python
COMPOUNDS = {"SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"}
```
Never use abbreviations like `"S"` or `"M"`.

### DataFrames
- Column names are `snake_case` strings
- Required columns per module:

| Module | Required columns |
|---|---|
| ingestion | `driver`, `compound`, `tyre_age`, `lap_time`, `stint`, `lap_number` |
| degradation | `tyre_age`, `lap_time_delta`, `compound` |
| rival_model | `driver`, `compound`, `tyre_age`, `position`, `gap_to_leader` |

### Error handling
- Raise `ValueError` for bad input data (wrong compound name, missing columns)
- Raise `HTTPException` in FastAPI route handlers only — never in computation modules
- Log warnings with Python `logging` module, not `print`

### FastF1 usage
```python
import fastf1
fastf1.Cache.enable_cache('./cache')  # Always first

session = fastf1.get_session(year, round_number, 'R')
session.load()  # Loads laps, telemetry, weather
laps = session.laps
```

## TypeScript (Frontend)

### Style
- Use `prettier` for formatting (config in `frontend/.prettierrc`)
- Strict mode on — `"strict": true` in `tsconfig.json`
- No `any` without a `// reason:` comment on the same line

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities and lib files: `camelCase.ts`
- Types and interfaces: `PascalCase` — `RaceData`, `DriverStrategy`, `DegradationPoint`

### API calls
All calls go through `lib/api.ts`. Pattern:
```typescript
export async function getStrategy(year: number, round: number, driver: string): Promise<StrategyResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/race/${year}/${round}/strategy/${driver}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

### Component structure
```tsx
// 1. Imports
// 2. Types/interfaces local to this file
// 3. Component function
// 4. Export default
```

No default exports for utility functions — named exports only.

### Tailwind
- Use utility classes only, no `@apply` in CSS files
- Dark theme is the only theme — no light mode variants needed
- Colour shortcuts (define in component or use inline):
  - Background: `bg-[#0a0a0a]`, `bg-[#111]`
  - Accent: `bg-[#e8002d]`, `text-[#e8002d]`
  - Muted: `text-[#888]`
  - Border: `border-[#222]`

## Git

### Branch naming
- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `chore/short-description` — config, deps, tooling

### Commit messages
```
feat: add tyre degradation curve fitting
fix: handle missing lap data in rival_model
chore: add fastf1 cache to .gitignore
docs: update ARCHITECTURE with live data flow
```

### What not to commit
- `./cache/` directory (FastF1 cache, can be large)
- `.env` and `.env.local`
- `__pycache__/`, `.venv/`, `node_modules/`

Add these to `.gitignore` immediately.
