import { TopBar } from "../components/TopBar";

interface ProfileScreenProps {
  credits: number;
  generations: number;
}

export function ProfileScreen({ credits, generations }: ProfileScreenProps) {
  return (
    <section className="screen active">
      <TopBar title="Профиль" />
      <div className="profile-block">
        <div className="profile-avatar">AV</div>
        <div className="profile-name">Anna Volkova</div>
        <div className="profile-metrics">Генераций: {generations}</div>
        <div className="profile-metrics">Баланс: {credits} 🪙</div>
      </div>
    </section>
  );
}
