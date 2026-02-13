import { useState, useEffect } from 'react';
import { Trophy, Award, Medal, Plus, Save } from 'lucide-react';
import { supabase, Champion, Team } from '../../lib/supabase';

type ChampionWithTeam = Champion & { teams: Team };

export default function ChampionsManagementPage() {
  const [champions, setChampions] = useState<ChampionWithTeam[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    team_id: '',
    tournament_id: '',
    position: 1,
    week: 1,
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    loadChampions();
    loadTeams();
  }, []);

  const loadChampions = async () => {
    const { data } = await supabase
      .from('champions')
      .select('*, teams(*)')
      .order('created_at', { ascending: false });

    if (data) setChampions(data as ChampionWithTeam[]);
  };

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('team_name', { ascending: true });

    if (data) setTeams(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('champions').insert({
        team_id: formData.team_id,
        tournament_id: formData.tournament_id || null,
        position: formData.position,
        week: formData.week,
        year: formData.year,
      });

      if (error) throw error;

      await loadChampions();
      setShowAddForm(false);
      setFormData({
        team_id: '',
        tournament_id: '',
        position: 1,
        week: 1,
        year: new Date().getFullYear(),
      });
    } catch (err) {
      alert('Error adding champion: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />;
      case 2:
        return <Award className="w-8 h-8 text-gray-400" />;
      case 3:
        return <Medal className="w-8 h-8 text-orange-400" />;
      default:
        return null;
    }
  };

  const getPositionText = (position: number) => {
    switch (position) {
      case 1:
        return 'Champion';
      case 2:
        return '1st Runner Up';
      case 3:
        return '2nd Runner Up';
      default:
        return '';
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1:
        return 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30';
      case 2:
        return 'from-gray-400/20 to-gray-400/5 border-gray-500/30';
      case 3:
        return 'from-orange-600/20 to-orange-600/5 border-orange-500/30';
      default:
        return 'from-blue-600/20 to-blue-600/5 border-blue-500/30';
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h3 className="text-2xl font-bold text-white">
          Weekly Champions ({champions.length})
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 glow-button"
        >
          <Plus className="w-5 h-5" />
          <span>Add Champion</span>
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8 bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box">
          <h4 className="text-xl font-bold text-white mb-4">Add Weekly Champion</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Team *</label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Position *</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value={1}>Champion (1st)</option>
                  <option value={2}>1st Runner Up (2nd)</option>
                  <option value={3}>2nd Runner Up (3rd)</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Week *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.week}
                  onChange={(e) => setFormData({ ...formData, week: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Year *</label>
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Tournament ID</label>
                <input
                  type="text"
                  value={formData.tournament_id}
                  onChange={(e) => setFormData({ ...formData, tournament_id: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Adding...' : 'Add Champion'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    team_id: '',
                    tournament_id: '',
                    position: 1,
                    week: 1,
                    year: new Date().getFullYear(),
                  });
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {champions.length === 0 ? (
        <div className="text-center text-gray-400 py-20">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No champions recorded yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {champions.map((champion, index) => (
            <div
              key={champion.id}
              className={`bg-gradient-to-br ${getPositionColor(champion.position)} border rounded-xl p-6 animate-slide-up glow-box-subtle hover:scale-105 transition-transform duration-300`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                {getPositionIcon(champion.position)}
                <span className="text-blue-400 text-sm">
                  Week {champion.week} - {champion.year}
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">
                {champion.teams.team_name}
              </h3>

              <div className="text-gray-400 mb-4">{getPositionText(champion.position)}</div>

              {champion.teams.team_photo && (
                <img
                  src={champion.teams.team_photo}
                  alt={champion.teams.team_name}
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}

              <div className="text-sm text-gray-400">
                <p>Captain: {champion.teams.team_captain}</p>
                {champion.teams.team_members.length > 0 && (
                  <p>Members: {champion.teams.team_members.join(', ')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
