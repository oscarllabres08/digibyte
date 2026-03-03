import { useState, useEffect } from 'react';
import { User, Trash2, Search, Filter, Plus, Save, Edit2, X } from 'lucide-react';
import { supabase, Player } from '../../lib/supabase';
import ConfirmModal from '../ConfirmModal';

type GameFilter = 'all' | 'Point Blank' | 'League of Legends' | 'Valorant';

export default function PlayersManagementPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    complete_name: '',
    ign: '',
    address: '',
    game: 'Point Blank',
  });
  const [editFormData, setEditFormData] = useState({
    complete_name: '',
    ign: '',
    address: '',
    game: 'Point Blank',
  });
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    targetId: string | null;
  }>({
    open: false,
    title: '',
    message: '',
    targetId: null,
  });
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('players').insert({
        complete_name: formData.complete_name,
        ign: formData.ign,
        address: formData.address,
        game: formData.game,
      });

      if (error) throw error;

      await loadPlayers();
      setShowAddForm(false);
      setFormData({
        complete_name: '',
        ign: '',
        address: '',
        game: 'Point Blank',
      });
    } catch (err) {
      alert('Error adding player: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (player: Player) => {
    setShowAddForm(false);
    setEditingPlayerId(player.id);
    setEditFormData({
      complete_name: player.complete_name,
      ign: player.ign,
      address: player.address,
      game: player.game,
    });
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditFormData({
      complete_name: '',
      ign: '',
      address: '',
      game: 'Point Blank',
    });
  };

  const handleUpdate = async (e: React.FormEvent, playerId: string) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('players')
        .update({
          complete_name: editFormData.complete_name,
          ign: editFormData.ign,
          address: editFormData.address,
          game: editFormData.game,
        })
        .eq('id', playerId);

      if (error) throw error;

      await loadPlayers();
      setEditingPlayerId(null);
      setEditFormData({
        complete_name: '',
        ign: '',
        address: '',
        game: 'Point Blank',
      });
    } catch (err) {
      alert('Error updating player: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const deletePlayer = async (playerId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('players').delete().eq('id', playerId);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      await loadPlayers();
    } catch (err) {
      alert('Error deleting player: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const deleteAllPlayers = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error('Error deleting all players:', error);
        throw error;
      }

      await loadPlayers();
      setDeleteAllConfirmOpen(false);
    } catch (err) {
      alert('Error deleting all players: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const openDeletePlayerConfirm = (player: Player) => {
    setConfirmState({
      open: true,
      title: 'Delete Player',
      message: `Are you sure you want to delete player "${player.complete_name}" (${player.ign})?`,
      targetId: player.id,
    });
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.complete_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.ign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGame = gameFilter === 'all' || player.game === gameFilter;
    return matchesSearch && matchesGame;
  });

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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl md:text-2xl font-bold text-white">
          Player Management ({filteredPlayers.length} / {players.length})
        </h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingPlayerId(null);
              setShowAddForm(true);
            }}
            disabled={editingPlayerId !== null}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 glow-button text-sm md:text-base w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Add Player</span>
          </button>
          {players.length > 0 && (
            <button
              onClick={() => setDeleteAllConfirmOpen(true)}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center justify-center space-x-2 text-sm md:text-base w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Delete All Players</span>
            </button>
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="mb-8 bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box">
          <h4 className="text-xl font-bold text-white mb-4">Add Player</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Complete Name *</label>
              <input
                type="text"
                value={formData.complete_name}
                onChange={(e) => setFormData({ ...formData, complete_name: e.target.value })}
                placeholder="Enter complete name"
                className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">IGN (In Game Name) *</label>
              <input
                type="text"
                value={formData.ign}
                onChange={(e) => setFormData({ ...formData, ign: e.target.value })}
                placeholder="Enter in-game name"
                className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
                rows={3}
                className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Game *</label>
              <select
                value={formData.game}
                onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              >
                <option value="Point Blank">Point Blank</option>
                <option value="League of Legends">League of Legends</option>
                <option value="Valorant">Valorant</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm md:text-base w-full sm:w-auto"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Adding...' : 'Add Player'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    complete_name: '',
                    ign: '',
                    address: '',
                    game: 'Point Blank',
                  });
                }}
                className="px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm md:text-base w-full sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, IGN, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm md:text-base"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value as GameFilter)}
            className="pl-10 pr-8 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm md:text-base appearance-none"
          >
            <option value="all">All Games</option>
            <option value="Point Blank">Point Blank</option>
            <option value="League of Legends">League of Legends</option>
            <option value="Valorant">Valorant</option>
          </select>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="text-center text-gray-400 py-20">
          <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No players registered yet</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center text-gray-400 py-20">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No players found matching your search</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlayers.map((player) => (
            <div
              key={player.id}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-blue-500/20 rounded-xl p-5 md:p-6 animate-slide-up glow-box-subtle"
            >
              {editingPlayerId === player.id ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg md:text-xl font-bold text-white">Edit Player</h4>
                    <button
                      onClick={cancelEdit}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={(e) => handleUpdate(e, player.id)} className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Complete Name *</label>
                      <input
                        type="text"
                        value={editFormData.complete_name}
                        onChange={(e) => setEditFormData({ ...editFormData, complete_name: e.target.value })}
                        placeholder="Enter complete name"
                        className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">IGN (In Game Name) *</label>
                      <input
                        type="text"
                        value={editFormData.ign}
                        onChange={(e) => setEditFormData({ ...editFormData, ign: e.target.value })}
                        placeholder="Enter in-game name"
                        className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Address *</label>
                      <textarea
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        placeholder="Enter address"
                        rows={3}
                        className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Game *</label>
                      <select
                        value={editFormData.game}
                        onChange={(e) => setEditFormData({ ...editFormData, game: e.target.value })}
                        className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        required
                      >
                        <option value="Point Blank">Point Blank</option>
                        <option value="League of Legends">League of Legends</option>
                        <option value="Valorant">Valorant</option>
                      </select>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm md:text-base w-full sm:w-auto"
                      >
                        <Save className="w-4 h-4" />
                        <span>{loading ? 'Updating...' : 'Update Player'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm md:text-base w-full sm:w-auto"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <User className="w-5 h-5 text-blue-400" />
                      <h4 className="text-lg md:text-xl font-bold text-white">{player.complete_name}</h4>
                      <span
                        className={`px-3 py-1 rounded-full border text-xs font-semibold ${getGameColor(player.game)}`}
                      >
                        {player.game}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm md:text-base text-gray-300">
                      <p>
                        <span className="text-gray-400">IGN:</span> {player.ign}
                      </p>
                      <p>
                        <span className="text-gray-400">Address:</span> {player.address}
                      </p>
                      <p className="text-xs text-gray-500">
                        Registered: {new Date(player.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(player)}
                      disabled={loading || editingPlayerId !== null}
                      className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => openDeletePlayerConfirm(player)}
                      disabled={loading || editingPlayerId !== null}
                      className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={loading}
        onConfirm={async () => {
          if (confirmState.targetId) {
            await deletePlayer(confirmState.targetId);
          }
          setConfirmState((prev) => ({ ...prev, open: false, targetId: null }));
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false, targetId: null }))}
      />

      <ConfirmModal
        open={deleteAllConfirmOpen}
        title="Delete All Players"
        message={`Are you sure you want to delete ALL ${players.length} players? This action cannot be undone and will permanently delete all player data.`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        loading={loading}
        onConfirm={deleteAllPlayers}
        onCancel={() => setDeleteAllConfirmOpen(false)}
      />
    </div>
  );
}
