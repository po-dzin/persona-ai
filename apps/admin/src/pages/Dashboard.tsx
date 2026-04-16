import { useEffect, useState } from "react";
import { api, type OverviewData, type TimeseriesData } from "../api";
import { StatCard, Card } from "../components/Card";
import { LineChart } from "../components/Chart";
import PeriodPicker from "../components/PeriodPicker";
import { CHART_COLORS } from "../utils/chartTokens";

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
        <StatCard label="Платящих" value={users.paying.toLocaleString()} sub={`Конверсия ${users.conversion_pct}%`} tone="success" />
        <StatCard label="Stars за период" value={`⭐ ${revenue.period_stars.toLocaleString()}`} sub={`Сегодня: ⭐ ${revenue.today_stars}`} tone="warning" />
        <StatCard label="ARPPU (всего)" value={`⭐ ${revenue.arppu_stars}`} />
        <StatCard label="Генераций за период" value={generations.period.done.toLocaleString()} sub={`Ошибок: ${generations.error_rate_pct}%`} />
        <StatCard label="В очереди" value={queueTotal} tone={queueTotal > 10 ? "danger" : "default"} />
      </div>

      {/* Charts */}
      {ts && (
        <div className="stats-grid stats-grid--charts">
          <Card>
            <div className="card-title">НОВЫЕ ПОЛЬЗОВАТЕЛИ</div>
            <LineChart
              data={ts.users}
              series={[{ key: "new_users", color: CHART_COLORS.accent, label: "Новые" }]}
            />
          </Card>
          <Card>
            <div className="card-title">ВЫРУЧКА (STARS)</div>
            <LineChart
              data={ts.revenue}
              series={[{ key: "stars", color: CHART_COLORS.warning, label: "Stars" }]}
            />
          </Card>
        </div>
      )}

      {ts && (
        <Card>
          <div className="card-title">ГЕНЕРАЦИИ</div>
          <LineChart
            data={ts.orders}
            series={[
              { key: "done",   color: CHART_COLORS.success, label: "Готово" },
              { key: "failed", color: CHART_COLORS.danger,  label: "Ошибка" },
              { key: "total",  color: CHART_COLORS.muted,   label: "Всего" },
            ]}
            height={180}
          />
          <div className="legend-row">
            {[{ tone: "success", label: "Готово" }, { tone: "danger", label: "Ошибка" }, { tone: "muted", label: "Всего" }].map((s) => (
              <div key={s.label} className="legend-item">
                <div className={`legend-dot legend-dot--${s.tone}`} />
                {s.label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Queue detail */}
      {queueTotal > 0 && (
        <Card>
          <div className="card-title card-title--tight">ОЧЕРЕДЬ JOBS</div>
          <div className="queue-grid">
            {Object.entries(queue.jobs).map(([status, cnt]) => (
              <div key={status} className="queue-item">
                <div className="queue-item-value">{cnt}</div>
                <div className="queue-item-label">{status}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="loading-box">Загрузка...</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  const text =
    msg === "unauthorized" ? "Неверный токен — обновите страницу." :
    msg === "not_admin"    ? "Нет прав администратора." :
    msg;
  return (
    <div className="error-box error-box--soft">
      {text}
    </div>
  );
}
