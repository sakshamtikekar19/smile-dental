import { motion } from "framer-motion";
import AnimatedSection from "../components/AnimatedSection";
import PremiumButton from "../components/PremiumButton";

const testimonials = [
  {
    name: "Emma Thompson",
    role: "Cosmetic Patient",
    content: "The AI simulation was what convinced me. Seeing the potential result before starting gave me so much confidence in the treatment plan.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1000&auto=format&fit=crop"
  },
  {
    name: "James Wilson",
    role: "Orthodontic Patient",
    content: "Incredible attention to detail. The results were even better than the simulation, and the team was professional throughout.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop"
  }
];

const galleryImages = [
  "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=1000&auto=format&fit=crop"
];

const Testimonials = () => {
  return (
    <section id="gallery" className="py-32 bg-[#030303] overflow-hidden scroll-mt-28 relative">
      {/* Background patterns */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-accent-blue/5 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent-purple/5 blur-[120px] rounded-full -z-10" />

      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <AnimatedSection>
            <div className="flex items-center gap-4 mb-8">
              <span className="h-px w-8 bg-gradient-to-r from-accent-blue to-accent-purple" />
              <span className="text-gradient text-[10px] font-bold uppercase tracking-[0.4em]">Success Stories</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-8xl font-serif text-white leading-[1.05] mb-12">
              Clinical Results, <br />
              <span className="italic text-[#808080] font-normal">Real Confidence</span>
            </h2>
            
            <div className="space-y-16 mt-20">
              {testimonials.map((t) => (
                <div key={t.name} className="group flex gap-10 items-start transition-all">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden flex-shrink-0 shadow-2xl border border-white/5 group-hover:scale-105 transition-transform duration-700 relative">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" />
                    <div className="absolute inset-0 bg-accent-blue/10 mix-blend-overlay" />
                  </div>
                  <div className="flex-1 pt-2">
                    <p className="text-2xl text-[#808080] font-serif italic mb-8 leading-relaxed relative group-hover:text-[#A0A0A0] transition-colors">
                      <span className="absolute -left-8 -top-3 text-5xl text-accent-blue/20 font-serif">&ldquo;</span>
                      {t.content}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="h-px w-6 bg-gradient-to-r from-accent-blue to-accent-purple shadow-[0_0_12px_rgba(0,209,255,0.3)]" />
                      <span className="font-bold text-white text-[13px] uppercase tracking-widest">{t.name}</span>
                      <span className="text-[#606060] text-[9px] tracking-[0.3em] uppercase">— {t.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.3} className="relative">
            <div className="grid grid-cols-2 gap-6">
              {galleryImages.map((img, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -15 }}
                  className={`relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 ${i % 2 === 1 ? "translate-y-16" : ""}`}
                >
                  <img 
                    src={img} 
                    alt={`Smile Result ${i + 1}`} 
                    className="w-full h-72 object-cover grayscale-[0.2] hover:grayscale-0 hover:scale-110 transition-all duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                </motion.div>
              ))}
            </div>
            
            <div className="absolute -bottom-16 -right-8 z-20 glass-medical p-10 rounded-[3rem] shadow-2xl max-w-[240px] glow-combined">
              <div className="text-6xl font-serif text-gradient mb-3 leading-none font-bold">5k<span className="text-3xl font-sans font-light opacity-40 text-white">+</span></div>
              <div className="text-[9px] uppercase tracking-[0.3em] font-black text-[#606060] leading-relaxed">Successful Clinical Transformations</div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
