import { useState, useEffect, useMemo } from 'react';
import { Shuffle, Save, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
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
  const [saving, setSaving] = useState<{ round: number; bracket: BracketNumber; bracketCategory?: BracketCategory } | null>(null);
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
      
      // For Round 2, determine based on match number
      // Lower bracket matches come after upper bracket round 2 matches
      // Upper bracket Round 2: 4 matches for 1-bracket system
      if (round === 2) {
        const round2Matches = allMatches.filter((m: any) => m.round === 2).sort((a: any, b: any) => a.match_number - b.match_number);
        
        // Upper bracket round 2 should have 4 matches (first 4 matches in Round 2)
        // Lower bracket matches will have match numbers higher than the 4th upper bracket match
        if (round2Matches.length > 4) {
          // We have more than 4 Round 2 matches, so lower bracket exists
          // First 4 matches are upper bracket, rest are lower bracket
          const upperRound2LastMatch = round2Matches[3]?.match_number || 0;
          if (matchNumber > upperRound2LastMatch) {
            return 'lower';
          }
        }
        // If exactly 4 matches or less, all are upper bracket
        return 'upper';
      }
      
      // For Round 3, determine based on match number
      // Upper bracket Round 3: 2 matches
      // Lower bracket Round 3: 1 match (comes after the 2nd upper bracket match)
      if (round === 3) {
        const round3Matches = allMatches.filter((m: any) => m.round === 3).sort((a: any, b: any) => a.match_number - b.match_number);
        
        // Upper bracket round 3 should have 2 matches
        // Lower bracket match will have match number higher than the 2nd upper bracket match
        if (round3Matches.length >= 2) {
          const upperRound3LastMatch = round3Matches[1]?.match_number || 0;
          if (matchNumber > upperRound3LastMatch) {
            return 'lower';
          }
        }
        return 'upper';
      }
      
      // Round 20 = Lower Bracket Round 2 Final, Round 25 = Lower Bracket Round 3, Round 30 = Lower Bracket Final
      if (round === 20 || round === 25 || round === 30) return 'lower';
      
      // Round 4-19 is always upper bracket
      // Round 20 = Lower Bracket Round 2 Final, Round 25 = Lower Bracket Round 3, Round 30 = Lower Bracket Final
      if (round >= 4 && round < 20) return 'upper';
      if (round >= 31) return 'upper'; // Round 31+ is upper bracket
      
      return 'upper';
    };

    // First, deduplicate data by match_number (keep the first occurrence)
    const uniqueData = data.filter((row: any, index: number, self: any[]) => 
      index === self.findIndex((r: any) => r.match_number === row.match_number)
    );

    const loaded: Match[] = uniqueData.map((row: any) => {
      const bracketNum = getBracketForMatch(row);
      // Determine bracket category dynamically
      const bracketCategory: BracketCategory = determineBracketCategory(row.round, row.match_number, uniqueData);

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

    // Final deduplication by matchNumber to ensure no duplicates in the final array
    const finalLoaded = loaded.filter((match, index, self) =>
      index === self.findIndex((m) => m.matchNumber === match.matchNumber)
    );

    setBrackets(finalLoaded);
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

  const saveRound = async (round: number, bracket: BracketNumber, bracketCategory?: BracketCategory) => {
    // Determine bracket category from the matches if not provided
    let roundMatches = brackets.filter(
      (m) => m.round === round && m.bracket === bracket,
    );
    
    // If bracketCategory is provided, filter by it to get only the correct bracket category matches
    if (bracketCategory) {
      roundMatches = roundMatches.filter((m) => m.bracketCategory === bracketCategory);
    }
    
    if (roundMatches.length === 0) {
      return;
    }
    
    const category = bracketCategory || roundMatches[0].bracketCategory || 'upper';
    setSaving({ round, bracket, bracketCategory: category });

    // Check if all matches have winners
    const allHaveWinners = roundMatches.every((m) => m.winner !== null);
    if (!allHaveWinners) {
      setSaveErrorMessage(`Please mark winners for all matches in Round ${round} before saving.`);
      setSaveErrorModalOpen(true);
      setSaving(null);
      return;
    }
    
    // Use the determined category (already stored in category variable)

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

    // Verify that all matches were saved successfully
    const { data: savedMatches, error: verifyError } = await supabase
      .from('brackets')
      .select('match_number, winner_id')
      .eq('tournament_id', targetTournamentId)
      .in('match_number', roundMatches.map(m => m.matchNumber));

    if (verifyError) {
      setSaveErrorMessage(`Error verifying saved matches: ${verifyError.message}`);
      setSaveErrorModalOpen(true);
      setSaving(null);
      return;
    }

    // Check if all matches were saved with correct winners
    const savedMatchNumbers = new Set((savedMatches || []).map((m: any) => m.match_number));
    const missingMatches = roundMatches.filter(m => !savedMatchNumbers.has(m.matchNumber));
    
    if (missingMatches.length > 0) {
      setSaveErrorMessage(`Failed to save ${missingMatches.length} match(es). Please try again.`);
      setSaveErrorModalOpen(true);
      setSaving(null);
      return;
    }

    // Update brackets state with saved winners
    const updatedMatchesMap = new Map(roundMatches.map(rm => [rm.matchNumber, rm]));
    const updatedBrackets: Match[] = brackets.map((m) => {
      const updatedMatch = updatedMatchesMap.get(m.matchNumber);
      return updatedMatch || m;
    });
    
    setBrackets(updatedBrackets);

    // Generate next round if Round 1 is saved (for 1-bracket system)
    if (round === 1 && category === 'upper' && bracketType === '1-bracket') {
      await generateNextRound(targetTournamentId, roundMatches, updatedBrackets);
    }
    
    // Generate Round 3 from Round 2 winners and Lower Bracket Round 2 from Round 2 losers
    if (round === 2 && category === 'upper' && bracketType === '1-bracket') {
      // Generate Round 3 from winners first
      await generateNextRound(targetTournamentId, roundMatches, updatedBrackets);
      
      // Generate Lower Bracket Round 2 from losers
      // Note: generateLowerBracketRound2 queries the database directly for match numbers
      await generateLowerBracketRound2(targetTournamentId, roundMatches, updatedBrackets);
    }

    // Generate Lower Bracket Round 2 Final (round 20) from Lower Bracket Round 2 winners
    if (round === 2 && category === 'lower' && bracketType === '1-bracket') {
      await generateLowerBracketRound2Final(targetTournamentId, roundMatches);
    }
    
    // Generate Round 4 from Round 3 winners and Lower Bracket Round 3 from Round 3 losers
    if (round === 3 && category === 'upper' && bracketType === '1-bracket') {
      // Generate Round 4 from winners
      await generateNextRound(targetTournamentId, roundMatches, updatedBrackets);
      // Generate Lower Bracket Round 3 from losers
      await generateLowerBracketRound3(targetTournamentId, roundMatches, updatedBrackets);
    }
    
    // Generate Lower Bracket Final (round 30) from Lower Bracket Round 2 Final winner and Lower Bracket Round 3 winner
    if ((round === 20 || round === 25) && category === 'lower' && bracketType === '1-bracket') {
      await generateLowerBracketFinal(targetTournamentId, updatedBrackets);
    }

    // Generate Upper Bracket Semi-Final (Round 5) from Round 4 loser and Lower Bracket Final winner
    // This can be triggered when either Round 4 (upper) or Lower Bracket Final (round 30, lower) is saved
    if (
      bracketType === '1-bracket' &&
      ((round === 4 && category === 'upper') || (round === 30 && category === 'lower'))
    ) {
      await generateUpperSemiFromRound4AndLowerFinal(targetTournamentId, updatedBrackets);
    }

    // Generate Final Round (Round 6) from Round 4 winner and Upper Bracket Semi-Final (Round 5) winner
    if (round === 5 && category === 'upper' && bracketType === '1-bracket') {
      await generateFinalFromRound4AndSemi(targetTournamentId, updatedBrackets);
    }

    // After Final Game (Round 6) is saved, create Champion, 1st Runner Up, 2nd Runner Up
    if (round === 6 && category === 'upper' && bracketType === '1-bracket') {
      await createChampionsFromFinal(targetTournamentId, updatedBrackets);
    }

    // Reload brackets from database (this will load both Round 3 and Lower Bracket Round 2)
    await loadBrackets(targetTournamentId, teams);
    
    // Collapse the round when it's saved
    const roundKey = category === 'lower' ? `lower-round-${round}` : `upper-round-${round}`;
    setExpandedRounds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(roundKey);
      // Auto-expand Round 2 if Round 1 was just saved
      if (round === 1 && category === 'upper') {
        newSet.add('upper-round-2');
      }
      // Auto-expand Round 3 and Lower Bracket Round 2 if Round 2 was just saved
      if (round === 2 && category === 'upper') {
        newSet.add('upper-round-3');
        newSet.add('lower-round-2');
      }
      // Auto-expand Lower Bracket Round 2 Final if Lower Bracket Round 2 was just saved
      if (round === 2 && category === 'lower') {
        newSet.add('lower-round-20');
      }
      // Auto-expand Round 4 and Lower Bracket Round 3 if Round 3 was just saved
      if (round === 3 && category === 'upper') {
        newSet.add('upper-round-4');
        newSet.add('lower-round-25');
      }
      // Auto-expand Lower Bracket Final if Lower Bracket Round 2 Final or Lower Bracket Round 3 was just saved
      if ((round === 20 || round === 25) && category === 'lower') {
        newSet.add('lower-round-30');
      }
      // Auto-expand Upper Semi (Round 5) if Round 4 or Lower Bracket Final was just saved
      if ((round === 4 && category === 'upper') || (round === 30 && category === 'lower')) {
        newSet.add('upper-round-5');
      }
      // Auto-expand Final (Round 6) if Round 5 was just saved
      if (round === 5 && category === 'upper') {
        newSet.add('upper-round-6');
      }
      return newSet;
    });
    
    setSaveSuccessModalOpen(true);
    setSaving(null);
  };

  // Generate next round from winners
  const generateNextRound = async (
    targetTournamentId: string,
    completedRoundMatches: Match[],
    currentBrackets: Match[]
  ) => {
    // Get winners from completed round
    const winners = completedRoundMatches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const winnerTeam =
          m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null;
        return { team: winnerTeam, parentMatch: m.matchNumber };
      })
      .filter((w) => w.team !== null);

    console.log(`Generating Round 2 from ${winners.length} winners`);

    // Need at least 2 winners to create matches
    if (winners.length < 2) {
      console.log('Not enough winners to generate next round');
      return;
    }

    const nextRound = completedRoundMatches[0].round + 1;

    // Check if next round already exists
    const nextRoundExists = currentBrackets.some(
      (m) => m.round === nextRound && m.bracket === 1 && m.bracketCategory === 'upper',
    );

    if (nextRoundExists) {
      console.log(`Round ${nextRound} already exists`);
      return;
    }

    // Check database
    const { data: existingNextRound } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', nextRound);

    if (existingNextRound && existingNextRound.length > 0) {
      console.log(`Round ${nextRound} already exists in database`);
      return;
    }

    // Create matches by pairing winners
    const newMatches: Match[] = [];
    let nextMatchNumber = Math.max(...currentBrackets.map((m) => m.matchNumber), 0) + 1;

    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        newMatches.push({
          team1: winners[i].team,
          team2: winners[i + 1].team,
          round: nextRound,
          matchNumber: nextMatchNumber++,
          bracket: 1,
          bracketCategory: 'upper',
          winner: null,
          parentMatch1: winners[i].parentMatch,
          parentMatch2: winners[i + 1].parentMatch,
        });
      } else {
        // Odd number of winners - bye to next round
        newMatches.push({
          team1: winners[i].team,
          team2: null,
          round: nextRound,
          matchNumber: nextMatchNumber++,
          bracket: 1,
          bracketCategory: 'upper',
          winner: null,
          parentMatch1: winners[i].parentMatch,
        });
      }
    }

    if (newMatches.length === 0) {
      console.log('No new matches to create');
      return;
    }

    // Save new matches to database
    const bracketData = newMatches.map((m) => ({
      tournament_id: targetTournamentId,
      team1_id: m.team1?.id || null,
      team2_id: m.team2?.id || null,
      round: m.round,
      match_number: m.matchNumber,
      winner_id: null,
    }));

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Round 2 matches:', insertError);
      return;
    }

    console.log(`Successfully created ${newMatches.length} matches for Round ${nextRound}`);
  };

  // Generate Lower Bracket Round 2 from Round 2 losers
  const generateLowerBracketRound2 = async (
    targetTournamentId: string,
    round2Matches: Match[],
    currentBrackets: Match[]
  ) => {
    // Get losers from Round 2
    const losers = round2Matches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const loserTeam =
          m.winner === 'team1' ? m.team2 : m.winner === 'team2' ? m.team1 : null;
        return { team: loserTeam, parentMatch: m.matchNumber };
      })
      .filter((l) => l.team !== null);

    console.log(`Generating Lower Bracket Round 2 from ${losers.length} losers`);
    console.log('Round 2 matches:', round2Matches.map(m => ({
      matchNumber: m.matchNumber,
      winner: m.winner,
      team1: m.team1?.team_name,
      team2: m.team2?.team_name
    })));
    console.log('Losers:', losers.map(l => l.team?.team_name));

    // Need exactly 4 losers for Lower Bracket Round 2
    if (losers.length !== 4) {
      console.log(`Expected 4 losers, got ${losers.length}`);
      return;
    }

    // Check if Lower Bracket Round 2 already exists
    const lowerRound2Exists = currentBrackets.some(
      (m) => m.round === 2 && m.bracketCategory === 'lower',
    );

    if (lowerRound2Exists) {
      console.log('Lower Bracket Round 2 already exists');
      return;
    }

    // Check database - count Round 2 matches
    const { data: existingRound2 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 2);

    // If we have more than 4 Round 2 matches, lower bracket already exists
    if (existingRound2 && existingRound2.length > 4) {
      console.log('Lower Bracket Round 2 already exists in database');
      return;
    }

    // Create Lower Bracket Round 2 matches (2 matches: Loser 1 vs Loser 2, Loser 3 vs Loser 4)
    const newMatches: Match[] = [];
    
    // Get the highest match number from all brackets (including any Round 3 matches that might have been created)
    // We need to check the database to get the actual highest match number
    const { data: allMatches } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .order('match_number', { ascending: false })
      .limit(1);
    
    const highestMatchNumber = allMatches && allMatches.length > 0 
      ? allMatches[0].match_number 
      : Math.max(...currentBrackets.map((m) => m.matchNumber), 0);
    
    let nextMatchNumber = highestMatchNumber + 1;

    console.log(`Creating Lower Bracket Round 2 matches starting from match number ${nextMatchNumber}`);
    console.log('Losers:', losers.map(l => l.team?.team_name));

    // Match 1: Loser from Round 2 Match 1 vs Loser from Round 2 Match 2
    // Match 2: Loser from Round 2 Match 3 vs Loser from Round 2 Match 4
    for (let i = 0; i < losers.length; i += 2) {
      if (i + 1 < losers.length && losers[i].team && losers[i + 1].team) {
        const matchNumber = nextMatchNumber++;
        newMatches.push({
          team1: losers[i].team,
          team2: losers[i + 1].team,
          round: 2, // Lower Bracket Round 2
          matchNumber: matchNumber,
          bracket: 1,
          bracketCategory: 'lower',
          winner: null,
          parentMatch1: losers[i].parentMatch,
          parentMatch2: losers[i + 1].parentMatch,
        });
        console.log(`Created Lower Bracket Round 2 match ${matchNumber}: ${losers[i].team?.team_name} vs ${losers[i + 1].team?.team_name}`);
      }
    }

    if (newMatches.length === 0) {
      console.log('No new matches to create for Lower Bracket Round 2');
      return;
    }

    // Save new matches to database
    const bracketData = newMatches.map((m) => ({
      tournament_id: targetTournamentId,
      team1_id: m.team1?.id || null,
      team2_id: m.team2?.id || null,
      round: m.round,
      match_number: m.matchNumber,
      winner_id: null,
    }));

    console.log(`Inserting ${bracketData.length} Lower Bracket Round 2 matches into database:`, bracketData);
    
    const { error: insertError, data: insertedData } = await supabase.from('brackets').insert(bracketData).select();
    if (insertError) {
      console.error('Error inserting Lower Bracket Round 2 matches:', insertError);
      return;
    }

    console.log(`Successfully created ${newMatches.length} matches for Lower Bracket Round 2`);
    console.log('Inserted matches:', insertedData);
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
      // If no tournament exists, just clear winners from state
      setBrackets((prev) =>
        prev.map((m) =>
          m.round === round && m.bracket === bracket && m.bracketCategory === category ? { ...m, winner: null } : m,
        ),
      );
      return;
    }

    // Clear winners in database for the current round
    for (const match of roundMatches) {
      await supabase
        .from('brackets')
        .update({ winner_id: null })
        .eq('tournament_id', targetTournamentId)
        .eq('match_number', match.matchNumber);
    }
    
    // Reload brackets from database
    if (targetTournamentId) {
      await loadBrackets(targetTournamentId, teams);
    }
  };

  // Remove all commented out generation functions
  /*
  const generateLowerBracketFromRound2Losers = async (targetTournamentId: string, currentBrackets?: Match[]) => {
    const { data: existingLowerRound2 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 2);
    
    // Count how many Round 2 matches exist - if more than 4, lower bracket already exists
    if (existingLowerRound2 && existingLowerRound2.length > 4) {
      console.log('Lower Bracket Round 2 already exists in database');
      return;
    }
    
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

    // Check database first to see if lower bracket Round 2 already exists
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

        const { error: insertError } = await supabase.from('brackets').insert(bracketData);
        if (insertError) {
          console.error('Error inserting Lower Bracket Round 2:', insertError);
          return;
        }
        console.log(`Successfully inserted ${matchesToSave.length} Lower Bracket Round 2 matches`);
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

      const { error: insertError } = await supabase.from('brackets').insert(bracketData);
      if (insertError) {
        console.error('Error inserting Lower Bracket Round 2:', insertError);
        return;
      }
      console.log(`Successfully inserted ${newMatches.length} Lower Bracket Round 2 matches`);
    }

    // Don't add to state here - let loadBrackets handle it after database insert
  };
  */

  const generateLowerBracketRound2Final = async (targetTournamentId: string, round2Matches?: Match[]) => {
    // If round2Matches is provided (from saveRound), use those; otherwise get from brackets state
    // IMPORTANT: round2Matches passed from saveRound are already filtered to Lower Bracket Round 2
    // If not provided, filter to get only Lower Bracket Round 2 matches
    const lowerBracketRound2Matches = round2Matches || brackets.filter(
      (m) => m.round === 2 && m.bracketCategory === 'lower',
    );
    
    console.log('generateLowerBracketRound2SemiFinal - Input matches:', lowerBracketRound2Matches.length);
    console.log('Matches details:', lowerBracketRound2Matches.map(m => ({
      matchNumber: m.matchNumber,
      round: m.round,
      bracketCategory: m.bracketCategory,
      winner: m.winner,
      team1: m.team1?.team_name,
      team2: m.team2?.team_name
    })));

    // Get winners from Lower Bracket Round 2
    // Make sure we only process Lower Bracket Round 2 matches (round 2, lower category)
    const validLowerBracketRound2Matches = lowerBracketRound2Matches.filter(
      (m) => m.round === 2 && m.bracketCategory === 'lower'
    );
    
    console.log('generateLowerBracketRound2SemiFinal - Valid Lower Bracket Round 2 matches:', validLowerBracketRound2Matches.length);
    
    const winners = validLowerBracketRound2Matches
      .filter((m) => m.winner !== null)
      .map((m) => (m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : null))
      .filter((t): t is Team => t !== null);

    console.log('Winners from Lower Bracket Round 2:', winners.length, winners.map(w => w.team_name));

    // Need 2 winners for semi-final
    if (winners.length !== 2) {
      console.log('Not enough winners in Lower Bracket Round 2:', winners.length, 'matches:', validLowerBracketRound2Matches.length);
      console.log('Expected 2 winners, got:', winners.length);
      return;
    }

    // Check if semi-final already exists in database first
    // Note: bracket_category might not be a column, so we'll check by round and match numbers
    const { data: existingSemiFinal } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 20);
    
    if (existingSemiFinal && existingSemiFinal.length > 0) {
      console.log('Lower Bracket Round 2 Semi-Final already exists in database');
      return;
    }

    // Check if semi-final already exists in state
    const currentBrackets = brackets;
    const semiFinalExists = currentBrackets.some((m) => m.round === 20 && m.bracketCategory === 'lower');
    if (semiFinalExists) {
      console.log('Lower Bracket Round 2 Semi-Final already exists in state');
      return;
    }

    // Get the highest match number from database to ensure we don't conflict
    const { data: allMatches } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .order('match_number', { ascending: false })
      .limit(1);
    
    const highestMatchNumber = allMatches && allMatches.length > 0 
      ? allMatches[0].match_number 
      : Math.max(...currentBrackets.map((m) => m.matchNumber), 0);
    
    const nextMatchNumber = highestMatchNumber + 1;
    const semiFinalMatch: Match = {
      team1: winners[0],
      team2: winners[1],
      round: 20, // Lower Bracket Round 2 Final
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
    };

    // Save to database first
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: semiFinalMatch.team1?.id || null,
      team2_id: semiFinalMatch.team2?.id || null,
      round: 20,
      match_number: semiFinalMatch.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Lower Bracket Round 2 Semi-Final:', insertError);
      return;
    }

    // Don't add to state here - let loadBrackets handle it after database insert
    console.log('Lower Bracket Round 2 Final saved to database, will be loaded by loadBrackets');
  };

  // Generate Lower Bracket Round 3 from Round 3 losers
  const generateLowerBracketRound3 = async (
    targetTournamentId: string,
    round3Matches: Match[],
    currentBrackets: Match[]
  ) => {
    // Get losers from Round 3 (upper bracket)
    const losers = round3Matches
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => {
        const loserTeam =
          m.winner === 'team1' ? m.team2 : m.winner === 'team2' ? m.team1 : null;
        return { team: loserTeam, parentMatch: m.matchNumber };
      })
      .filter((l) => l.team !== null);

    console.log(`Generating Lower Bracket Round 3 from ${losers.length} losers`);

    // Need exactly 2 losers for Lower Bracket Round 3
    if (losers.length !== 2) {
      console.log(`Expected 2 losers, got ${losers.length}`);
      return;
    }

    // Check if Lower Bracket Round 3 already exists
    const lowerRound3Exists = currentBrackets.some(
      (m) => m.round === 25 && m.bracketCategory === 'lower',
    );

    if (lowerRound3Exists) {
      console.log('Lower Bracket Round 3 already exists');
      return;
    }

    // Check database
    const { data: existingLowerRound3 } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 25);

    if (existingLowerRound3 && existingLowerRound3.length > 0) {
      console.log('Lower Bracket Round 3 already exists in database');
      return;
    }

    // Get the highest match number from database
    const { data: allMatches } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .order('match_number', { ascending: false })
      .limit(1);
    
    const highestMatchNumber = allMatches && allMatches.length > 0 
      ? allMatches[0].match_number 
      : Math.max(...currentBrackets.map((m) => m.matchNumber), 0);
    
    const nextMatchNumber = highestMatchNumber + 1;

    // Create Lower Bracket Round 3 match (1 match: Loser 1 vs Loser 2)
    const newMatch: Match = {
      team1: losers[0].team,
      team2: losers[1].team,
      round: 25, // Lower Bracket Round 3
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
      parentMatch1: losers[0].parentMatch,
      parentMatch2: losers[1].parentMatch,
    };

    // Save to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: newMatch.team1?.id || null,
      team2_id: newMatch.team2?.id || null,
      round: 25,
      match_number: newMatch.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Lower Bracket Round 3:', insertError);
      return;
    }

    console.log('Lower Bracket Round 3 saved to database, will be loaded by loadBrackets');
  };

  // Generate Lower Bracket Final (round 30) from Lower Bracket Round 2 Final winner and Lower Bracket Round 3 winner
  const generateLowerBracketFinal = async (
    targetTournamentId: string,
    currentBrackets: Match[]
  ) => {
    // Check if Lower Bracket Final already exists
    const { data: existingFinal } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 30);
    
    if (existingFinal && existingFinal.length > 0) {
      console.log('Lower Bracket Final already exists in database');
      return;
    }
    
    const lowerBracketFinalExists = currentBrackets.some((m) => m.round === 30 && m.bracketCategory === 'lower');
    if (lowerBracketFinalExists) {
      console.log('Lower Bracket Final already exists in state');
      return;
    }

    // Get Lower Bracket Round 2 Final winner (round 20)
    const lowerBracketRound2Final = currentBrackets.find(
      (m) => m.round === 20 && m.bracketCategory === 'lower',
    );
    const lowerBracketRound2Winner = lowerBracketRound2Final?.winner === 'team1'
      ? lowerBracketRound2Final.team1
      : lowerBracketRound2Final?.winner === 'team2'
        ? lowerBracketRound2Final.team2
        : null;

    // Get Lower Bracket Round 3 winner (round 25)
    const lowerBracketRound3Match = currentBrackets.find(
      (m) => m.round === 25 && m.bracketCategory === 'lower',
    );
    const lowerBracketRound3Winner = lowerBracketRound3Match?.winner === 'team1'
      ? lowerBracketRound3Match.team1
      : lowerBracketRound3Match?.winner === 'team2'
        ? lowerBracketRound3Match.team2
        : null;

    // Need both winners
    if (!lowerBracketRound2Winner || !lowerBracketRound3Winner) {
      console.log('Waiting for both Lower Bracket Round 2 Final and Lower Bracket Round 3 to have winners');
      return;
    }

    // Get the highest match number from database
    const { data: allMatches } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .order('match_number', { ascending: false })
      .limit(1);
    
    const highestMatchNumber = allMatches && allMatches.length > 0 
      ? allMatches[0].match_number 
      : Math.max(...currentBrackets.map((m) => m.matchNumber), 0);
    
    const nextMatchNumber = highestMatchNumber + 1;

    // Create Lower Bracket Final match
    const lowerBracketFinalMatch: Match = {
      team1: lowerBracketRound2Winner,
      team2: lowerBracketRound3Winner,
      round: 30, // Lower Bracket Final
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
    };

    // Save to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: lowerBracketFinalMatch.team1?.id || null,
      team2_id: lowerBracketFinalMatch.team2?.id || null,
      round: 30,
      match_number: lowerBracketFinalMatch.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Lower Bracket Final:', insertError);
      return;
    }

    console.log('Lower Bracket Final saved to database, will be loaded by loadBrackets');
  };

  // Generate Upper Bracket Semi-Final (Round 5) from Round 4 loser and Lower Bracket Final (round 30) winner
  const generateUpperSemiFromRound4AndLowerFinal = async (
    targetTournamentId: string,
    currentBrackets: Match[]
  ) => {
    // Find Round 4 (upper) match
    const round4Match = currentBrackets.find(
      (m) => m.round === 4 && m.bracket === 1 && m.bracketCategory === 'upper',
    );

    // Find Lower Bracket Final (round 30) match
    const lowerFinalMatch = currentBrackets.find(
      (m) => m.round === 30 && m.bracketCategory === 'lower',
    );

    if (!round4Match || !lowerFinalMatch) {
      console.log('Cannot generate Upper Semi: missing Round 4 or Lower Bracket Final match');
      return;
    }

    if (!round4Match.winner || !lowerFinalMatch.winner) {
      console.log('Cannot generate Upper Semi: winners not decided yet');
      return;
    }

    // Determine Round 4 loser
    const round4Loser =
      round4Match.winner === 'team1' ? round4Match.team2 : round4Match.team1;

    if (!round4Loser) {
      console.log('Cannot generate Upper Semi: Round 4 loser not found');
      return;
    }

    // Determine Lower Bracket Final winner
    const lowerFinalWinner =
      lowerFinalMatch.winner === 'team1' ? lowerFinalMatch.team1 :
      lowerFinalMatch.winner === 'team2' ? lowerFinalMatch.team2 :
      null;

    if (!lowerFinalWinner) {
      console.log('Cannot generate Upper Semi: Lower Bracket Final winner not found');
      return;
    }

    // Check if Round 5 (Upper Semi) already exists
    const upperSemiExists = currentBrackets.some(
      (m) => m.round === 5 && m.bracket === 1 && m.bracketCategory === 'upper',
    );
    if (upperSemiExists) {
      console.log('Upper Bracket Semi-Final (Round 5) already exists');
      return;
    }

    // Check database for existing Round 5
    const { data: existingSemi } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 5);
    if (existingSemi && existingSemi.length > 0) {
      console.log('Upper Bracket Semi-Final (Round 5) already exists in database');
      return;
    }

    // Get highest match number to continue numbering
    const { data: allMatches } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .order('match_number', { ascending: false })
      .limit(1);

    const highestMatchNumber = allMatches && allMatches.length > 0
      ? allMatches[0].match_number
      : Math.max(...currentBrackets.map((m) => m.matchNumber), 0);

    const nextMatchNumber = highestMatchNumber + 1;

    // Create Upper Bracket Semi-Final match (Round 5)
    const semiMatch: Match = {
      team1: lowerFinalWinner,
      team2: round4Loser,
      round: 5,
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'upper',
      winner: null,
      parentMatch1: lowerFinalMatch.matchNumber,
      parentMatch2: round4Match.matchNumber,
    };

    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: semiMatch.team1?.id || null,
      team2_id: semiMatch.team2?.id || null,
      round: semiMatch.round,
      match_number: semiMatch.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Upper Bracket Semi-Final (Round 5):', insertError);
      return;
    }

    console.log('Upper Bracket Semi-Final (Round 5) saved to database, will be loaded by loadBrackets');
  };

  // Generate Final Round (Round 6) from Round 4 winner and Upper Bracket Semi-Final (Round 5) winner
  const generateFinalFromRound4AndSemi = async (
    targetTournamentId: string,
    currentBrackets: Match[]
  ) => {
    // Find Round 4 (upper) match
    const round4Match = currentBrackets.find(
      (m) => m.round === 4 && m.bracket === 1 && m.bracketCategory === 'upper',
    );

    // Find Round 5 (upper semi) match
    const semiMatch = currentBrackets.find(
      (m) => m.round === 5 && m.bracket === 1 && m.bracketCategory === 'upper',
    );

    if (!round4Match || !semiMatch) {
      console.log('Cannot generate Final: missing Round 4 or Round 5 match');
      return;
    }

    if (!round4Match.winner || !semiMatch.winner) {
      console.log('Cannot generate Final: winners not decided yet');
      return;
    }

    const round4Winner =
      round4Match.winner === 'team1' ? round4Match.team1 : round4Match.team2;
    const semiWinner =
      semiMatch.winner === 'team1' ? semiMatch.team1 : semiMatch.team2;

    if (!round4Winner || !semiWinner) {
      console.log('Cannot generate Final: winners not found');
      return;
    }

    // Check if Final Round (Round 6) already exists
    const finalExists = currentBrackets.some(
      (m) => m.round === 6 && m.bracket === 1 && m.bracketCategory === 'upper',
    );
    if (finalExists) {
      console.log('Final Round (Round 6) already exists');
      return;
    }

    const { data: existingFinal } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 6);
    if (existingFinal && existingFinal.length > 0) {
      console.log('Final Round (Round 6) already exists in database');
      return;
    }

    // Get highest match number
    const { data: allMatches } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .order('match_number', { ascending: false })
      .limit(1);

    const highestMatchNumber = allMatches && allMatches.length > 0
      ? allMatches[0].match_number
      : Math.max(...currentBrackets.map((m) => m.matchNumber), 0);

    const nextMatchNumber = highestMatchNumber + 1;

    const finalMatch: Match = {
      team1: round4Winner,
      team2: semiWinner,
      round: 6,
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'upper',
      winner: null,
      parentMatch1: round4Match.matchNumber,
      parentMatch2: semiMatch.matchNumber,
    };

    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: finalMatch.team1?.id || null,
      team2_id: finalMatch.team2?.id || null,
      round: finalMatch.round,
      match_number: finalMatch.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Final Round (Round 6):', insertError);
      return;
    }

    console.log('Final Round (Round 6) saved to database, will be loaded by loadBrackets');
  };

  // Create Champion, 1st Runner Up, 2nd Runner Up from Final Game (Round 6) and Semi (Round 5)
  const createChampionsFromFinal = async (
    targetTournamentId: string,
    currentBrackets: Match[]
  ) => {
    // Find Final Game (Round 6, upper)
    const finalMatch = currentBrackets.find(
      (m) => m.round === 6 && m.bracket === 1 && m.bracketCategory === 'upper',
    );

    // Find Semi (Round 5, upper)
    const semiMatch = currentBrackets.find(
      (m) => m.round === 5 && m.bracket === 1 && m.bracketCategory === 'upper',
    );

    if (!finalMatch || !semiMatch) {
      console.log('Cannot create champions: missing final or semi match');
      return;
    }

    if (!finalMatch.winner || !semiMatch.winner) {
      console.log('Cannot create champions: winners not decided yet');
      return;
    }

    const championTeam =
      finalMatch.winner === 'team1' ? finalMatch.team1 : finalMatch.team2;
    const firstRunnerUpTeam =
      finalMatch.winner === 'team1' ? finalMatch.team2 : finalMatch.team1;
    const secondRunnerUpTeam =
      semiMatch.winner === 'team1' ? semiMatch.team2 : semiMatch.team1;

    if (!championTeam || !firstRunnerUpTeam || !secondRunnerUpTeam) {
      console.log('Cannot create champions: some teams not found');
      return;
    }

    // Simple ISO week calculation
    const getISOWeek = (date: Date) => {
      const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const now = new Date();
    const week = getISOWeek(now);
    const year = now.getFullYear();

    const championsPayload = [
      {
        team_id: championTeam.id,
        tournament_id: targetTournamentId,
        position: 1, // Champion
        week,
        year,
      },
      {
        team_id: firstRunnerUpTeam.id,
        tournament_id: targetTournamentId,
        position: 2, // 1st Runner Up
        week,
        year,
      },
      {
        team_id: secondRunnerUpTeam.id,
        tournament_id: targetTournamentId,
        position: 3, // 2nd Runner Up
        week,
        year,
      },
    ];

    const { error: championsError } = await supabase
      .from('champions')
      .insert(championsPayload);

    if (championsError) {
      console.error('Error inserting champions:', championsError);
      return;
    }

    console.log('Champions created successfully');
    setChampionTeam(championTeam);
    setChampionModalOpen(true);
  };

  /*
  const generateLowerBracketRound3FromRound3Losers = async (targetTournamentId: string, currentBrackets?: Match[]) => {
    // Use provided brackets or current state
    const bracketsToUse = currentBrackets || brackets;
    
    // Check database first to see if lower bracket Round 3 already exists
    const { data: existingRound3 } = await supabase
      .from('brackets')
      .select('match_number, round')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 3);
    
    // Count how many Round 3 matches exist - if we have upper bracket Round 3 (2 matches) + lower bracket (1 match) = 3 total
    // Upper bracket Round 3 should have 2 matches, so if we have 3 or more, lower bracket exists
    const upperRound3Count = bracketsToUse.filter((m) => m.round === 3 && m.bracketCategory === 'upper').length;
    const totalRound3InDb = existingRound3?.length || 0;
    
    if (upperRound3Count >= 2 && totalRound3InDb >= 3) {
      console.log('Lower Bracket Round 3 already exists in database');
      return;
    }
    
    // Check if lower bracket Round 3 already exists in state
    const lowerBracketRound3Exists = bracketsToUse.some((m) => m.round === 3 && m.bracketCategory === 'lower');
    if (lowerBracketRound3Exists) {
      console.log('Lower Bracket Round 3 already exists in state');
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

    // Check database first to see if lower bracket Round 3 already exists
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

    if (lowerRound3Exists) {
      console.log('Lower Bracket Round 3 already exists in database');
      return;
    }

    // Save to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: lowerBracketRound3Match.team1?.id || null,
      team2_id: lowerBracketRound3Match.team2?.id || null,
      round: 3,
      match_number: lowerBracketRound3Match.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Lower Bracket Round 3:', insertError);
      return;
    }

    // Don't add to state here - let loadBrackets handle it after database insert
    console.log('Lower Bracket Round 3 saved to database, will be loaded by loadBrackets');
  };
  */

  /*
  const generateLowerBracketFinal = async (targetTournamentId: string, currentBrackets?: Match[]) => {
    // Use provided brackets or current state
    const bracketsToUse = currentBrackets || brackets;
    
    // Check database first
    const { data: existingFinal } = await supabase
      .from('brackets')
      .select('match_number')
      .eq('tournament_id', targetTournamentId)
      .eq('round', 3.5);
    
    if (existingFinal && existingFinal.length > 0) {
      console.log('Lower Bracket Final already exists in database');
      return;
    }
    
    // Check if lower bracket final already exists in state
    const lowerBracketFinalExists = bracketsToUse.some((m) => m.round === 3.5 && m.bracketCategory === 'lower');
    if (lowerBracketFinalExists) {
      console.log('Lower Bracket Final already exists in state');
      return;
    }

    // Get Lower Bracket Round 2 Final winner (round 2.5)
    const lowerBracketRound2Final = bracketsToUse.find(
      (m) => m.round === 2.5 && m.bracketCategory === 'lower',
    );
    const lowerBracketRound2Winner = lowerBracketRound2Final?.winner === 'team1'
      ? lowerBracketRound2Final.team1
      : lowerBracketRound2Final?.winner === 'team2'
        ? lowerBracketRound2Final.team2
        : null;

    // Get Lower Bracket Round 3 winner
    const lowerBracketRound3Match = bracketsToUse.find(
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
    const nextMatchNumber = Math.max(...bracketsToUse.map((m) => m.matchNumber), 0) + 1;
    const lowerBracketFinalMatch: Match = {
      team1: lowerBracketRound2Winner,
      team2: lowerBracketRound3Winner,
      round: 3.5, // Lower Bracket Final
      matchNumber: nextMatchNumber,
      bracket: 1,
      bracketCategory: 'lower',
      winner: null,
    };

    // Save to database
    const bracketData = {
      tournament_id: targetTournamentId,
      team1_id: lowerBracketFinalMatch.team1?.id || null,
      team2_id: lowerBracketFinalMatch.team2?.id || null,
      round: 3.5,
      match_number: lowerBracketFinalMatch.matchNumber,
      winner_id: null,
    };

    const { error: insertError } = await supabase.from('brackets').insert(bracketData);
    if (insertError) {
      console.error('Error inserting Lower Bracket Final:', insertError);
      return;
    }

    // Don't add to state here - let loadBrackets handle it after database insert
    console.log('Lower Bracket Final saved to database, will be loaded by loadBrackets');
  };
  */

  /*
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
  */

  /*
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
  */

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
    // Use a special marker for bulk save
    setSaving({ round: -1, bracket: 1 });

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
        setSaving(null);
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

    setSaving(null);
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

      <div className="mb-8 bg-gray-900/50 border border-blue-500/20 rounded-xl p-5 md:p-7 lg:p-8 glow-box">
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
                disabled={saving !== null}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16">
                    {/* Left Column - Lower Bracket */}
                    <div className="space-y-8">
                      <h3 className="text-2xl xl:text-3xl font-bold text-yellow-400 mb-6 sticky top-0 bg-black/80 backdrop-blur-sm py-2 z-10">
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
                          // For Lower Bracket Round 2, check if round 20 (Lower Bracket Round 2 Final) exists
                          let isRoundSaved = allHaveWinners;
                          if (round === 2) {
                            // Check if Lower Bracket Round 2 Final (round 20) exists
                            const lowerBracketRound2FinalExists = brackets.some(
                              (m) => m.round === 20 && m.bracketCategory === 'lower'
                            );
                            isRoundSaved = allHaveWinners && lowerBracketRound2FinalExists;
                          }
                          // For Lower Bracket Round 3 (round 25), check if Lower Bracket Final (round 30) exists
                          if (round === 25) {
                            const lowerBracketFinalExists = brackets.some(
                              (m) => m.round === 30 && m.bracketCategory === 'lower'
                            );
                            isRoundSaved = allHaveWinners && lowerBracketFinalExists;
                          }
                          const roundKey = `lower-round-${round}`;
                          // Default to collapsed if saved, expanded if not saved
                          const isExpanded = isRoundSaved ? expandedRounds.has(roundKey) : true;
                          
                          return (
                            <div key={`lower-round-${round}`} className="bg-black/20 border border-yellow-500/30 rounded-lg p-5 md:p-6 lg:p-7">
                              <div className="flex items-center justify-between mb-3">
                                {isRoundSaved ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleRound(roundKey)}
                                    className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-yellow-400" /> : <ChevronDown className="w-5 h-5 text-yellow-400" />}
                                    <h4 className="text-xl font-semibold text-yellow-400">
                                      {round === 20 ? 'Lower Bracket Round 2 Final' : round === 25 ? 'Lower Bracket Round 3' : round === 30 ? 'Lower Bracket Final' : `Round ${round}`}
                                      <span className="text-sm text-green-400 ml-2">✓ Saved</span>
                                    </h4>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 flex-1">
                                    <h4 className="text-xl font-semibold text-yellow-400">
                                      {round === 20 ? 'Lower Bracket Round 2 Final' : round === 25 ? 'Lower Bracket Round 3' : round === 30 ? 'Lower Bracket Final' : `Round ${round}`}
                                    </h4>
                                  </div>
                                )}
                              </div>
                              {isExpanded && (
                                <>
                                  <div className="grid grid-cols-1 gap-4 md:gap-5 lg:gap-6">
                                    {roundMatches.map((match) => (
                                      <div
                                        key={`lower-${match.matchNumber}`}
                                        className="bg-black/30 border border-yellow-500/20 rounded-lg p-4 md:p-5 lg:p-6"
                                      >
                                        <div className="text-yellow-400 text-sm md:text-base lg:text-lg mb-3 md:mb-4">
                                          Lower Bracket Match {roundMatches.length === 2 && match.matchNumber === roundMatches[0]?.matchNumber ? '1' : roundMatches.length === 2 ? '2' : match.matchNumber}
                                        </div>
                                        <div className="space-y-2 md:space-y-3 lg:space-y-4">
                                          <div
                                            className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
                                              match.winner === 'team1'
                                                ? 'glow-green-border bg-green-900/10'
                                                : match.winner === 'team2'
                                                  ? 'glow-red-border bg-red-900/10'
                                                  : 'bg-gray-800/50 border-gray-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-white font-semibold text-base md:text-lg lg:text-xl truncate">
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
                                            className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
                                              match.winner === 'team2'
                                                ? 'glow-green-border bg-green-900/10'
                                                : match.winner === 'team1'
                                                  ? 'glow-red-border bg-red-900/10'
                                                  : 'bg-gray-800/50 border-gray-700'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-white font-semibold text-base md:text-lg lg:text-xl truncate">
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
                                        <span>Cancel Round {round}</span>
                                      </button>
                                    )}
                                    {!isRoundSaved && (
                                      <button
                                        type="button"
                                        onClick={() => saveRound(round, 1, 'lower')}
                                        disabled={!allHaveWinners || (saving?.round === round && saving?.bracketCategory === 'lower')}
                                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                      >
                                        {(saving?.round === round && saving?.bracketCategory === 'lower') ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Save className="w-4 h-4" />
                                        )}
                                        <span>{(saving?.round === round && saving?.bracketCategory === 'lower') ? 'Saving...' : `Save Round ${round}`}</span>
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
                        // For Round 4, check if Round 5 exists (Upper Semi)
                        // For Round 5, check if Round 6 exists (Final Game)
                        // A round is saved if all matches have winners AND the next round exists
                        let isRoundSaved = false;
                        if (round === 3) {
                          // Round 3 is saved if all have winners AND Round 4 exists
                          const round4Exists = brackets.some(
                            (m) => m.round === 4 && m.bracket === 1 && m.bracketCategory === 'upper',
                          );
                          isRoundSaved = allHaveWinners && round4Exists;
                        } else if (round === 4) {
                          // Round 4 is saved if all have winners AND Round 5 (Upper Semi) exists
                          const round5Exists = brackets.some(
                            (m) => m.round === 5 && m.bracket === 1 && m.bracketCategory === 'upper',
                          );
                          isRoundSaved = allHaveWinners && round5Exists;
                        } else if (round === 5) {
                          // Round 5 is saved if all have winners AND Round 6 (Final Game) exists
                          const round6Exists = brackets.some(
                            (m) => m.round === 6 && m.bracket === 1 && m.bracketCategory === 'upper',
                          );
                          isRoundSaved = allHaveWinners && round6Exists;
                        } else {
                          // For other rounds, use the standard check
                          isRoundSaved = allHaveWinners && nextRoundExists;
                        }
                        const roundKey = `upper-round-${round}`;
                        // Default to collapsed if saved, expanded if not saved
                        const isExpanded = isRoundSaved ? expandedRounds.has(roundKey) : true;

                        return (
                          <div key={`round-${round}`} className="bg-black/20 border border-blue-500/30 rounded-lg p-5 md:p-6 lg:p-7">
                            <div className="flex items-center justify-between mb-3">
                              {isRoundSaved ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRound(roundKey)}
                                  className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  {isExpanded ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
                                  <h4 className="text-xl font-semibold text-blue-400">
                                    {round === 6 ? 'Final Game' : `Round ${round} ${round === 1 ? '(16 Teams)' : ''}`}
                                    <span className="text-sm text-green-400 ml-2">✓ Saved</span>
                                  </h4>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 flex-1">
                                  <h4 className="text-xl font-semibold text-blue-400">
                                    {round === 6 ? 'Final Game' : `Round ${round} ${round === 1 ? '(16 Teams)' : ''}`}
                                  </h4>
                                </div>
                              )}
                            </div>
                            {isExpanded && (
                              <>
                                <div className="grid grid-cols-1 gap-4 md:gap-5 lg:gap-6">
                                  {roundMatches.map((match) => (
                                    <div
                                      key={`b1-${match.matchNumber}`}
                  className="bg-black/30 border border-blue-500/20 rounded-lg p-4 md:p-5 lg:p-6"
                >
                                      <div className="text-blue-400 text-sm md:text-base lg:text-lg mb-3 md:mb-4">
                                        Match {match.matchNumber}
                                      </div>
                  <div className="space-y-1.5 md:space-y-2">
                                        {/* Team 1 row */}
                                        <div
                                          className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
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
                                          className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
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
                                      onClick={() => saveRound(round, 1, 'upper')}
                                      disabled={!allHaveWinners || (saving?.round === round && saving?.bracketCategory === 'upper')}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                    >
                                      {(saving?.round === round && saving?.bracketCategory === 'upper') ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Save className="w-4 h-4" />
                                      )}
                                      <span>{(saving?.round === round && saving?.bracketCategory === 'upper') ? 'Saving...' : `Save Round ${round}`}</span>
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
              // 2 Brackets System - Show rounds for each bracket
              (() => {
                const bracket1Rounds = Array.from(
                  new Set(brackets.filter((m) => m.bracket === 1 && m.bracketCategory === 'upper').map((m) => m.round)),
                ).sort((a, b) => a - b);
                const bracket2Rounds = Array.from(
                  new Set(brackets.filter((m) => m.bracket === 2 && m.bracketCategory === 'upper').map((m) => m.round)),
                ).sort((a, b) => a - b);

                return (
                  <>
                    {/* Bracket 1 */}
                    <div>
                      <h4 className="text-2xl font-semibold text-white mb-4">Bracket 1</h4>
                      {bracket1Rounds.map((round) => {
                        const roundMatches = brackets
                          .filter((m) => m.bracket === 1 && m.round === round && m.bracketCategory === 'upper')
                          .sort((a, b) => a.matchNumber - b.matchNumber);

                        const allHaveWinners = roundMatches.every((m) => m.winner !== null);
                        const nextRoundExists = brackets.some(
                          (m) => m.round === round + 1 && m.bracket === 1 && m.bracketCategory === 'upper',
                        );
                        const hasAnyWinners = roundMatches.some((m) => m.winner !== null);

                        return (
                          <div key={`b1-round-${round}`} className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-lg font-semibold text-blue-400">
                                Round {round} {round === 1 && '(8 Teams)'}
                              </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
                              {roundMatches.map((match) => (
                    <div
                      key={`b1-${match.matchNumber}`}
                      className="bg-black/30 border border-blue-500/20 rounded-lg p-4 md:p-5 lg:p-6"
                    >
                      <div className="text-blue-400 text-xs md:text-sm mb-2 md:mb-3">
                        Bracket 1 - Match {match.matchNumber}
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                        {/* Team 1 row */}
                        <div
                          className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
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
                          className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
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
                                  onClick={() => saveRound(round, 1, 'upper')}
                                  disabled={!allHaveWinners || (saving?.round === round && saving?.bracketCategory === 'upper')}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                >
                                  {(saving?.round === round && saving?.bracketCategory === 'upper') ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                  <span>{(saving?.round === round && saving?.bracketCategory === 'upper') ? 'Saving...' : `Save Round ${round}`}</span>
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
                          .filter((m) => m.bracket === 2 && m.round === round && m.bracketCategory === 'upper')
                          .sort((a, b) => a.matchNumber - b.matchNumber);

                        const allHaveWinners = roundMatches.every((m) => m.winner !== null);
                        const nextRoundExists = brackets.some(
                          (m) => m.round === round + 1 && m.bracket === 2 && m.bracketCategory === 'upper',
                        );
                        const hasAnyWinners = roundMatches.some((m) => m.winner !== null);

                        return (
                          <div key={`b2-round-${round}`} className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-lg font-semibold text-blue-400">
                                Round {round} {round === 1 && '(8 Teams)'}
                              </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
                              {roundMatches.map((match) => (
                    <div
                      key={`b2-${match.matchNumber}`}
                      className="bg-black/30 border border-blue-500/20 rounded-lg p-4 md:p-5 lg:p-6"
                    >
                      <div className="text-blue-400 text-xs md:text-sm mb-2 md:mb-3">
                        Bracket 2 - Match {match.matchNumber}
                      </div>
                      <div className="space-y-1.5 md:space-y-2">
                        {/* Team 1 row */}
                        <div
                          className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
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
                          className={`flex items-center justify-between p-3 md:p-4 lg:p-5 rounded border ${
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
                                  onClick={() => saveRound(round, 2, 'upper')}
                                  disabled={!allHaveWinners || (saving?.round === round && saving?.bracket === 2)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                                >
                                  {(saving?.round === round && saving?.bracket === 2) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                  <span>{(saving?.round === round && saving?.bracket === 2) ? 'Saving...' : `Save Round ${round}`}</span>
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
