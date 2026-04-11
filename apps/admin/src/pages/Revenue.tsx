import { useEffect, useState } from "react";
import { api, type RevenueData } from "../api";
import { StatCard, Card } from "../components/Card";
import { BarChart } from "../components/Chart";
import PeriodPicker from "../components/PeriodPicker";
import { formatDateTimeShort } from "../utils/format";

const PACKAGE_LABELS: Record<string, string> = {
  STARTER_STARS: "Starter 150",
  BASIC_STARS: "Basic 365",
  POPULAR_STARS: "Popular 875",
  PRO_STARS: "Pro 2300",
  ULTRA_STARS: "Ultra 6000",
};

export default function Revenue() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.revenue(days)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (error) return <Err msg={error} />;
  if (loading || !data) return <Spin />;

  const { totals, by_package, recent } = data;
  const usd = (stars: number) => `$${(stars * 0.0151).toFixed(2)}`;

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Выручка</h1>
        <PeriodPicker value={days} onChange={setDays} options={[7, 30, 90]} />
      </div>

      {/* Totals */}
      <div className="stats-grid">
        <StatCard label="Stars за период" value={`⭐ ${totals.stars.toLocaleString()}`} sub={`≈ ${usd(totals.stars)}`} color="var(--yellow)" />
        <StatCard label="Платежей" value={totals.payments} />
        <StatCard label="Уникальных плательщиков" value={totals.paying_users} />
        <StatCard label="ARPPU" value={`⭐ ${totals.arppu_stars}`} sub={`≈ ${usd(totals.arppu_stars)}`} />
        <StatCard label="Рефанды" value={totals.refunded} color={totals.refunded > 0 ? "var(--red)" : "var(--text)"} />
      </div>

      {/* By package bar chart */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--muted)" }}>ПРОДАЖИ ПО ПАКЕТАМ (STARS)</div>
        <BarChart
          data={by_package.map((p) => ({
            label: PACKAGE_LABELS[p.package_code] ?? p.package_code,
            value: p.total_stars,
          }))}
          color="var(--yellow)"
        />

        {/* Table */}
        <div className="card-scroll-x" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Пакет</th>
                <th>Продано</th>
                <th>Stars</th>
                <th>≈ USD</th>
                <th>Покупателей</th>
              </tr>
            </thead>
            <tbody>
              {by_package.map((p) => (
                <tr key={p.package_code}>
                  <td>{PACKAGE_LABELS[p.package_code] ?? p.package_code}</td>
                  <td>{p.payments_count}</td>
                  <td style={{ color: "var(--yellow)", fontWeight: 600 }}>⭐ {p.total_stars.toLocaleString()}</td>
                  <td style={{ color: "var(--muted)" }}>{usd(p.total_stars)}</td>
                  <td>{p.unique_buyers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent payments */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--muted)" }}>ПОСЛЕДНИЕ ПЛАТЕЖИ</div>
        <div className="card-scroll-x">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Пакет</th>
                <th>Stars</th>
                <th>Провайдер</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.payment_id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.first_name ?? p.user_id}</div>
                    {p.username && <div style={{ fontSize: 11, color: "var(--muted)" }}>@{p.username}</div>}
                  </td>
                  <td>{PACKAGE_LABELS[p.package_code] ?? p.package_code}</td>
                  <td style={{ color: "var(--yellow)", fontWeight: 600 }}>⭐ {p.amount}</td>
                  <td style={{ color: "var(--muted)" }}>{p.provider}</td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{formatDateTimeShort(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Spin() { return <div style={{ color: "var(--muted)", padding: 40 }}>Загрузка...</div>; }
function Err({ msg }: { msg: string }) {
  return <div style={{ color: "var(--red)", padding: 20 }}>Ошибка: {msg}</div>;
}
