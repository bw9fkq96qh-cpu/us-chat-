# Socket Chat App

A small full-stack chat app with a React frontend, Node.js backend, Socket.io real-time messages, and in-memory username login/signup.

## Setup

```bash
npm run install:all
```

If PowerShell blocks `npm` on Windows, use:

```bash
npm.cmd run install:all
```

## Run It

```bash
npm run dev
```

If PowerShell blocks `npm` on Windows, use:

```bash
npm.cmd run dev
```

The client runs at `http://localhost:5173` and the server runs at `http://localhost:4000`.

## Notes

- Users, sessions, and messages live in memory and reset when the server restarts.
- Login only needs a username that has already been signed up.
- Signup creates a session immediately.
- Socket.io requires the login token before a user can connect to chat.
