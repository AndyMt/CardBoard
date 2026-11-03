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
| **CSV Parsing**           | [Papa Parse](https://www.papaparse.com/) | ^5.4.1      | Lightweight and powerful CSV parser for the browser.                                       |

---

### **Backend**
| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **Server Framework**      | [Express](https://expressjs.com/) | ^4.18.2     | Lightweight, flexible, and easy to integrate with WebSocket.                                |
| **Real-Time Communication** | [Socket.IO](https://socket.io/) | ^4.7.2      | Built-in support for WebSocket with fallbacks for older browsers.                          |
| **File Operations**       | [fs-extra](https://github.com/jprichardson/node-fs-extra) | ^11.1.1     | Promise-based file operations (simpler than `fs`).                                          |
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
| **Backend Development**   | [Nodemon](https://nodemon.io/) | ^3.0.1      | Auto-restarts the server during development.                                                |
| **TypeScript Compiler**   | [TypeScript (`tsc`)](https://www.typescriptlang.org/) | ^5.2.2      | Compiles TypeScript to JavaScript.                                                          |

---

## **4. Testing**
| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **Unit Testing**          | [Jest](https://jestjs.io/)  | ^29.6.4     | Zero-config, fast, and works well with React and TypeScript.                                |
| **End-to-End Testing**    | [Cypress](https://www.cypress.io/) | ^13.1.0     | Easy to set up and debug.                                                                   |

---

## **5. Persistence**
| **Purpose**               | **Library/Framework**       | **Version** | **Why**                                                                                     |
|---------------------------|-----------------------------|-------------|---------------------------------------------------------------------------------------------|
| **JSON Storage**          | `fs-extra` + `lockfile`     | Latest      | Human-readable JSON files with thread-safe writes.                                          |
| **Future: SQLite**        | [SQLite3](https://www.sqlite.org/index.html) | ^5.1.6      | Lightweight, file-based database with ACID compliance (optional for scaling).               |

---

## **7. Project Structure**
```
d:\Projects\GitRepos\CardBoard\
├── src\
│   ├── client\               # Frontend (React + TypeScript)
│   │   ├── components\       # React components (.tsx)
│   │   │   ├── BoardView.tsx
│   │   │   └── ToolbarView.tsx
│   │   ├── store\            # Zustand store (.ts)
│   │   │   └── useBoardStore.ts
│   │   └── App.tsx           # Entry point for frontend
│   │
│   ├── server\               # Backend (Express + TypeScript)
│   │   ├── model\            # Model layer (.ts)
│   │   │   ├── BoardModel.ts
│   │   │   ├── Card.ts
│   │   │   ├── Group.ts
│   │   │   └── JSONPersistence.ts
│   │   │
│   │   ├── controller\       # Controller layer (.ts)
│   │   │   ├── BoardController.ts
│   │   │   └── WebSocketController.ts
│   │   │
│   │   └── app.ts            # Entry point for backend
│   │
│   ├── types\                # Shared types (.ts)
│   │   ├── Board.ts
│   │   ├── Card.ts
│   │   └── Group.ts
│   │
│   └── data\                 # JSON files
│       ├── board.json
│       └── backups\
│
├── package.json
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
└── ARCHITECTURE.MD          # This document
```

