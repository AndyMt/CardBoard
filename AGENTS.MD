# **Working with Kilo (AI Agent)**

## Development Environment

- **Tools**: use agent tools (`read`, `glob`, `grep`, `semantic_search`) for all file inspection and search; use `bash` only for explicitly allowed commands.
- **Terminal**: Use Git Bash for all other commands, but only single commands without shell operators (`|`, `;`, `&&`, `||`, backticks, `$(`, redirections, newlines).
- **Read-only modes (Plan/Ask)**: In Plan mode, writes are limited to plan Markdown files; in Ask mode, do not use `write`/`edit`. Do not run git mutations (`git add`, `git commit`, `git checkout`, `git reset`, `git stash`, etc.), and do not run write/create/move/delete commands except Plan mode writing plan Markdown files. If an operation is unavailable, output the result as text instead of attempting a disallowed command.
- **Prerequisites**: Node.js LTS; run `npm install` before starting.

## Tool Usage by Mode

- **Plan mode**: Use ONLY dedicated agent tools for inspection (`read`, `glob`, `grep`, `semantic_search`). Writing/editing is permitted ONLY for plan Markdown files. Never use `bash` for file listing/reading/searching. Never edit source/config files. Never run git mutating commands.
- **Ask mode**: Use ONLY dedicated agent tools: `read`, `glob`, `grep`, `semantic_search`. Never use `write`/`edit`. Never run git mutating commands.
- **Code mode**: May use `write`/`edit` and allowed bash commands.

## Safe bash Commands

- Only run single commands matching explicit allow patterns.
- Never use shell operators (`|`, `;`, `&&`, `||`, backticks, `$(`, redirections, newlines).
- Never run git mutations (`git add`, `git commit`, `git checkout`, `git reset`, `git stash`, etc.); only read-only git subcommands are allowed.
- Never run write/create/move/delete commands in read-only modes (except Plan mode writing plan Markdown files).
- If a needed operation is not available via agent tools or allowed bash, output the result as text for the user instead of attempting a disallowed command. Do not retry denied commands; report the limitation.

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
- **Tools**: In Plan mode, writes are limited to plan Markdown files; in Ask mode, do not attempt writes, edits, or git mutations; prefer agent tools for all file inspection.
- **Git**: when using Kilo's CODE mode, don't stage any changes, unless explicitly stated in the prompt.
- **Git**: when using Kilo's CODE mode, don't commit any changes, unless explicitly stated in the prompt.
