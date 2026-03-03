import { Cpu, Trophy, Users } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="min-h-screen flex items-center justify-center relative overflow-hidden pt-16 sm:pt-20">
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 sm:top-20 sm:left-20 w-48 h-48 sm:w-72 sm:h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 sm:bottom-20 sm:right-20 w-64 h-64 sm:w-96 sm:h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-4 sm:mb-6">
            <Cpu className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-blue-400 animate-float glow-icon" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-8xl font-bold text-white mb-4 sm:mb-6 tracking-tight sm:tracking-wider">
            <span className="text-blue-400 glow-text">Digibyte</span> Net Cafe
          </h1>

          <p className="text-base sm:text-xl md:text-2xl text-gray-300 mb-8 sm:mb-12 max-w-2xl mx-auto px-4">
            Premier Gaming Tournament Hub
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12 px-4">
            <a
              href="#register"
              className="px-5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 glow-button"
            >
              Register Your Team
            </a>
            <a
              href="#tournaments"
              className="px-5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 bg-transparent border-2 border-blue-500 text-blue-400 rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-500/10 transition-all duration-300 transform hover:scale-105"
            >
              View Tournaments
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto mt-12 sm:mt-16 md:mt-20 px-4">
            <div className="p-4 sm:p-5 md:p-6 bg-gray-900/50 border border-blue-500/20 rounded-xl hover:border-blue-500/50 transition-all duration-300 animate-slide-up glow-box-subtle">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-blue-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-1.5 sm:mb-2">Weekly Tournaments</h3>
              <p className="text-xs sm:text-sm text-gray-400">Compete for prizes every week</p>
            </div>

            <div className="p-4 sm:p-5 md:p-6 bg-gray-900/50 border border-blue-500/20 rounded-xl hover:border-blue-500/50 transition-all duration-300 animate-slide-up delay-200 glow-box-subtle">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-blue-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-1.5 sm:mb-2">Team Registration</h3>
              <p className="text-xs sm:text-sm text-gray-400">Easy team setup and management</p>
            </div>

            <div className="p-4 sm:p-5 md:p-6 bg-gray-900/50 border border-blue-500/20 rounded-xl hover:border-blue-500/50 transition-all duration-300 animate-slide-up delay-400 glow-box-subtle sm:col-span-2 md:col-span-1">
              <Cpu className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-blue-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-1.5 sm:mb-2">Top Equipment</h3>
              <p className="text-xs sm:text-sm text-gray-400">High-end gaming PCs available</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
