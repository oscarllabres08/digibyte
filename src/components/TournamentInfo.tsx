import { useState, useEffect } from 'react';
import { BookOpen, Shield, Trophy } from 'lucide-react';
import { supabase, Tournament } from '../lib/supabase';

export default function TournamentInfo() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (data) {
      setTournaments(data);
      // Use the first active tournament for rules and prize pool
      if (data.length > 0) {
        setActiveTournament(data[0]);
      }
    }
  };

  return (
    <section id="tournaments" className="min-h-screen py-20 relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
            Tournament <span className="text-blue-400 glow-text">Info</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg">Everything you need to know</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-12">
          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 md:p-8 animate-slide-up glow-box-subtle">
            <div className="flex justify-center mb-4">
              <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-blue-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 text-center">Rules & Regulations</h3>
            {activeTournament?.rules ? (
              <ul className="space-y-3 text-gray-300 text-sm md:text-base text-center">
                {activeTournament.rules.split('\n').filter(r => r.trim()).map((rule, idx) => (
                  <li key={idx} className="flex items-center justify-center">
                    <span className="text-blue-400 mr-2 flex-shrink-0">•</span>
                    <span className="break-words">{rule.trim()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-3 text-gray-300 text-sm md:text-base text-center">
                <li className="flex items-center justify-center">
                  <span className="text-blue-400 mr-2 flex-shrink-0">•</span>
                  <span>Teams must consist of 4-8 registered members</span>
                </li>
                <li className="flex items-center justify-center">
                  <span className="text-blue-400 mr-2 flex-shrink-0">•</span>
                  <span>All members must be present on tournament day</span>
                </li>
                <li className="flex items-center justify-center">
                  <span className="text-blue-400 mr-2 flex-shrink-0">•</span>
                  <span>Registration fee must be paid before tournament start</span>
                </li>
                <li className="flex items-center justify-center">
                  <span className="text-blue-400 mr-2 flex-shrink-0">•</span>
                  <span>Fair play and sportsmanship required at all times</span>
                </li>
              </ul>
            )}
          </div>

          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 md:p-8 animate-slide-up delay-200 glow-box-subtle">
            <div className="flex justify-center mb-4">
              <Trophy className="w-10 h-10 md:w-12 md:h-12 text-blue-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 text-center">Prize Pool</h3>
            <div className="space-y-3 md:space-y-4">
              {(activeTournament?.prize_1st || activeTournament?.prize_2nd || activeTournament?.prize_3rd) ? (
                <>
                  {activeTournament.prize_1st && (
                    <div className="p-4 bg-gradient-to-r from-yellow-600/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg text-center">
                      <div className="text-yellow-400 font-semibold text-sm md:text-base mb-1">1st Place</div>
                      <div className="text-lg md:text-2xl font-bold text-white break-words">{activeTournament.prize_1st}</div>
                    </div>
                  )}
                  {activeTournament.prize_2nd && (
                    <div className="p-4 bg-gradient-to-r from-gray-400/20 to-gray-400/10 border border-gray-500/30 rounded-lg text-center">
                      <div className="text-gray-300 font-semibold text-sm md:text-base mb-1">2nd Place</div>
                      <div className="text-lg md:text-2xl font-bold text-white break-words">{activeTournament.prize_2nd}</div>
                    </div>
                  )}
                  {activeTournament.prize_3rd && (
                    <div className="p-4 bg-gradient-to-r from-orange-600/20 to-orange-600/10 border border-orange-500/30 rounded-lg text-center">
                      <div className="text-orange-400 font-semibold text-sm md:text-base mb-1">3rd Place</div>
                      <div className="text-lg md:text-2xl font-bold text-white break-words">{activeTournament.prize_3rd}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-4 bg-gradient-to-r from-yellow-600/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg text-center">
                    <div className="text-yellow-400 font-semibold text-sm md:text-base mb-1">1st Place</div>
                    <div className="text-lg md:text-2xl font-bold text-white">₱5,000 + Trophy</div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-gray-400/20 to-gray-400/10 border border-gray-500/30 rounded-lg text-center">
                    <div className="text-gray-300 font-semibold text-sm md:text-base mb-1">2nd Place</div>
                    <div className="text-lg md:text-2xl font-bold text-white">₱3,000</div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-orange-600/20 to-orange-600/10 border border-orange-500/30 rounded-lg text-center">
                    <div className="text-orange-400 font-semibold text-sm md:text-base mb-1">3rd Place</div>
                    <div className="text-lg md:text-2xl font-bold text-white">₱2,000</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {tournaments.length > 0 && (
          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 md:p-8 animate-slide-up delay-400 glow-box-subtle">
            <div className="flex justify-center mb-4">
              <Shield className="w-10 h-10 md:w-12 md:h-12 text-blue-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 text-center">Active Tournaments</h3>
            <div className="space-y-3 md:space-y-4">
              {tournaments.map((tournament) => (
                <div key={tournament.id} className="p-5 md:p-6 bg-black/30 rounded-lg border border-blue-500/10 text-center">
                  <h4 className="text-xl md:text-2xl font-bold text-white mb-3">{tournament.title}</h4>
                  {tournament.description && (
                    <p className="text-gray-300 mb-3 text-base md:text-lg break-words leading-relaxed">{tournament.description}</p>
                  )}
                  {tournament.start_date && (
                    <p className="text-blue-400 text-sm md:text-base font-semibold">
                      Starts: {new Date(tournament.start_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
