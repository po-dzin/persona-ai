import { useEffect, useMemo, useState } from "react";
import {
  api,
  type LifecycleOverviewData,
  type LifecycleTimelineData,
  type LifecycleUsersData,
} from "../api";
import { Card, StatCard } from "../components/Card";
import { LineChart } from "../components/Chart";
import PeriodPicker from "../components/PeriodPicker";
import { CHART_COLORS } from "../utils/chartTokens";
import { formatDateTimeShort } from "../utils/format";

const STATES = ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "INACTIVE_30D"] as const;

export default function Lifecycle() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<LifecycleOverviewData | null>(null);
  const [users, setUsers] = useState<LifecycleUsersData | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<LifecycleTimelineData | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    Promise.all([
      api.lifecycleOverview(days),
      api.lifecycleUsers({ state, search, page: 1, limit: 50 }),
    ])
      .then(([o, u]) => {
        setOverview(o);
        setUsers(u);
      })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => { load(); }, [days, state, search]);

  const openUser = (userId: string) => {
    setSelectedUser(userId);
    setTimeline(null);
    api.lifecycleTimeline(userId).then(setTimeline).catch((e: Error) => setError(e.message));
  };

  const chartData = useMemo(
    () => (overview?.transitions_daily ?? []).map((d) => ({ day: d.day, transitions: d.transitions })),
    [overview],
  );

  const doAction = async (action: "force" | "lock" | "unlock" | "recompute") => {
    if (!selectedUser) return;
    const reason = window.prompt("Причина действия (обязательно):", action);
    if (!reason || reason.trim().length < 3) return;
    try {
      if (action === "force") {
        const toState = window.prompt(`Целевой статус (${STATES.join(", ")}):`, "S3") ?? "";
        if (!STATES.includes(toState as (typeof STATES)[number])) return;
        await api.lifecycleForceTransition(selectedUser, toState, reason.trim());
      } else if (action === "lock") {
        await api.lifecycleLock(selectedUser, reason.trim());
      } else if (action === "unlock") {
        await api.lifecycleUnlock(selectedUser, reason.trim());
      } else {
        await api.lifecycleRecompute(selectedUser, reason.trim());
      }
      await Promise.all([load(), api.lifecycleTimeline(selectedUser).then(setTimeline)]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Жизненный цикл</h1>
        <PeriodPicker value={days} onChange={setDays} options={[7, 30, 90]} />
      </div>

      {error && <div className="page-error-inline">Ошибка: {error}</div>}

      {overview && (
        <div className="stats-grid stats-grid--compact">
          {STATES.map((s) => (
            <StatCard key={s} label={s} value={overview.states[s] ?? 0} />
          ))}
          <StatCard label="Заблокировано" value={overview.locked_users} />
          <StatCard label="Переходов" value={overview.transitions_total} />
        </div>
      )}

      <div className="split-grid split-grid--wide-left">
        <Card>
          <div className="lifecycle-controls">
            <input
              placeholder="Поиск пользователя..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lifecycle-search"
            />
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="lifecycle-select"
            >
              <option value="">Все статусы</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="card-scroll-x lifecycle-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Статус</th>
                  <th>Блок</th>
                  <th>Баланс</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {(users?.users ?? []).map((u) => (
                  <tr key={u.user_id} className="table-row-clickable" onClick={() => openUser(u.user_id)}>
                    <td>{u.username ? `@${u.username}` : u.user_id}</td>
                    <td>{u.lifecycle_state}</td>
                    <td>{u.lifecycle_locked ? "да" : "нет"}</td>
                    <td>{u.paid_credits}</td>
                    <td className="cell-sm-muted">{formatDateTimeShort(u.lifecycle_state_updated_at ?? u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack-gap">
          <Card>
            <div className="card-title card-title--mini-gap">ПЕРЕХОДЫ / ДЕНЬ</div>
            <LineChart data={chartData} series={[{ key: "transitions", color: CHART_COLORS.accent, label: "Переходы" }]} />
          </Card>

          <Card>
            {selectedUser ? (() => {
              const u = users?.users.find((x) => x.user_id === selectedUser);
              return (
                <div className="tl-user-header">
                  <div className="tl-user-name">
                    {u?.username ? `@${u.username}` : selectedUser}
                  </div>
                  <div className="tl-user-badges">
                    {u?.lifecycle_state && <span className="tl-badge tl-badge--state">{u.lifecycle_state}</span>}
                    {u?.lifecycle_locked && <span className="tl-badge tl-badge--locked">Заблокирован</span>}
                  </div>
                </div>
              );
            })() : (
              <div className="card-title card-title--tight">ТАЙМЛАЙН ПОЛЬЗОВАТЕЛЯ</div>
            )}

            {selectedUser && (
              <div className="tl-actions">
                <button className="tl-btn tl-btn--neutral" onClick={() => doAction("recompute")}>Пересчитать</button>
                <button className="tl-btn tl-btn--accent"  onClick={() => doAction("force")}>Сменить статус</button>
                <button className="tl-btn tl-btn--success" onClick={() => doAction("unlock")}>Разблокировать</button>
                <button className="tl-btn tl-btn--danger"  onClick={() => doAction("lock")}>Заблокировать</button>
              </div>
            )}

            <div className="tl-feed">
              {!selectedUser ? (
                <div className="tl-empty">Выберите пользователя из таблицы</div>
              ) : !timeline ? (
                <div className="tl-empty">Загрузка...</div>
              ) : timeline.transitions.length === 0 ? (
                <div className="tl-empty">Переходов пока нет</div>
              ) : (
                timeline.transitions.map((t) => (
                  <div key={t.transition_id} className="tl-event">
                    <div className="tl-dot" />
                    <div className="tl-content">
                      <div className="tl-states">
                        <span className="tl-state tl-state--from">{t.from_state ?? "—"}</span>
                        <span className="tl-arrow">→</span>
                        <span className="tl-state tl-state--to">{t.to_state}</span>
                        <span className="tl-source-chip">{t.source}</span>
                      </div>
                      {t.reason && <div className="tl-reason">{t.reason}</div>}
                      <div className="tl-time">{formatDateTimeShort(t.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
