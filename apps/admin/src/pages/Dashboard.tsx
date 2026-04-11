import { useEffect, useState } from "react";
import { api, type OverviewData, type TimeseriesData } from "../api";
import { StatCard, Card } from "../components/Card";
import { LineChart } from "../components/Chart";
import PeriodPicker from "../components/PeriodPicker";

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ts, setTs] = useState<TimeseriesData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([api.overview(days), api.timeseries(Math.max(days, 14))])
      .then(([ov, t]) => { setOverview(ov); setTs(t); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (error) return <ErrorBox msg={error} />;
  if (loading || !overview) return <Spinner />;

  const { users, generations, revenue, queue } = overview;
  const queueTotal = Object.values(queue.jobs).reduce((a, b) => a + b, 0);

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Дашборд</h1>
        <PeriodPicker value={days} onChange={setDays} />
      </div>

      {/* Top stat cards */}
      <div className="stats-grid stats-grid--compact">
        <StatCard label="Всего пользователей" value={users.total.toLocaleString()} sub={`+${users.new_period} за период`} />
        <StatCard label="Новые сегодня" value={users.new_today} sub={`DAU: ${users.dau}`} />
        <StatCard label="Платящих" value={users.paying.toLocaleString()} sub={`Конверсия ${users.conversion_pct}%`} color="var(--green)" />
        <StatCard label="Stars за период" value={`⭐ ${revenue.period_stars.toLocaleString()}`} sub={`Сегодня: ⭐ ${revenue.today_stars}`} color="var(--yellow)" />
        <StatCard label="ARPPU (всего)" value={`⭐ ${revenue.arppu_stars}`} />
        <StatCard label="Генераций за период" value={generations.period.done.toLocaleString()} sub={`Ошибок: ${generations.error_rate_pct}%`} />
        <StatCard label="В очереди" value={queueTotal} color={queueTotal > 10 ? "var(--red)" : "var(--text)"} />
      </div>

      {/* Charts */}
      {ts && (
        <div className="stats-grid stats-grid--charts">
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>НОВЫЕ ПОЛЬЗОВАТЕЛИ</div>
            <LineChart
              data={ts.users}
              series={[{ key: "new_users", color: "#7c6af7", label: "Новые" }]}
            />
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ВЫРУЧКА (STARS)</div>
            <LineChart
              data={ts.revenue}
              series={[{ key: "stars", color: "#fbbf24", label: "Stars" }]}
            />
          </Card>
        </div>
      )}

      {ts && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ГЕНЕРАЦИИ</div>
          <LineChart
            data={ts.orders}
            series={[
              { key: "done", color: "#34d399", label: "Готово" },
              { key: "failed", color: "#f87171", label: "Ошибка" },
              { key: "total", color: "#8b8fa8", label: "Всего" },
            ]}
            height={180}
          />
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            {[{ color: "#34d399", label: "Готово" }, { color: "#f87171", label: "Ошибка" }, { color: "#8b8fa8", label: "Всего" }].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                {s.label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Queue detail */}
      {queueTotal > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--muted)" }}>ОЧЕРЕДЬ JOBS</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(queue.jobs).map(([status, cnt]) => (
              <div key={status} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{cnt}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{status}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Spinner() {
  return <div style={{ color: "var(--muted)", padding: 40 }}>Загрузка...</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  const text =
    msg === "unauthorized" ? "Неверный токен — обновите страницу." :
    msg === "not_admin"    ? "Нет прав администратора." :
    msg;
  return (
    <div style={{ background: "rgba(248,113,113,.1)", border: "1px solid var(--red)", borderRadius: "var(--radius)", padding: 20, color: "var(--red)" }}>
      {text}
    </div>
  );
}
