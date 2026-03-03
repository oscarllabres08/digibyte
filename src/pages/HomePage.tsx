import Header from '../components/Header';
import Hero from '../components/Hero';
import TournamentInfo from '../components/TournamentInfo';
import PublicBracketVisualization from '../components/PublicBracketVisualization';
import TeamRegistration from '../components/TeamRegistration';
import Champions from '../components/Champions';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <TournamentInfo />
      <PublicBracketVisualization />
      <TeamRegistration />
      <Champions />
    </div>
  );
}
