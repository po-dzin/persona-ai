import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: Props) {
  return (
    <div className={["card", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

type StatTone = "default" | "success" | "danger" | "warning" | "muted";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: StatTone;
}

export function StatCard({ label, value, sub, tone = "default" }: StatCardProps) {
  return (
    <Card className="card--compact">
      <div className="stat-card-label">
        {label}
      </div>
      <div className={`stat-card-value stat-card-value--${tone}`}>
        {value}
      </div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </Card>
  );
}
