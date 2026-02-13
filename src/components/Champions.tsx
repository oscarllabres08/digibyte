import { useState, useEffect } from 'react';
import { Trophy, Award, Medal } from 'lucide-react';
import { supabase, Champion, Team } from '../lib/supabase';

type ChampionWithTeam = Champion & { teams: Team };

export default function Champions() {
  const [champions, setChampions] = useState<ChampionWithTeam[]>([]);

  useEffect(() => {
    loadChampions();
  }, []);

  const loadChampions = async () => {
    const { data } = await supabase
      .from('champions')
      .select('*, teams(*)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) setChampions(data as ChampionWithTeam[]);
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />;
      case 2:
        return <Award className="w-8 h-8 text-gray-400" />;
      case 3:
        return <Medal className="w-8 h-8 text-orange-400" />;
      default:
        return null;
    }
  };

  const getPositionText = (position: number) => {
    switch (position) {
      case 1:
        return 'Champion';
      case 2:
        return '1st Runner Up';
      case 3:
        return '2nd Runner Up';
      default:
        return '';
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1:
        return 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30';
      case 2:
        return 'from-gray-400/20 to-gray-400/5 border-gray-500/30';
      case 3:
        return 'from-orange-600/20 to-orange-600/5 border-orange-500/30';
      default:
        return 'from-blue-600/20 to-blue-600/5 border-blue-500/30';
    }
  };

  return (
    <section id="champions" className="min-h-screen py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-5xl font-bold text-white mb-4">
            Hall of <span className="text-blue-400 glow-text">Champions</span>
          </h2>
          <p className="text-gray-400 text-lg">Celebrating our winners</p>
        </div>

        {champions.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No champions yet. Be the first!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {champions.map((champion, index) => (
              <div
                key={champion.id}
                className={`bg-gradient-to-br ${getPositionColor(champion.position)} border rounded-xl p-6 animate-slide-up glow-box-subtle hover:scale-105 transition-transform duration-300`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  {getPositionIcon(champion.position)}
                  <span className="text-blue-400 text-sm">
                    Week {champion.week} - {champion.year}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">
                  {champion.teams.team_name}
                </h3>

                <div className="text-gray-400 mb-4">{getPositionText(champion.position)}</div>

                {champion.teams.team_photo && (
                  <img
                    src={champion.teams.team_photo}
                    alt={champion.teams.team_name}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                )}

                <div className="text-sm text-gray-400">
                  <p>Captain: {champion.teams.team_captain}</p>
                  {champion.teams.team_members.length > 0 && (
                    <p>Members: {champion.teams.team_members.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
