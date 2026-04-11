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
    <div className="login-shell">
      <form onSubmit={submit} className="login-form">
        <div className="login-header">
          <div className="login-logo-wrap">
            <IconLogo size={36} />
          </div>
          <h1 className="login-title">Persona Админка</h1>
          <p className="login-subtitle">Введите токен для входа</p>
        </div>

        <div className="login-card">
          <label className="login-label">
            Токен администратора
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_SECRET_TOKEN"
            autoFocus
            className="login-input"
          />

          {error && (
            <div className="error-box error-box--compact error-box--soft">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!token || loading}
            className={`login-submit${token ? "" : " login-submit--disabled"}`}
          >
            {loading ? "Проверяю..." : "Войти"}
          </button>
        </div>
      </form>
    </div>
  );
}
