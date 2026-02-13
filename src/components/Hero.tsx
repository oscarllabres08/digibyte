import { Cpu, Trophy, Users } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <Cpu className="w-20 h-20 text-blue-400 animate-float glow-icon" />
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-8xl font-bold text-white mb-6 tracking-wider">
            <span className="text-blue-400 glow-text">Digibyte</span> Net Cafe
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Premier Gaming Tournament Hub
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <a
              href="#register"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 glow-button"
            >
              Register Your Team
            </a>
            <a
              href="#tournaments"
              className="px-8 py-4 bg-transparent border-2 border-blue-500 text-blue-400 rounded-lg font-semibold hover:bg-blue-500/10 transition-all duration-300 transform hover:scale-105"
            >
              View Tournaments
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-20">
            <div className="p-6 bg-gray-900/50 border border-blue-500/20 rounded-xl hover:border-blue-500/50 transition-all duration-300 animate-slide-up glow-box-subtle">
              <Trophy className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Weekly Tournaments</h3>
              <p className="text-gray-400">Compete for prizes every week</p>
            </div>

            <div className="p-6 bg-gray-900/50 border border-blue-500/20 rounded-xl hover:border-blue-500/50 transition-all duration-300 animate-slide-up delay-200 glow-box-subtle">
              <Users className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Team Registration</h3>
              <p className="text-gray-400">Easy team setup and management</p>
            </div>

            <div className="p-6 bg-gray-900/50 border border-blue-500/20 rounded-xl hover:border-blue-500/50 transition-all duration-300 animate-slide-up delay-400 glow-box-subtle">
              <Cpu className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Top Equipment</h3>
              <p className="text-gray-400">High-end gaming PCs available</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
