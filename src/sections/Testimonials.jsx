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
    <section id="gallery" className="py-24 bg-white overflow-hidden scroll-mt-28">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <AnimatedSection>
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-6 bg-zinc-300" />
              <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.3em]">Patient Stories</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-zinc-900 leading-[1.1] mb-8">
              Real Results, <br />
              <span className="italic text-zinc-300 font-normal">Real Confidence</span>
            </h2>
            
            <div className="space-y-12 mt-16">
              {testimonials.map((t) => (
                <div key={t.name} className="group flex gap-8 items-start transition-all">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-xl border-4 border-zinc-50 group-hover:scale-105 transition-transform duration-500">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 pt-2">
                    <p className="text-xl text-zinc-600 font-serif italic mb-6 leading-relaxed relative">
                      <span className="absolute -left-6 -top-2 text-4xl text-brand-gold/20 font-serif">&ldquo;</span>
                      {t.content}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="h-px w-4 bg-brand-gold" />
                      <span className="font-bold text-zinc-900 text-sm">{t.name}</span>
                      <span className="text-zinc-400 text-[10px] tracking-widest uppercase">— {t.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.3} className="relative">
            <div className="grid grid-cols-2 gap-4">
              {galleryImages.map((img, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -10 }}
                  className={`relative rounded-3xl overflow-hidden shadow-lg ${i % 2 === 1 ? "translate-y-12" : ""}`}
                >
                  <img 
                    src={img} 
                    alt={`Smile Result ${i + 1}`} 
                    className="w-full h-64 object-cover hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </motion.div>
              ))}
            </div>
            
            <div className="absolute -bottom-12 -right-12 z-20 glass p-8 rounded-[2rem] shadow-2xl max-w-[220px]">
              <div className="text-5xl font-serif text-brand-gold mb-2 leading-none">5k<span className="text-2xl font-sans font-normal opacity-50">+</span></div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 leading-tight">Successful Smile Transformations</div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
