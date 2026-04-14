import { motion } from "framer-motion";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] md:min-h-[95vh] flex items-center pt-20 md:pt-24 overflow-hidden bg-white">
      {/* Background patterns: Premium Layering (Clipped on mobile) */}
      <div className="absolute top-0 right-0 w-[80%] md:w-[60%] h-full bg-brand-beige/30 -z-10 skew-x-[-12deg] translate-x-12 md:translate-x-24" />
      
      {/* Dynamic Animated Blobs (Hidden on mobile for performance) */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 left-1/4 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-brand-blue/30 rounded-full blur-[100px] md:blur-[140px] -z-10 hidden sm:block" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, -40, 0],
          y: [0, 40, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-1/4 right-1/4 w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-brand-gold/10 rounded-full blur-[80px] md:blur-[120px] -z-10 hidden sm:block" 
      />
      
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="max-w-2xl text-center lg:text-left">
          <AnimatedSection delay={0.2} y={30}>
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6 md:mb-8">
              <span className="h-px w-6 md:w-8 bg-brand-gold" />
              <span className="text-brand-gold text-[10px] md:text-[11px] font-bold uppercase tracking-[0.3em]">
                The Future of Aesthetic Dentistry
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif leading-[1.1] md:leading-[1.02] tracking-tight text-zinc-900 mb-6 md:mb-8">
              Visualize Your <br className="hidden sm:block" />
              <span className="italic text-zinc-400 font-normal">Perfect Smile</span> <br className="hidden sm:block" />
              Before Treatment
            </h1>
            <p className="text-lg md:text-xl text-zinc-500 font-sans leading-relaxed mb-10 max-w-lg">
              Experience the power of AI-driven smile simulation. Our advanced technology lets you see your transformation before you even begin your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-5">
              <PremiumButton 
                onClick={() => document.getElementById('simulation').scrollIntoView({ behavior: 'smooth' })}
                className="text-base py-5 px-10 shadow-xl shadow-brand-gold/10"
              >
                Start Simulation
              </PremiumButton>
              <PremiumButton
                variant="secondary"
                className="text-base py-5 px-10 glass"
                onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Results
              </PremiumButton>
            </div>
          </AnimatedSection>
        </div>

        <div className="relative">
          <AnimatedSection delay={0.4} y={40} className="relative z-10">
            <motion.div 
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="relative p-4 glass rounded-[2.5rem] shadow-2xl"
            >
              <div className="rounded-[1.8rem] overflow-hidden aspect-[4/5] md:aspect-[3/4]">
                <img 
                  src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=1000&auto=format&fit=crop" 
                  alt="Perfect Smile" 
                  className="w-full h-full object-cover transition-transform duration-1000 hover:scale-110"
                />
              </div>
            </motion.div>

            {/* Floating Premium Badge */}
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 1 }}
              className="absolute -right-12 top-1/4 glass p-6 rounded-3xl shadow-2xl hidden md:block max-w-[200px]"
            >
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-serif text-lg">AI</div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Status</div>
                  <div className="text-sm font-bold text-zinc-900 leading-tight">Simulator Online</div>
                  <div className="text-[11px] text-zinc-500 mt-1">98.4% Precision</div>
                </div>
              </div>
            </motion.div>

            {/* Floating Trust Indicator */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute -left-12 bottom-12 glass p-5 rounded-3xl shadow-2xl hidden md:flex items-center gap-4"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-white overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="avatar" />
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Trusted by</div>
                <div className="text-sm font-bold text-zinc-900">2,400+ Patients</div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Hero;
