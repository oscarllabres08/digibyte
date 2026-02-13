import { useState } from 'react';
import { UserPlus, Upload, Plus, X } from 'lucide-react';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setError('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

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

      const { error: insertError } = await supabase.from('teams').insert({
        team_name: formData.team_name,
        team_captain: formData.team_captain,
        team_members: filteredMembers,
        team_photo: imageUrl || null,
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
      setSelectedFile(null);
      setPreviewUrl(null);
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
              <label className="block text-gray-300 mb-2 font-semibold">Team Photo</label>
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Team photo preview"
                    className="w-full h-48 object-cover rounded-lg mb-2 border border-blue-500/30"
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
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-500/30 border-dashed rounded-lg cursor-pointer bg-black/50 hover:bg-black/70 transition-all">
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
              disabled={loading || uploading}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 glow-button"
            >
              <UserPlus className="w-5 h-5" />
              <span>
                {uploading ? 'Uploading image...' : loading ? 'Registering...' : 'Register Team'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
