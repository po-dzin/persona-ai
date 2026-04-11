interface Props {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
}

export default function PeriodPicker({ value, onChange, options = [1, 7, 30] }: Props) {
  const labels: Record<number, string> = { 1: "24ч", 7: "7д", 14: "14д", 30: "30д", 90: "90д" };

  return (
    <div className="period-picker">
      {options.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`period-picker-btn${value === d ? " period-picker-btn--active" : ""}`}
        >
          {labels[d] ?? `${d}д`}
        </button>
      ))}
    </div>
  );
}
