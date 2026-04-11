import { useEffect, useState } from "react";
import { api, type GenerationsData } from "../api";
import { StatCard, Card } from "../components/Card";
import { BarChart } from "../components/Chart";
import PeriodPicker from "../components/PeriodPicker";
import { formatDateTimeShort } from "../utils/format";

const STATUS_COLORS: Record<string, string> = {
  done: "var(--green)",
  failed: "var(--red)",
  processing: "var(--yellow)",
  draft: "var(--muted)",
  awaiting_credit_or_payment: "var(--accent)",
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
        <StatCard label="Успешно" value={done.toLocaleString()} color="var(--green)" />
        <StatCard label="Ошибки" value={failed.toLocaleString()} color={failed > 0 ? "var(--red)" : "var(--text)"} />
        <StatCard label="Доля ошибок" value={`${errRate}%`} color={Number(errRate) > 5 ? "var(--red)" : "var(--text)"} />
        {avg_gen_seconds != null && (
          <StatCard label="Среднее время" value={`${avg_gen_seconds}с`} />
        )}
      </div>

      {/* By status pills */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ПО СТАТУСУ</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(by_status).map(([status, cnt]) => (
            <div key={status} style={{
              background: "var(--surface2)", borderRadius: 8, padding: "8px 14px",
              borderLeft: `3px solid ${STATUS_COLORS[status] ?? "var(--border)"}`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{cnt}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{status}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="split-grid" style={{ marginBottom: 16 }}>
        {/* Top styles */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ТОП СТИЛЕЙ</div>
          <BarChart
            data={top_styles.map((s) => ({ label: s.style_code, value: s.done }))}
            color="var(--accent)"
            height={150}
          />
        </Card>

        {/* By model */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ПО МОДЕЛИ</div>
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
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{m.model_id}</td>
                    <td>{m.total}</td>
                    <td style={{ color: "var(--green)" }}>{m.done}</td>
                    <td style={{ color: Number(fp) > 5 ? "var(--red)" : "var(--muted)" }}>{fp}%</td>
                    <td style={{ color: "var(--muted)" }}>{m.avg_cost}</td>
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
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--red)" }}>ПОСЛЕДНИЕ ОШИБКИ</div>
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
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{f.order_id.slice(0, 8)}…</td>
                    <td style={{ fontSize: 12 }}>{f.user_id}</td>
                    <td style={{ fontSize: 12 }}>{f.model_id}</td>
                    <td style={{ fontSize: 12 }}>{f.style_code}</td>
                    <td style={{ color: "var(--red)", fontSize: 12 }}>{f.fail_reason_code ?? "—"}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{f.provider ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{f.attempts ?? 0}</td>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{formatDateTimeShort(f.created_at)}</td>
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

function Spin() { return <div style={{ color: "var(--muted)", padding: 40 }}>Загрузка...</div>; }
function Err({ msg }: { msg: string }) {
  return <div style={{ color: "var(--red)", padding: 20 }}>Ошибка: {msg}</div>;
}
