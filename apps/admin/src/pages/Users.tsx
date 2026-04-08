import { useEffect, useState } from "react";
import { api, type UsersData, type UserDetailData } from "../api";
import { Card, StatCard } from "../components/Card";

type Filter = "" | "paying" | "active";

export default function Users() {
  const [data, setData] = useState<UsersData | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetailData | null>(null);
  const [error, setError] = useState("");

  const load = (p = page, s = search, f = filter) => {
    setError("");
    api.users({ page: p, search: s, filter: f })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => { load(1, search, filter); }, [search, filter]);

  const openUser = (userId: string) => {
    setSelected(userId);
    setDetail(null);
    api.userDetail(userId).then(setDetail).catch(() => {});
  };

  if (selected && detail) {
    return <UserDetail detail={detail} onBack={() => { setSelected(null); setDetail(null); }} />;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Пользователи</h1>
        {data && <span style={{ color: "var(--muted)", fontSize: 13 }}>Всего: {data.total.toLocaleString()}</span>}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <label htmlFor="users-search" style={{ display: "contents" }}>
          <input
            id="users-search"
            placeholder="Поиск по ID, username, имени..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 220 }}
            aria-label="Поиск пользователей"
          />
        </label>
        {(["", "paying", "active"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid",
              borderColor: filter === f ? "var(--accent)" : "var(--border)",
              background: filter === f ? "var(--accent-dim)" : "transparent",
              color: filter === f ? "var(--accent)" : "var(--muted)",
            }}
          >
            {f === "" ? "Все" : f === "paying" ? "Платящие" : "Активные (7д)"}
          </button>
        ))}
      </div>

      {error && <div style={{ color: "var(--red)", marginBottom: 12 }}>Ошибка: {error}</div>}

      <Card>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Telegram ID</th>
                <th>Монеты</th>
                <th>Генераций</th>
                <th>Потрачено ⭐</th>
                <th>Зарег.</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr
                  key={u.user_id}
                  style={{ cursor: "pointer" }}
                  onClick={() => openUser(u.user_id)}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{u.first_name ?? "—"}</div>
                    {u.username && <div style={{ fontSize: 11, color: "var(--muted)" }}>@{u.username}</div>}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{u.user_id}</td>
                  <td style={{ fontWeight: 600 }}>{u.paid_credits}</td>
                  <td>{u.gens_done}</td>
                  <td style={{ color: u.total_stars > 0 ? "var(--yellow)" : "var(--muted)" }}>
                    {u.total_stars > 0 ? `⭐ ${u.total_stars}` : "—"}
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button
              disabled={page === 1}
              onClick={() => { const p = page - 1; setPage(p); load(p); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: page === 1 ? "var(--muted)" : "var(--text)" }}
            >
              ←
            </button>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{page} / {data.pages}</span>
            <button
              disabled={page >= data.pages}
              onClick={() => { const p = page + 1; setPage(p); load(p); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: page >= data.pages ? "var(--muted)" : "var(--text)" }}
            >
              →
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}


function UserDetail({ detail, onBack }: { detail: UserDetailData; onBack: () => void }) {
  const { user, stats, orders, payments } = detail;
  const name = (user.first_name as string) ?? (user.user_id as string);

  return (
    <div>
      <button
        onClick={onBack}
        style={{ marginBottom: 20, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)" }}
      >
        ← Назад
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
        {name}
        {user.username != null && <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 8, fontSize: 15 }}>@{String(user.username)}</span>}
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Монеты" value={user.paid_credits as number} />
        <StatCard label="Генераций" value={stats.done_orders} color="var(--green)" />
        <StatCard label="Ошибок" value={stats.failed_orders} color={stats.failed_orders > 0 ? "var(--red)" : "var(--text)"} />
        <StatCard label="Монет потрачено" value={stats.coins_spent} />
        <StatCard label="Stars оплачено" value={stats.total_stars_paid > 0 ? `⭐ ${stats.total_stars_paid}` : "—"} color={stats.total_stars_paid > 0 ? "var(--yellow)" : "var(--text)"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ПОСЛЕДНИЕ ЗАКАЗЫ</div>
          <table>
            <thead>
              <tr><th>Статус</th><th>Стиль</th><th>🪙</th><th>Дата</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id as string}>
                  <td><StatusBadge status={o.status as string} /></td>
                  <td style={{ fontSize: 12 }}>{o.style_code as string}</td>
                  <td style={{ color: "var(--muted)" }}>{o.credit_cost as number}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(o.created_at as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ПЛАТЕЖИ</div>
          {payments.length === 0
            ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Платежей нет</div>
            : (
              <table>
                <thead>
                  <tr><th>Пакет</th><th>Stars</th><th>Дата</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.payment_id as string}>
                      <td style={{ fontSize: 12 }}>{p.package_code as string}</td>
                      <td style={{ color: "var(--yellow)", fontWeight: 600 }}>⭐ {p.amount as number}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(p.created_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: "var(--green)", failed: "var(--red)", processing: "var(--yellow)",
  };
  return (
    <span style={{ color: colors[status] ?? "var(--muted)", fontSize: 12, fontWeight: 500 }}>
      {status}
    </span>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
