import { useState, useEffect, useMemo } from 'react';
import { Trophy, Save, Loader2, RefreshCw, X } from 'lucide-react';
import { supabase, Team } from '../../lib/supabase';
import ConfirmModal from '../ConfirmModal';

type WinnerSide = 'team1' | 'team2' | null;
type BracketCategory = 'upper' | 'lower';

interface Match {
  team1: Team | null;
  team2: Team | null;
  round: number;
  matchNumber: number;
  bracketCategory: BracketCategory;
  winner: WinnerSide;
  parentMatch1?: number;
  parentMatch2?: number;
}

export default function FourTeamBracketPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [brackets, setBrackets] = useState<Match[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [saving, setSaving] = useState<{ round: number; bracketCategory?: BracketCategory } | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false);
  const [saveErrorModalOpen, setSaveErrorModalOpen] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [cancelRoundModalOpen, setCancelRoundModalOpen] = useState(false);
  const [cancelRoundData, setCancelRoundData] = useState<{ round: number; bracketCategory?: BracketCategory } | null>(null);
  const [championModalOpen, setChampionModalOpen] = useState(false);
  const [championTeam, setChampionTeam] = useState<Team | null>(null);

  // Calculate team standings (wins and losses) based on current brackets
  const teamStandings = useMemo(() => {
    const standings: Record<string, { wins: number; losses: number }> = {};

    brackets.forEach((match) => {
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
  }, [brackets]);

  const loadTeams = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading teams:', error);
      return;
    }

    setTeams(data || []);
  };

  const loadBrackets = async (id: string, teamsSource: Team[]) => {
    if (!id) return;

    const { data, error } = await supabase
      .from('brackets')
      .select('*')
      .eq('tournament_id', id)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true });

    if (error) {
      console.error('Error loading brackets:', error);
      return;
    }

    if (!data || data.length === 0) return;

    const findTeam = (teamId: string | null) => {
      if (!teamId) return null;
      return teamsSource.find((t) => t.id === teamId) || null;
    };

    const loaded: Match[] = data.map((row: any) => {
      // Determine bracket category based on round and match number
      let bracketCategory: BracketCategory = 'upper';
      if (row.round === 2 && row.match_number === 4) bracketCategory = 'lower';
      else if (row.round === 3) bracketCategory = 'lower';
      else if (row.round === 4) bracketCategory = 'upper'; // Final is upper bracket

      return {
        team1: findTeam(row.team1_id),
        team2: findTeam(row.team2_id),
        round: row.round,
        matchNumber: row.match_number,
        bracketCategory,
        winner: row.winner_id
          ? row.winner_id === row.team1_id
            ? 'team1'
            : 'team2'
          : null,
        parentMatch1: row.parent_match1,
        parentMatch2: row.parent_match2,
      };
    });

    setBrackets(loaded);
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (teams.length === 0) return;
    if (typeof window === 'undefined') return;

    const storedId = window.localStorage.getItem('digibyte_current_tournament_id');
    if (storedId) {
      setTournamentId(storedId);
      void loadBrackets(storedId, teams);
    }
  }, [teams]);

  const generateBracketsInternal = async () => {
    // Filter teams that have at least 1 member (randomly generated teams)
    const eligibleTeams = teams.filter((t) => t.team_members && t.team_members.length > 0);

    if (eligibleTeams.length < 4) {
      alert(`This bracket requires exactly 4 teams.\nCurrently you have ${eligibleTeams.length} eligible team(s).`);
      return;
    }

    // Take first 4 teams (or randomly select 4)
    const selectedTeams = eligibleTeams.slice(0, 4);
    const shuffled = [...selectedTeams].sort(() => Math.random() - 0.5);

    const matches: Match[] = [];

    // Round 1: 2 matches (upper bracket)
    // Match 1: Team 1 vs Team 2
    matches.push({
      team1: shuffled[0],
      team2: shuffled[1],
      round: 1,
      matchNumber: 1,
      bracketCategory: 'upper',
      winner: null,
    });

    // Match 2: Team 3 vs Team 4
    matches.push({
      team1: shuffled[2],
      team2: shuffled[3],
      round: 1,
      matchNumber: 2,
      bracketCategory: 'upper',
      winner: null,
    });

    try {
      // Ensure we have a valid tournament for this 4-team bracket
      let targetTournamentId = tournamentId;

      if (targetTournamentId) {
        const { data: existingTournament, error: checkError } = await supabase
          .from('tournaments')
          .select('id')
          .eq('id', targetTournamentId)
          .single();

        if (checkError || !existingTournament) {
          targetTournamentId = '';
          setTournamentId('');
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('digibyte_current_tournament_id');
          }
        }
      }

      if (!targetTournamentId) {
        const { data, error: createError } = await supabase
          .from('tournaments')
          .insert({
            title: `4 Teams Tournament ${new Date().toLocaleString()}`,
            status: 'active',
          })
          .select('id')
          .single();

        if (createError || !data?.id) {
          setSaveErrorMessage('Error creating tournament record: ' + (createError?.message || 'Unknown error'));
          setSaveErrorModalOpen(true);
          return;
        }

        targetTournamentId = data.id as string;
        setTournamentId(targetTournamentId);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
        }
      }

      // Remove any existing brackets for this tournament (fresh bracket)
      await supabase.from('brackets').delete().eq('tournament_id', targetTournamentId);

      // Save Round 1 matches (no winners yet) so they persist when leaving page
      const bracketData = matches.map((m) => ({
        tournament_id: targetTournamentId,
        team1_id: m.team1?.id || null,
        team2_id: m.team2?.id || null,
        round: m.round,
        match_number: m.matchNumber,
        winner_id: null,
        parent_match1: null,
        parent_match2: null,
      }));

      const { error: insertError } = await supabase.from('brackets').insert(bracketData);
      if (insertError) {
        setSaveErrorMessage('Error saving initial bracket: ' + insertError.message);
        setSaveErrorModalOpen(true);
        return;
      }

      // Finally update local state
      setBrackets(matches);
    } catch (error: any) {
      console.error('Error generating 4-team bracket:', error);
      setSaveErrorMessage('Error generating bracket: ' + (error?.message || 'Unknown error'));
      setSaveErrorModalOpen(true);
    }
  };

  const generateBrackets = () => {
    const hasExistingResults = brackets.some((match) => match.winner !== null);
    const hasSavedBrackets = brackets.length > 0 && tournamentId !== '';

    if (hasExistingResults || hasSavedBrackets) {
      setConfirmGenerateOpen(true);
      return;
    }

    void generateBracketsInternal();
  };

  const confirmGenerate = async () => {
    setConfirmGenerateOpen(false);

    try {
      // Reset local brackets state, then generate a new Round 1 bracket
      setBrackets([]);
      await generateBracketsInternal();
    } catch (error) {
      console.error('Error regenerating 4-team bracket:', error);
      setSaveErrorMessage('Error regenerating bracket. Please try again.');
      setSaveErrorModalOpen(true);
    }
  };

  const setWinner = async (matchNumber: number, side: WinnerSide, bracketCategory: BracketCategory) => {
    // Update local state immediately for UI feedback
    const updatedBrackets = brackets.map((match) => {
      if (match.matchNumber !== matchNumber || match.bracketCategory !== bracketCategory) return match;

      // If clicking the same winner again, clear selection; otherwise set new winner
      const newWinner: WinnerSide = match.winner === side ? null : side;
      return { ...match, winner: newWinner };
    });

    setBrackets(updatedBrackets);

    // Auto-save to database in the background
    const match = updatedBrackets.find(
      (m) => m.matchNumber === matchNumber && m.bracketCategory === bracketCategory,
    );
    if (!match) return;

    let targetTournamentId = tournamentId;

    // If there's a tournament ID, verify it exists
    if (targetTournamentId) {
      const { data: existingTournament, error: checkError } = await supabase
        .from('tournaments')
        .select('id')
        .eq('id', targetTournamentId)
        .single();

      // If tournament doesn't exist or there's an error, create a new one
      if (checkError || !existingTournament) {
        targetTournamentId = '';
        setTournamentId('');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('digibyte_current_tournament_id');
        }
      }
    }

    // If there's no tournament yet, auto-create one
    if (!targetTournamentId) {
      const { data, error: createError } = await supabase
        .from('tournaments')
        .insert({
          title: `4 Teams Tournament ${new Date().toLocaleString()}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError || !data?.id) {
        console.error('Error creating tournament for auto-save:', createError);
        return;
      }

      targetTournamentId = data.id as string;
      setTournamentId(targetTournamentId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
      }
    }

    // Ensure all brackets exist in database first (if not already saved)
    const { data: existingBrackets } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId);

    const existingMatchNumbers = new Set(
      (existingBrackets || []).map((b: any) => b.match_number),
    );

    // If brackets don't exist yet, save all of them
    if (!existingMatchNumbers.has(matchNumber)) {
      const bracketData = updatedBrackets.map((m) => ({
        tournament_id: targetTournamentId,
        team1_id: m.team1?.id || null,
        team2_id: m.team2?.id || null,
        round: m.round,
        match_number: m.matchNumber,
        winner_id:
          m.winner === 'team1'
            ? m.team1?.id || null
            : m.winner === 'team2'
              ? m.team2?.id || null
              : null,
        parent_match1: m.parentMatch1 || null,
        parent_match2: m.parentMatch2 || null,
      }));

      await supabase.from('brackets').delete().eq('tournament_id', targetTournamentId);
      await supabase.from('brackets').insert(bracketData);
    } else {
      // Update only the specific match's winner
      const winnerId =
        match.winner === 'team1'
          ? match.team1?.id || null
          : match.winner === 'team2'
            ? match.team2?.id || null
            : null;

      await supabase
        .from('brackets')
        .update({ winner_id: winnerId })
        .eq('tournament_id', targetTournamentId)
        .eq('match_number', matchNumber);
    }
  };

  const saveRound = async (round: number, bracketCategory: BracketCategory) => {
    const roundMatches = brackets.filter(
      (m) => m.round === round && m.bracketCategory === bracketCategory,
    );

    if (roundMatches.length === 0) {
      return;
    }

    setSaving({ round, bracketCategory });

    // Check if all matches have winners
    const allHaveWinners = roundMatches.every((m) => m.winner !== null);
    if (!allHaveWinners) {
      setSaveErrorMessage(`Please mark winners for all matches in Round ${round} before saving.`);
      setSaveErrorModalOpen(true);
      setSaving(null);
      return;
    }

    let targetTournamentId = tournamentId;

    // If there's a tournament ID, verify it exists
    if (targetTournamentId) {
      const { data: existingTournament, error: checkError } = await supabase
        .from('tournaments')
        .select('id')
        .eq('id', targetTournamentId)
        .single();

      if (checkError || !existingTournament) {
        targetTournamentId = '';
        setTournamentId('');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('digibyte_current_tournament_id');
        }
      }
    }

    // If there's no tournament yet, create one
    if (!targetTournamentId) {
      const { data, error: createError } = await supabase
        .from('tournaments')
        .insert({
          title: `4 Teams Tournament ${new Date().toLocaleString()}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError || !data?.id) {
        setSaveErrorMessage('Error creating tournament record: ' + (createError?.message || 'Unknown error'));
        setSaveErrorModalOpen(true);
        setSaving(null);
        return;
      }

      targetTournamentId = data.id as string;
      setTournamentId(targetTournamentId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
      }
    }

    // Save all matches in this round
    const saveErrors: string[] = [];
    for (const match of roundMatches) {
      const winnerId =
        match.winner === 'team1'
          ? match.team1?.id || null
          : match.winner === 'team2'
            ? match.team2?.id || null
            : null;

      // Check if match exists in database
      const { data: existingMatch, error: checkError } = await supabase
        .from('brackets')
        .select('match_number')
        .eq('tournament_id', targetTournamentId)
        .eq('match_number', match.matchNumber)
        .maybeSingle();

      if (existingMatch && !checkError) {
        // Match exists, update it
        const { error: updateError } = await supabase
          .from('brackets')
          .update({ winner_id: winnerId })
          .eq('tournament_id', targetTournamentId)
          .eq('match_number', match.matchNumber);
        if (updateError) {
          console.error('Error updating match:', updateError);
          saveErrors.push(`Error updating match ${match.matchNumber}: ${updateError.message}`);
        }
      } else {
        // Match doesn't exist, insert it
        const { error: insertError } = await supabase
          .from('brackets')
          .insert({
            tournament_id: targetTournamentId,
            team1_id: match.team1?.id || null,
            team2_id: match.team2?.id || null,
            round: match.round,
            match_number: match.matchNumber,
            winner_id: winnerId,
            parent_match1: match.parentMatch1 || null,
            parent_match2: match.parentMatch2 || null,
          });
        if (insertError) {
          console.error('Error inserting match:', insertError);
          saveErrors.push(`Error inserting match ${match.matchNumber}: ${insertError.message}`);
        }
      }
    }

    // If there were any errors, show them and stop
    if (saveErrors.length > 0) {
      setSaveErrorMessage(`Failed to save some matches:\n${saveErrors.join('\n')}`);
      setSaveErrorModalOpen(true);
      setSaving(null);
      return;
    }

    // Generate next round based on bracket structure
    if (round === 1 && bracketCategory === 'upper') {
      await generateRound2(targetTournamentId, roundMatches);
    } else if (round === 2) {
      // Check if both Round 2 Upper and Lower are complete before generating Round 3
      const { data: round2Data } = await supabase
        .from('brackets')
        .select('winner_id')
        .eq('tournament_id', targetTournamentId)
        .eq('round', 2);

      if (round2Data && round2Data.length === 2 && round2Data.every((r: any) => r.winner_id)) {
        await generateRound3(targetTournamentId, roundMatches);
      }
    } else if (round === 3 && bracketCategory === 'lower') {
      await generateRound4(targetTournamentId, roundMatches);
    } else if (round === 4 && bracketCategory === 'upper') {
      // Final round - check for champion
      const finalMatch = roundMatches[0];
      if (finalMatch && finalMatch.winner) {
        const champion = finalMatch.winner === 'team1' ? finalMatch.team1 : finalMatch.team2;
        if (champion) {
          setChampionTeam(champion);
          setChampionModalOpen(true);
        }
      }
    }

    // Reload brackets from database
    await loadBrackets(targetTournamentId, teams);

    setSaveSuccessModalOpen(true);
    setTimeout(() => setSaveSuccessModalOpen(false), 2000);
    setSaving(null);
  };

  const generateRound2 = async (targetTournamentId: string, round1Matches: Match[]) => {
    // Get winners and losers from Round 1
    const winners = round1Matches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const winnerTeam = m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null;
        return { team: winnerTeam, parentMatch: m.matchNumber };
      })
      .filter((w) => w.team !== null);

    const losers = round1Matches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const loserTeam = m.winner === 'team1' ? m.team2 : m.winner === 'team2' ? m.team1 : null;
        return { team: loserTeam, parentMatch: m.matchNumber };
      })
      .filter((l) => l.team !== null);

    if (winners.length < 2 || losers.length < 2) {
      console.log('Not enough winners/losers to generate Round 2');
      return;
    }

    // Check if Round 2 already exists
    const { data: existingRound2 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 2);

    if (existingRound2 && existingRound2.length > 0) {
      console.log('Round 2 already exists');
      return;
    }

    const newMatches: Match[] = [];
    let nextMatchNumber = Math.max(...brackets.map((m) => m.matchNumber), 0) + 1;

    // Round 2 Upper: Winner of Match 1 vs Winner of Match 2
    newMatches.push({
      team1: winners[0].team,
      team2: winners[1].team,
      round: 2,
      matchNumber: nextMatchNumber++,
      bracketCategory: 'upper',
      winner: null,
      parentMatch1: winners[0].parentMatch,
      parentMatch2: winners[1].parentMatch,
    });

    // Round 2 Lower: Loser of Match 1 vs Loser of Match 2
    newMatches.push({
      team1: losers[0].team,
      team2: losers[1].team,
      round: 2,
      matchNumber: nextMatchNumber++,
      bracketCategory: 'lower',
      winner: null,
      parentMatch1: losers[0].parentMatch,
      parentMatch2: losers[1].parentMatch,
    });

    // Save new matches to database
    const bracketData = newMatches.map((m) => ({
      tournament_id: targetTournamentId,
      team1_id: m.team1?.id || null,
      team2_id: m.team2?.id || null,
      round: m.round,
      match_number: m.matchNumber,
      winner_id: null,
      parent_match1: m.parentMatch1 || null,
      parent_match2: m.parentMatch2 || null,
    }));

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Round 2 matches:', insertError);
      return;
    }

    console.log(`Successfully created ${newMatches.length} matches for Round 2`);
  };

  const generateRound3 = async (targetTournamentId: string, round2Matches: Match[]) => {
    // Check if Round 3 already exists
    const { data: existingRound3 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 3);

    if (existingRound3 && existingRound3.length > 0) {
      console.log('Round 3 already exists');
      return;
    }

    // Get Round 2 Upper and Lower results
    const { data: round2Data } = await supabase
      .from('brackets')
      .select('*')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 2)
      .order('match_number', { ascending: true });

    if (!round2Data || round2Data.length < 2) {
      console.log('Round 2 not complete');
      return;
    }

    // Find upper and lower bracket matches
    // Upper bracket match should have lower match_number (generated first)
    const round2Upper = round2Data.find((r: any) => r.match_number === Math.min(...round2Data.map((d: any) => d.match_number)));
    const round2Lower = round2Data.find((r: any) => r.match_number === Math.max(...round2Data.map((d: any) => d.match_number)));

    if (!round2Upper?.winner_id || !round2Lower?.winner_id) {
      console.log('Round 2 matches not completed');
      return;
    }

    const upperWinner = round2Upper.winner_id === round2Upper.team1_id ? round2Upper.team1_id : round2Upper.team2_id;
    const upperLoser = round2Upper.winner_id === round2Upper.team1_id ? round2Upper.team2_id : round2Upper.team1_id;
    const lowerWinner = round2Lower.winner_id === round2Lower.team1_id ? round2Lower.team1_id : round2Lower.team2_id;

    const nextMatchNumber = Math.max(...brackets.map((m) => m.matchNumber), 0) + 1;

    // Round 3: Winner of Lower Round 2 vs Loser of Upper Round 2
    const newMatch: Match = {
      team1: teams.find((t) => t.id === lowerWinner) || null,
      team2: teams.find((t) => t.id === upperLoser) || null,
      round: 3,
      matchNumber: nextMatchNumber,
      bracketCategory: 'lower',
      winner: null,
      parentMatch1: round2Lower.match_number,
      parentMatch2: round2Upper.match_number,
    };

    // Save new match to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: newMatch.team1?.id || null,
      team2_id: newMatch.team2?.id || null,
      round: newMatch.round,
      match_number: newMatch.matchNumber,
      winner_id: null,
      parent_match1: newMatch.parentMatch1 || null,
      parent_match2: newMatch.parentMatch2 || null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Round 3 match:', insertError);
      return;
    }

    console.log('Successfully created Round 3 match');
  };

  const generateRound4 = async (targetTournamentId: string, round3Matches: Match[]) => {
    // Check if Round 4 already exists
    const { data: existingRound4 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 4);

    if (existingRound4 && existingRound4.length > 0) {
      console.log('Round 4 already exists');
      return;
    }

    // Get Round 3 winner and Round 2 Upper winner
    const { data: round3Data } = await supabase
      .from('brackets')
      .select('*')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 3)
      .single();

    const { data: round2AllData } = await supabase
      .from('brackets')
      .select('*')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 2)
      .order('match_number', { ascending: true });

    const round2UpperData = round2AllData?.find((r: any) => r.match_number === Math.min(...(round2AllData?.map((d: any) => d.match_number) || [])));

    if (!round3Data?.winner_id || !round2UpperData?.winner_id) {
      console.log('Previous rounds not complete');
      return;
    }

    const round3Winner = round3Data.winner_id;
    const round2UpperWinner = round2UpperData.winner_id;

    const nextMatchNumber = Math.max(...brackets.map((m) => m.matchNumber), 0) + 1;

    // Round 4 Final: Winner of Round 3 vs Winner of Upper Round 2
    const newMatch: Match = {
      team1: teams.find((t) => t.id === round3Winner) || null,
      team2: teams.find((t) => t.id === round2UpperWinner) || null,
      round: 4,
      matchNumber: nextMatchNumber,
      bracketCategory: 'upper',
      winner: null,
      parentMatch1: round3Data.match_number,
      parentMatch2: round2UpperData.match_number,
    };

    // Save new match to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: newMatch.team1?.id || null,
      team2_id: newMatch.team2?.id || null,
      round: newMatch.round,
      match_number: newMatch.matchNumber,
      winner_id: null,
      parent_match1: newMatch.parentMatch1 || null,
      parent_match2: newMatch.parentMatch2 || null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Round 4 match:', insertError);
      return;
    }

    console.log('Successfully created Round 4 match');
  };

  const handleCancelRoundClick = (round: number, bracketCategory: BracketCategory) => {
    setCancelRoundData({ round, bracketCategory });
    setCancelRoundModalOpen(true);
  };

  const cancelRound = async () => {
    if (!cancelRoundData || !tournamentId) return;

    const { round, bracketCategory } = cancelRoundData;

    // Delete all matches from this round onwards
    const { error } = await supabase
      .from('brackets')
      .delete()
      .eq('tournament_id', tournamentId)
      .gte('round', round);

    if (error) {
      console.error('Error canceling round:', error);
      setSaveErrorMessage('Error canceling round: ' + error.message);
      setSaveErrorModalOpen(true);
    } else {
      // Reload brackets
      await loadBrackets(tournamentId, teams);
    }

    setCancelRoundModalOpen(false);
    setCancelRoundData(null);
  };

  const round1Matches = brackets.filter((m) => m.round === 1);
  const round2Upper = brackets.find((m) => m.round === 2 && m.bracketCategory === 'upper');
  const round2Lower = brackets.find((m) => m.round === 2 && m.bracketCategory === 'lower');
  const round3 = brackets.find((m) => m.round === 3);
  const round4 = brackets.find((m) => m.round === 4);

  const round1AllHaveWinners = round1Matches.length > 0 && round1Matches.every((m) => m.winner !== null);
  const round2UpperHasWinner = round2Upper?.winner !== null;
  const round2LowerHasWinner = round2Lower?.winner !== null;
  const round3HasWinner = round3?.winner !== null;
  const round4HasWinner = round4?.winner !== null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">
            4 Teams <span className="text-blue-400">Double Elimination</span>
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm">Generate bracket for 4 randomly generated teams</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={generateBrackets}
            disabled={teams.filter((t) => t.team_members && t.team_members.length > 0).length < 4}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
            Generate Bracket
          </button>
        </div>
      </div>

      {brackets.length === 0 && (
        <div className="text-center py-8 sm:py-12 text-gray-400">
          <Trophy className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
          <p className="text-sm sm:text-base">No bracket generated yet. Click "Generate Bracket" to start.</p>
          {teams.filter((t) => t.team_members && t.team_members.length > 0).length < 4 && (
            <p className="text-xs sm:text-sm text-yellow-400 mt-2">You need at least 4 teams with members to generate a bracket.</p>
          )}
        </div>
      )}

      {brackets.length > 0 && (
        <div className="space-y-6 sm:space-y-8">
          {/* Round 1 */}
          {round1Matches.length > 0 && (
            <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-3 sm:p-4 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">Round 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {round1Matches.map((match) => (
                  <div
                    key={match.matchNumber}
                    className={`bg-black/30 border rounded-lg p-3 sm:p-4 ${
                      match.winner === 'team1'
                        ? 'glow-green-border bg-green-900/10 border-green-500/50'
                        : match.winner === 'team2'
                          ? 'glow-green-border bg-green-900/10 border-green-500/50'
                          : 'border-blue-500/20'
                    }`}
                  >
                    <div className="text-blue-400 text-xs sm:text-sm mb-2 sm:mb-3">Match {match.matchNumber}</div>
                    <div className="space-y-1.5 sm:space-y-2">
                      {/* Team 1 */}
                      <div
                        className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                          match.winner === 'team1'
                            ? 'glow-green-border bg-green-900/10'
                            : match.winner === 'team2'
                              ? 'glow-red-border bg-red-900/10'
                              : 'bg-gray-800/50 border-gray-700'
                        }`}
                      >
                        <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                          {match.team1?.team_name || 'BYE'}
                          {match.team1 && teamStandings[match.team1.id] && (
                            <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                              ({teamStandings[match.team1.id].wins}W-{teamStandings[match.team1.id].losses}L)
                            </span>
                          )}
                        </span>
                        {match.team1 && (
                          <button
                            type="button"
                            onClick={() => setWinner(match.matchNumber, 'team1', match.bracketCategory)}
                            className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
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

                      <div className="text-center text-gray-500 text-[10px] sm:text-xs">VS</div>

                      {/* Team 2 */}
                      <div
                        className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                          match.winner === 'team2'
                            ? 'glow-green-border bg-green-900/10'
                            : match.winner === 'team1'
                              ? 'glow-red-border bg-red-900/10'
                              : 'bg-gray-800/50 border-gray-700'
                        }`}
                      >
                        <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                          {match.team2?.team_name || 'BYE'}
                          {match.team2 && teamStandings[match.team2.id] && (
                            <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                              ({teamStandings[match.team2.id].wins}W-{teamStandings[match.team2.id].losses}L)
                            </span>
                          )}
                        </span>
                        {match.team2 && (
                          <button
                            type="button"
                            onClick={() => setWinner(match.matchNumber, 'team2', match.bracketCategory)}
                            className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
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
              <div className="flex items-center justify-end gap-2 mt-3 sm:mt-4">
                {round1AllHaveWinners && (
                  <button
                    type="button"
                    onClick={() => handleCancelRoundClick(1, 'upper')}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Cancel Round 1</span>
                  </button>
                )}
                {round1AllHaveWinners && (
                  <button
                    type="button"
                    onClick={() => saveRound(1, 'upper')}
                    disabled={saving?.round === 1 && saving?.bracketCategory === 'upper'}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-1.5 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    {saving?.round === 1 && saving?.bracketCategory === 'upper' ? (
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    <span>{saving?.round === 1 && saving?.bracketCategory === 'upper' ? 'Saving...' : 'Save Round 1'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Round 2 Upper */}
          {round2Upper && round1AllHaveWinners && (
            <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-3 sm:p-4 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">Round 2 - Upper Bracket</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div
                  className={`bg-black/30 border rounded-lg p-3 sm:p-4 ${
                    round2Upper.winner === 'team1' || round2Upper.winner === 'team2'
                      ? 'glow-green-border bg-green-900/10 border-green-500/50'
                      : 'border-blue-500/20'
                  }`}
                >
                  <div className="text-blue-400 text-xs sm:text-sm mb-2 sm:mb-3">Match {round2Upper.matchNumber}</div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round2Upper.winner === 'team1'
                          ? 'glow-green-border bg-green-900/10'
                          : round2Upper.winner === 'team2'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round2Upper.team1?.team_name || 'TBD'}
                        {round2Upper.team1 && teamStandings[round2Upper.team1.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round2Upper.team1.id].wins}W-{teamStandings[round2Upper.team1.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round2Upper.team1 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round2Upper.matchNumber, 'team1', round2Upper.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round2Upper.winner === 'team1'
                              ? 'bg-green-600 text-white border-green-400'
                              : round2Upper.winner === 'team2'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round2Upper.winner === 'team1' ? 'W' : round2Upper.winner === 'team2' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                    <div className="text-center text-gray-500 text-[10px] sm:text-xs">VS</div>
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round2Upper.winner === 'team2'
                          ? 'glow-green-border bg-green-900/10'
                          : round2Upper.winner === 'team1'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round2Upper.team2?.team_name || 'TBD'}
                        {round2Upper.team2 && teamStandings[round2Upper.team2.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round2Upper.team2.id].wins}W-{teamStandings[round2Upper.team2.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round2Upper.team2 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round2Upper.matchNumber, 'team2', round2Upper.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round2Upper.winner === 'team2'
                              ? 'bg-green-600 text-white border-green-400'
                              : round2Upper.winner === 'team1'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round2Upper.winner === 'team2' ? 'W' : round2Upper.winner === 'team1' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 sm:mt-4">
                {round2UpperHasWinner && (
                  <button
                    type="button"
                    onClick={() => handleCancelRoundClick(2, 'upper')}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Cancel Round 2</span>
                  </button>
                )}
                {round2UpperHasWinner && (
                  <button
                    type="button"
                    onClick={() => saveRound(2, 'upper')}
                    disabled={saving?.round === 2 && saving?.bracketCategory === 'upper'}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-1.5 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    {saving?.round === 2 && saving?.bracketCategory === 'upper' ? (
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    <span>{saving?.round === 2 && saving?.bracketCategory === 'upper' ? 'Saving...' : 'Save Round 2 (Upper)'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Round 2 Lower */}
          {round2Lower && round1AllHaveWinners && (
            <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-3 sm:p-4 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">Round 2 - Lower Bracket</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div
                  className={`bg-black/30 border rounded-lg p-3 sm:p-4 ${
                    round2Lower.winner === 'team1' || round2Lower.winner === 'team2'
                      ? 'glow-green-border bg-green-900/10 border-green-500/50'
                      : 'border-blue-500/20'
                  }`}
                >
                  <div className="text-blue-400 text-xs sm:text-sm mb-2 sm:mb-3">Match {round2Lower.matchNumber}</div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round2Lower.winner === 'team1'
                          ? 'glow-green-border bg-green-900/10'
                          : round2Lower.winner === 'team2'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round2Lower.team1?.team_name || 'TBD'}
                        {round2Lower.team1 && teamStandings[round2Lower.team1.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round2Lower.team1.id].wins}W-{teamStandings[round2Lower.team1.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round2Lower.team1 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round2Lower.matchNumber, 'team1', round2Lower.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round2Lower.winner === 'team1'
                              ? 'bg-green-600 text-white border-green-400'
                              : round2Lower.winner === 'team2'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round2Lower.winner === 'team1' ? 'W' : round2Lower.winner === 'team2' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                    <div className="text-center text-gray-500 text-[10px] sm:text-xs">VS</div>
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round2Lower.winner === 'team2'
                          ? 'glow-green-border bg-green-900/10'
                          : round2Lower.winner === 'team1'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round2Lower.team2?.team_name || 'TBD'}
                        {round2Lower.team2 && teamStandings[round2Lower.team2.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round2Lower.team2.id].wins}W-{teamStandings[round2Lower.team2.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round2Lower.team2 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round2Lower.matchNumber, 'team2', round2Lower.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round2Lower.winner === 'team2'
                              ? 'bg-green-600 text-white border-green-400'
                              : round2Lower.winner === 'team1'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round2Lower.winner === 'team2' ? 'W' : round2Lower.winner === 'team1' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 sm:mt-4">
                {round2LowerHasWinner && (
                  <button
                    type="button"
                    onClick={() => handleCancelRoundClick(2, 'lower')}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Cancel Round 2</span>
                  </button>
                )}
                {round2LowerHasWinner && (
                  <button
                    type="button"
                    onClick={() => saveRound(2, 'lower')}
                    disabled={saving?.round === 2 && saving?.bracketCategory === 'lower'}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-1.5 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    {saving?.round === 2 && saving?.bracketCategory === 'lower' ? (
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    <span>{saving?.round === 2 && saving?.bracketCategory === 'lower' ? 'Saving...' : 'Save Round 2 (Lower)'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Round 3 */}
          {round3 && round2UpperHasWinner && round2LowerHasWinner && (
            <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-3 sm:p-4 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">Round 3 - Lower Bracket Final</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div
                  className={`bg-black/30 border rounded-lg p-3 sm:p-4 ${
                    round3.winner === 'team1' || round3.winner === 'team2'
                      ? 'glow-green-border bg-green-900/10 border-green-500/50'
                      : 'border-blue-500/20'
                  }`}
                >
                  <div className="text-blue-400 text-xs sm:text-sm mb-2 sm:mb-3">Match {round3.matchNumber}</div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round3.winner === 'team1'
                          ? 'glow-green-border bg-green-900/10'
                          : round3.winner === 'team2'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round3.team1?.team_name || 'TBD'}
                        {round3.team1 && teamStandings[round3.team1.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round3.team1.id].wins}W-{teamStandings[round3.team1.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round3.team1 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round3.matchNumber, 'team1', round3.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round3.winner === 'team1'
                              ? 'bg-green-600 text-white border-green-400'
                              : round3.winner === 'team2'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round3.winner === 'team1' ? 'W' : round3.winner === 'team2' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                    <div className="text-center text-gray-500 text-[10px] sm:text-xs">VS</div>
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round3.winner === 'team2'
                          ? 'glow-green-border bg-green-900/10'
                          : round3.winner === 'team1'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round3.team2?.team_name || 'TBD'}
                        {round3.team2 && teamStandings[round3.team2.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round3.team2.id].wins}W-{teamStandings[round3.team2.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round3.team2 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round3.matchNumber, 'team2', round3.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round3.winner === 'team2'
                              ? 'bg-green-600 text-white border-green-400'
                              : round3.winner === 'team1'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round3.winner === 'team2' ? 'W' : round3.winner === 'team1' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 sm:mt-4">
                {round3HasWinner && (
                  <button
                    type="button"
                    onClick={() => handleCancelRoundClick(3, 'lower')}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Cancel Round 3</span>
                  </button>
                )}
                {round3HasWinner && (
                  <button
                    type="button"
                    onClick={() => saveRound(3, 'lower')}
                    disabled={saving?.round === 3 && saving?.bracketCategory === 'lower'}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-1.5 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    {saving?.round === 3 && saving?.bracketCategory === 'lower' ? (
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    <span>{saving?.round === 3 && saving?.bracketCategory === 'lower' ? 'Saving...' : 'Save Round 3'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Round 4 - Final */}
          {round4 && round3HasWinner && (
            <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-2 border-yellow-500/50 rounded-lg p-4 sm:p-6 md:p-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400 mb-4 sm:mb-6 text-center">
                Round 4 - Grand Final 🏆
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div
                  className={`bg-black/30 border-2 rounded-lg p-3 sm:p-4 ${
                    round4.winner === 'team1' || round4.winner === 'team2'
                      ? 'glow-green-border bg-green-900/10 border-green-500'
                      : 'border-yellow-500/50'
                  }`}
                >
                  <div className="text-yellow-400 text-xs sm:text-sm mb-2 sm:mb-3">Match {round4.matchNumber}</div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round4.winner === 'team1'
                          ? 'glow-green-border bg-green-900/10'
                          : round4.winner === 'team2'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round4.team1?.team_name || 'TBD'}
                        {round4.team1 && teamStandings[round4.team1.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round4.team1.id].wins}W-{teamStandings[round4.team1.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round4.team1 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round4.matchNumber, 'team1', round4.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round4.winner === 'team1'
                              ? 'bg-green-600 text-white border-green-400'
                              : round4.winner === 'team2'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round4.winner === 'team1' ? 'W' : round4.winner === 'team2' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                    <div className="text-center text-gray-500 text-[10px] sm:text-xs">VS</div>
                    <div
                      className={`flex items-center justify-between p-2 sm:p-2.5 md:p-3 rounded border ${
                        round4.winner === 'team2'
                          ? 'glow-green-border bg-green-900/10'
                          : round4.winner === 'team1'
                            ? 'glow-red-border bg-red-900/10'
                            : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <span className="text-white font-semibold text-xs sm:text-sm md:text-base truncate flex-1">
                        {round4.team2?.team_name || 'TBD'}
                        {round4.team2 && teamStandings[round4.team2.id] && (
                          <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                            ({teamStandings[round4.team2.id].wins}W-{teamStandings[round4.team2.id].losses}L)
                          </span>
                        )}
                      </span>
                      {round4.team2 && (
                        <button
                          type="button"
                          onClick={() => setWinner(round4.matchNumber, 'team2', round4.bracketCategory)}
                          className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md text-[10px] sm:text-xs font-bold border transition-colors flex-shrink-0 ${
                            round4.winner === 'team2'
                              ? 'bg-green-600 text-white border-green-400'
                              : round4.winner === 'team1'
                                ? 'bg-red-900/40 text-red-400 border-red-500'
                                : 'bg-gray-900 text-green-300 border-green-500/40 hover:bg-green-700/60 hover:text-white'
                          }`}
                        >
                          {round4.winner === 'team2' ? 'W' : round4.winner === 'team1' ? 'L' : 'W'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 sm:mt-4">
                {round4HasWinner && (
                  <button
                    type="button"
                    onClick={() => handleCancelRoundClick(4, 'upper')}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Cancel Round 4</span>
                  </button>
                )}
                {round4HasWinner && (
                  <button
                    type="button"
                    onClick={() => saveRound(4, 'upper')}
                    disabled={saving?.round === 4 && saving?.bracketCategory === 'upper'}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-1.5 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    {saving?.round === 4 && saving?.bracketCategory === 'upper' ? (
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    <span>{saving?.round === 4 && saving?.bracketCategory === 'upper' ? 'Saving...' : 'Save Round 4 (Final)'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmGenerateOpen}
        title="Regenerate Bracket?"
        message="This will overwrite the current bracket. Are you sure?"
        confirmLabel="Yes, Regenerate"
        cancelLabel="Cancel"
        onConfirm={confirmGenerate}
        onCancel={() => setConfirmGenerateOpen(false)}
      />

      <ConfirmModal
        open={cancelRoundModalOpen}
        title="Cancel Round?"
        message={`This will delete Round ${cancelRoundData?.round} and all subsequent rounds. Are you sure?`}
        confirmLabel="Yes, Cancel"
        cancelLabel="No, Keep It"
        onConfirm={cancelRound}
        onCancel={() => setCancelRoundModalOpen(false)}
      />

      {/* Champion Modal */}
      {championModalOpen && championTeam && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-yellow-900/90 to-orange-900/90 border-2 border-yellow-500 rounded-xl p-6 sm:p-8 md:p-12 max-w-md w-full text-center animate-fade-in">
            <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 text-yellow-400" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
              🎉 Congratulations! 🎉
            </h2>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400 mb-2 sm:mb-3">
              {championTeam.team_name}
            </h3>
            <p className="text-gray-200 text-sm sm:text-base mb-6 sm:mb-8">
              You are the Champions!
            </p>
            <button
              onClick={() => setChampionModalOpen(false)}
              className="px-6 py-2 sm:px-8 sm:py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {saveSuccessModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-green-900/90 border border-green-500 rounded-lg p-6 text-center">
            <p className="text-green-400 font-semibold">Round saved successfully!</p>
          </div>
        </div>
      )}

      {/* Error Modal */}
      <ConfirmModal
        open={saveErrorModalOpen}
        title="Error Saving Round"
        message={saveErrorMessage}
        confirmLabel="OK"
        onConfirm={() => setSaveErrorModalOpen(false)}
        hideCancel
      />
    </div>
  );
}
