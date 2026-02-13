import { LogIn, LogOut, Trophy, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AdminLogin from './AdminLogin';

export default function Header() {
  const { user, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const prevUserRef = useRef(user);

  useEffect(() => {
    // If user just logged in (was null, now is not null)
    if (!prevUserRef.current && user) {
      // Redirect to admin dashboard page
      setTimeout(() => {
        navigate('/admin', { replace: true });
      }, 300);
    }
    prevUserRef.current = user;
  }, [user, navigate]);

  return (
    <>
      <header className="fixed w-full top-0 z-50 bg-black/80 backdrop-blur-md border-b border-blue-500/20">
        <nav className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-3 group">
              <Trophy className="w-6 h-6 md:w-8 md:h-8 text-blue-400 group-hover:text-blue-300 transition-all duration-300 group-hover:rotate-12" />
              <span className="text-lg md:text-2xl font-bold text-white tracking-wider">
                <span className="text-blue-400 glow-text">Digibyte</span> Net Cafe
              </span>
            </div>

            {/* Desktop Navigation - Only for public page */}
            {location.pathname === '/' && (
              <div className="hidden md:flex items-center space-x-6">
                <a href="#home" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                  Home
                </a>
                <a href="#register" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                  Register
                </a>
                <a href="#champions" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                  Champions
                </a>
                {user && (
                  <Link to="/admin" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                    Admin
                  </Link>
                )}
                {!user && (
                  <button
                    onClick={() => setShowLogin(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-all duration-300 glow-button"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Admin Login</span>
                  </button>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            {location.pathname === '/' && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 text-gray-300 hover:text-blue-400 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Mobile Sidebar for Public Page */}
      {location.pathname === '/' && (
        <>
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div
            className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-blue-500/20 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-blue-500/20">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-blue-400" />
                  <span className="text-lg font-bold text-white">
                    <span className="text-blue-400">Digibyte</span> Net Cafe
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                <a
                  href="#home"
                  onClick={() => setSidebarOpen(false)}
                  className="block w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-gray-300 hover:bg-gray-800/50 hover:text-white"
                >
                  <span className="font-medium">Home</span>
                </a>
                <a
                  href="#register"
                  onClick={() => setSidebarOpen(false)}
                  className="block w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-gray-300 hover:bg-gray-800/50 hover:text-white"
                >
                  <span className="font-medium">Register</span>
                </a>
                <a
                  href="#champions"
                  onClick={() => setSidebarOpen(false)}
                  className="block w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-gray-300 hover:bg-gray-800/50 hover:text-white"
                >
                  <span className="font-medium">Champions</span>
                </a>
                {user && (
                  <Link
                    to="/admin"
                    onClick={() => setSidebarOpen(false)}
                    className="block w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-gray-300 hover:bg-gray-800/50 hover:text-white"
                  >
                    <span className="font-medium">Admin</span>
                  </Link>
                )}
              </nav>

              <div className="p-4 border-t border-blue-500/20">
                {user ? (
                  <button
                    onClick={async () => {
                      await signOut();
                      setSidebarOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all bg-red-600/20 text-red-400 hover:bg-red-600/40"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowLogin(true);
                      setSidebarOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all bg-blue-600/20 text-blue-400 hover:bg-blue-600/40"
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="font-medium">Admin Login</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}
    </>
  );
}
