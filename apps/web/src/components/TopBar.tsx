import type { ReactNode } from "react";

interface TopBarProps {
  title: string;
  rightSlot?: ReactNode;
}

export function TopBar({ title, rightSlot }: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar-title">{title}</div>
      {rightSlot ? <div className="top-bar-right">{rightSlot}</div> : null}
    </div>
  );
}
