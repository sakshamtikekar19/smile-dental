import { motion } from "framer-motion";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-24 overflow-hidden bg-white">
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#F9F9F7] -z-10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-blue/30 rounded-full blur-[120px] -z-10" />
      
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="max-w-2xl">
          <AnimatedSection delay={0.2} y={30}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-blue/50 text-zinc-600 text-[10px] font-semibold uppercase tracking-widest mb-6">
              The Future of Cosmetic Dentistry
            </span>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-serif leading-[1.05] tracking-tight text-zinc-900 mb-8">
              Visualize Your <br />
              <span className="italic text-zinc-500">Perfect Smile</span> <br />
              Before Treatment
            </h1>
            <p className="text-lg md:text-xl text-zinc-500 font-sans leading-relaxed mb-10 max-w-lg">
              Experience the power of AI-driven smile simulation. Our advanced technology lets you see your transformation before you even begin your journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <PremiumButton 
                onClick={() => document.getElementById('simulation').scrollIntoView({ behavior: 'smooth' })}
                className="text-base py-5 px-10"
              >
                Try Smile Simulation
              </PremiumButton>
              <PremiumButton
                variant="secondary"
                className="text-base py-5 px-10"
                onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Our Gallery
              </PremiumButton>
            </div>
          </AnimatedSection>
        </div>

        <div className="relative">
          <AnimatedSection delay={0.4} y={40} className="relative z-10">
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/5] md:aspect-[3/4]"
            >
              <img 
                src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=1000&auto=format&fit=crop" 
                alt="Perfect Smile" 
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </motion.div>

            {/* Floating UI elements */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute -right-8 top-1/4 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl hidden md:block"
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 bg-brand-blue rounded-full flex items-center justify-center text-zinc-700 font-serif">AI</div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Simulation</div>
                  <div className="text-sm font-semibold text-zinc-800">98.4% Accuracy</div>
                </div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Hero;
