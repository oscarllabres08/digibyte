import { LogIn, LogOut, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import AdminLogin from './AdminLogin';

export default function Header() {
  const { user, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const prevUserRef = useRef(user);

  useEffect(() => {
    // If user just logged in (was null, now is not null)
    if (!prevUserRef.current && user) {
      // Redirect to admin dashboard
      setTimeout(() => {
        window.location.hash = '#admin';
        const adminSection = document.getElementById('admin');
        if (adminSection) {
          // Account for fixed header height
          const headerOffset = 80;
          const elementPosition = adminSection.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
    prevUserRef.current = user;
  }, [user]);

  return (
    <>
      <header className="fixed w-full top-0 z-50 bg-black/80 backdrop-blur-md border-b border-blue-500/20">
        <nav className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 group">
              <Trophy className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-all duration-300 group-hover:rotate-12" />
              <span className="text-2xl font-bold text-white tracking-wider">
                DIGI<span className="text-blue-400 glow-text">BYTE</span>
              </span>
            </div>

            <div className="flex items-center space-x-6">
              <a href="#home" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                Home
              </a>
              <a href="#register" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                Register
              </a>
              <a href="#champions" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                Champions
              </a>
              {user ? (
                <>
                  <a href="#admin" className="text-gray-300 hover:text-blue-400 transition-colors duration-300">
                    Admin
                  </a>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-all duration-300"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-all duration-300 glow-button"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Admin Login</span>
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}
    </>
  );
}
