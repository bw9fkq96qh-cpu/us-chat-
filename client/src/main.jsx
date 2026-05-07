import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";

const API_URL = "https://us-chat-9z9u.onrender.com";

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
const [messages, setMessages] = useState([]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/${mode}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    username,
    password,
  })
});
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <div>
          <p className="eyebrow">US Chat</p>
          <h1>{mode === "login" ? "Welcome back" : "Create an account"}</h1>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <label>
          Username
          <input
            autoComplete="username"
            minLength={3}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          /> 
          </label>
 <label>
  Password
  <input
    type="password"
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
</label>


        {error && <p className="error">{error}</p>}

        <button className="primary" disabled={loading} type="submit">
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>
    </main>
  );
}

function ChatApp({ auth, onLogout }) {
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [draft, setDraft] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const secretMode = true;
  const bottomRef = useRef(null);

  const socket = useMemo(
    () =>
      io(API_URL, {
  auth: {
    token: auth.token,
  },
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
}),
    [auth.token]
);

  useEffect(() => {
    socket.on("connect", () => setSocketStatus("online"));
    socket.on("disconnect", () => setSocketStatus("offline"));
    socket.on("connect_error", () => setSocketStatus("unauthorized"));
    socket.on("messages:history", (history) => setMessages(history));
    socket.on("message:new", (message) => {
      setMessages((current) => [...current, message]);
    });
    socket.on("typing", (username) => {
  setTypingUser(username);

  setTimeout(() => {
    setTypingUser("");
  }, 1500);
});
    socket.on("chat:system", (message) => { 
      setMessages((current) => [...current, { ...message, system: true }]);
    });
    socket.on("users:online", setOnlineUsers);

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(event) {
    event.preventDefault();
    const cleanDraft = draft.trim();

    if (!cleanDraft) return;

    socket.emit("message:send", cleanDraft, (response) => {
      if (response?.ok) {
        setDraft("");
      }
    });
  }

  async function logout() {
    await fetch(`${API_URL}/api/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}` }
    }).catch(() => {});
    socket.disconnect();
    onLogout();
  }

  return (
    <main className="chat-shell">
      <section className="chat-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Signed in as {auth.user.username}</p>
            <h1>Team Chat</h1>
          </div>
          <div className="topbar-actions">
            <span className={`status ${socketStatus}`}>{socketStatus}</span>
            <button type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <div className="me" aria-live="polite">
          {messages.length === 0 && (
          <div className="empty-state">
  No messages yet. Start the conversation.
</div>
          )}

          {messages.map((message) =>
            message.system ? (
              <p className="system-message" key={message.id}>
                {message.text}
              </p>
            ) : (
              <article
                className={`message ${
                  message.user.id === auth.user.id ? "mine" : ""
                }`}
                key={message.id}
              >
                <div className="message-meta">
                  <strong>{message.user.username}</strong>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </time>
                </div>
                <p>{message.text}</p>
              </article>
            )
          )}
          <div ref={bottomRef} />
        </div>

{typingUser && (
  <p className="typing-text">
    {typingUser} is typing...
  </p>
)}
       <form className="composer" onSubmit={sendMessage}>
  <input
    type="text"
    value={draft}
    onChange={(event) => {
      console.log("typing emitted");
      setDraft(event.target.value);
      socket.emit("typing", auth.user.username);
    }}
    placeholder="Type a message..."
    maxLength={1000}
  />

  <button className="primary" type="submit">
    Send
  </button>
</form>
</section>

      <aside className="sidebar">
        <h2>Online</h2>
        <div className="user-list">
          {onlineUsers.map((user) => (
            <div className="online-user" key={user.id}>
              <span>{user.username.slice(0, 1).toUpperCase()}</span>
              {user.username}
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem("chat-auth");
    return stored ? JSON.parse(stored) : null;
  });

  function handleAuth(nextAuth) {
    localStorage.setItem("chat-auth", JSON.stringify(nextAuth));
    setAuth(nextAuth);
  }

  function handleLogout() {
    localStorage.removeItem("chat-auth");
    setAuth(null);
  }

  return auth ? (
    <ChatApp auth={auth} onLogout={handleLogout} />
  ) : (
    <AuthForm onAuth={handleAuth} />
  );
}

createRoot(document.getElementById("root")).render(<App />);
