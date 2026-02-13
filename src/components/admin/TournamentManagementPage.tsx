import { useState, useEffect } from 'react';
import { Edit2, Save, X, Plus } from 'lucide-react';
import { supabase, Tournament } from '../../lib/supabase';

export default function TournamentManagementPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rules: '',
    status: 'active',
    start_date: '',
    prize_1st: '',
    prize_2nd: '',
    prize_3rd: '',
  });

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading tournaments:', error);
      alert('Error loading tournaments: ' + error.message);
    } else if (data) {
      setTournaments(data);
    }
  };

  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setFormData({
      title: tournament.title || '',
      description: tournament.description || '',
      rules: tournament.rules || '',
      status: tournament.status || 'active',
      start_date: tournament.start_date ? new Date(tournament.start_date).toISOString().split('T')[0] : '',
      prize_1st: tournament.prize_1st || '',
      prize_2nd: tournament.prize_2nd || '',
      prize_3rd: tournament.prize_3rd || '',
    });
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData: any = {
        title: formData.title,
        description: formData.description || null,
        rules: formData.rules || null,
        status: formData.status,
        start_date: formData.start_date || null,
        prize_1st: formData.prize_1st || null,
        prize_2nd: formData.prize_2nd || null,
        prize_3rd: formData.prize_3rd || null,
      };

      if (editingTournament) {
        // Update existing tournament
        const { error } = await supabase
          .from('tournaments')
          .update(submitData)
          .eq('id', editingTournament.id);

        if (error) throw error;
      } else {
        // Add new tournament
        const { error } = await supabase.from('tournaments').insert(submitData);

        if (error) throw error;
      }

      await loadTournaments();
      setShowAddForm(false);
      setEditingTournament(null);
      setFormData({
        title: '',
        description: '',
        rules: '',
        status: 'active',
        start_date: '',
        prize_1st: '',
        prize_2nd: '',
        prize_3rd: '',
      });
    } catch (err: any) {
      console.error('Error saving tournament:', err);
      alert('Error saving tournament: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingTournament(null);
    setFormData({
      title: '',
      description: '',
      rules: '',
      status: 'active',
      start_date: '',
      prize_1st: '',
      prize_2nd: '',
      prize_3rd: '',
    });
  };

  const deleteTournament = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);

      if (error) throw error;

      await loadTournaments();
    } catch (err: any) {
      console.error('Error deleting tournament:', err);
      alert('Error deleting tournament: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-white">Tournament Management</h3>
        {!showAddForm && !editingTournament && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tournament</span>
          </button>
        )}
      </div>

      {(showAddForm || editingTournament) && (
        <div className="mb-6 p-6 bg-gray-800/50 border border-blue-500/20 rounded-lg">
          <h4 className="text-xl font-semibold text-white mb-4">
            {editingTournament ? 'Edit Tournament' : 'Add New Tournament'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Rules (one per line)</label>
              <textarea
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                rows={6}
                placeholder="Teams must consist of 4-8 registered members&#10;All members must be present on tournament day&#10;Registration fee must be paid before tournament start"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">1st Place Prize</label>
                <input
                  type="text"
                  value={formData.prize_1st}
                  onChange={(e) => setFormData({ ...formData, prize_1st: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="₱5,000 + Trophy"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">2nd Place Prize</label>
                <input
                  type="text"
                  value={formData.prize_2nd}
                  onChange={(e) => setFormData({ ...formData, prize_2nd: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="₱3,000"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">3rd Place Prize</label>
                <input
                  type="text"
                  value={formData.prize_3rd}
                  onChange={(e) => setFormData({ ...formData, prize_3rd: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="₱2,000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center space-x-2 px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm md:text-base w-full sm:w-auto"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="flex items-center justify-center space-x-2 px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm md:text-base w-full sm:w-auto"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {tournaments.map((tournament) => (
          <div
            key={tournament.id}
            className="p-6 bg-gray-800/50 border border-blue-500/20 rounded-lg"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">{tournament.title}</h4>
                <p className="text-gray-400 text-sm mb-2">
                  Status: <span className="text-blue-400">{tournament.status}</span>
                </p>
                {tournament.start_date && (
                  <p className="text-gray-400 text-sm">
                    Start Date: {new Date(tournament.start_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
                <button
                  onClick={() => handleEdit(tournament)}
                  className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors flex items-center justify-center"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteTournament(tournament.id)}
                  className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-colors flex items-center justify-center"
                  title="Delete"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {tournament.description && (
              <p className="text-gray-300 mb-3">{tournament.description}</p>
            )}

            {tournament.rules && (
              <div className="mb-3">
                <h5 className="text-gray-300 font-semibold mb-2">Rules:</h5>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
                  {tournament.rules.split('\n').filter(r => r.trim()).map((rule, idx) => (
                    <li key={idx}>{rule.trim()}</li>
                  ))}
                </ul>
              </div>
            )}

            {(tournament.prize_1st || tournament.prize_2nd || tournament.prize_3rd) && (
              <div>
                <h5 className="text-gray-300 font-semibold mb-2">Prize Pool:</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {tournament.prize_1st && (
                    <div className="p-3 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
                      <div className="text-yellow-400 font-semibold text-sm">1st Place</div>
                      <div className="text-white font-bold">{tournament.prize_1st}</div>
                    </div>
                  )}
                  {tournament.prize_2nd && (
                    <div className="p-3 bg-gray-400/20 border border-gray-500/30 rounded-lg">
                      <div className="text-gray-300 font-semibold text-sm">2nd Place</div>
                      <div className="text-white font-bold">{tournament.prize_2nd}</div>
                    </div>
                  )}
                  {tournament.prize_3rd && (
                    <div className="p-3 bg-orange-600/20 border border-orange-500/30 rounded-lg">
                      <div className="text-orange-400 font-semibold text-sm">3rd Place</div>
                      <div className="text-white font-bold">{tournament.prize_3rd}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {tournaments.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No tournaments found. Click "Add Tournament" to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
