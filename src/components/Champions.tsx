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
      .order('year', { ascending: false })
      .order('week', { ascending: false })
      .order('position', { ascending: false });

    if (data && data.length > 0) {
      // Group by week and year
      const grouped = data.reduce((acc, champion) => {
        const key = `${champion.year}-${champion.week}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(champion);
        return acc;
      }, {} as Record<string, ChampionWithTeam[]>);

      // Get the latest week
      const latestKey = Object.keys(grouped).sort().reverse()[0];
      const latestChampions = grouped[latestKey] || [];

      // Sort by position ascending (1, 2, 3) so display order is: Champion, 1st Runner Up, 2nd Runner Up
      latestChampions.sort((a: ChampionWithTeam, b: ChampionWithTeam) => a.position - b.position);

      setChampions(latestChampions);
    }
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

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
            Hall of <span className="text-blue-400 glow-text">Champions</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg">Celebrating our winners</p>
        </div>

        {champions.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No champions yet. Be the first!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {champions.map((champion, index) => (
              <div
                key={champion.id}
                className={`bg-gradient-to-br ${getPositionColor(champion.position)} border rounded-xl p-5 md:p-6 animate-slide-up glow-box-subtle hover:scale-105 transition-transform duration-300`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  {getPositionIcon(champion.position)}
                  <span className="text-blue-400 text-xs md:text-sm font-medium">
                    Week {champion.week} - {champion.year}
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  {champion.teams.team_name}
                </h3>

                <div className="mb-4">
                  {champion.position === 1 && (
                    <span className="text-yellow-400 font-bold text-lg md:text-xl glow-text">
                      {getPositionText(champion.position)}
                    </span>
                  )}
                  {champion.position === 2 && (
                    <span className="text-gray-300 font-bold text-lg md:text-xl">
                      {getPositionText(champion.position)}
                    </span>
                  )}
                  {champion.position === 3 && (
                    <span className="text-orange-400 font-bold text-lg md:text-xl">
                      {getPositionText(champion.position)}
                    </span>
                  )}
                </div>

                {champion.teams.team_photo && (
                  <img
                    src={champion.teams.team_photo}
                    alt={champion.teams.team_name}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                )}

                <div className="text-sm md:text-base text-gray-300">
                  <p className="mb-1">
                    <span className="text-blue-400 font-semibold">Captain:</span> {champion.teams.team_captain}
                  </p>
                  {champion.teams.team_members.length > 0 && (
                    <p>
                      <span className="text-blue-400 font-semibold">Members:</span> {champion.teams.team_members.join(', ')}
                    </p>
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
