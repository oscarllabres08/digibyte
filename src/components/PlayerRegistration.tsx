import { useState, useEffect } from 'react';
import { UserPlus, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PlayerRegistration() {
  const [formData, setFormData] = useState({
    complete_name: '',
    ign: '',
    address: '',
    game: 'Point Blank',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [registrationActive, setRegistrationActive] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('registration_settings')
        .select('player_registration_active')
        .limit(1)
        .single();

      if (error) {
        console.error('Error checking registration status:', error);
        // Default to active if there's an error
        setRegistrationActive(true);
      } else if (data) {
        setRegistrationActive(data.player_registration_active);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setRegistrationActive(true);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registrationActive) {
      setError('Registration is currently not active');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error: insertError } = await supabase.from('players').insert({
        complete_name: formData.complete_name,
        ign: formData.ign,
        address: formData.address,
        game: formData.game,
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        complete_name: '',
        ign: '',
        address: '',
        game: 'Point Blank',
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="player-register" className="min-h-screen py-12 sm:py-16 md:py-20 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-8 sm:mb-12 md:mb-16 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 sm:mb-3 md:mb-4">
            Player <span className="text-blue-400 glow-text">Registration</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base md:text-lg">Register as an individual player</p>
        </div>

        <div className="max-w-3xl mx-auto bg-gray-900/50 border border-blue-500/20 rounded-xl p-4 sm:p-6 md:p-8 animate-slide-up glow-box relative">
          {!registrationActive && !checkingStatus && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
              <div className="text-center p-4 sm:p-6 md:p-8">
                <Lock className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 text-gray-400" />
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No Active Tournament</h3>
                <p className="text-sm sm:text-base text-gray-400 px-4">Registration is currently closed. Please check back later.</p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6" style={{ opacity: registrationActive || checkingStatus ? 1 : 0.3 }}>
            <div>
              <label className="block text-gray-300 mb-1.5 sm:mb-2 font-semibold text-sm sm:text-base">Complete Name *</label>
              <input
                type="text"
                value={formData.complete_name}
                onChange={(e) => setFormData({ ...formData, complete_name: e.target.value })}
                placeholder="Enter your complete name"
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-1.5 sm:mb-2 font-semibold text-sm sm:text-base">IGN (In Game Name) *</label>
              <input
                type="text"
                value={formData.ign}
                onChange={(e) => setFormData({ ...formData, ign: e.target.value })}
                placeholder="Enter your in-game name"
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-1.5 sm:mb-2 font-semibold text-sm sm:text-base">Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter your address"
                rows={3}
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500 transition-all resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-1.5 sm:mb-2 font-semibold text-sm sm:text-base">Game *</label>
              <select
                value={formData.game}
                onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:border-blue-500 transition-all"
                required
              >
                <option value="Point Blank">Point Blank</option>
                <option value="League of Legends">League of Legends</option>
                <option value="Valorant">Valorant</option>
              </select>
            </div>

            {error && (
              <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-600/20 border border-green-500/50 rounded-lg text-green-400">
                Player registered successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 md:py-4 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 glow-button"
            >
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{loading ? 'Registering...' : 'Register Player'}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
