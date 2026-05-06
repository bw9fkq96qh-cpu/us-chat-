import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const users = new Map();
const sessions = new Map();
const messages = [];

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

function publicUser(user) {
  return {
    id: user.id,
    username: user.username
  };
}

function authFromToken(token) {
  if (!token) return null;

  const userId = sessions.get(token);
  if (!userId) return null;

  const user = users.get(userId);
  return user ? publicUser(user) : null;
}

function onlineUsers() {
  const connectedUserIds = new Set();

  for (const socket of io.sockets.sockets.values()) {
    if (socket.user?.id) {
      connectedUserIds.add(socket.user.id);
    }
  }

  return [...connectedUserIds]
    .map((id) => users.get(id))
    .filter(Boolean)
    .map(publicUser);
}

function sendOnlineUsers() {
  io.emit("users:online", onlineUsers());
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/signup", (req, res) => {
  const username = String(req.body.username || "").trim();

  if (username.length < 3) {
    return res.status(400).json({
      error: "Username must be at least 3 characters."
    });
  }

  const exists = [...users.values()].some(
    (user) => user.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const user = {
    id: uuid(),
    username
  };
  const token = uuid();

  users.set(user.id, user);
  sessions.set(token, user.id);

  res.status(201).json({ token, user: publicUser(user) });
});

app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const user = [...users.values()].find(
    (candidate) => candidate.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ error: "Username not found. Sign up first." });
  }

  const token = uuid();
  sessions.set(token, user.id);

  res.json({ token, user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  const token = String(req.headers.authorization || "").replace("Bearer ", "");
  sessions.delete(token);
  res.status(204).send();
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const user = authFromToken(token);

  if (!user) {
    return next(new Error("Unauthorized"));
  }

  socket.user = user;
  next();
});

io.on("connection", (socket) => {
  socket.emit("messages:history", messages.slice(-50));
  sendOnlineUsers();

  socket.broadcast.emit("chat:system", {
    id: uuid(),
    text: `${socket.user.username} joined the chat`,
    createdAt: new Date().toISOString()
  });

  socket.on("message:send", (text, ack) => {
    const cleanText = String(text || "").trim();

    if (!cleanText) {
      ack?.({ ok: false, error: "Message cannot be empty." });
      return;
    }

    const message = {
      id: uuid(),
      text: cleanText.slice(0, 1000),
      user: socket.user,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    io.emit("message:new", message);
    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    sendOnlineUsers();
    socket.broadcast.emit("chat:system", {
      id: uuid(),
      text: `${socket.user.username} left the chat`,
      createdAt: new Date().toISOString()
    });
  });
});



app.use(express.static(path.join(__dirname, "../../client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});
server.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});
