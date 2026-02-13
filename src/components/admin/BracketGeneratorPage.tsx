import { useState, useEffect } from 'react';
import { Shuffle, Save } from 'lucide-react';
import { supabase, Team } from '../../lib/supabase';
import ConfirmModal from '../ConfirmModal';

type BracketNumber = 1 | 2;
type WinnerSide = 'team1' | 'team2' | null;

interface Match {
  team1: Team | null;
  team2: Team | null;
  round: number;
  matchNumber: number;
  bracket: BracketNumber;
  winner: WinnerSide;
}

export default function BracketGeneratorPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [brackets, setBrackets] = useState<Match[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTeams(data);
  };

  const loadBrackets = async (id: string, teamsSource: Team[]) => {
    if (!id) return;

    const { data, error } = await supabase
      .from('brackets')
      .select('*')
      .eq('tournament_id', id)
      .order('match_number', { ascending: true });

    if (error) {
      // If there are simply no brackets yet, don't spam errors
      console.error('Error loading brackets:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      setBrackets([]);
      return;
    }

    const findTeam = (teamId: string | null) =>
      teamsSource.find((t) => t.id === teamId) || null;

    const loaded: Match[] = data.map((row: any) => ({
      team1: findTeam(row.team1_id),
      team2: findTeam(row.team2_id),
      round: row.round,
      matchNumber: row.match_number,
      bracket: row.match_number <= 4 ? 1 : 2,
      winner: row.winner_id
        ? row.winner_id === row.team1_id
          ? 'team1'
          : row.winner_id === row.team2_id
            ? 'team2'
            : null
        : null,
    }));

    setBrackets(loaded);
  };

  // Load teams on initial mount
  useEffect(() => {
    loadTeams();
  }, []);

  // Once teams are loaded, restore last saved brackets for the current tournament (if any)
  useEffect(() => {
    if (teams.length === 0) return;
    if (typeof window === 'undefined') return;

    const storedId = window.localStorage.getItem('digibyte_current_tournament_id');
    if (storedId) {
      setTournamentId(storedId);
      // Use the freshly loaded teams so IDs resolve correctly
      void loadBrackets(storedId, teams);
    }
  }, [teams]);

  const generateBracketsInternal = () => {
    const paidTeams = teams.filter((t) => t.paid);

    // For this tournament, we expect exactly 16 paid teams (8 per bracket)
    if (paidTeams.length !== 16) {
      alert(`This tournament format requires exactly 16 paid teams.\nCurrently you have ${paidTeams.length} paid team(s).`);
      return;
    }

    const shuffled = [...paidTeams].sort(() => Math.random() - 0.5);

    const bracket1Teams = shuffled.slice(0, 8);
    const bracket2Teams = shuffled.slice(8, 16);

    const matches: Match[] = [];
    let matchNumber = 1;

    const buildMatchesForBracket = (bracketTeams: Team[], bracketNumber: BracketNumber) => {
      for (let i = 0; i < bracketTeams.length; i += 2) {
        matches.push({
          team1: bracketTeams[i],
          team2: bracketTeams[i + 1] || null,
          round: 1,
          matchNumber: matchNumber++,
          bracket: bracketNumber,
          winner: null,
        });
      }
    };

    buildMatchesForBracket(bracket1Teams, 1);
    buildMatchesForBracket(bracket2Teams, 2);

    setBrackets(matches);
  };

  const generateBrackets = () => {
    // If there are existing results (any winner selected), open confirmation modal
    const hasExistingResults = brackets.some((match) => match.winner !== null);
    if (hasExistingResults) {
      setConfirmGenerateOpen(true);
      return;
    }

    generateBracketsInternal();
  };

  const setWinner = (matchNumber: number, bracket: BracketNumber, side: WinnerSide) => {
    setBrackets((prev) =>
      prev.map((match) => {
        if (match.matchNumber !== matchNumber || match.bracket !== bracket) return match;

        // If clicking the same winner again, clear selection; otherwise set new winner
        const newWinner: WinnerSide = match.winner === side ? null : side;
        return { ...match, winner: newWinner };
      }),
    );
  };

  const saveBrackets = async () => {
    setSaving(true);

    let targetTournamentId = tournamentId;

    // If there's no tournament yet, auto-create one
    if (!targetTournamentId) {
      const { data, error: createError } = await supabase
        .from('tournaments')
        .insert({
          title: `Tournament ${new Date().toLocaleString()}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError || !data?.id) {
        alert('Error creating tournament record for brackets.');
        setSaving(false);
        return;
      }

      targetTournamentId = data.id as string;
      setTournamentId(targetTournamentId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
      }
    }

    const bracketData = brackets.map((match) => ({
      tournament_id: targetTournamentId,
      team1_id: match.team1?.id || null,
      team2_id: match.team2?.id || null,
      round: match.round,
      match_number: match.matchNumber,
      winner_id:
        match.winner === 'team1'
          ? match.team1?.id || null
          : match.winner === 'team2'
            ? match.team2?.id || null
            : null,
    }));

    // Remove existing brackets for this tournament so we can overwrite cleanly
    await supabase.from('brackets').delete().eq('tournament_id', targetTournamentId);

    const { error } = await supabase.from('brackets').insert(bracketData);

    if (error) {
      alert('Error saving brackets: ' + error.message);
    } else {
      alert('Brackets saved successfully!');

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
      }
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
            <span className="text-center">Generate Bracket 1 &amp; 2 (16 Teams)</span>
          </button>

          {brackets.length > 0 && (
            <>
              <button
                onClick={saveBrackets}
                disabled={saving}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm md:text-base w-full sm:w-auto"
              >
                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{saving ? 'Saving...' : 'Save Brackets'}</span>
              </button>
              {tournamentId && (
                <button
                  type="button"
                  onClick={() => loadBrackets(tournamentId, teams)}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all text-sm md:text-base w-full sm:w-auto"
                >
                  Load Brackets
                </button>
              )}
            </>
          )}
        </div>

        {paidTeamsCount < 2 && (
          <div className="p-4 bg-yellow-600/20 border border-yellow-500/50 rounded-lg text-yellow-400">
            You need at least 2 paid teams to generate brackets. Currently have {paidTeamsCount} paid team(s).
          </div>
        )}

        {brackets.length > 0 && (
          <div className="space-y-6">
            <div>
              <h4 className="text-xl font-semibold text-white mb-3">Bracket 1 (8 Teams)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {brackets
                  .filter((match) => match.bracket === 1)
                  .map((match) => (
                    <div
                      key={`b1-${match.matchNumber}`}
                      className="bg-black/30 border border-blue-500/20 rounded-lg p-3 md:p-4"
                    >
                      <div className="text-blue-400 text-xs md:text-sm mb-2 md:mb-3">
                        Bracket 1 - Match {match.matchNumber}
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                        {/* Team 1 row */}
                        <div
                          className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                            match.winner === 'team1'
                              ? 'glow-green-border bg-green-900/10'
                              : match.winner === 'team2'
                                ? 'glow-red-border bg-red-900/10'
                                : 'bg-gray-800/50 border-gray-700'
                          }`}
                        >
                          <span className="text-white font-semibold text-sm md:text-base truncate mr-2">
                            {match.team1?.team_name || 'BYE'}
                          </span>
                          {match.team1 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 1, 'team1')}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors ${
                                match.winner === 'team1'
                                  ? 'bg-green-600 text-white border-green-400'
                                  : match.winner === 'team2'
                                    ? 'bg-red-900/40 text-red-400 border-red-500'
                                    : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                              }`}
                            >
                              {match.winner === 'team1' ? 'W' : match.winner === 'team2' ? 'L' : 'W'}
                            </button>
                          )}
                        </div>

                        <div className="text-center text-gray-500 text-xs md:text-sm">VS</div>

                        {/* Team 2 row */}
                        <div
                          className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                            match.winner === 'team2'
                              ? 'glow-green-border bg-green-900/10'
                              : match.winner === 'team1'
                                ? 'glow-red-border bg-red-900/10'
                                : 'bg-gray-800/50 border-gray-700'
                          }`}
                        >
                          <span className="text-white font-semibold text-sm md:text-base truncate mr-2">
                            {match.team2?.team_name || 'BYE'}
                          </span>
                          {match.team2 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 1, 'team2')}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors ${
                                match.winner === 'team2'
                                  ? 'bg-green-600 text-white border-green-400'
                                  : match.winner === 'team1'
                                    ? 'bg-red-900/40 text-red-400 border-red-500'
                                    : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                              }`}
                            >
                              {match.winner === 'team2' ? 'W' : match.winner === 'team1' ? 'L' : 'W'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-3">Bracket 2 (8 Teams)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {brackets
                  .filter((match) => match.bracket === 2)
                  .map((match) => (
                    <div
                      key={`b2-${match.matchNumber}`}
                      className="bg-black/30 border border-blue-500/20 rounded-lg p-3 md:p-4"
                    >
                      <div className="text-blue-400 text-xs md:text-sm mb-2 md:mb-3">
                        Bracket 2 - Match {match.matchNumber}
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                        {/* Team 1 row */}
                        <div
                          className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                            match.winner === 'team1'
                              ? 'glow-green-border bg-green-900/10'
                              : match.winner === 'team2'
                                ? 'glow-red-border bg-red-900/10'
                                : 'bg-gray-800/50 border-gray-700'
                          }`}
                        >
                          <span className="text-white font-semibold text-sm md:text-base truncate mr-2">
                            {match.team1?.team_name || 'BYE'}
                          </span>
                          {match.team1 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 2, 'team1')}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors ${
                                match.winner === 'team1'
                                  ? 'bg-green-600 text-white border-green-400'
                                  : match.winner === 'team2'
                                    ? 'bg-red-900/40 text-red-400 border-red-500'
                                    : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                              }`}
                            >
                              {match.winner === 'team1' ? 'W' : match.winner === 'team2' ? 'L' : 'W'}
                            </button>
                          )}
                        </div>

                        <div className="text-center text-gray-500 text-xs md:text-sm">VS</div>

                        {/* Team 2 row */}
                        <div
                          className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                            match.winner === 'team2'
                              ? 'glow-green-border bg-green-900/10'
                              : match.winner === 'team1'
                                ? 'glow-red-border bg-red-900/10'
                                : 'bg-gray-800/50 border-gray-700'
                          }`}
                        >
                          <span className="text-white font-semibold text-sm md:text-base truncate mr-2">
                            {match.team2?.team_name || 'BYE'}
                          </span>
                          {match.team2 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 2, 'team2')}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors ${
                                match.winner === 'team2'
                                  ? 'bg-green-600 text-white border-green-400'
                                  : match.winner === 'team1'
                                    ? 'bg-red-900/40 text-red-400 border-red-500'
                                    : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                              }`}
                            >
                              {match.winner === 'team2' ? 'W' : match.winner === 'team1' ? 'L' : 'W'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmGenerateOpen}
        title="Regenerate brackets?"
        message="There are already recorded winners in the current brackets. Generating new brackets will remove the current matchups and results for this tournament. Do you want to generate new brackets anyway?"
        confirmLabel="Yes, generate new brackets"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmGenerateOpen(false);
          generateBracketsInternal();
        }}
        onCancel={() => setConfirmGenerateOpen(false)}
      />
    </div>
  );
}
