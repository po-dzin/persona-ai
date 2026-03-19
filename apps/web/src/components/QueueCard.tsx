interface QueueCardProps {
  title: string;
  count: number;
}

export function QueueCard({ title, count }: QueueCardProps) {
  return (
    <div className="queue-card">
      <div className="queue-title">{title}</div>
      <div className="queue-detail">Генерация</div>
      {count > 1 ? <div className="queue-count">{count}</div> : null}
    </div>
  );
}
