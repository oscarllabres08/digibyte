import { useState } from 'react';
import { UserPlus, Upload, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function TeamRegistration() {
  const [formData, setFormData] = useState({
    team_name: '',
    team_captain: '',
    team_members: [''],
    team_photo: '',
    fb: '',
    contact_no: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const filteredMembers = formData.team_members.filter(m => m.trim() !== '');

      const { error: insertError } = await supabase.from('teams').insert({
        team_name: formData.team_name,
        team_captain: formData.team_captain,
        team_members: filteredMembers,
        team_photo: formData.team_photo || null,
        fb: formData.fb || null,
        contact_no: formData.contact_no,
        paid: false,
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        team_name: '',
        team_captain: '',
        team_members: [''],
        team_photo: '',
        fb: '',
        contact_no: '',
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

  return (
    <section id="register" className="min-h-screen py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-5xl font-bold text-white mb-4">
            Team <span className="text-blue-400 glow-text">Registration</span>
          </h2>
          <p className="text-gray-400 text-lg">Join the competition</p>
        </div>

        <div className="max-w-3xl mx-auto bg-gray-900/50 border border-blue-500/20 rounded-xl p-8 animate-slide-up glow-box">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Team Name *</label>
              <input
                type="text"
                value={formData.team_name}
                onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                placeholder="Enter your team name"
                className="w-full px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Team Captain *</label>
              <input
                type="text"
                value={formData.team_captain}
                onChange={(e) => setFormData({ ...formData, team_captain: e.target.value })}
                placeholder="Enter team captain name"
                className="w-full px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Team Members</label>
              <div className="space-y-3">
                {formData.team_members.map((member, index) => (
                  <input
                    key={index}
                    type="text"
                    value={member}
                    onChange={(e) => handleMemberChange(index, e.target.value)}
                    placeholder={`Enter member ${index + 1} name`}
                    className="w-full px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                ))}
                <button
                  type="button"
                  onClick={addMember}
                  className="w-full py-3 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg font-semibold hover:bg-blue-600/30 transition-all flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Member</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">Team Photo URL</label>
              <div className="flex items-center space-x-3">
                <Upload className="w-5 h-5 text-blue-400" />
                <input
                  type="url"
                  value={formData.team_photo}
                  onChange={(e) => setFormData({ ...formData, team_photo: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1 px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Facebook</label>
                <input
                  type="text"
                  value={formData.fb}
                  onChange={(e) => setFormData({ ...formData, fb: e.target.value })}
                  placeholder="Facebook profile/page"
                  className="w-full px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Contact Number *</label>
                <input
                  type="tel"
                  value={formData.contact_no}
                  onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
                  placeholder="Enter contact number"
                  className="w-full px-4 py-3 bg-black/50 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-600/20 border border-green-500/50 rounded-lg text-green-400">
                Team registered successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 glow-button"
            >
              <UserPlus className="w-5 h-5" />
              <span>{loading ? 'Registering...' : 'Register Team'}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
