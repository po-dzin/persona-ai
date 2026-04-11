import { useEffect, useState } from "react";
import { api, type UsersData, type UserDetailData } from "../api";
import { Card, StatCard } from "../components/Card";
import { formatDateTimeShort } from "../utils/format";

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
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Пользователи</h1>
        {data && <span className="page-meta">Всего: {data.total.toLocaleString()}</span>}
      </div>

      {/* Controls */}
      <div className="users-controls">
        <label htmlFor="users-search" className="users-search-wrap">
          <input
            id="users-search"
            placeholder="Поиск по ID, username, имени..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="users-search-input"
            aria-label="Поиск пользователей"
          />
        </label>
        <div className="users-filters-scroll" role="region" aria-label="Фильтры пользователей">
          <div className="users-filters-row">
            {(["", "paying", "active"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`filter-chip${filter === f ? " filter-chip--active" : ""}`}
              >
                {f === "" ? "Все" : f === "paying" ? "Платящие" : "Активные (7д)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="page-error-inline">Ошибка: {error}</div>}

      <Card>
        <div className="card-scroll-x">
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
                  className="table-row-clickable"
                  onClick={() => openUser(u.user_id)}
                >
                  <td>
                    <div className="cell-strong">{u.first_name ?? "—"}</div>
                    {u.username && <div className="cell-xs-muted">@{u.username}</div>}
                  </td>
                  <td className="cell-mono-sm">{u.user_id}</td>
                  <td className="cell-strong">{u.paid_credits}</td>
                  <td>{u.gens_done}</td>
                  <td className={u.total_stars > 0 ? "cell-yellow-strong" : "cell-muted"}>
                    {u.total_stars > 0 ? `⭐ ${u.total_stars}` : "—"}
                  </td>
                  <td className="cell-sm-muted">{formatDateTimeShort(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="pager">
            <button
              disabled={page === 1}
              onClick={() => { const p = page - 1; setPage(p); load(p); }}
              className="pager-btn"
            >
              ←
            </button>
            <span className="page-meta">{page} / {data.pages}</span>
            <button
              disabled={page >= data.pages}
              onClick={() => { const p = page + 1; setPage(p); load(p); }}
              className="pager-btn"
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
        className="back-btn"
      >
        ← Назад
      </button>

      <h1 className="detail-title">
        {name}
        {user.username != null && <span className="detail-title-sub">@{String(user.username)}</span>}
      </h1>

      <div className="stats-grid detail-stats-grid">
        <StatCard label="Монеты" value={user.paid_credits as number} />
        <StatCard label="Генераций" value={stats.done_orders} tone="success" />
        <StatCard label="Ошибок" value={stats.failed_orders} tone={stats.failed_orders > 0 ? "danger" : "default"} />
        <StatCard label="Монет потрачено" value={stats.coins_spent} />
        <StatCard label="Stars оплачено" value={stats.total_stars_paid > 0 ? `⭐ ${stats.total_stars_paid}` : "—"} tone={stats.total_stars_paid > 0 ? "warning" : "default"} />
      </div>

      <div className="split-grid">
        <Card>
          <div className="card-title">ПОСЛЕДНИЕ ЗАКАЗЫ</div>
          <div className="card-scroll-x">
            <table>
              <thead>
                <tr><th>Статус</th><th>Стиль</th><th>🪙</th><th>Дата</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id as string}>
                    <td><StatusBadge status={o.status as string} /></td>
                    <td className="cell-sm">{o.style_code as string}</td>
                    <td className="cell-muted">{o.credit_cost as number}</td>
                    <td className="cell-xs-muted">{formatDateTimeShort(o.created_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="card-title">ПЛАТЕЖИ</div>
          {payments.length === 0
            ? <div className="muted-body">Платежей нет</div>
            : (
              <div className="card-scroll-x">
                <table>
                  <thead>
                    <tr><th>Пакет</th><th>Stars</th><th>Дата</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.payment_id as string}>
                        <td className="cell-sm">{p.package_code as string}</td>
                        <td className="cell-yellow-strong">⭐ {p.amount as number}</td>
                        <td className="cell-xs-muted">{formatDateTimeShort(p.created_at as string)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {status}
    </span>
  );
}
