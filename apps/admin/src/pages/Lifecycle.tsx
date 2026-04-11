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

      {error && <div style={{ color: "var(--red)", marginBottom: 12 }}>Ошибка: {error}</div>}

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
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              placeholder="Поиск пользователя..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 220, flex: 1 }}
            />
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 10, padding: "8px 10px" }}
            >
              <option value="">Все статусы</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="card-scroll-x" style={{ maxHeight: 500 }}>
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
                  <tr key={u.user_id} style={{ cursor: "pointer" }} onClick={() => openUser(u.user_id)}>
                    <td>{u.username ? `@${u.username}` : u.user_id}</td>
                    <td>{u.lifecycle_state}</td>
                    <td>{u.lifecycle_locked ? "да" : "нет"}</td>
                    <td>{u.paid_credits}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{formatDateTimeShort(u.lifecycle_state_updated_at ?? u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>ПЕРЕХОДЫ / ДЕНЬ</div>
            <LineChart data={chartData} series={[{ key: "transitions", color: "#7c6af7", label: "Переходы" }]} />
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>ТАЙМЛАЙН ПОЛЬЗОВАТЕЛЯ</div>
              {selectedUser && <div style={{ fontSize: 12, color: "var(--text)" }}>{selectedUser}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => doAction("force")}>Сменить статус</button>
              <button onClick={() => doAction("lock")}>Заблокировать</button>
              <button onClick={() => doAction("unlock")}>Разблокировать</button>
              <button onClick={() => doAction("recompute")}>Пересчитать</button>
            </div>
            <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
              {!timeline
                ? <div style={{ color: "var(--muted)" }}>Выберите пользователя</div>
                : timeline.transitions.length === 0
                  ? <div style={{ color: "var(--muted)" }}>Переходов пока нет</div>
                  : timeline.transitions.map((t) => (
                    <div key={t.transition_id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 12, color: "var(--text)" }}>
                        {t.from_state ?? "—"} → {t.to_state} <span style={{ color: "var(--muted)" }}>({t.source})</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.reason} · {formatDateTimeShort(t.created_at)}</div>
                    </div>
                  ))
              }
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
