import { useEffect, useState } from "react";
import { api, type GenerationsData } from "../api";
import { StatCard, Card } from "../components/Card";
import { BarChart } from "../components/Chart";
import PeriodPicker from "../components/PeriodPicker";
import { formatDateTimeShort } from "../utils/format";

const STATUS_TONE: Record<string, string> = {
  done: "success",
  failed: "danger",
  processing: "warning",
  draft: "muted",
  awaiting_credit_or_payment: "accent",
};

export default function Generations() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<GenerationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.generations(days)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (error) return <Err msg={error} />;
  if (loading || !data) return <Spin />;

  const { by_status, top_styles, by_model, recent_failed, avg_gen_seconds } = data;
  const total = Object.values(by_status).reduce((a, b) => a + b, 0);
  const done = by_status["done"] ?? 0;
  const failed = by_status["failed"] ?? 0;
  const errRate = total ? ((failed / total) * 100).toFixed(1) : "0";

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Генерации</h1>
        <PeriodPicker value={days} onChange={setDays} />
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Всего" value={total.toLocaleString()} />
        <StatCard label="Успешно" value={done.toLocaleString()} tone="success" />
        <StatCard label="Ошибки" value={failed.toLocaleString()} tone={failed > 0 ? "danger" : "default"} />
        <StatCard label="Доля ошибок" value={`${errRate}%`} tone={Number(errRate) > 5 ? "danger" : "default"} />
        {avg_gen_seconds != null && (
          <StatCard label="Среднее время" value={`${avg_gen_seconds}с`} />
        )}
      </div>

      {/* By status pills */}
      <Card>
        <div className="card-title">ПО СТАТУСУ</div>
        <div className="chips-grid">
          {Object.entries(by_status).map(([status, cnt]) => (
            <div
              key={status}
              className={`status-chip status-chip--${STATUS_TONE[status] ?? "default"}`}
            >
              <div className="status-chip-value">{cnt}</div>
              <div className="status-chip-label">{status}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="split-grid split-grid--mb">
        {/* Top styles */}
        <Card>
          <div className="card-title">ТОП СТИЛЕЙ</div>
          <BarChart
            data={top_styles.map((s) => ({ label: s.style_code, value: s.done }))}
            color="var(--accent)"
            height={150}
          />
        </Card>

        {/* By model */}
        <Card>
          <div className="card-title">ПО МОДЕЛИ</div>
          <table>
            <thead>
              <tr>
                <th>Модель</th>
                <th>Всего</th>
                <th>Успешно</th>
                <th>Ошибки %</th>
                <th>Ср. стоимость</th>
              </tr>
            </thead>
            <tbody>
              {by_model.map((m) => {
                const fp = m.total ? ((m.failed / m.total) * 100).toFixed(0) : "0";
                return (
                  <tr key={m.model_id}>
                    <td className="cell-strong-sm">{m.model_id}</td>
                    <td>{m.total}</td>
                    <td className="cell-green">{m.done}</td>
                    <td className={Number(fp) > 5 ? "cell-red" : "cell-muted"}>{fp}%</td>
                    <td className="cell-muted">{m.avg_cost}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Recent failures */}
      {recent_failed.length > 0 && (
        <Card>
          <div className="card-title card-title--error">ПОСЛЕДНИЕ ОШИБКИ</div>
          <div className="card-scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Заказ</th>
                  <th>Пользователь</th>
                  <th>Модель</th>
                  <th>Стиль</th>
                  <th>Причина</th>
                  <th>Провайдер</th>
                  <th>Попыток</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                {recent_failed.map((f) => (
                  <tr key={f.order_id}>
                    <td className="cell-mono-xs">{f.order_id.slice(0, 8)}…</td>
                    <td className="cell-sm">{f.user_id}</td>
                    <td className="cell-sm">{f.model_id}</td>
                    <td className="cell-sm">{f.style_code}</td>
                    <td className="cell-red-sm">{f.fail_reason_code ?? "—"}</td>
                    <td className="cell-sm-muted">{f.provider ?? "—"}</td>
                    <td className="cell-muted">{f.attempts ?? 0}</td>
                    <td className="cell-xs-muted">{formatDateTimeShort(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Spin() { return <div className="loading-box">Загрузка...</div>; }
function Err({ msg }: { msg: string }) {
  return <div className="error-box">Ошибка: {msg}</div>;
}
