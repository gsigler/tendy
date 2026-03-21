import { useState } from "react";
import AuthPage from "./components/AuthPage";
import ChatPage from "./components/ChatPage";
import { isLoggedIn, type AuthResponse, type User } from "./lib/api";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    if (isLoggedIn()) {
      // Try to restore user from localStorage
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });

  function handleAuth(data: AuthResponse) {
    setUser(data.user);
    localStorage.setItem("user", JSON.stringify(data.user));
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("user");
  }

  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return <ChatPage user={user} onLogout={handleLogout} />;
}
