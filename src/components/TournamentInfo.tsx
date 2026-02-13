import { useState, useEffect } from 'react';
import { BookOpen, Shield, Trophy } from 'lucide-react';
import { supabase, Tournament } from '../lib/supabase';

export default function TournamentInfo() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (data) setTournaments(data);
  };

  return (
    <section id="tournaments" className="min-h-screen py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-5xl font-bold text-white mb-4">
            Tournament <span className="text-blue-400 glow-text">Info</span>
          </h2>
          <p className="text-gray-400 text-lg">Everything you need to know</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-8 animate-slide-up glow-box-subtle">
            <BookOpen className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Rules & Regulations</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                Teams must consist of 3-5 registered members
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                All members must be present on tournament day
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                Registration fee must be paid before tournament start
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                Single elimination bracket format
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                Fair play and sportsmanship required at all times
              </li>
            </ul>
          </div>

          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-8 animate-slide-up delay-200 glow-box-subtle">
            <Trophy className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Prize Pool</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-yellow-600/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg">
                <div className="text-yellow-400 font-semibold">1st Place</div>
                <div className="text-2xl font-bold text-white">₱5,000 + Trophy</div>
              </div>
              <div className="p-4 bg-gradient-to-r from-gray-400/20 to-gray-400/10 border border-gray-500/30 rounded-lg">
                <div className="text-gray-300 font-semibold">2nd Place</div>
                <div className="text-2xl font-bold text-white">₱3,000</div>
              </div>
              <div className="p-4 bg-gradient-to-r from-orange-600/20 to-orange-600/10 border border-orange-500/30 rounded-lg">
                <div className="text-orange-400 font-semibold">3rd Place</div>
                <div className="text-2xl font-bold text-white">₱2,000</div>
              </div>
            </div>
          </div>
        </div>

        {tournaments.length > 0 && (
          <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-8 animate-slide-up delay-400 glow-box-subtle">
            <Shield className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Active Tournaments</h3>
            <div className="space-y-4">
              {tournaments.map((tournament) => (
                <div key={tournament.id} className="p-4 bg-black/30 rounded-lg border border-blue-500/10">
                  <h4 className="text-xl font-semibold text-white mb-2">{tournament.title}</h4>
                  <p className="text-gray-400 mb-2">{tournament.description}</p>
                  {tournament.start_date && (
                    <p className="text-blue-400 text-sm">
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
