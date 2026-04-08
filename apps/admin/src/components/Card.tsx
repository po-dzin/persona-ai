import type { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  style?: CSSProperties;
}

export function Card({ children, style }: Props) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6, lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? "var(--text)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 5 }}>{sub}</div>}
    </Card>
  );
}
