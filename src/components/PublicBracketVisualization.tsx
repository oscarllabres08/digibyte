import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid3x3, Info, Loader2, RefreshCw, Trophy, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { supabase, Bracket, Team, Tournament } from '../lib/supabase';

type WinnerSide = 'team1' | 'team2' | null;
type BracketCategory = 'upper' | 'lower';

type MatchView = {
  id: string;
  round: number;
  matchNumber: number;
  bracketCategory: BracketCategory;
  team1: Team | null;
  team2: Team | null;
  winner: WinnerSide;
};

function getWinnerSide(row: Bracket): WinnerSide {
  if (!row.winner_id) return null;
  if (row.team1_id && row.winner_id === row.team1_id) return 'team1';
  if (row.team2_id && row.winner_id === row.team2_id) return 'team2';
  return null;
}

function roundLabel(round: number, round1Count: number, maxRound: number) {
  // Single elimination typical labels
  if (round1Count === 8 && maxRound <= 4) {
    if (round === 1) return 'Round of 16';
    if (round === 2) return 'Quarter-Final';
    if (round === 3) return 'Semi-Final';
    if (round === 4) return 'Final';
  }

  // Fallback
  return `Round ${round}`;
}

function determineBracketCategory(round: number, matchNumber: number, allMatches: Bracket[]): BracketCategory {
  // Round 1 is always upper bracket
  if (round === 1) return 'upper';

  // For Round 2 and 3, the DB stores both upper and lower matches in the same round number.
  // We infer which is which based on the match ordering within that round.
  if (round === 2) {
    const round2 = allMatches
      .filter((m) => m.round === 2)
      .slice()
      .sort((a, b) => a.match_number - b.match_number);

    // Upper bracket round 2 is typically 4 matches (for 16-team start).
    if (round2.length > 4) {
      const upperLast = round2[3]?.match_number ?? 0;
      return matchNumber > upperLast ? 'lower' : 'upper';
    }
    return 'upper';
  }

  if (round === 3) {
    const round3 = allMatches
      .filter((m) => m.round === 3)
      .slice()
      .sort((a, b) => a.match_number - b.match_number);

    // Upper bracket round 3 is typically 2 matches; extra matches are lower bracket.
    if (round3.length > 2) {
      const upperLast = round3[1]?.match_number ?? 0;
      return matchNumber > upperLast ? 'lower' : 'upper';
    }
    return 'upper';
  }

  // Special lower-bracket rounds used by the generator
  if (round === 20 || round === 25 || round === 30) return 'lower';

  // Remaining rounds are upper bracket (4-6 finals path)
  return 'upper';
}

function upperRoundLabel(round: number, round1Count: number, maxUpperRound: number) {
  // Digibyte 16-team double-elim (upper path) labels
  if (round1Count === 8 && maxUpperRound >= 6) {
    if (round === 1) return 'Round of 16';
    if (round === 2) return 'Quarter-Final';
    if (round === 3) return 'Semi-Final';
    if (round === 4) return 'Upper Bracket Final';
    if (round === 5) return 'Final Qualifier';
    if (round === 6) return 'Final Round - Championship';
  }

  // Fall back to generic single-elim labels (or Round X)
  return roundLabel(round, round1Count, Math.min(maxUpperRound, 4));
}

function groupTitle(category: BracketCategory, round: number, round1Count: number, maxUpperRound: number) {
  const base =
    category === 'upper'
      ? upperRoundLabel(round, round1Count, maxUpperRound)
      : round === 20
        ? 'Round 2 Final'
        : round === 25
          ? 'Round 3'
          : round === 30
            ? 'Final'
            : `Round ${round}`;

  return `${category === 'upper' ? 'Upper Bracket' : 'Lower Bracket'} • ${base}`;
}

