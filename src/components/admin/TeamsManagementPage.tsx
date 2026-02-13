import { useState, useEffect } from 'react';
import { Check, X, Edit, Trash2, Plus, Save } from 'lucide-react';
import { supabase, Team } from '../../lib/supabase';

export default function TeamsManagementPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    team_name: '',
    team_captain: '',
    team_members: [''],
    team_photo: '',
    fb: '',
    contact_no: '',
  });

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTeams(data);
  };

  const togglePaid = async (teamId: string, currentStatus: boolean) => {
    // Prevent multiple clicks
    if (loading) return;
    
    setLoading(true);
    const newPaidStatus = !currentStatus;
    
    try {
      // Update the database - use select to get updated data
      const { data, error } = await supabase
        .from('teams')
        .update({ paid: newPaidStatus })
        .eq('id', teamId)
        .select()
        .single();

      if (error) {
        console.error('Error updating paid status:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        
        // Check if it's an RLS policy error
        if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
          alert('Permission denied. The admin user needs to be created in Supabase with proper authentication.\n\nError: ' + error.message);
        } else {
          alert('Error updating paid status: ' + error.message);
        }
        
        // Revert the optimistic update
        setTeams(prevTeams =>
          prevTeams.map(team =>
            team.id === teamId ? { ...team, paid: currentStatus } : team
          )
        );
        setLoading(false);
        return;
      }

      // If update succeeded, update state with the returned data
      if (data) {
        setTeams(prevTeams =>
          prevTeams.map(team =>
            team.id === teamId ? { ...team, paid: data.paid } : team
          )
        );
      } else {
        // Fallback: update with expected value
        setTeams(prevTeams =>
          prevTeams.map(team =>
            team.id === teamId ? { ...team, paid: newPaidStatus } : team
          )
        );
      }

      // Reload teams to ensure database consistency
      await loadTeams();
      setLoading(false);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setLoading(false);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    setLoading(true);
    const { error } = await supabase.from('teams').delete().eq('id', teamId);

    if (!error) {
      await loadTeams();
    }
    setLoading(false);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      team_name: team.team_name,
      team_captain: team.team_captain,
      team_members: team.team_members.length > 0 ? team.team_members : [''],
      team_photo: team.team_photo || '',
      fb: team.fb || '',
      contact_no: team.contact_no,
    });
    setShowAddForm(true);
  };

  const handleMemberChange = (index: number, value: string) => {
    const newMembers = [...formData.team_members];
    newMembers[index] = value;
    setFormData({ ...formData, team_members: newMembers });
  };

  const addMember = () => {
    setFormData({
      ...formData,
      team_members: [...formData.team_members, ''],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const filteredMembers = formData.team_members.filter(m => m.trim() !== '');

      if (editingTeam) {
        // Update existing team
        const { error } = await supabase
          .from('teams')
          .update({
            team_name: formData.team_name,
            team_captain: formData.team_captain,
            team_members: filteredMembers,
            team_photo: formData.team_photo || null,
            fb: formData.fb || null,
            contact_no: formData.contact_no,
          })
          .eq('id', editingTeam.id);

        if (error) throw error;
      } else {
        // Add new team
        const { error } = await supabase.from('teams').insert({
          team_name: formData.team_name,
          team_captain: formData.team_captain,
          team_members: filteredMembers,
          team_photo: formData.team_photo || null,
          fb: formData.fb || null,
          contact_no: formData.contact_no,
          paid: false,
        });

        if (error) throw error;
      }

      await loadTeams();
      setShowAddForm(false);
      setEditingTeam(null);
      setFormData({
        team_name: '',
        team_captain: '',
        team_members: [''],
        team_photo: '',
        fb: '',
        contact_no: '',
      });
    } catch (err) {
      alert('Error saving team: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingTeam(null);
    setFormData({
      team_name: '',
      team_captain: '',
      team_members: [''],
      team_photo: '',
      fb: '',
      contact_no: '',
    });
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h3 className="text-2xl font-bold text-white">
          Teams Management ({teams.length})
        </h3>
        <button
          onClick={() => {
            setEditingTeam(null);
            setShowAddForm(true);
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center space-x-2 glow-button"
        >
          <Plus className="w-5 h-5" />
          <span>Add Team</span>
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8 bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box">
          <h4 className="text-xl font-bold text-white mb-4">
            {editingTeam ? 'Edit Team' : 'Add New Team'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Team Name *</label>
                <input
                  type="text"
                  value={formData.team_name}
                  onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                  placeholder="Enter team name"
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Team Captain *</label>
                <input
                  type="text"
                  value={formData.team_captain}
                  onChange={(e) => setFormData({ ...formData, team_captain: e.target.value })}
                  placeholder="Enter captain name"
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Team Members</label>
              <div className="space-y-2">
                {formData.team_members.map((member, index) => (
                  <input
                    key={index}
                    type="text"
                    value={member}
                    onChange={(e) => handleMemberChange(index, e.target.value)}
                    placeholder={`Enter member ${index + 1} name`}
                    className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                ))}
                <button
                  type="button"
                  onClick={addMember}
                  className="w-full py-2 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Member</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Team Photo URL</label>
                <input
                  type="url"
                  value={formData.team_photo}
                  onChange={(e) => setFormData({ ...formData, team_photo: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Contact Number *</label>
                <input
                  type="tel"
                  value={formData.contact_no}
                  onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
                  placeholder="Enter contact number"
                  className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Facebook</label>
              <input
                type="text"
                value={formData.fb}
                onChange={(e) => setFormData({ ...formData, fb: e.target.value })}
                placeholder="Facebook profile/page"
                className="w-full px-4 py-2 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : editingTeam ? 'Update' : 'Add'} Team</span>
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {teams.map((team) => (
          <div
            key={team.id}
            className={`bg-gray-900/50 border rounded-xl p-6 animate-slide-up ${
              team.paid
                ? 'glow-green-border'
                : 'border-blue-500/20 glow-box-subtle'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h3 className="text-2xl font-bold text-white">{team.team_name}</h3>
                  {team.paid ? (
                    <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm border border-green-500/30">
                      Paid
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-600/20 text-red-400 rounded-full text-sm border border-red-500/30">
                      Unpaid
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-gray-300">
                  <p>
                    <span className="text-blue-400">Captain:</span> {team.team_captain}
                  </p>
                  {team.team_members.length > 0 && (
                    <p>
                      <span className="text-blue-400">Members:</span>{' '}
                      {team.team_members.join(', ')}
                    </p>
                  )}
                  <p>
                    <span className="text-blue-400">Contact:</span> {team.contact_no}
                  </p>
                  {team.fb && (
                    <p>
                      <span className="text-blue-400">Facebook:</span> {team.fb}
                    </p>
                  )}
                </div>
              </div>

              {team.team_photo && (
                <img
                  src={team.team_photo}
                  alt={team.team_name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-blue-500/20">
              <button
                onClick={() => togglePaid(team.id, team.paid)}
                disabled={loading}
                className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-2 ${
                  team.paid
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40'
                    : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                }`}
              >
                {team.paid ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>{team.paid ? 'Mark Unpaid' : 'Mark Paid'}</span>
              </button>

              <button
                onClick={() => handleEdit(team)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-all flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => deleteTeam(team.id)}
                disabled={loading}
                className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-all flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <p>No teams registered yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
