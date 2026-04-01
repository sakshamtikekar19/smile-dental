import AnimatedSection from "../components/AnimatedSection";
import PremiumButton from "../components/PremiumButton";

const testimonials = [
  {
    name: "Emma Thompson",
    role: "Patient",
    content: "The AI simulation was what convinced me. Seeing the potential result before starting gave me so much confidence in the treatment plan.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1000&auto=format&fit=crop"
  },
  {
    name: "James Wilson",
    role: "Patient",
    content: "Incredible attention to detail. The results were even better than the simulation, and the team was professional throughout.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop"
  }
];

const Testimonials = () => {
  return (
    <section id="gallery" className="py-24 bg-white overflow-hidden scroll-mt-28">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <span className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-4 block">Patient Stories</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-zinc-900 leading-tight mb-8">
              Real Results, <br />
              <span className="italic text-zinc-400 font-normal">Real Confidence</span>
            </h2>
            
            <div className="space-y-12 mt-16">
              {testimonials.map((t) => (
                <div key={t.name} className="flex gap-6 items-start">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 shadow-lg border-2 border-white">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xl text-zinc-600 font-serif italic mb-4 leading-relaxed">
                      &ldquo;{t.content}&rdquo;
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900">{t.name}</span>
                      <span className="text-zinc-400 text-sm">— {t.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.3} className="relative">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1000&auto=format&fit=crop" 
                alt="Happy Patient" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              
              <div className="absolute bottom-10 left-10 right-10 p-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white">
                <div className="text-4xl font-serif mb-2">5,000+</div>
                <div className="text-sm uppercase tracking-widest font-bold opacity-80">Smiles Transformed</div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-blue/30 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-brand-gold/10 rounded-full blur-3xl -z-10" />
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
