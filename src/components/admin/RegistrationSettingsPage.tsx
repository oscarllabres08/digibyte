import { useState, useEffect } from 'react';
import { Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase, RegistrationSettings } from '../../lib/supabase';

export default function RegistrationSettingsPage() {
  const [settings, setSettings] = useState<RegistrationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registration_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.error('Error loading settings:', error);
        // If no settings exist, create default ones
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
        } else {
          alert('Error loading settings: ' + error.message);
        }
      } else if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('registration_settings')
        .insert({
          team_registration_active: true,
          live_bracket_visible: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (err) {
      console.error('Error creating default settings:', err);
    }
  };

  const toggleTeamRegistration = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const newValue = !settings.team_registration_active;
      const { data, error } = await supabase
        .from('registration_settings')
        .update({ team_registration_active: newValue })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (err) {
      alert('Error updating team registration status: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleLiveBracket = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const newValue = !(settings.live_bracket_visible ?? true);
      const { data, error } = await supabase
        .from('registration_settings')
        .update({ live_bracket_visible: newValue })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (err) {
      alert('Error updating live bracket visibility: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="text-center text-gray-400 py-20">
        <Settings className="w-16 h-16 mx-auto mb-4 opacity-50 animate-spin" />
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center text-gray-400 py-20">
        <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Unable to load settings</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Registration Settings</h3>
        <p className="text-gray-400 text-sm md:text-base">
          Control whether team registration is active for public users
        </p>
      </div>

      <div className="space-y-6">
        {/* Team Registration Toggle */}
        <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box-subtle">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-white mb-2">Team Registration</h4>
              <p className="text-sm text-gray-400">
                {settings.team_registration_active
                  ? 'Team registration is currently active. Users can register teams.'
                  : 'Team registration is currently inactive. Users cannot register teams.'}
              </p>
            </div>
            <button
              onClick={toggleTeamRegistration}
              disabled={saving}
              className={`ml-4 flex items-center justify-center w-16 h-8 rounded-full transition-all ${
                settings.team_registration_active
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {settings.team_registration_active ? (
                <ToggleRight className="w-6 h-6 text-white" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-500/20">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                settings.team_registration_active
                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                  : 'bg-red-500/20 text-red-300 border border-red-500/50'
              }`}
            >
              {settings.team_registration_active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>

        {/* Live Bracket Visibility Toggle */}
        <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box-subtle">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-white mb-2">Live Bracket Visibility</h4>
              <p className="text-sm text-gray-400">
                {(settings.live_bracket_visible ?? true)
                  ? 'Live bracket is currently visible on the public page.'
                  : 'Live bracket is currently hidden. An overlay will cover the bracket content on the public page.'}
              </p>
            </div>
            <button
              onClick={toggleLiveBracket}
              disabled={saving}
              className={`ml-4 flex items-center justify-center w-16 h-8 rounded-full transition-all ${
                (settings.live_bracket_visible ?? true)
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {(settings.live_bracket_visible ?? true) ? (
                <ToggleRight className="w-6 h-6 text-white" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-500/20">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                (settings.live_bracket_visible ?? true)
                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                  : 'bg-red-500/20 text-red-300 border border-red-500/50'
              }`}
            >
              {(settings.live_bracket_visible ?? true) ? 'VISIBLE' : 'HIDDEN'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
