import { useState, useEffect, useRef } from 'react';
import { Users, Trophy, Grid3x3, LayoutDashboard, Info, Menu, X, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TeamsManagementPage from './admin/TeamsManagementPage';
import ChampionsManagementPage from './admin/ChampionsManagementPage';
import BracketGeneratorPage from './admin/BracketGeneratorPage';
import TournamentManagementPage from './admin/TournamentManagementPage';
import ConfirmModal from './ConfirmModal';

type Page = 'teams' | 'champions' | 'brackets' | 'tournaments';

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState<Page>('teams');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const logoutTriggeredRef = useRef(false);

  const pages = [
    { id: 'teams' as Page, label: 'Team Management', icon: Users },
    { id: 'tournaments' as Page, label: 'Tournament Info', icon: Info },
    { id: 'champions' as Page, label: 'Weekly Champion', icon: Trophy },
    { id: 'brackets' as Page, label: 'Bracket Generator', icon: Grid3x3 },
  ];

  const handlePageChange = (pageId: Page) => {
    setActivePage(pageId);
    setSidebarOpen(false);
  };

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
    setLogoutModalOpen(false);
  };

  // Auto logout when tab/window is closed or navigated away (but NOT just when switching tabs)
  useEffect(() => {
    const performAutoLogout = async () => {
      // Prevent multiple logout calls
      if (logoutTriggeredRef.current) return;
      logoutTriggeredRef.current = true;

      try {
        await signOut();
      } catch (error) {
        console.error('Error during auto logout:', error);
      }
    };

    // Handle beforeunload (page is about to unload)
    const handleBeforeUnload = () => {
      performAutoLogout();
    };

    // Handle pagehide (page is being hidden)
    const handlePageHide = () => {
      performAutoLogout();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [signOut]);

  const renderPage = () => {
    switch (activePage) {
      case 'teams':
        return <TeamsManagementPage />;
      case 'tournaments':
        return <TournamentManagementPage />;
      case 'champions':
        return <ChampionsManagementPage />;
      case 'brackets':
        return <BracketGeneratorPage />;
      default:
        return <TeamsManagementPage />;
    }
  };

  return (
    <section className="min-h-screen py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-blue-500/20 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-blue-500/20">
            <div className="flex items-center space-x-2">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Menu</h3>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {pages.map((page) => {
              const Icon = page.icon;
              const isActive = activePage === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => handlePageChange(page.id)}
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

          <div className="p-4 border-t border-blue-500/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all bg-red-600/20 text-red-400 hover:bg-red-600/40"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Mobile Menu Button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-900/50 border border-blue-500/20 rounded-lg text-white hover:bg-gray-800/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </div>

        <div className="text-center mb-6 md:mb-8 animate-fade-in">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4">
            Admin <span className="text-blue-400 glow-text">Dashboard</span>
          </h2>
          <p className="text-gray-400 text-sm md:text-lg">Manage teams and tournaments</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Desktop Sidebar Navigation */}
          <div className="hidden lg:block lg:w-64 flex-shrink-0">
            <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-4 glow-box-subtle sticky top-24">
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
              <div className="mt-4 pt-4 border-t border-blue-500/20">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all bg-red-600/20 text-red-400 hover:bg-red-600/40"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-4 md:p-6 glow-box-subtle">
              {renderPage()}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={logoutModalOpen}
        title="Logout"
        message="Are you sure you want to logout from the admin dashboard?"
        confirmLabel="Logout"
        cancelLabel="Stay Logged In"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutModalOpen(false)}
      />
    </section>
  );
}
