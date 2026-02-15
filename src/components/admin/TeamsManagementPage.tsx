import { useState, useEffect, useMemo } from 'react';
import { Check, X, Edit, Trash2, Plus, Save, Upload, Search, Filter } from 'lucide-react';
import { supabase, Team } from '../../lib/supabase';
import ConfirmModal from '../ConfirmModal';

type PaymentFilter = 'all' | 'paid' | 'unpaid';

export default function TeamsManagementPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    team_name: '',
    team_captain: '',
    team_members: [''],
    team_photo: '',
    fb: '',
    contact_no: '',
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
    setLoading(true);
    const { error } = await supabase.from('teams').delete().eq('id', teamId);

    if (!error) {
      await loadTeams();
    }
    setLoading(false);
  };

  const openDeleteTeamConfirm = (team: Team) => {
    setConfirmState({
      open: true,
      title: 'Delete Team',
      message: `Are you sure you want to delete "${team.team_name}"? This action cannot be undone.`,
      targetId: team.id,
    });
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
    setPreviewUrl(team.team_photo || null);
    setSelectedFile(null);
    setShowAddForm(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData({ ...formData, team_photo: '' });
  };

  const uploadImage = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `teams/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('team-photos')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('team-photos')
        .getPublicUrl(filePath);

      return data.publicUrl as string;
    } catch (err) {
      console.error('Error uploading image:', err);
      throw err;
    }
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
      let imageUrl = formData.team_photo;

      // Upload image if a new file is selected
      if (selectedFile) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(selectedFile);
          if (!imageUrl) {
            throw new Error('Failed to upload image');
          }
        } catch (uploadErr) {
          throw new Error('Failed to upload image. Please try again.');
        } finally {
          setUploading(false);
        }
      }

      const filteredMembers = formData.team_members.filter(m => m.trim() !== '');

      if (editingTeam) {
        // Update existing team
        const { error } = await supabase
          .from('teams')
          .update({
            team_name: formData.team_name,
            team_captain: formData.team_captain,
            team_members: filteredMembers,
            team_photo: imageUrl || null,
            fb: formData.fb || null,
            contact_no: formData.contact_no,
          })
          .eq('id', editingTeam.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        // Add new team
        const { error } = await supabase.from('teams').insert({
          team_name: formData.team_name,
          team_captain: formData.team_captain,
          team_members: filteredMembers,
          team_photo: imageUrl || null,
          fb: formData.fb || null,
          contact_no: formData.contact_no,
          paid: false,
        }).select();

        if (error) {
          console.error('Insert error:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          throw error;
        }
      }

      await loadTeams();
      setShowAddForm(false);
      setEditingTeam(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      setFormData({
        team_name: '',
        team_captain: '',
        team_members: [''],
        team_photo: '',
        fb: '',
        contact_no: '',
      });
    } catch (err) {
      console.error('Error saving team:', err);
      let errorMessage = 'Unknown error';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Handle Supabase error object
        const supabaseError = err as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.error?.message) {
          errorMessage = supabaseError.error.message;
        } else if (supabaseError.code) {
          errorMessage = `Error code: ${supabaseError.code}`;
        }
      }
      
      // Check for common errors
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('violates unique constraint')) {
        errorMessage = 'Team name already exists. Please choose a different name.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('policy') || errorMessage.includes('RLS')) {
        errorMessage = 'Permission denied. Please ensure you are logged in as admin.';
      }
      
      alert('Error saving team: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingTeam(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData({
      team_name: '',
      team_captain: '',
      team_members: [''],
      team_photo: '',
      fb: '',
      contact_no: '',
    });
  };

  // Filter teams based on search query and payment filter
  const filteredTeams = useMemo(() => {
    let filtered = teams;

    // Apply payment filter
    if (paymentFilter === 'paid') {
      filtered = filtered.filter((team) => team.paid);
    } else if (paymentFilter === 'unpaid') {
      filtered = filtered.filter((team) => !team.paid);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((team) => {
        const teamName = team.team_name?.toLowerCase() || '';
        const captain = team.team_captain?.toLowerCase() || '';
        const members = team.team_members?.join(' ').toLowerCase() || '';
        const contact = team.contact_no?.toLowerCase() || '';
        const fb = team.fb?.toLowerCase() || '';
        
        return (
          teamName.includes(query) ||
          captain.includes(query) ||
          members.includes(query) ||
          contact.includes(query) ||
          fb.includes(query)
        );
      });
    }

    return filtered;
  }, [teams, searchQuery, paymentFilter]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xl md:text-2xl font-bold text-white">
            Teams Management ({teams.length} total, {filteredTeams.length} shown)
          </h3>
          <button
            onClick={() => {
              setEditingTeam(null);
              setShowAddForm(true);
            }}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 glow-button text-sm md:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Add Team</span>
          </button>
        </div>

        {/* Search and Filter Section */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search teams by name, captain, members, contact, or Facebook..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-blue-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm md:text-base"
            />
          </div>

          {/* Payment Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <div className="flex bg-gray-800/50 border border-blue-500/30 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                  paymentFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('paid')}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                  paymentFilter === 'paid'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('unpaid')}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                  paymentFilter === 'unpaid'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>
        </div>
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

            <div>
              <label className="block text-gray-300 mb-2">Team Photo</label>
              {previewUrl ? (
                <div className="relative mb-4">
                  <img
                    src={previewUrl}
                    alt="Team photo preview"
                    className="w-full h-48 object-cover rounded-lg border border-blue-500/30"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-red-600/80 text-white rounded-full hover:bg-red-600 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-500/30 border-dashed rounded-lg cursor-pointer bg-black/50 hover:bg-black/70 transition-all mb-4">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-blue-400" />
                    <p className="mb-2 text-sm text-gray-400">
                      <span className="font-semibold text-blue-400">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF (MAX. 5MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
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
                disabled={loading || uploading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {uploading ? 'Uploading image...' : loading ? 'Saving...' : editingTeam ? 'Update' : 'Add'} Team
                </span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {filteredTeams.map((team) => (
          <div
            key={team.id}
            className={`bg-gray-900/50 border rounded-xl p-4 md:p-6 animate-slide-up ${
              team.paid
                ? 'glow-green-border'
                : 'border-blue-500/20 glow-box-subtle'
            }`}
          >
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-white truncate">{team.team_name}</h3>
                </div>
                {team.paid ? (
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-full text-xs md:text-sm border border-green-500/30 flex-shrink-0">
                    Paid
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded-full text-xs md:text-sm border border-red-500/30 flex-shrink-0">
                    Unpaid
                  </span>
                )}
              </div>

              <div className="space-y-1.5 md:space-y-2 text-sm md:text-base text-gray-300">
                <p className="truncate">
                  <span className="text-blue-400">Captain:</span> {team.team_captain}
                </p>
                {team.team_members.length > 0 && (
                  <p className="line-clamp-2">
                    <span className="text-blue-400">Members:</span>{' '}
                    {team.team_members.join(', ')}
                  </p>
                )}
                <p className="truncate">
                  <span className="text-blue-400">Contact:</span> {team.contact_no}
                </p>
                {team.fb && (
                  <p className="truncate">
                    <span className="text-blue-400">FB:</span> {team.fb}
                  </p>
                )}
              </div>

              {team.team_photo && (
                <img
                  src={team.team_photo}
                  alt={team.team_name}
                  className="w-full h-32 md:h-40 object-cover rounded-lg"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2 md:gap-3 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-blue-500/20">
              <button
                onClick={() => togglePaid(team.id, team.paid)}
                disabled={loading}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-all flex items-center space-x-1.5 md:space-x-2 text-xs md:text-sm ${
                  team.paid
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40'
                    : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                }`}
              >
                {team.paid ? <X className="w-3 h-3 md:w-4 md:h-4" /> : <Check className="w-3 h-3 md:w-4 md:h-4" />}
                <span className="hidden sm:inline">{team.paid ? 'Mark Unpaid' : 'Mark Paid'}</span>
                <span className="sm:hidden">{team.paid ? 'Unpaid' : 'Paid'}</span>
              </button>

              <button
                onClick={() => handleEdit(team)}
                disabled={loading}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-all flex items-center space-x-1.5 md:space-x-2 text-xs md:text-sm"
              >
                <Edit className="w-3 h-3 md:w-4 md:h-4" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => openDeleteTeamConfirm(team)}
                disabled={loading}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-all flex items-center space-x-1.5 md:space-x-2 text-xs md:text-sm"
              >
                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
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

        {teams.length > 0 && filteredTeams.length === 0 && (
          <div className="text-center text-gray-400 py-20 col-span-full">
            <p>No teams match your search criteria</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setPaymentFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-all text-sm"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={loading}
        onConfirm={async () => {
          if (confirmState.targetId) {
            await deleteTeam(confirmState.targetId);
          }
          setConfirmState((prev) => ({ ...prev, open: false, targetId: null }));
        }}
        onCancel={() =>
          setConfirmState((prev) => ({ ...prev, open: false, targetId: null }))
        }
      />
    </div>
  );
}
