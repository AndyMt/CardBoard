# **Working with Kilo (AI Agent)**

## Development Environment

- **Tools**: use agent tools first for list, read and write.
- **Terminal**: Use Git Bash for all other commands.
- **Prerequisites**: Node.js LTS; run `npm install` before starting.

## How to Run

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `vite` | Vite dev server (client only) |
| `npm run server` | `npm run build:server && node dist/server/server.js` | Build server TS, then run Express + Socket.IO server |
| `npm start` | `concurrently "npm run server" "npm run dev"` | Server + client concurrently |
| `npm run build` | `vite build` | Frontend to `build/` |
| `npm run build:server` | `tsc -p tsconfig.server.json` | Server TS to `dist/` |
| `npm run build:all` | `npm run build:server && npm run build` | Both server and frontend |
| `npm run preview` | `vite preview` | Preview production frontend |

Server port: `process.env.PORT || 8080` (`src/server/server.ts:15`).

## Best Practices

- **requirements**: look at REQUIREMENTS.MD for all requirements.
- **architecture**: look at ARCHITECTURE.MD for all architecture details.
- **Git**: when using Kilo's CODE mode, don't stage any changes, unless explicitly stated in the prompt.
- **Git**: when using Kilo's CODE mode, don't commit any changes, unless explicitly stated in the prompt.
