import { useState } from "react";
import { IconLogo } from "../components/Icons";

interface Props { onLogin: (token: string) => void; }

export default function Login({ onLogin }: Props) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/admin/api/overview?days=1", {
        headers: { "X-Admin-Token": token },
      });
      if (res.status === 401) { setError("Неверный токен"); return; }
      if (res.status === 503) { setError("ADMIN_SECRET_TOKEN не настроен на сервере"); return; }
      if (!res.ok) { setError(`Ошибка сервера: ${res.status}`); return; }
      onLogin(token);
    } catch {
      setError("Нет соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh" }}>
      <form onSubmit={submit} style={{ width: 320 }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: "var(--accent)" }}>
            <IconLogo size={36} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Persona Админка</h1>
          <p style={{ color: "var(--muted)", marginTop: 4 }}>Введите токен для входа</p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
          <label style={{ display: "block", marginBottom: 6, color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Токен администратора
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_SECRET_TOKEN"
            autoFocus
            style={{ width: "100%", marginBottom: 16 }}
          />

          {error && (
            <div style={{ background: "rgba(248,113,113,.1)", border: "1px solid var(--red)", borderRadius: 8, padding: "8px 12px", color: "var(--red)", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!token || loading}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
              background: token ? "var(--accent)" : "var(--border)",
              color: token ? "#fff" : "var(--muted)",
              fontWeight: 600, transition: "background .15s",
            }}
          >
            {loading ? "Проверяю..." : "Войти"}
          </button>
        </div>
      </form>
    </div>
  );
}
