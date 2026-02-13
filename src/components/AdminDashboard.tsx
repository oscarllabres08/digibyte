import { useState } from 'react';
import { Users, Trophy, Grid3x3, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TeamsManagementPage from './admin/TeamsManagementPage';
import ChampionsManagementPage from './admin/ChampionsManagementPage';
import BracketGeneratorPage from './admin/BracketGeneratorPage';

type Page = 'teams' | 'champions' | 'brackets';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState<Page>('teams');

  if (!user) {
    return (
      <section id="admin" className="min-h-screen py-20 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>Please login to access the admin dashboard</p>
        </div>
      </section>
    );
  }

  const pages = [
    { id: 'teams' as Page, label: 'Teams Management', icon: Users },
    { id: 'champions' as Page, label: 'Weekly Champions', icon: Trophy },
    { id: 'brackets' as Page, label: 'Bracket Generator', icon: Grid3x3 },
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'teams':
        return <TeamsManagementPage />;
      case 'champions':
        return <ChampionsManagementPage />;
      case 'brackets':
        return <BracketGeneratorPage />;
      default:
        return <TeamsManagementPage />;
    }
  };

  return (
    <section id="admin" className="min-h-screen py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <h2 className="text-5xl font-bold text-white mb-4">
            Admin <span className="text-blue-400 glow-text">Dashboard</span>
          </h2>
          <p className="text-gray-400 text-lg">Manage teams and tournaments</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-4 glow-box-subtle">
              <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-blue-500/20">
                <LayoutDashboard className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Navigation</h3>
              </div>
              <nav className="space-y-2">
                {pages.map((page) => {
                  const Icon = page.icon;
                  const isActive = activePage === page.id;
                  return (
                    <button
                      key={page.id}
                      onClick={() => setActivePage(page.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                          : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{page.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6 glow-box-subtle">
              {renderPage()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
