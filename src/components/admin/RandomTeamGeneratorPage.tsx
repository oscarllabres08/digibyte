import { useState, useEffect } from 'react';
import { Shuffle, Users, Save, X, User } from 'lucide-react';
import { supabase, Player } from '../../lib/supabase';
import ConfirmModal from '../ConfirmModal';

interface GeneratedTeam {
  teamName: string;
  captain: string;
  members: string[];
  captainPlayer: Player;
  memberPlayers: Player[];
}

export default function RandomTeamGeneratorPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedTeams, setGeneratedTeams] = useState<GeneratedTeam[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  
  const REQUIRED_PLAYERS = 20;
  const NUMBER_OF_TEAMS = 4;
  const PLAYERS_PER_TEAM = 5;

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setPlayers(data);
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateRandomTeams = () => {
    if (players.length < REQUIRED_PLAYERS) {
      alert(`You need at least ${REQUIRED_PLAYERS} players to generate teams. Currently you have ${players.length} players.`);
      return;
    }

    // Take only the first 20 players if there are more
    const playersToUse = players.slice(0, REQUIRED_PLAYERS);
    
    // Shuffle players randomly
    const shuffledPlayers = shuffleArray(playersToUse);

    // Distribute players into 4 teams with 5 players each
    const teams: GeneratedTeam[] = [];
    let playerIndex = 0;

    for (let i = 0; i < NUMBER_OF_TEAMS; i++) {
      const teamPlayers = shuffledPlayers.slice(playerIndex, playerIndex + PLAYERS_PER_TEAM);
      playerIndex += PLAYERS_PER_TEAM;

      // First player is captain, rest are members
      const captain = teamPlayers[0];
      const members = teamPlayers.slice(1);

      // Simple team name: Team 1, Team 2, Team 3, Team 4
      teams.push({
        teamName: `Team ${i + 1}`,
        captain: captain.complete_name,
        members: members.map((p) => p.complete_name),
        captainPlayer: captain,
        memberPlayers: members,
      });
    }

    setGeneratedTeams(teams);
    setShowPreview(true);
  };

  const createTeams = async () => {
    setLoading(true);
    try {
      const teamsToCreate = generatedTeams.map((team) => ({
        team_name: team.teamName,
        team_captain: team.captain,
        team_members: team.members,
        contact_no: 'N/A - Random Team',
        paid: false,
      }));

      // Insert all teams
      const { error } = await supabase.from('teams').insert(teamsToCreate);

      if (error) {
        console.error('Error creating teams:', error);
        throw error;
      }

      alert(`Successfully created ${teamsToCreate.length} teams!`);
      setShowPreview(false);
      setGeneratedTeams([]);
      setConfirmCreateOpen(false);
    } catch (err) {
      alert('Error creating teams: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getGameColor = (game: string) => {
    switch (game) {
      case 'Point Blank':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'League of Legends':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'Valorant':
        return 'bg-red-500/20 text-red-300 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
    }
  };

  return (
    <div>
      <div className="mb-4 sm:mb-5 md:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2">
            Random Team Generator
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base">
            Randomly assign {REQUIRED_PLAYERS} players into {NUMBER_OF_TEAMS} teams ({PLAYERS_PER_TEAM} players per team)
          </p>
        </div>
        <button
          onClick={generateRandomTeams}
          disabled={loading || players.length < REQUIRED_PLAYERS}
          className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto glow-button"
        >
          <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Generate Random Teams</span>
        </button>
      </div>

      {players.length < REQUIRED_PLAYERS && (
        <div className="mb-4 sm:mb-6 bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-3 sm:p-4 text-yellow-400">
          <div className="flex items-start gap-2 sm:gap-3">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm sm:text-base mb-1">Cannot Generate Teams Yet</p>
              <p className="text-xs sm:text-sm">
                You need at least {REQUIRED_PLAYERS} registered players to generate teams. Currently you have {players.length} player{players.length !== 1 ? 's' : ''}.
                {players.length > 0 && (
                  <span className="block mt-1">Need {REQUIRED_PLAYERS - players.length} more player{REQUIRED_PLAYERS - players.length !== 1 ? 's' : ''}.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div className="mb-4 sm:mb-6 bg-gray-900/50 border border-blue-500/20 rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 glow-box-subtle">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            <div>
              <p className="text-white text-sm sm:text-base md:text-lg font-semibold">
                Registered Players ({players.length})
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                {players.length >= REQUIRED_PLAYERS 
                  ? `First ${REQUIRED_PLAYERS} players will be randomly assigned to ${NUMBER_OF_TEAMS} teams`
                  : 'These players will be randomly assigned to teams once you reach 20 players'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`bg-black/30 border rounded-lg p-2 sm:p-2.5 ${
                  index < REQUIRED_PLAYERS 
                    ? 'border-blue-500/30' 
                    : 'border-gray-500/20 opacity-60'
                }`}
              >
                <p className="text-xs sm:text-sm md:text-base font-semibold text-white text-center truncate">
                  {player.complete_name}
                </p>
                {index < REQUIRED_PLAYERS && (
                  <p className="text-[10px] text-blue-400 text-center mt-1">Will be assigned</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showPreview && generatedTeams.length > 0 && (
        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-base sm:text-lg md:text-xl font-bold text-white">
              Generated Teams Preview ({generatedTeams.length} teams)
            </h4>
            <button
              onClick={() => {
                setShowPreview(false);
                setGeneratedTeams([]);
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-xs sm:text-sm"
            >
              <X className="w-4 h-4 inline mr-1.5" />
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {generatedTeams.map((team, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-blue-500/20 rounded-xl p-3 sm:p-4 md:p-5 animate-slide-up glow-box-subtle"
              >
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  <h5 className="text-base sm:text-lg md:text-xl font-bold text-white">{team.teamName}</h5>
                </div>

                <div className="space-y-2 sm:space-y-2.5">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Captain:</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm sm:text-base font-semibold text-white">{team.captain}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] sm:text-xs font-semibold ${getGameColor(team.captainPlayer.game)}`}
                      >
                        {team.captainPlayer.game}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">IGN: {team.captainPlayer.ign}</p>
                  </div>

                  {team.members.length > 0 && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-400 mb-1">Members ({team.members.length}):</p>
                      <div className="space-y-1">
                        {team.memberPlayers.map((player, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <User className="w-3 h-3 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-white truncate">{player.complete_name}</p>
                              <p className="text-[10px] text-gray-500 truncate">IGN: {player.ign}</p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold flex-shrink-0 ${getGameColor(player.game)}`}
                            >
                              {player.game.substring(0, 2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-blue-500/20">
                    <p className="text-xs text-gray-500">
                      Total: {team.members.length + 1} player{team.members.length + 1 !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
            <button
              onClick={() => {
                setShowPreview(false);
                setGeneratedTeams([]);
              }}
              className="px-4 py-2 sm:py-2.5 md:py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmCreateOpen(true)}
              disabled={loading}
              className="px-4 py-2 sm:py-2.5 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
            >
              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{loading ? 'Creating...' : 'Create Teams'}</span>
            </button>
          </div>
        </div>
      )}

      {players.length === 0 && (
        <div className="text-center text-gray-400 py-12 sm:py-16 md:py-20">
          <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
          <p className="text-sm sm:text-base md:text-lg">No players available</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">Add at least {REQUIRED_PLAYERS} players to generate random teams</p>
        </div>
      )}

      <ConfirmModal
        open={confirmCreateOpen}
        title="Create Random Teams"
        message={`Are you sure you want to create ${generatedTeams.length} teams with randomly assigned players? This will add new teams to the database.`}
        confirmLabel="Create Teams"
        cancelLabel="Cancel"
        loading={loading}
        onConfirm={createTeams}
        onCancel={() => setConfirmCreateOpen(false)}
      />
    </div>
  );
}
