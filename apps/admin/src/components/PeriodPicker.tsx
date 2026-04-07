interface Props {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
}

export default function PeriodPicker({ value, onChange, options = [1, 7, 30] }: Props) {
  const labels: Record<number, string> = { 1: "24ч", 7: "7д", 14: "14д", 30: "30д", 90: "90д" };

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          style={{
            padding: "5px 12px", borderRadius: 6, border: "1px solid",
            borderColor: value === d ? "var(--accent)" : "var(--border)",
            background: value === d ? "var(--accent-dim)" : "transparent",
            color: value === d ? "var(--accent)" : "var(--muted)",
            fontWeight: value === d ? 600 : 400,
            transition: "all .15s",
          }}
        >
          {labels[d] ?? `${d}д`}
        </button>
      ))}
    </div>
  );
}
