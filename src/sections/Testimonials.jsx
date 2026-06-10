import AnimatedSection from "../components/AnimatedSection";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "Veneer Patient",
    content: "The whitening preview was spot on. Seeing my future smile gave me the confidence to move forward with my treatment plan.",
    rating: 5,
    image: "https://i.pravatar.cc/150?u=sarah"
  },
  {
    name: "Dr. Michael Chen",
    role: "Orthodontist",
    content: "As a professional, I'm impressed by the anatomical accuracy of the simulator. It's a game-changer for patient communication.",
    rating: 5,
    image: "https://i.pravatar.cc/150?u=michael"
  },
  {
    name: "Emma Thompson",
    role: "Whitening Patient",
    content: "Incredible technology. The results matched the simulation perfectly. I couldn't be happier with my new bright smile.",
    rating: 5,
    image: "https://i.pravatar.cc/150?u=emma"
  }
];

const Testimonials = () => {
  return (
    <section id="gallery" className="py-16 md:py-24 bg-[#F8FAFC] overflow-hidden scroll-mt-28 relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-blue/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <AnimatedSection>
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="w-8 h-[1px] bg-accent-blue" />
              <span className="text-accent-blue text-[10px] font-bold uppercase tracking-[0.4em]">Testimonials</span>
              <span className="w-8 h-[1px] bg-accent-blue" />
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-text-primary mb-8">
              Clinical <span className="text-accent-blue italic">Excellence</span>
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed">
              Hear from our patients and partners who have experienced the precision of our clinical smile imaging.
            </p>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {testimonials.map((t, i) => (
            <AnimatedSection key={t.name} delay={0.2 + i * 0.15}>
              <div className="h-full p-8 md:p-10 rounded-[32px] bg-white border border-black/5 hover:border-accent-blue/20 transition-all duration-500 group relative shadow-sm hover:shadow-xl">
                <div className="absolute top-8 right-8 text-accent-blue-pale group-hover:text-accent-blue/20 transition-colors">
                  <Quote size={40} fill="currentColor" />
                </div>
                
                <div className="flex gap-1 mb-8">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={14} className="fill-accent-blue text-accent-blue" />
                  ))}
                </div>

                <p className="text-text-primary text-lg leading-relaxed mb-10 font-medium relative z-10">
                  &ldquo;{t.content}&rdquo;
                </p>

                <div className="flex items-center gap-4 mt-auto">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-accent-blue-pale bg-accent-blue-pale">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-text-primary font-bold text-sm tracking-tight">{t.name}</h4>
                    <p className="text-accent-blue text-[10px] font-black uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
