# **CardBoard: Architecture Overview**

This document outlines the **frameworks, libraries, and architecture** used in the **CardBoard** project, a collaborative web application for managing cards and groups on a board.

---

## **1. Core Stack**

### **Frontend**

| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **UI Framework**          | [React](https://react.dev/) | ^18.2.0     | Component-based architecture, virtual DOM for performance, and a rich ecosystem.           |
| **State Management**      | [Zustand](https://zustand-demo.pmnd.rs/) | ^4.4.1 | Simpler than Redux, lightweight, and works well with React.                                |
| **Drag-and-Drop**         | [Dnd Kit](https://dndkit.com/) | ^6.0.8      | Modern, flexible, and performant drag-and-drop library for React.                          |
| **Styling**               | [TailwindCSS](https://tailwindcss.com/) | ^3.3.3      | Utility-first CSS framework for rapid UI development.                                      |
| **Real-Time Updates**     | [Socket.IO Client](https://socket.io/) | ^4.7.2      | Real-time bidirectional communication with the backend.                                    |

---

### **Backend**

| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **Server Framework**      | [Express](https://expressjs.com/) | ^5.3.0     | Lightweight, flexible, and easy to integrate with WebSocket.                                |
| **Real-Time Communication** | [Socket.IO](https://socket.io/) | ^4.7.2      | Built-in support for WebSocket with fallbacks for older browsers.                          |
| **File Operations**       | [fs-extra](https://github.com/jprichardson/node-fs-extra) | ^11.4.1     | Promise-based file operations (simpler than `fs`).                                          |
| **File Locking**          | [Lockfile](https://github.com/npm/lockfile) | ^1.0.4      | Prevents concurrent writes to the JSON file.                                                |

---

## **2. TypeScript**

| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **Type Safety**           | [TypeScript](https://www.typescriptlang.org/) | ^5.2.2      | Adds type safety to JavaScript, reducing bugs and improving maintainability.               |
| **Type Definitions**      | `@types/*`                  | Latest      | Type definitions for libraries (e.g., `@types/react`, `@types/express`).                   |

---

## **3. Build Tooling**

| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **Frontend Build**        | [Vite](https://vitejs.dev/) | ^4.4.9      | Faster than Create React App, modern tooling, and supports TypeScript out of the box.      |
| **TypeScript Compiler**   | [TypeScript (`tsc`)](https://www.typescriptlang.org/) | ^5.2.2      | Compiles TypeScript to JavaScript.                                                          |

---

## **4. Persistence**

| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **JSON Storage**          | `fs-extra` + `lockfile`     | Latest      | Human-readable JSON files with thread-safe writes.                                          |

---

## **5. Runtime & Scripts**

The application is split into a Vite dev server (client) and an Express + Socket.IO server (backend).

| **Script**               | **Command**                                             | **Description**                                                                             |
|--------------------------|---------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `npm run dev`            | `vite`                                                  | Starts the Vite dev server for the frontend.                                                |
| `npm run server`         | `npm run build:server && node dist/server/server.js`    | Compiles the server (TypeScript → CommonJS) then runs `dist/server/server.js`.              |
| `npm start`              | `concurrently "npm run server" "npm run dev"`           | Runs server and client concurrently via `concurrently`.                                     |
| `npm run build`          | `vite build`                                            | Builds the frontend to `build/`.                                                            |
| `npm run build:server`   | `tsc -p tsconfig.server.json`                           | Compiles the server TypeScript to `dist/`.                                                  |
| `npm run build:all`      | `npm run build:server && npm run build`                 | Builds both server and frontend.                                                            |
| `npm run preview`        | `vite preview`                                          | Previews the production frontend build.                                                     |

**Server port:** `process.env.PORT || 8080` (`src/server/server.ts:15`).

**Dev proxy:** `vite.config.ts` proxies `/api` and `/socket.io` to `http://localhost:8080` so the Vite dev server can reach the backend during development.

---

## **6. Project Structure**

```
D:\Projects\GitRepos\CardBoard\
├── src\
│   ├── client\               # Frontend (React + TypeScript)
│   │   ├── App.tsx           # Frontend entry point
│   │   ├── main.tsx          # React DOM mount
│   │   ├── components\       # React components (.tsx)
│   │   │   ├── BoardView.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ElementView.tsx
│   │   │   ├── Group.tsx
│   │   │   ├── SelectionTest.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── UserPicker.tsx
│   │   ├── controller\       # Client-side controllers (.ts)
│   │   │   ├── ElementSelectionController.ts
│   │   │   └── GroupSelectionController.ts
│   │   ├── hooks\            # React hooks (.ts)
│   │   │   └── useElementSelection.ts
│   │   └── services\         # Client services (.ts)
│   │       ├── BoardService.ts
│   │       ├── ToolService.ts
│   │       ├── UserService.ts
│   │       └── WebSocketService.ts
│   │
│   ├── server\               # Backend (Express + TypeScript)
│   │   ├── server.ts         # Entry point: Express app + Socket.IO HTTP server (port 8080)
│   │   ├── app.ts            # Express app instance
│   │   ├── controller\       # Server controllers (.ts)
│   │   │   ├── BoardController.ts
│   │   │   ├── ToolController.ts
│   │   │   └── WebSocketController.ts
│   │   ├── model\            # Server model layer (.ts)
│   │   │   ├── BoardModel.ts
│   │   │   ├── Card.ts
│   │   │   ├── ElementModel.ts
│   │   │   └── Group.ts
│   │   ├── persistence\      # Persistence layer (.ts)
│   │   │   ├── JSONPersistence.ts
│   │   │   └── UserPersistence.ts
│   │   └── services\         # Server services (.ts)
│   │       └── UserService.ts
│   │
│   ├── types\                # Shared types (.ts)
│   │   ├── Board.ts
│   │   ├── Card.ts
│   │   ├── Element.ts
│   │   ├── Group.ts
│   │   └── User.ts
│   │
│   ├── data\                 # JSON files (runtime)
│   │   └── backups\
│   │
│   ├── global.d.ts
│   └── vite-env.d.ts
│
├── package.json
├── package-lock.json
├── tsconfig.json            # Root TypeScript config (client, NodeNext module)
├── tsconfig.server.json     # Server TypeScript config (CommonJS, outDir dist)
├── vite.config.ts           # Vite config with /api and /socket.io proxy
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.MD          # This document
├── AGENTS.MD
├── REQUIREMENTS.MD
├── README.MD
└── SECURITY.md
```

---

## **7. Notes on removed items**

The following items were described in an earlier version of this document but are **not part of the current codebase** (not installed in `package.json`):

- **Papa Parse** — CSV parsing is not implemented via an external library.
- **Nodemon** — server is started via `npm run server` (build then run `dist/server/server.js`).
- **Jest** and **Cypress** — no test framework is installed.
- **SQLite3** — persistence uses JSON files only (`fs-extra` + `lockfile`); SQLite is not installed.
