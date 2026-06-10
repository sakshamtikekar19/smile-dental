import { motion } from "framer-motion";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] md:min-h-[95vh] flex items-center pt-20 md:pt-24 overflow-hidden bg-medical-gradient">
      {/* Background patterns: Premium Layering */}
      <div className="absolute top-0 right-0 w-[80%] md:w-[60%] h-full bg-gradient-to-l from-accent-blue/10 to-transparent -z-10 skew-x-[-12deg] translate-x-12 md:translate-x-24" />
      <div className="absolute bottom-0 left-0 w-[80%] md:w-[60%] h-full bg-gradient-to-r from-[#D4E6F1]/20 to-transparent -z-10 skew-x-[12deg] -translate-x-12 md:-translate-x-24" />
      
      {/* Dynamic Animated Blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 left-1/4 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-accent-blue/5 rounded-full blur-[100px] md:blur-[160px] -z-10 hidden sm:block" 
      />
      
      <div className="container mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="max-w-2xl text-center lg:text-left">
          <AnimatedSection delay={0.2} y={30}>
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6 md:mb-8">
              <span className="h-px w-6 md:w-8 bg-accent-blue" />
              <span className="text-accent-blue text-[10px] md:text-[11px] font-bold uppercase tracking-[0.4em]">
                The Future of Aesthetic Dentistry
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif leading-[1.1] md:leading-[1.02] tracking-tight text-text-primary mb-6 md:mb-8">
              Visualize Your <br className="hidden sm:block" />
              <span className="italic text-accent-blue font-normal">Perfect Smile</span> <br className="hidden sm:block" />
              <span className="text-text-primary">Before Treatment</span>
            </h1>
            <p className="text-lg md:text-xl text-text-secondary font-sans leading-relaxed mb-10 max-w-lg">
              Experience the power of AI-driven smile simulation. Our advanced technology lets you see your transformation before you even begin your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center lg:justify-start">
              <PremiumButton 
                onClick={() => document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" })}
                className="w-full sm:w-auto text-base py-5 px-10 hover:scale-105 transition-transform"
              >
                Start Simulation
              </PremiumButton>
              <PremiumButton
                variant="secondary"
                className="w-full sm:w-auto text-base py-5 px-10 border-black/10 hover:bg-accent-blue/5 transition-colors"
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
              className="relative p-4 glass-medical rounded-[2.5rem] shadow-2xl"
            >
              <div className="rounded-[1.8rem] overflow-hidden aspect-[4/5] md:aspect-[3/4] relative">
                <img 
                  src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=2000" 
                  alt="Modern Dental Clinic" 
                  className="w-full h-full object-cover transition-transform duration-1000 hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
              </div>
            </motion.div>

            {/* Floating Premium Badge */}
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 1 }}
              className="absolute -right-12 top-1/4 glass-medical p-6 rounded-3xl shadow-2xl hidden md:block max-w-[220px] glow-blue"
            >
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-accent-blue rounded-2xl flex items-center justify-center text-white font-serif text-lg font-bold">AI</div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-accent-blue animate-pulse shadow-[0_0_8px_rgba(123,168,201,0.5)]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-text-secondary font-bold mb-1">Status</div>
                  <div className="text-sm font-bold text-text-primary leading-tight">Simulator Online</div>
                  <div className="text-[11px] text-accent-blue mt-1 font-mono">98.4% Precision</div>
                </div>
              </div>
            </motion.div>

            {/* Floating Trust Indicator */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute -left-12 bottom-12 glass-medical p-5 rounded-3xl shadow-2xl hidden md:flex items-center gap-4"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-white overflow-hidden bg-accent-blue-pale">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Trusted by</div>
                <div className="text-sm font-bold text-text-primary">2,400+ Patients</div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Hero;
