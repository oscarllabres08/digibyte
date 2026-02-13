import { useState } from 'react';
import { Shuffle, Save } from 'lucide-react';
import { supabase, Team } from '../lib/supabase';

interface BracketGeneratorProps {
  teams: Team[];
}

interface Match {
  team1: Team | null;
  team2: Team | null;
  round: number;
  matchNumber: number;
}

export default function BracketGenerator({ teams }: BracketGeneratorProps) {
  const [brackets, setBrackets] = useState<Match[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [saving, setSaving] = useState(false);

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
    }

    setSaving(false);
  };

  return (
    <div className="mb-8 bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box">
      <h3 className="text-2xl font-bold text-white mb-4">Tournament Brackets</h3>

      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={generateBrackets}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2"
        >
          <Shuffle className="w-5 h-5" />
          <span>Generate Random Brackets</span>
        </button>

        {brackets.length > 0 && (
          <>
            <input
              type="text"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              placeholder="Tournament ID"
              className="px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={saveBrackets}
              disabled={saving}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Brackets'}</span>
            </button>
          </>
        )}
      </div>

      {brackets.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-white">First Round Matches</h4>
          <div className="grid md:grid-cols-2 gap-4">
            {brackets.map((match) => (
              <div
                key={match.matchNumber}
                className="bg-black/30 border border-blue-500/20 rounded-lg p-4"
              >
                <div className="text-blue-400 text-sm mb-3">Match {match.matchNumber}</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                    <span className="text-white font-semibold">
                      {match.team1?.team_name || 'BYE'}
                    </span>
                  </div>
                  <div className="text-center text-gray-500 text-sm">VS</div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                    <span className="text-white font-semibold">
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
  );
}