export default function PublicBracketVisualization() {
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [error, setError] = useState<string>('');
  const [liveBracketVisible, setLiveBracketVisible] = useState<boolean>(true);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const loadActiveTournament = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: tError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tError) throw tError;
      setActiveTournament(data || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load active tournament');
      setActiveTournament(null);
    } finally {
      setLoading(false);
    }
  };

  const loadBracketForTournament = async (tournamentId: string) => {
    setLoadingBracket(true);
    setError('');
    try {
      const { data: bracketRows, error: bError } = await supabase
        .from('brackets')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });

      if (bError) throw bError;

      if (!bracketRows || bracketRows.length === 0) {
        setMatches([]);
        return;
      }

      const teamIds = Array.from(
        new Set(
          bracketRows
            .flatMap((r: any) => [r.team1_id, r.team2_id])
            .filter(Boolean),
        ),
      ) as string[];

      const teamMap = new Map<string, Team>();
      if (teamIds.length > 0) {
        const { data: teamRows, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds);

        if (teamError) throw teamError;
        (teamRows || []).forEach((t: any) => teamMap.set(t.id, t as Team));
      }

      const typedRows = bracketRows as Bracket[];

      const views: MatchView[] = (typedRows as any[]).map((row: any) => ({
        id: row.id,
        round: row.round,
        matchNumber: row.match_number,
        bracketCategory: determineBracketCategory(row.round, row.match_number, typedRows),
        team1: row.team1_id ? teamMap.get(row.team1_id) || null : null,
        team2: row.team2_id ? teamMap.get(row.team2_id) || null : null,
        winner: getWinnerSide(row as Bracket),
      }));

      setMatches(views);
    } catch (e: any) {
      setError(e?.message || 'Failed to load bracket');
      setMatches([]);
    } finally {
      setLoadingBracket(false);
    }
  };

  const loadLiveBracketSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('registration_settings')
        .select('live_bracket_visible')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading live bracket setting:', error);
        // Default to visible if error
        setLiveBracketVisible(true);
      } else {
        setLiveBracketVisible(data?.live_bracket_visible ?? true);
      }
    } catch (err) {
      console.error('Unexpected error loading live bracket setting:', err);
      setLiveBracketVisible(true);
    }
  };

  useEffect(() => {
    void loadActiveTournament();
    void loadLiveBracketSetting();
  }, []);

  // Load brackets + subscribe for realtime updates when admin saves winners
  useEffect(() => {
    const tid = activeTournament?.id;
    if (!tid) return;

    void loadBracketForTournament(tid);

    // Cleanup any previous channel
    if (realtimeChannelRef.current) {
      try {
        void supabase.removeChannel(realtimeChannelRef.current);
      } catch {
        // ignore
      }
      realtimeChannelRef.current = null;
    }

    try {
      const channel = supabase
        .channel(`public-brackets-${tid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'brackets', filter: `tournament_id=eq.${tid}` },
          () => {
            void loadBracketForTournament(tid);
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    } catch {
      // If realtime isn't configured, silently skip (the initial load still works).
    }

    return () => {
      if (realtimeChannelRef.current) {
        try {
          void supabase.removeChannel(realtimeChannelRef.current);
        } catch {
          // ignore
        }
        realtimeChannelRef.current = null;
      }
    };
  }, [activeTournament?.id]);

  // Subscribe to registration_settings changes for live_bracket_visible
  useEffect(() => {
    const channel = supabase
      .channel('registration-settings-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registration_settings' },
        () => {
          void loadLiveBracketSetting();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const rounds = useMemo(() => {
    const byGroup = new Map<string, { round: number; bracketCategory: BracketCategory; matches: MatchView[] }>();

    matches.forEach((m) => {
      // Public view: show upper rounds (1-6) and lower bracket rounds (2/3 splits + 20/25/30)
      const isRelevant =
        (m.round >= 1 && m.round <= 6) || m.round === 20 || m.round === 25 || m.round === 30;
      if (!isRelevant) return;

      const key = `${m.bracketCategory}-${m.round}`;
      const existing = byGroup.get(key) || { round: m.round, bracketCategory: m.bracketCategory, matches: [] as MatchView[] };
      existing.matches.push(m);
      byGroup.set(key, existing);
    });

    // stable order by match number
    Array.from(byGroup.values()).forEach((g) => g.matches.sort((a, b) => a.matchNumber - b.matchNumber));

    // Sort groups by round within each bracket category
    return Array.from(byGroup.values()).sort((a, b) => a.round - b.round);
  }, [matches]);

  const upperGroups = useMemo(
    () => rounds.filter((r) => r.bracketCategory === 'upper').sort((a, b) => a.round - b.round),
    [rounds],
  );
  const lowerGroups = useMemo(
    () => rounds.filter((r) => r.bracketCategory === 'lower').sort((a, b) => a.round - b.round),
    [rounds],
  );

  const round1Count = rounds.find((r) => r.round === 1 && r.bracketCategory === 'upper')?.matches.length || 0;
  const maxUpperRound = rounds.filter((r) => r.bracketCategory === 'upper').length
    ? Math.max(...rounds.filter((r) => r.bracketCategory === 'upper').map((r) => r.round))
    : 0;

  const champion = useMemo(() => {
    const final = matches.find((m) => m.bracketCategory === 'upper' && m.round === 6);
    if (!final?.winner) return null;
    return final.winner === 'team1' ? final.team1 : final.team2;
  }, [matches]);

  // Calculate team standings (wins and losses) - same logic as admin page
  const teamStandings = useMemo(() => {
    const standings: Record<string, { wins: number; losses: number }> = {};

    matches.forEach((match) => {
      if (match.winner === 'team1' && match.team1) {
        const teamId = match.team1.id;
        standings[teamId] = standings[teamId] || { wins: 0, losses: 0 };
        standings[teamId].wins++;
        if (match.team2) {
          const team2Id = match.team2.id;
          standings[team2Id] = standings[team2Id] || { wins: 0, losses: 0 };
          standings[team2Id].losses++;
        }
      } else if (match.winner === 'team2' && match.team2) {
        const teamId = match.team2.id;
        standings[teamId] = standings[teamId] || { wins: 0, losses: 0 };
        standings[teamId].wins++;
        if (match.team1) {
          const team1Id = match.team1.id;
          standings[team1Id] = standings[team1Id] || { wins: 0, losses: 0 };
          standings[team1Id].losses++;
        }
      }
    });

    return standings;
  }, [matches]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleManualRefresh = () => {
    if (loading || loadingBracket) return;

    if (activeTournament?.id) {
      void loadBracketForTournament(activeTournament.id);
    } else {
      void loadActiveTournament();
    }
  };

  return (
    <section id="brackets" className="min-h-screen py-12 sm:py-16 md:py-20 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-8 sm:mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 sm:mb-3 md:mb-4">
            Live <span className="text-blue-400 glow-text">Bracket</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base md:text-lg">
            {activeTournament?.title ? `Tournament: ${activeTournament.title}` : 'Tournament progress'}
          </p>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">
            <Loader2 className="w-10 h-10 mx-auto mb-4 opacity-70 animate-spin" />
            <p>Loading tournament...</p>
          </div>
        ) : error ? (
          <div className="text-center text-red-300 py-10 bg-red-900/20 border border-red-500/30 rounded-xl">
            <p className="font-semibold">{error}</p>
          </div>
        ) : !activeTournament ? (
          <div className="text-center text-gray-400 py-20">
            <Grid3x3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No active tournament right now.</p>
          </div>
        ) : loadingBracket ? (
          <div className="text-center text-gray-400 py-20">
            <Loader2 className="w-10 h-10 mx-auto mb-4 opacity-70 animate-spin" />
            <p>Loading bracket...</p>
          </div>
        ) : rounds.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <Grid3x3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Bracket not generated yet.</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">Once the admin generates Round 1, it will appear here.</p>
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-4 sm:p-5 md:p-6 lg:p-8 glow-box-subtle relative">
            {/* Overlay to hide bracket content when toggle is off */}
            {!liveBracketVisible && (
              <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm rounded-xl z-50 flex items-center justify-center">
                <div className="text-center px-4">
                  <Lock className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                  <p className="text-gray-300 text-lg font-semibold mb-2">Live Bracket Hidden</p>
                  <p className="text-gray-400 text-sm">The bracket is currently not available for viewing.</p>
                </div>
              </div>
            )}
            {champion && (
              <div className="mb-4 sm:mb-5">
                <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/40 rounded-xl p-4 sm:p-5 flex items-center gap-3">
                  <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-yellow-300 font-semibold text-xs sm:text-sm">Champion</div>
                    <div className="text-white font-extrabold text-lg sm:text-xl truncate">
                      {champion.team_name}
                    </div>
                    <div className="text-yellow-100/80 text-xs sm:text-sm">
                      Congratulations! 🎉
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5">
              <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-black/30 border border-blue-500/10 flex-1">
                <Info className="w-5 h-5 text-blue-300 mt-0.5 flex-shrink-0" />
                <div className="text-xs sm:text-sm text-gray-300">
                  <div className="font-semibold text-white mb-1">Bracket Guide</div>
                  <div>
                    <span className="font-semibold text-blue-200">Upper Bracket</span>: teams with <span className="font-semibold">0 losses</span>.
                    {' '}
                    <span className="font-semibold text-blue-200">Lower Bracket</span>: teams with <span className="font-semibold">1 loss</span> still fighting to reach the Final.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={loadingBracket || loading}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loadingBracket || loading ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
                <span>{loadingBracket || loading ? 'Refreshing...' : 'Refresh Bracket'}</span>
              </button>
            </div>

            {/* Upper Bracket (top) */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-bold text-sm sm:text-base">Upper Bracket</div>
                <div className="text-gray-500 text-xs">Scroll horizontally to view rounds</div>
              </div>
              <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-3">
                {upperGroups.map((r) => {
                  const groupKey = `${r.bracketCategory}-${r.round}`;
                  const isCollapsed = collapsedGroups.has(groupKey);
                  return (
                    <div key={groupKey} className="min-w-[240px] sm:min-w-[260px]">
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-blue-300 font-bold text-sm sm:text-base">
                              {groupTitle(r.bracketCategory, r.round, round1Count, maxUpperRound)}
                            </div>
                            <div className="text-gray-500 text-xs">Matches: {r.matches.length}</div>
                            {r.round === 4 && (
                              <div className="mt-2 text-xs sm:text-sm text-yellow-200 leading-snug">
                                <span className="font-semibold text-yellow-300">Note:</span> Winner advances to the{' '}
                                <span className="font-semibold">Final Game</span> as the waiting team. Loser will face the{' '}
                                <span className="font-semibold">Lower Bracket Final</span> winner.
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroup(groupKey)}
                            className="p-1 rounded-full border border-blue-500/40 text-blue-200 hover:bg-blue-500/10 transition-colors"
                            aria-label={isCollapsed ? 'Expand round' : 'Collapse round'}
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-3">
                          {r.matches.map((m) => (
                            <div key={m.id} className="bg-black/30 border border-blue-500/10 rounded-lg p-3">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="text-[11px] text-gray-400">Match {m.matchNumber}</div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-blue-500/10 border-blue-500/30 text-blue-200">
                                  UPPER
                                </span>
                              </div>

                              <div className="space-y-2">
                                <div
                                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border ${
                                    m.winner === 'team1'
                                      ? 'border-green-500/50 bg-green-900/15'
                                      : m.winner === 'team2'
                                        ? 'border-red-500/40 bg-red-900/10'
                                        : 'border-gray-700 bg-gray-900/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                    <span className="text-white text-xs sm:text-sm font-semibold truncate">
                                      {m.team1?.team_name || 'TBD'}
                                    </span>
                                    {m.team1 && teamStandings[m.team1.id] && (
                                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                                        ({teamStandings[m.team1.id].wins}W-{teamStandings[m.team1.id].losses}L)
                                      </span>
                                    )}
                                  </div>
                                  {m.winner === 'team1' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-semibold">
                                      WIN
                                    </span>
                                  )}
                                </div>

                                <div className="text-center text-gray-500 text-[10px]">VS</div>

                                <div
                                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border ${
                                    m.winner === 'team2'
                                      ? 'border-green-500/50 bg-green-900/15'
                                      : m.winner === 'team1'
                                        ? 'border-red-500/40 bg-red-900/10'
                                        : 'border-gray-700 bg-gray-900/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                    <span className="text-white text-xs sm:text-sm font-semibold truncate">
                                      {m.team2?.team_name || 'TBD'}
                                    </span>
                                    {m.team2 && teamStandings[m.team2.id] && (
                                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                                        ({teamStandings[m.team2.id].wins}W-{teamStandings[m.team2.id].losses}L)
                                      </span>
                                    )}
                                  </div>
                                  {m.winner === 'team2' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-semibold">
                                      WIN
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lower Bracket (below) */}
            {lowerGroups.length > 0 && (
              <div className="pt-4 border-t border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white font-bold text-sm sm:text-base">Lower Bracket</div>
                  <div className="text-gray-500 text-xs">Scroll horizontally to view rounds</div>
                </div>
                <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-3">
                  {lowerGroups.map((r) => {
                    const groupKey = `${r.bracketCategory}-${r.round}`;
                    const isCollapsed = collapsedGroups.has(groupKey);
                    return (
                      <div key={groupKey} className="min-w-[240px] sm:min-w-[260px]">
                        <div className="mb-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-purple-200 font-bold text-sm sm:text-base">
                                {groupTitle(r.bracketCategory, r.round, round1Count, maxUpperRound)}
                              </div>
                              <div className="text-gray-500 text-xs">Matches: {r.matches.length}</div>
                              {r.round === 30 && (
                                <div className="mt-2 text-xs sm:text-sm text-yellow-200 leading-snug">
                                  <span className="font-semibold text-yellow-300">Note:</span> The{' '}
                                  <span className="font-semibold">Lower Bracket Final</span> winner returns to the{' '}
                                  <span className="font-semibold">Upper Bracket</span> to play in the{' '}
                                  <span className="font-semibold">Final Game</span>.
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupKey)}
                              className="p-1 rounded-full border border-purple-500/40 text-purple-200 hover:bg-purple-500/10 transition-colors"
                              aria-label={isCollapsed ? 'Expand round' : 'Collapse round'}
                            >
                              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="space-y-3">
                            {r.matches.map((m) => (
                              <div key={m.id} className="bg-black/30 border border-purple-500/10 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="text-[11px] text-gray-400">Match {m.matchNumber}</div>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-purple-500/10 border-purple-500/30 text-purple-200">
                                    LOWER
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  <div
                                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border ${
                                      m.winner === 'team1'
                                        ? 'border-green-500/50 bg-green-900/15'
                                        : m.winner === 'team2'
                                          ? 'border-red-500/40 bg-red-900/10'
                                          : 'border-gray-700 bg-gray-900/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                      <span className="text-white text-xs sm:text-sm font-semibold truncate">
                                        {m.team1?.team_name || 'TBD'}
                                      </span>
                                      {m.team1 && teamStandings[m.team1.id] && (
                                        <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                                          ({teamStandings[m.team1.id].wins}W-{teamStandings[m.team1.id].losses}L)
                                        </span>
                                      )}
                                    </div>
                                    {m.winner === 'team1' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-semibold">
                                        WIN
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-center text-gray-500 text-[10px]">VS</div>

                                  <div
                                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded border ${
                                      m.winner === 'team2'
                                        ? 'border-green-500/50 bg-green-900/15'
                                        : m.winner === 'team1'
                                          ? 'border-red-500/40 bg-red-900/10'
                                          : 'border-gray-700 bg-gray-900/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                      <span className="text-white text-xs sm:text-sm font-semibold truncate">
                                        {m.team2?.team_name || 'TBD'}
                                      </span>
                                      {m.team2 && teamStandings[m.team2.id] && (
                                        <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                                          ({teamStandings[m.team2.id].wins}W-{teamStandings[m.team2.id].losses}L)
                                        </span>
                                      )}
                                    </div>
                                    {m.winner === 'team2' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 font-semibold">
                                        WIN
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-gray-500 text-xs">
              Updates automatically when the admin saves winners.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

