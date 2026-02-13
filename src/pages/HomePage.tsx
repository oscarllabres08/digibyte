import Header from '../components/Header';
import Hero from '../components/Hero';
import TournamentInfo from '../components/TournamentInfo';
import TeamRegistration from '../components/TeamRegistration';
import Champions from '../components/Champions';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <Hero />
      <TournamentInfo />
      <TeamRegistration />
      <Champions />
    </div>
  );
}
