import { useState, useEffect } from 'react';
import { Shuffle, Save } from 'lucide-react';
import { supabase, Team } from '../../lib/supabase';

interface Match {
  team1: Team | null;
  team2: Team | null;
  round: number;
  matchNumber: number;
}

export default function BracketGeneratorPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [brackets, setBrackets] = useState<Match[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTeams(data);
  };

  const generateBrackets = () => {
    const paidTeams = teams.filter((t) => t.paid);

    if (paidTeams.length < 2) {
      alert('Need at least 2 paid teams to generate brackets');
      return;
    }

    const shuffled = [...paidTeams].sort(() => Math.random() - 0.5);

    const matches: Match[] = [];
    let matchNumber = 1;

    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({
        team1: shuffled[i],
        team2: shuffled[i + 1] || null,
        round: 1,
        matchNumber: matchNumber++,
      });
    }

    setBrackets(matches);
  };

  const saveBrackets = async () => {
    if (!tournamentId) {
      alert('Please enter a tournament ID');
      return;
    }

    setSaving(true);

    const bracketData = brackets.map((match) => ({
      tournament_id: tournamentId,
      team1_id: match.team1?.id || null,
      team2_id: match.team2?.id || null,
      round: match.round,
      match_number: match.matchNumber,
    }));

    const { error } = await supabase.from('brackets').insert(bracketData);

    if (error) {
      alert('Error saving brackets: ' + error.message);
    } else {
      alert('Brackets saved successfully!');
      setBrackets([]);
      setTournamentId('');
    }

    setSaving(false);
  };

  const paidTeamsCount = teams.filter((t) => t.paid).length;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Tournament Brackets</h3>
        <p className="text-gray-400 text-sm md:text-base">
          Paid Teams: {paidTeamsCount} / {teams.length}
        </p>
      </div>

      <div className="mb-8 bg-gray-900/50 border border-blue-500/20 rounded-xl p-4 md:p-6 glow-box">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <button
            onClick={generateBrackets}
            disabled={paidTeamsCount < 2}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base w-full sm:w-auto"
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-center">Generate Random Brackets (1st Elimination)</span>
          </button>

          {brackets.length > 0 && (
            <>
              <input
                type="text"
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
                placeholder="Tournament ID"
                className="px-4 py-2 sm:py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm md:text-base w-full sm:w-auto"
              />
              <button
                onClick={saveBrackets}
                disabled={saving || !tournamentId}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm md:text-base w-full sm:w-auto"
              >
                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{saving ? 'Saving...' : 'Save Brackets'}</span>
              </button>
            </>
          )}
        </div>

        {paidTeamsCount < 2 && (
          <div className="p-4 bg-yellow-600/20 border border-yellow-500/50 rounded-lg text-yellow-400">
            You need at least 2 paid teams to generate brackets. Currently have {paidTeamsCount} paid team(s).
          </div>
        )}

        {brackets.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xl font-semibold text-white">First Round Matches</h4>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {brackets.map((match) => (
                <div
                  key={match.matchNumber}
                  className="bg-black/30 border border-blue-500/20 rounded-lg p-3 md:p-4"
                >
                  <div className="text-blue-400 text-xs md:text-sm mb-2 md:mb-3">Match {match.matchNumber}</div>
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="flex items-center justify-between p-2 md:p-3 bg-gray-800/50 rounded">
                      <span className="text-white font-semibold text-sm md:text-base truncate">
                        {match.team1?.team_name || 'BYE'}
                      </span>
                    </div>
                    <div className="text-center text-gray-500 text-xs md:text-sm">VS</div>
                    <div className="flex items-center justify-between p-2 md:p-3 bg-gray-800/50 rounded">
                      <span className="text-white font-semibold text-sm md:text-base truncate">
                        {match.team2?.team_name || 'BYE'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
