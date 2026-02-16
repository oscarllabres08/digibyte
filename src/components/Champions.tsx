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

  // Derive champion and runners-up for clearer highlighting
  const champion = champions.find((c) => c.position === 1) || null;
  const firstRunnerUp = champions.find((c) => c.position === 2) || null;
  const secondRunnerUp = champions.find((c) => c.position === 3) || null;

  return (
    <section id="champions" className="min-h-screen py-20 relative overflow-hidden">
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
          <div className="space-y-8">
            {/* Champion - full width, very highlighted */}
            {champion && (
              <div
                className={`max-w-3xl mx-auto bg-gradient-to-br ${getPositionColor(1)} border-2 border-yellow-400 rounded-2xl p-6 md:p-8 animate-slide-up glow-box-subtle shadow-2xl`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getPositionIcon(1)}
                    <span className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400 text-yellow-300 text-xs md:text-sm font-semibold uppercase tracking-wide">
                      {getPositionText(1)}
                    </span>
                  </div>
                  <span className="text-yellow-300 text-xs md:text-sm font-medium">
                    Week {champion.week} - {champion.year}
                  </span>
                </div>

                <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-wide">
                  {champion.teams.team_name}
                </h3>

                {champion.teams.team_photo && (
                  <img
                    src={champion.teams.team_photo}
                    alt={champion.teams.team_name}
                    className="w-full h-48 md:h-56 object-cover rounded-xl mb-5 border border-yellow-500/40"
                  />
                )}

                <div className="text-sm md:text-base text-gray-100">
                  <p className="mb-1">
                    <span className="text-yellow-300 font-semibold">Captain:</span> {champion.teams.team_captain}
                  </p>
                  {champion.teams.team_members.length > 0 && (
                    <p>
                      <span className="text-yellow-300 font-semibold">Members:</span> {champion.teams.team_members.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Runners-up row */}
            {(firstRunnerUp || secondRunnerUp) && (
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                {firstRunnerUp && (
                  <div
                    key={firstRunnerUp.id}
                    className={`bg-gradient-to-br ${getPositionColor(2)} border rounded-xl p-5 md:p-6 animate-slide-up glow-box-subtle`}
                    style={{ animationDelay: `100ms` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getPositionIcon(2)}
                        <span className="px-2 py-0.5 rounded-full bg-gray-500/20 border border-gray-400 text-gray-100 text-xs font-semibold uppercase tracking-wide">
                          {getPositionText(2)}
                        </span>
                      </div>
                      <span className="text-gray-200 text-xs font-medium">
                        Week {firstRunnerUp.week} - {firstRunnerUp.year}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                      {firstRunnerUp.teams.team_name}
                    </h3>

                    <div className="text-sm md:text-base text-gray-200">
                      <p className="mb-1">
                        <span className="text-gray-100 font-semibold">Captain:</span> {firstRunnerUp.teams.team_captain}
                      </p>
                      {firstRunnerUp.teams.team_members.length > 0 && (
                        <p>
                          <span className="text-gray-100 font-semibold">Members:</span> {firstRunnerUp.teams.team_members.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {secondRunnerUp && (
                  <div
                    key={secondRunnerUp.id}
                    className={`bg-gradient-to-br ${getPositionColor(3)} border rounded-xl p-5 md:p-6 animate-slide-up glow-box-subtle`}
                    style={{ animationDelay: `200ms` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getPositionIcon(3)}
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400 text-orange-200 text-xs font-semibold uppercase tracking-wide">
                          {getPositionText(3)}
                        </span>
                      </div>
                      <span className="text-orange-200 text-xs font-medium">
                        Week {secondRunnerUp.week} - {secondRunnerUp.year}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                      {secondRunnerUp.teams.team_name}
                    </h3>

                    <div className="text-sm md:text-base text-orange-100">
                      <p className="mb-1">
                        <span className="font-semibold">Captain:</span> {secondRunnerUp.teams.team_captain}
                      </p>
                      {secondRunnerUp.teams.team_members.length > 0 && (
                        <p>
                          <span className="font-semibold">Members:</span> {secondRunnerUp.teams.team_members.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
