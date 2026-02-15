import { useState, useEffect, useMemo } from 'react';
import { Shuffle, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, Team } from '../../lib/supabase';
import ConfirmModal from '../ConfirmModal';

type BracketNumber = 1 | 2;
type WinnerSide = 'team1' | 'team2' | null;
type BracketType = '1-bracket' | '2-brackets';
type BracketCategory = 'upper' | 'lower';

interface Match {
  team1: Team | null;
  team2: Team | null;
  round: number;
  matchNumber: number;
  bracket: BracketNumber;
  bracketCategory: BracketCategory; // 'upper' or 'lower'
  winner: WinnerSide;
  parentMatch1?: number; // Match number in previous round that feeds team1
  parentMatch2?: number; // Match number in previous round that feeds team2
}

export default function BracketGeneratorPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [brackets, setBrackets] = useState<Match[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [bracketType, setBracketType] = useState<BracketType>('2-brackets');
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false);
  const [saveErrorModalOpen, setSaveErrorModalOpen] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [cancelRoundModalOpen, setCancelRoundModalOpen] = useState(false);
  const [cancelRoundData, setCancelRoundData] = useState<{ round: number; bracket: BracketNumber; bracketCategory?: BracketCategory } | null>(null);
  const [championModalOpen, setChampionModalOpen] = useState(false);
  const [championTeam, setChampionTeam] = useState<Team | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set()); // Track expanded rounds: "upper-round-2" or "lower-round-2"

  const toggleRound = (roundKey: string) => {
    setExpandedRounds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roundKey)) {
        newSet.delete(roundKey);
      } else {
        newSet.add(roundKey);
      }
      return newSet;
    });
  };

  // Calculate team standings (wins and losses)
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

    // Try to restore bracket type from localStorage, otherwise default to 2-brackets
    let detectedBracketType: BracketType = '2-brackets';
    if (typeof window !== 'undefined') {
      const storedType = window.localStorage.getItem('digibyte_bracket_type');
      if (storedType === '1-bracket' || storedType === '2-brackets') {
        detectedBracketType = storedType as BracketType;
      }
    }
    const is1Bracket = detectedBracketType === '1-bracket';
    if (is1Bracket) {
      setBracketType('1-bracket');
    } else {
      setBracketType('2-brackets');
    }

    // For 2-bracket system, determine bracket assignments
    // Round 1: matches 1-4 = bracket 1, matches 5-8 = bracket 2
    // Later rounds: use simple heuristic based on match position in round
    const getBracketForMatch = (row: any): BracketNumber => {
      if (is1Bracket) return 1;
      if (row.round === 1) {
        return row.match_number <= 4 ? 1 : 2;
      }
      // For later rounds, use match position: lower half = bracket 1, upper half = bracket 2
      const roundMatches = data.filter((m: any) => m.round === row.round);
      const sortedRoundMatches = roundMatches.sort((a: any, b: any) => a.match_number - b.match_number);
      const midPoint = Math.ceil(sortedRoundMatches.length / 2);
      return row.match_number <= sortedRoundMatches[midPoint - 1]?.match_number ? 1 : 2;
    };

    // Helper function to determine bracket category
    const determineBracketCategory = (round: number, matchNumber: number, allMatches: any[]): BracketCategory => {
      // Round 1 is always upper bracket
      if (round === 1) return 'upper';
      
      // Round 3+ is always upper bracket
      if (round >= 3) return 'upper';
      
      // For Round 2, determine based on match number
      // Lower bracket matches come after upper bracket round 2 matches
      // Upper bracket Round 2: 4 matches for 1-bracket system, 4 matches (2 per bracket) for 2-bracket system
      const round2Matches = allMatches.filter((m: any) => m.round === 2).sort((a: any, b: any) => a.match_number - b.match_number);
      
      // Upper bracket round 2 should have 4 matches (either 4 from 1 bracket or 2+2 from 2 brackets)
      // Lower bracket matches will have match numbers higher than the 4th upper bracket match
      if (round2Matches.length >= 4) {
        const upperRound2LastMatch = round2Matches[3]?.match_number || 0;
        if (matchNumber > upperRound2LastMatch) {
          return 'lower';
        }
      }
      
      return 'upper';
    };

    const loaded: Match[] = data.map((row: any) => {
      const bracketNum = getBracketForMatch(row);
      // Determine bracket category dynamically
      const bracketCategory: BracketCategory = determineBracketCategory(row.round, row.match_number, data);

      return {
        team1: findTeam(row.team1_id),
        team2: findTeam(row.team2_id),
        round: row.round,
        matchNumber: row.match_number,
        bracket: bracketNum,
        bracketCategory,
        winner: row.winner_id
          ? row.winner_id === row.team1_id
            ? 'team1'
            : row.winner_id === row.team2_id
              ? 'team2'
              : null
          : null,
      };
    });

    setBrackets(loaded);
    setBracketType(detectedBracketType);
  };

  // Load teams on initial mount and restore bracket type preference
  useEffect(() => {
    loadTeams();
    
    // Restore bracket type preference from localStorage
    if (typeof window !== 'undefined') {
      const storedType = window.localStorage.getItem('digibyte_bracket_type');
      if (storedType === '1-bracket' || storedType === '2-brackets') {
        setBracketType(storedType as BracketType);
      }
    }
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

    // For this tournament, we expect exactly 16 paid teams
    if (paidTeams.length !== 16) {
      alert(`This tournament format requires exactly 16 paid teams.\nCurrently you have ${paidTeams.length} paid team(s).`);
      return;
    }

    const shuffled = [...paidTeams].sort(() => Math.random() - 0.5);

    const matches: Match[] = [];
    let matchNumber = 1;

    if (bracketType === '1-bracket') {
      // 1 Bracket System: All 16 teams in one bracket (8 matches)
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({
        team1: shuffled[i],
        team2: shuffled[i + 1] || null,
        round: 1,
        matchNumber: matchNumber++,
          bracket: 1,
          bracketCategory: 'upper',
          winner: null,
        });
      }
    } else {
      // 2 Brackets System: Split 16 teams into 2 brackets (4 matches each)
      const bracket1Teams = shuffled.slice(0, 8);
      const bracket2Teams = shuffled.slice(8, 16);

      const buildMatchesForBracket = (bracketTeams: Team[], bracketNumber: BracketNumber) => {
        for (let i = 0; i < bracketTeams.length; i += 2) {
          matches.push({
            team1: bracketTeams[i],
            team2: bracketTeams[i + 1] || null,
            round: 1,
            matchNumber: matchNumber++,
            bracket: bracketNumber,
            bracketCategory: 'upper',
            winner: null,
          });
        }
      };

      buildMatchesForBracket(bracket1Teams, 1);
      buildMatchesForBracket(bracket2Teams, 2);
    }

    setBrackets(matches);
  };

  const generateBrackets = () => {
    // If there are existing brackets (saved or with winners), open confirmation modal
    const hasExistingResults = brackets.some((match) => match.winner !== null);
    const hasSavedBrackets = brackets.length > 0 && tournamentId !== '';
    
    if (hasExistingResults || hasSavedBrackets) {
      setConfirmGenerateOpen(true);
      return;
    }

    generateBracketsInternal();
  };

  const setWinner = async (matchNumber: number, bracket: BracketNumber, side: WinnerSide, bracketCategory?: BracketCategory) => {
    // Determine bracket category if not provided
    let category: BracketCategory = bracketCategory || 'upper';
    if (!bracketCategory) {
      const existingMatch = brackets.find((m) => m.matchNumber === matchNumber && m.bracket === bracket);
      if (existingMatch) {
        category = existingMatch.bracketCategory || 'upper';
      }
    }

    // Update local state immediately for UI feedback
    const updatedBrackets = brackets.map((match) => {
      if (match.matchNumber !== matchNumber || match.bracket !== bracket || match.bracketCategory !== category) return match;

      // If clicking the same winner again, clear selection; otherwise set new winner
      const newWinner: WinnerSide = match.winner === side ? null : side;
      return { ...match, winner: newWinner };
    });

    setBrackets(updatedBrackets);

    // Auto-save to database in the background
    const match = updatedBrackets.find(
      (m) => m.matchNumber === matchNumber && m.bracket === bracket && m.bracketCategory === category,
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
          title: `Tournament ${new Date().toLocaleString()}`,
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
        window.localStorage.setItem('digibyte_bracket_type', bracketType);
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

    // Don't auto-generate next round - user will click "Save Round" button
  };

  const saveRound = async (round: number, bracket: BracketNumber) => {
    // Determine bracket category from the matches
    const roundMatches = brackets.filter(
      (m) => m.round === round && m.bracket === bracket,
    );
    
    if (roundMatches.length === 0) return;
    
    const bracketCategory = roundMatches[0].bracketCategory || 'upper';

    // Check if all matches have winners
    const allHaveWinners = roundMatches.every((m) => m.winner !== null);
    if (!allHaveWinners) {
      setSaveErrorMessage(`Please mark winners for all matches in Round ${round} before saving.`);
      setSaveErrorModalOpen(true);
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
          title: `Tournament ${new Date().toLocaleString()}`,
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
        window.localStorage.setItem('digibyte_bracket_type', bracketType);
      }
    }

    // Save all matches in this round
    for (const match of roundMatches) {
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
        .eq('match_number', match.matchNumber);
    }

    // Update brackets state with saved winners and get updated brackets for next operations
    // Compute updated brackets directly (setBrackets is async)
    let updatedBrackets: Match[] = [];
    setBrackets((prev) => {
      updatedBrackets = prev.map((m) => {
        const updatedMatch = roundMatches.find((rm) => rm.matchNumber === m.matchNumber);
        return updatedMatch || m;
      });
      return updatedBrackets;
    });

    // Get bracket category for this round (already determined above)

    // Generate next round if applicable - use updated brackets
    await generateNextRoundIfComplete(updatedBrackets, targetTournamentId, round, bracket);
    
    // If Round 2 (upper bracket) is saved, generate Lower Bracket Round 2 from losers
    if (round === 2 && bracketCategory === 'upper') {
      // Use updated brackets to check for existing lower bracket Round 2
      const lowerBracketRound2Exists = updatedBrackets.some((m) => m.round === 2 && m.bracketCategory === 'lower');
      if (!lowerBracketRound2Exists) {
        await generateLowerBracketFromRound2Losers(targetTournamentId, updatedBrackets);
      }
    }
    
    // If Lower Bracket Round 2 is saved, generate Lower Bracket Round 2 Semi-Final (match up the 2 winners)
    if (round === 2 && bracketCategory === 'lower') {
      // Check database first to see if semi-final already exists
      const { data: existingSemiFinal } = await supabase
        .from('brackets')
        .select('match_number')
        .eq('tournament_id', targetTournamentId)
        .eq('round', 2.5);
      
      // Check if semi-final already exists in state
      const semiFinalExistsInState = updatedBrackets.some((m) => m.round === 2.5 && m.bracketCategory === 'lower');
      
      if (!semiFinalExistsInState && (!existingSemiFinal || existingSemiFinal.length === 0)) {
        // Use the roundMatches that were just saved (they have the winners)
        await generateLowerBracketRound2SemiFinal(targetTournamentId, roundMatches);
      } else {
        console.log('Lower Bracket Round 2 Semi-Final already exists, skipping generation');
      }
    }

    // If Lower Bracket Round 2 Semi-Final is saved, check if Lower Bracket Round 3 is complete to generate Lower Bracket Finals
    if (round === 2.5 && bracketCategory === 'lower') {
      const lowerBracketRound3Match = updatedBrackets.find(
        (m) => m.round === 3 && m.bracketCategory === 'lower',
      );
      if (lowerBracketRound3Match?.winner !== null) {
        await generateLowerBracketFinal(targetTournamentId);
      }
    }

    // If Round 3 (upper bracket) is saved, generate Lower Bracket Round 3 from losers and Round 4
    if (round === 3 && bracketCategory === 'upper') {
      await generateLowerBracketRound3FromRound3Losers(targetTournamentId, updatedBrackets);
      await generateRound4FromRound3AndLowerBracket(targetTournamentId, updatedBrackets);
    }

    // If Lower Bracket Round 3 is saved, check if Lower Bracket Round 2 Semi-Final is complete to generate Lower Bracket Finals
    if (round === 3 && bracketCategory === 'lower') {
      const lowerBracketRound2SemiFinal = updatedBrackets.find(
        (m) => m.round === 2.5 && m.bracketCategory === 'lower',
      );
      if (lowerBracketRound2SemiFinal?.winner !== null) {
        await generateLowerBracketFinal(targetTournamentId);
      }
    }

    // If Lower Bracket Final is saved, check if Round 4 is complete to generate Final Round
    if (round === 3.5 && bracketCategory === 'lower') {
      const round4Match = updatedBrackets.find(
        (m) => m.round === 4 && m.bracketCategory === 'upper',
      );
      if (round4Match?.winner !== null) {
        await generateFinalRoundFromRound4(targetTournamentId);
      }
    }

    // If Round 4 is saved, check if Lower Bracket Final is complete to generate Final Round
    if (round === 4 && bracketCategory === 'upper') {
      const lowerBracketFinalMatch = updatedBrackets.find(
        (m) => m.round === 3.5 && m.bracketCategory === 'lower',
      );
      if (lowerBracketFinalMatch?.winner !== null) {
        await generateFinalRoundFromRound4(targetTournamentId);
      }
    }
    
    // Automatically collapse the round when it's saved
    const roundKey = bracketCategory === 'lower' ? `lower-round-${round}` : `upper-round-${round}`;
    setExpandedRounds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(roundKey); // Remove from expanded set to collapse it
      return newSet;
    });

    // Check if this is the Final Round (Championship) and show champion modal
    if (round === 5 && bracketCategory === 'upper' && allHaveWinners) {
      const finalMatch = roundMatches.find((m) => m.round === 5 && m.bracketCategory === 'upper');
      if (finalMatch) {
        const champion = finalMatch.winner === 'team1' ? finalMatch.team1 : finalMatch.team2;
        if (champion) {
          setChampionTeam(champion);
          setChampionModalOpen(true);
          setSaveSuccessModalOpen(false); // Don't show regular success modal, show champion modal instead
          return; // Exit early to prevent showing success modal
        }
      }
    }
    
    setSaveSuccessModalOpen(true);
    setSaving(false);
  };

  const generateNextRoundIfComplete = async (
    currentBrackets: Match[],
    targetTournamentId: string,
    completedRound: number,
    bracketNum: BracketNumber,
  ) => {
    // Check the specific round and bracket that was just completed (only upper bracket)
    const roundMatches = currentBrackets.filter(
      (m) => m.round === completedRound && m.bracket === bracketNum && m.bracketCategory === 'upper',
    );

    // Check if next round already exists
    const nextRound = completedRound + 1;
    const nextRoundExists = currentBrackets.some(
      (m) => m.round === nextRound && m.bracket === bracketNum && m.bracketCategory === 'upper',
    );

    if (nextRoundExists) return;

    // Generate next round matches
    const winners = roundMatches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const winnerTeam =
          m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null;
        return { team: winnerTeam, parentMatch: m.matchNumber };
      })
      .filter((w) => w.team !== null);

    // Only create next round if we have at least 2 winners
    if (winners.length < 2) return;

    // Remove duplicate teams (same team ID)
    const uniqueWinners = winners.filter((w, index, self) => 
      index === self.findIndex((t) => t.team?.id === w.team?.id)
    );

    if (uniqueWinners.length < 2) {
      console.log('Not enough unique winners for next round');
      return;
    }

    const newMatches: Match[] = [];
    let nextMatchNumber = Math.max(...currentBrackets.map((m) => m.matchNumber), 0) + 1;

    // Pair winners: match 1 winner vs match 2 winner, match 3 winner vs match 4 winner, etc.
    for (let i = 0; i < uniqueWinners.length; i += 2) {
      if (i + 1 < uniqueWinners.length) {
        // Ensure teams are different
        if (uniqueWinners[i].team?.id !== uniqueWinners[i + 1].team?.id) {
          newMatches.push({
            team1: uniqueWinners[i].team,
            team2: uniqueWinners[i + 1].team,
            round: nextRound,
            matchNumber: nextMatchNumber++,
            bracket: bracketNum,
            bracketCategory: 'upper',
            winner: null,
            parentMatch1: uniqueWinners[i].parentMatch,
            parentMatch2: uniqueWinners[i + 1].parentMatch,
          });
        }
      } else {
        // Odd number of winners - bye to next round
        newMatches.push({
          team1: uniqueWinners[i].team,
          team2: null,
          round: nextRound,
          matchNumber: nextMatchNumber++,
          bracket: bracketNum,
          bracketCategory: 'upper',
          winner: null,
          parentMatch1: uniqueWinners[i].parentMatch,
        });
      }
    }

    if (newMatches.length === 0) {
      console.log('No new matches to create');
      return;
    }

    // Add new matches to state with duplicate check
    setBrackets((prev) => {
      // Check if any of these matches already exist
      const existingMatchNumbers = prev.map((m) => m.matchNumber);
      const matchesToAdd = newMatches.filter((m) => !existingMatchNumbers.includes(m.matchNumber));
      
      // Also check for duplicate round/bracket combinations
      const existingRounds = prev.filter(
        (m) => m.round === nextRound && m.bracket === bracketNum && m.bracketCategory === 'upper'
      );
      if (existingRounds.length > 0) {
        return prev;
      }
      
      return [...prev, ...matchesToAdd];
    });

    // Save new matches to database
    const matchesToSave = newMatches.filter((m) => {
      // Check if match already exists in database by checking current brackets
      return !currentBrackets.some(
        (existing) => existing.round === m.round && 
                     existing.bracket === m.bracket && 
                     existing.bracketCategory === m.bracketCategory &&
                     existing.team1?.id === m.team1?.id &&
                     existing.team2?.id === m.team2?.id
      );
    });

    if (matchesToSave.length > 0) {
      const bracketData = matchesToSave.map((m) => ({
        tournament_id: targetTournamentId,
        team1_id: m.team1?.id || null,
        team2_id: m.team2?.id || null,
        round: m.round,
        match_number: m.matchNumber,
        winner_id: null,
      }));

      await supabase.from('brackets').insert(bracketData);
    }
  };

  // Generate Lower Bracket Round 2 from Round 2 losers (4 teams → 2 matches → 1 match → 1 winner)
  const generateLowerBracketFromRound2Losers = async (targetTournamentId: string, currentBrackets?: Match[]) => {
    // Use provided brackets or current state
    const bracketsToUse = currentBrackets || brackets;
    
    // Check if lower bracket Round 2 already exists in state
    const lowerBracketRound2ExistsInState = bracketsToUse.some((m) => m.round === 2 && m.bracketCategory === 'lower');
    
    // If it exists in state, don't generate
    if (lowerBracketRound2ExistsInState) {
      console.log('Lower Bracket Round 2 already exists in state');
      return;
    }

    // Get all Round 2 matches (upper bracket)
    const round2Matches = bracketsToUse.filter(
      (m) => m.round === 2 && m.bracketCategory === 'upper',
    );

    // Get losers from Round 2
    const losers: Team[] = [];
    round2Matches.forEach((match) => {
      if (match.winner === 'team1' && match.team2) {
        losers.push(match.team2);
      } else if (match.winner === 'team2' && match.team1) {
        losers.push(match.team1);
      }
    });

    // Need 4 losers for lower bracket Round 2
    if (losers.length !== 4) {
      console.log('Not enough losers for Lower Bracket Round 2:', losers.length);
      return;
    }

    // Create Lower Bracket Round 2 matches (2 matches: Match 1 and Match 2)
    const newMatches: Match[] = [];
    let nextMatchNumber = Math.max(...bracketsToUse.map((m) => m.matchNumber), 0) + 1;

    // Lower Bracket Round 2 Match 1: Loser from Round 2 Match 1 vs Loser from Round 2 Match 2
    // Lower Bracket Round 2 Match 2: Loser from Round 2 Match 3 vs Loser from Round 2 Match 4
    for (let i = 0; i < losers.length; i += 2) {
      if (i + 1 < losers.length) {
        newMatches.push({
          team1: losers[i],
          team2: losers[i + 1],
          round: 2, // Lower bracket Round 2
          matchNumber: nextMatchNumber++,
          bracket: 1,
          bracketCategory: 'lower',
          winner: null,
        });
      }
    }

    if (newMatches.length === 0) return;

    // Add new matches to state with duplicate check
    setBrackets((prev) => {
      // Check for duplicate round/bracket/category combinations first
      const existingLowerRound2 = prev.filter(
        (m) => m.round === 2 && m.bracketCategory === 'lower'
      );
      if (existingLowerRound2.length > 0) {
        console.log('Lower Bracket Round 2 already exists in state, not adding');
        return prev;
      }
      
      // Check if any of these matches already exist by team combinations
      const matchesToAdd = newMatches.filter((newMatch) => {
        const exists = prev.some((existing) => 
          existing.round === 2 &&
          existing.bracketCategory === 'lower' &&
          ((existing.team1?.id === newMatch.team1?.id && existing.team2?.id === newMatch.team2?.id) ||
           (existing.team1?.id === newMatch.team2?.id && existing.team2?.id === newMatch.team1?.id))
        );
        return !exists;
      });
      
      if (matchesToAdd.length === 0) {
        console.log('All Lower Bracket Round 2 matches already exist in state');
        return prev;
      }
      
      return [...prev, ...matchesToAdd];
    });

    // Save new matches to database - check for duplicates first
    // Check if lower bracket Round 2 matches already exist by checking team combinations
    const { data: allRound2Matches } = await supabase
      .from('brackets')
      .select('match_number, team1_id, team2_id')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 2);

    if (allRound2Matches && allRound2Matches.length > 0) {
      // Check if any of the new matches already exist with the same team combinations
      const matchesToSave = newMatches.filter((newMatch) => {
        const exists = allRound2Matches.some((existing) => 
          (existing.team1_id === newMatch.team1?.id && existing.team2_id === newMatch.team2?.id) ||
          (existing.team1_id === newMatch.team2?.id && existing.team2_id === newMatch.team1?.id)
        );
        return !exists;
      });
      
      if (matchesToSave.length === 0) {
        console.log('Lower Bracket Round 2 already exists in database');
        return;
      }

      if (matchesToSave.length > 0) {
        const bracketData = matchesToSave.map((m) => ({
          tournament_id: targetTournamentId,
          team1_id: m.team1?.id || null,
          team2_id: m.team2?.id || null,
          round: m.round,
          match_number: m.matchNumber,
          winner_id: null,
        }));

        await supabase.from('brackets').insert(bracketData);
      }
    } else {
      // No existing Round 2 matches, save all new matches
      const bracketData = newMatches.map((m) => ({
        tournament_id: targetTournamentId,
        team1_id: m.team1?.id || null,
        team2_id: m.team2?.id || null,
        round: m.round,
        match_number: m.matchNumber,
        winner_id: null,
      }));

      await supabase.from('brackets').insert(bracketData);
    }
  };

  // Generate Lower Bracket Round 2 Semi-Final (2 winners → 1 match → 1 winner)
  const generateLowerBracketRound2SemiFinal = async (targetTournamentId: string, round2Matches?: Match[]) => {
    // If round2Matches is provided (from saveRound), use those; otherwise get from brackets state
    const lowerBracketRound2Matches = round2Matches || brackets.filter(
      (m) => m.round === 2 && m.bracketCategory === 'lower',
    );

    // Get winners from Lower Bracket Round 2
    const winners = lowerBracketRound2Matches
      .filter((m) => m.winner !== null)
      .map((m) => (m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null))
      .filter((t): t is Team => t !== null);

    // Need 2 winners for semi-final
    if (winners.length !== 2) {
      console.log('Not enough winners in Lower Bracket Round 2:', winners.length, 'matches:', lowerBracketRound2Matches.length);
      return;
    }

    // Check if semi-final already exists before creating
    const currentBrackets = brackets;
    const semiFinalExists = currentBrackets.some((m) => m.round === 2.5 && m.bracketCategory === 'lower');
    if (semiFinalExists) {
      console.log('Lower Bracket Round 2 Semi-Final already exists');
      return;
    }

    // Create semi-final match
    const nextMatchNumber = Math.max(...currentBrackets.map((m) => m.matchNumber), 0) + 1;
    const semiFinalMatch: Match = {
      team1: winners[0],
      team2: winners[1],
      round: 2.5, // Lower Bracket Round 2 Semi-Final
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
    };

    // Add to state
    setBrackets((prev) => {
      // Double-check it doesn't exist in the updated state
      const exists = prev.some((m) => m.round === 2.5 && m.bracketCategory === 'lower');
      if (exists) return prev;
      return [...prev, semiFinalMatch];
    });

    // Save to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: semiFinalMatch.team1?.id || null,
      team2_id: semiFinalMatch.team2?.id || null,
      round: 2.5,
      match_number: semiFinalMatch.matchNumber,
      winner_id: null,
    };

    await supabase.from('brackets').insert(bracketData);
  };

  // Generate Lower Bracket Round 3 from Round 3 losers (2 teams → 1 match → 1 winner)
  const generateLowerBracketRound3FromRound3Losers = async (targetTournamentId: string, currentBrackets?: Match[]) => {
    // Use provided brackets or current state
    const bracketsToUse = currentBrackets || brackets;
    
    // Check if lower bracket Round 3 already exists
    const lowerBracketRound3Exists = bracketsToUse.some((m) => m.round === 3 && m.bracketCategory === 'lower');
    if (lowerBracketRound3Exists) {
      console.log('Lower Bracket Round 3 already exists');
      return;
    }

    // Get all Round 3 matches (upper bracket)
    const round3Matches = bracketsToUse.filter(
      (m) => m.round === 3 && m.bracketCategory === 'upper',
    );

    // Get losers from Round 3
    const losers: Team[] = [];
    round3Matches.forEach((match) => {
      if (match.winner === 'team1' && match.team2) {
        losers.push(match.team2);
      } else if (match.winner === 'team2' && match.team1) {
        losers.push(match.team1);
      }
    });

    // Need 2 losers for lower bracket Round 3
    if (losers.length !== 2) return;

    // Create Lower Bracket Round 3 match
    const nextMatchNumber = Math.max(...bracketsToUse.map((m) => m.matchNumber), 0) + 1;
    const lowerBracketRound3Match: Match = {
      team1: losers[0],
      team2: losers[1],
      round: 3, // Lower bracket Round 3
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
    };

    // Add match to state with duplicate check
    setBrackets((prev) => {
      const exists = prev.some((m) => 
        m.round === 3 && 
        m.bracketCategory === 'lower' &&
        m.team1?.id === lowerBracketRound3Match.team1?.id &&
        m.team2?.id === lowerBracketRound3Match.team2?.id
      );
      if (exists) {
        console.log('Lower Bracket Round 3 already exists in state');
        return prev;
      }
      return [...prev, lowerBracketRound3Match];
    });

    // Save to database - check for duplicates first
    const { data: existingLowerRound3 } = await supabase
      .from('brackets')
      .select('match_number, team1_id, team2_id')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 3);

    // Check if a lower bracket Round 3 match already exists with the same teams
    const lowerRound3Exists = existingLowerRound3?.some((m) => 
      (m.team1_id === lowerBracketRound3Match.team1?.id && m.team2_id === lowerBracketRound3Match.team2?.id) ||
      (m.team1_id === lowerBracketRound3Match.team2?.id && m.team2_id === lowerBracketRound3Match.team1?.id)
    );

    if (!lowerRound3Exists) {
      const bracketData = {
        tournament_id: targetTournamentId,
        team1_id: lowerBracketRound3Match.team1?.id || null,
        team2_id: lowerBracketRound3Match.team2?.id || null,
        round: 3,
        match_number: lowerBracketRound3Match.matchNumber,
        winner_id: null,
      };

      await supabase.from('brackets').insert(bracketData);
    } else {
      console.log('Lower Bracket Round 3 already exists in database');
    }
  };

  // Generate Lower Bracket Final (Lower Bracket Round 2 winner vs Lower Bracket Round 3 winner)
  const generateLowerBracketFinal = async (targetTournamentId: string) => {
    // Check if lower bracket final already exists
    const lowerBracketFinalExists = brackets.some((m) => m.round === 3.5 && m.bracketCategory === 'lower');
    if (lowerBracketFinalExists) return;

    // Get Lower Bracket Round 2 Semi-Final winner
    const lowerBracketRound2SemiFinal = brackets.find(
      (m) => m.round === 2.5 && m.bracketCategory === 'lower',
    );
    const lowerBracketRound2Winner = lowerBracketRound2SemiFinal?.winner === 'team1'
      ? lowerBracketRound2SemiFinal.team1
      : lowerBracketRound2SemiFinal?.winner === 'team2'
        ? lowerBracketRound2SemiFinal.team2
        : null;

    // Get Lower Bracket Round 3 winner
    const lowerBracketRound3Match = brackets.find(
      (m) => m.round === 3 && m.bracketCategory === 'lower',
    );
    const lowerBracketRound3Winner = lowerBracketRound3Match?.winner === 'team1'
      ? lowerBracketRound3Match.team1
      : lowerBracketRound3Match?.winner === 'team2'
        ? lowerBracketRound3Match.team2
        : null;

    // Need both winners
    if (!lowerBracketRound2Winner || !lowerBracketRound3Winner) return;

    // Create Lower Bracket Final match
    const nextMatchNumber = Math.max(...brackets.map((m) => m.matchNumber), 0) + 1;
    const lowerBracketFinalMatch: Match = {
      team1: lowerBracketRound2Winner,
      team2: lowerBracketRound3Winner,
      round: 3.5, // Lower Bracket Final
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
    };

    // Add match to state
    setBrackets((prev) => [...prev, lowerBracketFinalMatch]);

    // Save to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: lowerBracketFinalMatch.team1?.id || null,
      team2_id: lowerBracketFinalMatch.team2?.id || null,
      round: 3.5,
      match_number: lowerBracketFinalMatch.matchNumber,
      winner_id: null,
    };

    await supabase.from('brackets').insert(bracketData);
  };

  // Generate Round 4 from Round 3 winners (2 teams → 1 match → 1 winner)
  const generateRound4FromRound3AndLowerBracket = async (targetTournamentId: string, currentBrackets?: Match[]) => {
    // Use provided brackets or current state
    const bracketsToUse = currentBrackets || brackets;
    
    // Check if Round 4 already exists
    const round4Exists = bracketsToUse.some((m) => m.round === 4 && m.bracketCategory === 'upper');
    if (round4Exists) {
      console.log('Round 4 already exists');
      return;
    }

    // Get Round 3 winners (upper bracket)
    const round3Matches = bracketsToUse.filter(
      (m) => m.round === 3 && m.bracketCategory === 'upper',
    );
    const round3Winners = round3Matches
      .filter((m) => m.winner !== null)
      .map((m) => (m.winner === 'team1' ? m.team1 : m.team2))
      .filter((t): t is Team => t !== null);

    // Need 2 winners from Round 3
    if (round3Winners.length !== 2) return;

    // Create Round 4 match (1 match: 2 teams)
    const nextMatchNumber = Math.max(...bracketsToUse.map((m) => m.matchNumber), 0) + 1;
    const round4Match: Match = {
      team1: round3Winners[0],
      team2: round3Winners[1],
      round: 4,
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'upper',
      winner: null,
    };

    // Add match to state - double check for duplicates
    setBrackets((prev) => {
      // Check if Round 4 already exists in the updated state
      const exists = prev.some((m) => m.round === 4 && m.bracketCategory === 'upper');
      if (exists) {
        return prev;
      }
      return [...prev, round4Match];
    });

    // Save to database - check if it already exists in database first
    const { data: existingRound4 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 4);

    if (existingRound4 && existingRound4.length > 0) {
      return; // Round 4 already exists in database
    }

    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: round4Match.team1?.id || null,
      team2_id: round4Match.team2?.id || null,
      round: 4,
      match_number: round4Match.matchNumber,
      winner_id: null,
    };

    await supabase.from('brackets').insert(bracketData);
  };

  // Generate Final Round from Round 4 winner and Lower Bracket Final winner
  const generateFinalRoundFromRound4 = async (targetTournamentId: string) => {
    // Check if Final Round already exists
    const finalRoundExists = brackets.some((m) => m.round === 5 && m.bracketCategory === 'upper');
    if (finalRoundExists) return;

    // Get Round 4 winner (upper bracket)
    const round4Match = brackets.find(
      (m) => m.round === 4 && m.bracketCategory === 'upper',
    );
    const round4Winner = round4Match?.winner === 'team1'
      ? round4Match.team1
      : round4Match?.winner === 'team2'
        ? round4Match.team2
        : null;

    // Get Lower Bracket Final winner
    const lowerBracketFinalMatch = brackets.find(
      (m) => m.round === 3.5 && m.bracketCategory === 'lower',
    );
    const lowerBracketFinalWinner = lowerBracketFinalMatch?.winner === 'team1'
      ? lowerBracketFinalMatch.team1
      : lowerBracketFinalMatch?.winner === 'team2'
        ? lowerBracketFinalMatch.team2
        : null;

    // Need both winners
    if (!round4Winner || !lowerBracketFinalWinner) return;

    // Create Final Round match (Championship)
    const nextMatchNumber = Math.max(...brackets.map((m) => m.matchNumber), 0) + 1;
    const finalMatch: Match = {
      team1: round4Winner,
      team2: lowerBracketFinalWinner,
      round: 5, // Final Round
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'upper',
      winner: null,
    };

    // Add final match to state
    setBrackets((prev) => [...prev, finalMatch]);

    // Save final match to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: finalMatch.team1?.id || null,
      team2_id: finalMatch.team2?.id || null,
      round: finalMatch.round,
      match_number: finalMatch.matchNumber,
      winner_id: null,
    };

    await supabase.from('brackets').insert(bracketData);
  };

  const cancelRound = async (round: number, bracket: BracketNumber, bracketCategory?: BracketCategory) => {
    // Determine bracket category if not provided
    let category: BracketCategory = bracketCategory || 'upper';
    if (!bracketCategory) {
      const matches = brackets.filter((m) => m.round === round && m.bracket === bracket);
      if (matches.length > 0) {
        category = matches[0].bracketCategory || 'upper';
      }
    }

    const roundMatches = brackets.filter(
      (m) => m.round === round && m.bracket === bracket && m.bracketCategory === category,
    );

    if (roundMatches.length === 0) return;

    let targetTournamentId = tournamentId;
    if (!targetTournamentId) {
      // If no tournament exists, recursively delete all dependent rounds and clear from state
      const roundsToDelete: number[] = [];
      let currentRound = round + 1;
      while (brackets.some((m) => m.round === currentRound && m.bracket === bracket && m.bracketCategory === category)) {
        roundsToDelete.push(currentRound);
        currentRound++;
      }

      // If cancelling Round 2 (upper bracket), also remove all lower bracket matches
      if (round === 2 && category === 'upper') {
        setBrackets((prev) =>
          prev
            .filter((m) => 
              !(m.bracketCategory === 'lower') && 
              !(roundsToDelete.includes(m.round) && m.bracket === bracket && m.bracketCategory === category)
            )
            .map((m) =>
              m.round === round && m.bracket === bracket && m.bracketCategory === category ? { ...m, winner: null } : m,
            ),
        );
      } else {
        setBrackets((prev) =>
          prev
            .filter((m) => !(roundsToDelete.includes(m.round) && m.bracket === bracket && m.bracketCategory === category))
            .map((m) =>
              m.round === round && m.bracket === bracket && m.bracketCategory === category ? { ...m, winner: null } : m,
            ),
        );
      }
      return;
    }

    // For lower bracket, we need to handle dependencies differently
    // If canceling lower bracket Round 2, we need to also remove Round 4 (which depends on lower bracket winners)
    if (category === 'lower' && round === 2) {
      // Find Round 4 matches that depend on lower bracket winners
      const round4Matches = brackets.filter(
        (m) => m.round === 4 && m.bracketCategory === 'upper',
      );
      const round4MatchNumbers = round4Matches.map((m) => m.matchNumber);

      // Delete Round 4 from database
      if (round4MatchNumbers.length > 0) {
        await supabase
          .from('brackets')
          .delete()
          .eq('tournament_id', targetTournamentId)
          .in('match_number', round4MatchNumbers);
      }

      // Also delete Final Round (Round 5) if it exists
      const finalRoundMatches = brackets.filter(
        (m) => m.round === 5 && m.bracketCategory === 'upper',
      );
      const finalRoundMatchNumbers = finalRoundMatches.map((m) => m.matchNumber);

      if (finalRoundMatchNumbers.length > 0) {
        await supabase
          .from('brackets')
          .delete()
          .eq('tournament_id', targetTournamentId)
          .in('match_number', finalRoundMatchNumbers);
      }

      // Remove Round 4 and Final Round from state (only upper bracket rounds 4 and 5)
      setBrackets((prev) =>
        prev
          .filter((m) => !((m.round === 4 || m.round === 5) && m.bracketCategory === 'upper'))
          .map((m) =>
            m.round === round && m.bracket === bracket && m.bracketCategory === category ? { ...m, winner: null } : m,
          ),
      );
    } else {
      // For upper bracket, recursively find all dependent rounds
      const roundsToDelete: number[] = [];
      let currentRound = round + 1;
      while (brackets.some((m) => m.round === currentRound && m.bracket === bracket && m.bracketCategory === category)) {
        roundsToDelete.push(currentRound);
        currentRound++;
      }

      // Get all match numbers from dependent rounds
      const allDependentMatches = brackets.filter(
        (m) => roundsToDelete.includes(m.round) && m.bracket === bracket && m.bracketCategory === category,
      );
      const dependentMatchNumbers = allDependentMatches.map((m) => m.matchNumber);

      // If cancelling Round 2 (upper bracket), also remove all lower bracket matches
      if (round === 2 && category === 'upper') {
        // Get all lower bracket matches
        const allLowerBracketMatches = brackets.filter((m) => m.bracketCategory === 'lower');
        const lowerBracketMatchNumbers = allLowerBracketMatches.map((m) => m.matchNumber);

        // Delete all lower bracket matches from database
        if (lowerBracketMatchNumbers.length > 0) {
          await supabase
            .from('brackets')
            .delete()
            .eq('tournament_id', targetTournamentId)
            .in('match_number', lowerBracketMatchNumbers);
        }

        // Delete dependent upper bracket rounds from database
        if (dependentMatchNumbers.length > 0) {
          await supabase
            .from('brackets')
            .delete()
            .eq('tournament_id', targetTournamentId)
            .in('match_number', dependentMatchNumbers);
        }

        // Update state: remove all lower bracket matches, dependent upper bracket rounds, and clear winners in current round
        setBrackets((prev) =>
          prev
            .filter((m) => 
              !(m.bracketCategory === 'lower') && 
              !(roundsToDelete.includes(m.round) && m.bracket === bracket && m.bracketCategory === category)
            )
            .map((m) =>
              m.round === round && m.bracket === bracket && m.bracketCategory === category ? { ...m, winner: null } : m,
            ),
        );
      } else {
        // For other upper bracket rounds, just delete dependent upper bracket rounds
        // Delete dependent rounds from database
        if (dependentMatchNumbers.length > 0) {
          await supabase
            .from('brackets')
            .delete()
            .eq('tournament_id', targetTournamentId)
            .in('match_number', dependentMatchNumbers);
        }

        // Update state: remove dependent rounds and clear winners in current round
        setBrackets((prev) =>
          prev
            .filter((m) => !(roundsToDelete.includes(m.round) && m.bracket === bracket && m.bracketCategory === category))
            .map((m) =>
              m.round === round && m.bracket === bracket && m.bracketCategory === category ? { ...m, winner: null } : m,
            ),
        );
      }
    }

    // Clear winners in database for the current round
    for (const match of roundMatches) {
      await supabase
        .from('brackets')
        .update({ winner_id: null })
        .eq('tournament_id', targetTournamentId)
        .eq('match_number', match.matchNumber);
    }
  };

  const handleCancelRoundClick = (round: number, bracket: BracketNumber, bracketCategory?: BracketCategory) => {
    setCancelRoundData({ round, bracket, bracketCategory });
    setCancelRoundModalOpen(true);
  };

  const confirmCancelRound = async () => {
    if (cancelRoundData) {
      await cancelRound(cancelRoundData.round, cancelRoundData.bracket, cancelRoundData.bracketCategory);
      setCancelRoundModalOpen(false);
      setCancelRoundData(null);
    }
  };

  const saveBrackets = async () => {
    setSaving(true);

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
          title: `Tournament ${new Date().toLocaleString()}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError || !data?.id) {
        setSaveErrorMessage('Error creating tournament record for brackets: ' + (createError?.message || 'Unknown error'));
        setSaveErrorModalOpen(true);
        setSaving(false);
        return;
      }

      targetTournamentId = data.id as string;
      setTournamentId(targetTournamentId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
        window.localStorage.setItem('digibyte_bracket_type', bracketType);
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
      setSaveErrorMessage('Error saving brackets: ' + error.message);
      setSaveErrorModalOpen(true);
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('digibyte_current_tournament_id', targetTournamentId);
        window.localStorage.setItem('digibyte_bracket_type', bracketType);
      }
      setSaveSuccessModalOpen(true);
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
        {/* Bracket Type Selection */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-3 text-sm md:text-base">
            Select Bracket System:
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setBracketType('1-bracket')}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all text-sm md:text-base font-semibold ${
                bracketType === '1-bracket'
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-gray-800 text-gray-300 border-2 border-gray-600 hover:bg-gray-700'
              }`}
            >
              1 Bracket (16 Teams)
            </button>
            <button
              type="button"
              onClick={() => setBracketType('2-brackets')}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all text-sm md:text-base font-semibold ${
                bracketType === '2-brackets'
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-gray-800 text-gray-300 border-2 border-gray-600 hover:bg-gray-700'
              }`}
            >
              2 Brackets (8 Teams Each)
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <button
            onClick={generateBrackets}
            disabled={paidTeamsCount < 16}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base w-full sm:w-auto"
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-center">
              Generate {bracketType === '1-bracket' ? 'Bracket (16 Teams)' : 'Bracket 1 & 2 (16 Teams)'}
            </span>
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

        {paidTeamsCount < 16 && (
          <div className="p-4 bg-yellow-600/20 border border-yellow-500/50 rounded-lg text-yellow-400">
            This tournament format requires exactly 16 paid teams. Currently you have {paidTeamsCount} paid team(s).
          </div>
        )}

        {brackets.length > 0 && (
          <div className="space-y-8">
            {bracketType === '1-bracket' ? (
              // 1 Bracket System - Split layout: Lower brackets on left, Upper brackets on right
              (() => {
                const upperBracketRounds = Array.from(
                  new Set(brackets.filter((m) => m.bracket === 1 && m.bracketCategory === 'upper').map((m) => m.round)),
                ).sort((a, b) => a - b);
                const lowerBracketRounds = Array.from(
                  new Set(brackets.filter((m) => m.bracketCategory === 'lower').map((m) => m.round)),
                ).sort((a, b) => a - b);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Left Column - Lower Bracket */}
                    <div className="space-y-8">
                      <h3 className="text-2xl font-bold text-yellow-400 mb-6 sticky top-0 bg-black/80 backdrop-blur-sm py-2 z-10">
                        Lower Bracket
                      </h3>
                      {lowerBracketRounds.length > 0 ? (
                        lowerBracketRounds.map((round) => {
                          const roundMatches = brackets
                            .filter((m) => m.round === round && m.bracketCategory === 'lower')
                            .sort((a, b) => a.matchNumber - b.matchNumber);
                          
                          const allHaveWinners = roundMatches.every((m) => m.winner !== null);
                          const hasAnyWinners = roundMatches.some((m) => m.winner !== null);
                          
                          // Check if round is saved (has next round or is final round with winners)
                          const nextRoundExists = brackets.some(
                            (m) => {
                              if (round === 2) return m.round === 2.5 && m.bracketCategory === 'lower';
                              if (round === 2.5) return m.round === 3.5 && m.bracketCategory === 'lower';
                              if (round === 3) return m.round === 3.5 && m.bracketCategory === 'lower';
                              if (round === 3.5) return m.round === 4 && m.bracketCategory === 'upper';
                              return false;
                            }
                          );
                          const isRoundSaved = allHaveWinners && (nextRoundExists || round === 3.5);
                          const roundKey = `lower-round-${round}`;
                          // Default to collapsed if saved, expanded if not saved
                          const isExpanded = isRoundSaved ? expandedRounds.has(roundKey) : true;
                          
                          return (
                            <div key={`lower-round-${round}`} className="bg-black/20 border border-yellow-500/30 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                {isRoundSaved ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleRound(roundKey)}
                                    className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-yellow-400" /> : <ChevronDown className="w-5 h-5 text-yellow-400" />}
                                    <h4 className="text-xl font-semibold text-yellow-400">
                                      {round === 2.5 
                                        ? 'Round 2 Semi-Final'
                                        : round === 3.5
                                          ? 'Final'
                                          : `Round ${round}`}
                                      {roundMatches.length === 2 && round !== 2.5 && round !== 3.5 && (
                                        <> (Match {roundMatches[0]?.matchNumber} & {roundMatches[1]?.matchNumber})</>
                                      )}
                                      <span className="text-sm text-green-400 ml-2">✓ Saved</span>
                                    </h4>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 flex-1">
                                    <h4 className="text-xl font-semibold text-yellow-400">
                                      {round === 2.5 
                                        ? 'Round 2 Semi-Final'
                                        : round === 3.5
                                          ? 'Final'
                                          : `Round ${round}`}
                                      {roundMatches.length === 2 && round !== 2.5 && round !== 3.5 && (
                                        <> (Match {roundMatches[0]?.matchNumber} & {roundMatches[1]?.matchNumber})</>
                                      )}
                                    </h4>
                                  </div>
                                )}
                              </div>
                              {isExpanded && (
                                <>
                                  <div className="grid grid-cols-1 gap-3 md:gap-4">
                                    {roundMatches.map((match) => (
                                      <div
                                        key={`lower-${match.matchNumber}`}
                                        className="bg-black/30 border border-yellow-500/20 rounded-lg p-3 md:p-4"
                                      >
                                        <div className="text-yellow-400 text-xs md:text-sm mb-2 md:mb-3">
                                          {round === 2.5 
                                            ? 'Lower Bracket Round 2 Semi-Final'
                                            : round === 3.5
                                              ? 'Lower Bracket Final'
                                              : `Lower Bracket Match ${roundMatches.length === 2 && match.matchNumber === roundMatches[0]?.matchNumber ? '1' : roundMatches.length === 2 ? '2' : match.matchNumber}`}
                                        </div>
                                        <div className="space-y-1.5 md:space-y-2">
                                          <div
                                            className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                                              match.winner === 'team1'
                                                ? 'glow-green-border bg-green-900/10'
                                                : match.winner === 'team2'
                                                  ? 'glow-red-border bg-red-900/10'
                                                  : 'bg-gray-800/50 border-gray-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-white font-semibold text-sm md:text-base truncate">
                                                {match.team1?.team_name || 'BYE'}
                                              </span>
                                              {match.team1 && teamStandings[match.team1.id] && (
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                  ({teamStandings[match.team1.id].wins}W-{teamStandings[match.team1.id].losses}L)
                                                </span>
                                              )}
                                            </div>
                                            {match.team1 && (
                                              <button
                                                type="button"
                                                onClick={() => setWinner(match.matchNumber, 1, 'team1', match.bracketCategory)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors flex-shrink-0 ${
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
                                          <div
                                            className={`flex items-center justify-between p-2 md:p-3 rounded border ${
                                              match.winner === 'team2'
                                                ? 'glow-green-border bg-green-900/10'
                                                : match.winner === 'team1'
                                                  ? 'glow-red-border bg-red-900/10'
                                                  : 'bg-gray-800/50 border-gray-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-white font-semibold text-sm md:text-base truncate">
                                                {match.team2?.team_name || 'BYE'}
                                              </span>
                                              {match.team2 && teamStandings[match.team2.id] && (
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                  ({teamStandings[match.team2.id].wins}W-{teamStandings[match.team2.id].losses}L)
                                                </span>
                                              )}
                                            </div>
                                            {match.team2 && (
                                              <button
                                                type="button"
                                                onClick={() => setWinner(match.matchNumber, 1, 'team2', match.bracketCategory)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors flex-shrink-0 ${
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
                                  <div className="flex items-center justify-end gap-2 mt-4">
                                    {hasAnyWinners && (
                                      <button
                                        type="button"
                                        onClick={() => handleCancelRoundClick(round, 1, 'lower')}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-2 text-sm md:text-base"
                                      >
                                        <X className="w-4 h-4" />
                                        <span>Cancel {round === 2.5 ? 'Round 2 Semi-Final' : round === 3.5 ? 'Final' : `Round ${round}`}</span>
                                      </button>
                                    )}
                                    {!isRoundSaved && (
                                      <button
                                        type="button"
                                        onClick={() => saveRound(round, 1)}
                                        disabled={!allHaveWinners}
                                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                      >
                                        <Save className="w-4 h-4" />
                                        <span>Save {round === 2.5 ? 'Round 2 Semi-Final' : round === 3.5 ? 'Final' : `Round ${round}`}</span>
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-gray-500 text-center py-8">No lower bracket matches yet</div>
                      )}
                    </div>

                    {/* Right Column - Upper Bracket */}
                    <div className="space-y-8">
                      <h3 className="text-2xl font-bold text-blue-400 mb-6 sticky top-0 bg-black/80 backdrop-blur-sm py-2 z-10">
                        Upper Bracket
                      </h3>
                      {upperBracketRounds.map((round) => {
                        const roundMatches = brackets
                          .filter((m) => m.bracket === 1 && m.round === round && m.bracketCategory === 'upper')
                          .sort((a, b) => a.matchNumber - b.matchNumber);

                        const allHaveWinners = roundMatches.every((m) => m.winner !== null);
                        const nextRoundExists = brackets.some(
                          (m) => m.round === round + 1 && m.bracket === 1 && m.bracketCategory === 'upper',
                        );
                        const hasAnyWinners = roundMatches.some((m) => m.winner !== null);
                        
                        // For Round 3, check if Round 4 exists (which is generated from Round 3)
                        // For Round 4, check if Round 5 (Final) exists
                        // A round is saved if all matches have winners AND the next round exists
                        let isRoundSaved = false;
                        if (round === 3) {
                          // Round 3 is saved if all have winners AND Round 4 exists
                          const round4Exists = brackets.some(
                            (m) => m.round === 4 && m.bracket === 1 && m.bracketCategory === 'upper',
                          );
                          isRoundSaved = allHaveWinners && round4Exists;
                        } else if (round === 4) {
                          // Round 4 is saved if all have winners AND Round 5 (Final) exists
                          const round5Exists = brackets.some(
                            (m) => m.round === 5 && m.bracket === 1 && m.bracketCategory === 'upper',
                          );
                          isRoundSaved = allHaveWinners && round5Exists;
                        } else {
                          // For other rounds, use the standard check
                          isRoundSaved = allHaveWinners && nextRoundExists;
                        }
                        const roundKey = `upper-round-${round}`;
                        // Default to collapsed if saved, expanded if not saved
                        const isExpanded = isRoundSaved ? expandedRounds.has(roundKey) : true;

                        return (
                          <div key={`round-${round}`} className="bg-black/20 border border-blue-500/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              {isRoundSaved ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRound(roundKey)}
                                  className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  {isExpanded ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
                                  <h4 className="text-xl font-semibold text-blue-400">
                                    Round {round} {round === 1 && '(16 Teams)'}
                                    <span className="text-sm text-green-400 ml-2">✓ Saved</span>
                                  </h4>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 flex-1">
                                  <h4 className="text-xl font-semibold text-blue-400">
                                    Round {round} {round === 1 && '(16 Teams)'}
                                  </h4>
                                </div>
                              )}
                            </div>
                            {isExpanded && (
                              <>
                                <div className="grid grid-cols-1 gap-3 md:gap-4">
                                  {roundMatches.map((match) => (
                                    <div
                                      key={`b1-${match.matchNumber}`}
                  className="bg-black/30 border border-blue-500/20 rounded-lg p-3 md:p-4"
                >
                                      <div className="text-blue-400 text-xs md:text-sm mb-2 md:mb-3">
                                        Match {match.matchNumber}
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
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-white font-semibold text-sm md:text-base truncate">
                        {match.team1?.team_name || 'BYE'}
                      </span>
                                            {match.team1 && teamStandings[match.team1.id] && (
                                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                                ({teamStandings[match.team1.id].wins}W-{teamStandings[match.team1.id].losses}L)
                                              </span>
                                            )}
                    </div>
                                          {match.team1 && (
                                            <button
                                              type="button"
                                              onClick={() => setWinner(match.matchNumber, 1, 'team1', match.bracketCategory)}
                                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors flex-shrink-0 ${
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
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-white font-semibold text-sm md:text-base truncate">
                        {match.team2?.team_name || 'BYE'}
                      </span>
                                            {match.team2 && teamStandings[match.team2.id] && (
                                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                                ({teamStandings[match.team2.id].wins}W-{teamStandings[match.team2.id].losses}L)
                                              </span>
                                            )}
                                          </div>
                                          {match.team2 && (
                                            <button
                                              type="button"
                                              onClick={() => setWinner(match.matchNumber, 1, 'team2', match.bracketCategory)}
                                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors flex-shrink-0 ${
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
                                <div className="flex items-center justify-end gap-2 mt-4">
                                  {hasAnyWinners && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelRoundClick(round, 1)}
                                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-2 text-sm md:text-base"
                                    >
                                      <X className="w-4 h-4" />
                                      <span>Cancel Round {round}</span>
                                    </button>
                                  )}
                                  {!isRoundSaved && (
                                    <button
                                      type="button"
                                      onClick={() => saveRound(round, 1)}
                                      disabled={!allHaveWinners}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                    >
                                      <Save className="w-4 h-4" />
                                      <span>Save Round {round}</span>
                                    </button>
                                  )}
          </div>
                              </>
        )}
                          </div>
                        );
                      })}
      </div>
    </div>
  );
              })()
            ) : (
              // 2 Brackets System - Show rounds separately for each bracket
              (() => {
                const bracket1Rounds = Array.from(
                  new Set(brackets.filter((m) => m.bracket === 1).map((m) => m.round)),
                ).sort((a, b) => a - b);
                const bracket2Rounds = Array.from(
                  new Set(brackets.filter((m) => m.bracket === 2).map((m) => m.round)),
                ).sort((a, b) => a - b);

                return (
                  <>
                    {/* Bracket 1 */}
                    <div>
                      <h4 className="text-2xl font-semibold text-white mb-4">Bracket 1</h4>
                      {bracket1Rounds.map((round) => {
                        const roundMatches = brackets
                          .filter((m) => m.bracket === 1 && m.round === round)
                          .sort((a, b) => a.matchNumber - b.matchNumber);

                        const allHaveWinners = roundMatches.every((m) => m.winner !== null);
                        const nextRoundExists = brackets.some(
                          (m) => m.round === round + 1 && m.bracket === 1,
                        );
                        const hasAnyWinners = roundMatches.some((m) => m.winner !== null);

                        return (
                          <div key={`b1-round-${round}`} className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-lg font-semibold text-blue-400">
                                Round {round} {round === 1 && '(8 Teams)'}
                              </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                              {roundMatches.map((match) => (
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
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-white font-semibold text-sm md:text-base truncate">
                              {match.team1?.team_name || 'BYE'}
                            </span>
                            {match.team1 && teamStandings[match.team1.id] && (
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                ({teamStandings[match.team1.id].wins}W-{teamStandings[match.team1.id].losses}L)
                              </span>
                            )}
                          </div>
                          {match.team1 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 1, 'team1', match.bracketCategory)}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors flex-shrink-0 ${
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
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-white font-semibold text-sm md:text-base truncate">
                              {match.team2?.team_name || 'BYE'}
                            </span>
                            {match.team2 && teamStandings[match.team2.id] && (
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                ({teamStandings[match.team2.id].wins}W-{teamStandings[match.team2.id].losses}L)
                              </span>
                            )}
                          </div>
                          {match.team2 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 1, 'team2', match.bracketCategory)}
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
                            <div className="flex items-center justify-end gap-2 mt-4">
                              {hasAnyWinners && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelRoundClick(round, 1)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-2 text-sm md:text-base"
                                >
                                  <X className="w-4 h-4" />
                                  <span>Cancel Round {round}</span>
                                </button>
                              )}
                              {!nextRoundExists && (
                                <button
                                  type="button"
                                  onClick={() => saveRound(round, 1)}
                                  disabled={!allHaveWinners}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                >
                                  <Save className="w-4 h-4" />
                                  <span>Save Round {round}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bracket 2 */}
                    <div>
                      <h4 className="text-2xl font-semibold text-white mb-4">Bracket 2</h4>
                      {bracket2Rounds.map((round) => {
                        const roundMatches = brackets
                          .filter((m) => m.bracket === 2 && m.round === round)
                          .sort((a, b) => a.matchNumber - b.matchNumber);

                        const allHaveWinners = roundMatches.every((m) => m.winner !== null);
                        const nextRoundExists = brackets.some(
                          (m) => m.round === round + 1 && m.bracket === 2,
                        );
                        const hasAnyWinners = roundMatches.some((m) => m.winner !== null);

                        return (
                          <div key={`b2-round-${round}`} className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-lg font-semibold text-blue-400">
                                Round {round} {round === 1 && '(8 Teams)'}
                              </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                              {roundMatches.map((match) => (
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
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-white font-semibold text-sm md:text-base truncate">
                              {match.team1?.team_name || 'BYE'}
                            </span>
                            {match.team1 && teamStandings[match.team1.id] && (
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                ({teamStandings[match.team1.id].wins}W-{teamStandings[match.team1.id].losses}L)
                              </span>
                            )}
                          </div>
                          {match.team1 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 2, 'team1', match.bracketCategory)}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold border transition-colors flex-shrink-0 ${
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
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-white font-semibold text-sm md:text-base truncate">
                              {match.team2?.team_name || 'BYE'}
                            </span>
                            {match.team2 && teamStandings[match.team2.id] && (
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                ({teamStandings[match.team2.id].wins}W-{teamStandings[match.team2.id].losses}L)
                              </span>
                            )}
                          </div>
                          {match.team2 && (
                            <button
                              type="button"
                              onClick={() => setWinner(match.matchNumber, 2, 'team2', match.bracketCategory)}
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
                            <div className="flex items-center justify-end gap-2 mt-4">
                              {hasAnyWinners && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelRoundClick(round, 2)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-2 text-sm md:text-base"
                                >
                                  <X className="w-4 h-4" />
                                  <span>Cancel Round {round}</span>
                                </button>
                              )}
                              {!nextRoundExists && (
                                <button
                                  type="button"
                                  onClick={() => saveRound(round, 2)}
                                  disabled={!allHaveWinners}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                >
                                  <Save className="w-4 h-4" />
                                  <span>Save Round {round}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmGenerateOpen}
        title="Regenerate brackets?"
        message={
          brackets.some((match) => match.winner !== null)
            ? "There are already recorded winners in the current brackets. Generating new brackets will remove the current matchups and results for this tournament. Do you want to generate new brackets anyway?"
            : "The current brackets have been saved. Generating new brackets will replace the saved brackets and you will lose the current matchups. Do you want to generate new brackets anyway?"
        }
        confirmLabel="Yes, generate new brackets"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmGenerateOpen(false);
          generateBracketsInternal();
        }}
        onCancel={() => setConfirmGenerateOpen(false)}
      />

      {/* Success Modal */}
      {saveSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSaveSuccessModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-gray-900/95 border border-green-500/40 shadow-xl p-6 md:p-7 animate-slide-up">
            <h3 className="text-lg md:text-xl font-bold text-white mb-3">Success</h3>
            <p className="text-sm md:text-base text-gray-300 mb-6">Brackets saved successfully!</p>
            <div className="flex justify-end">
              <button
                onClick={() => setSaveSuccessModalOpen(false)}
                className="inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm md:text-base font-semibold hover:bg-green-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {saveErrorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSaveErrorModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-gray-900/95 border border-red-500/40 shadow-xl p-6 md:p-7 animate-slide-up">
            <h3 className="text-lg md:text-xl font-bold text-white mb-3">Error</h3>
            <p className="text-sm md:text-base text-gray-300 mb-6">{saveErrorMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setSaveErrorModalOpen(false)}
                className="inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm md:text-base font-semibold hover:bg-red-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Round Confirmation Modal */}
      <ConfirmModal
        open={cancelRoundModalOpen}
        title="Cancel Round?"
        message={
          cancelRoundData
            ? cancelRoundData.bracketCategory === 'lower'
              ? `Are you sure you want to cancel Lower Bracket Round ${cancelRoundData.round}? This will clear all winners in this round and remove Round 4 and Final Round (if they exist) since they depend on lower bracket results. This action cannot be undone.`
              : `Are you sure you want to cancel Round ${cancelRoundData.round} in Bracket ${cancelRoundData.bracket}? This will clear all winners in this round and remove any next round that was generated from it. This action cannot be undone.`
            : ''
        }
        confirmLabel="Yes, cancel round"
        cancelLabel="No, keep it"
        onConfirm={confirmCancelRound}
        onCancel={() => {
          setCancelRoundModalOpen(false);
          setCancelRoundData(null);
        }}
      />

      {/* Champion Modal */}
      {championModalOpen && championTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setChampionModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-gradient-to-br from-yellow-900/95 via-yellow-800/95 to-yellow-900/95 border-2 border-yellow-400 shadow-2xl p-8 md:p-10 animate-slide-up">
            <div className="text-center">
              <h3 className="text-3xl md:text-4xl font-bold text-yellow-300 mb-4">
                🏆 We have a champion! 🏆
              </h3>
              <div className="bg-black/40 rounded-lg p-6 mb-6 border border-yellow-500/30">
                <p className="text-yellow-400 text-sm md:text-base mb-2">Champion Team:</p>
                <p className="text-2xl md:text-3xl font-bold text-yellow-300">
                  {championTeam.team_name}
                </p>
              </div>
              <p className="text-xl md:text-2xl text-white mb-6 font-semibold">
                Congratulations!
              </p>
              <button
                onClick={() => {
                  setChampionModalOpen(false);
                  setChampionTeam(null);
                }}
                className="inline-flex justify-center items-center px-6 py-3 rounded-lg bg-yellow-600 text-white text-base md:text-lg font-semibold hover:bg-yellow-700 transition-colors shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
