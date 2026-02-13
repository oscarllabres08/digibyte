import Header from './components/Header';
import Hero from './components/Hero';
import TournamentInfo from './components/TournamentInfo';
import TeamRegistration from './components/TeamRegistration';
import Champions from './components/Champions';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <Hero />
      <TournamentInfo />
      <TeamRegistration />
      <Champions />
      <AdminDashboard />
    </div>
  );
}

export default App;
