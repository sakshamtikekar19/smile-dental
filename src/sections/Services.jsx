import { Sparkles, ShieldCheck, HeartPulse, Layers, ArrowRight } from "lucide-react";
import AnimatedSection from "../components/AnimatedSection";

const services = [
  {
    title: "Teeth Whitening",
    description: "Professional whitening treatments that brighten your smile by several shades in just one visit.",
    icon: Sparkles,
    color: "bg-blue-50 text-blue-500",
    treatment: "whitening"
  },
  {
    title: "Alignment",
    description: "Digital alignment preview for straighter tooth positioning and improved smile symmetry.",
    icon: Layers,
    color: "bg-purple-50 text-purple-500",
    treatment: "alignment"
  },
  {
    title: "Braces",
    description: "Dedicated braces simulation showing realistic bracket and wire placement on your teeth.",
    icon: ShieldCheck,
    color: "bg-indigo-50 text-indigo-500",
    treatment: "braces"
  },
  {
    title: "Full Smile Transformation",
    description: "Combined aesthetic simulation to preview a complete smile makeover in one view.",
    icon: HeartPulse,
    color: "bg-rose-50 text-rose-500",
    treatment: "transformation"
  }
];

const Services = () => {
  const goToSimulator = (treatment = null) => {
    if (treatment) {
      window.dispatchEvent(new CustomEvent("smile:select-treatment", { detail: { treatment } }));
    }
    document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="services" className="py-32 bg-[#030303] scroll-mt-28 relative overflow-hidden">
      {/* Subtle Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-accent-blue/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-accent-purple/5 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <AnimatedSection className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-[1px] bg-accent-blue" />
              <span className="text-accent-blue text-[10px] font-bold uppercase tracking-[0.4em]">Expertise</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-white leading-tight">
              Crafting Smiles with <br />
              <span className="text-gradient italic">Precision & Artistry</span>
            </h2>
          </AnimatedSection>
          
          <AnimatedSection delay={0.2} className="md:w-1/3">
            <p className="text-[#808080] text-lg leading-relaxed mb-8">
              We combine advanced medical technology with an artistic eye to deliver results that are both beautiful and healthy.
            </p>
            <button 
              onClick={() => goToSimulator()}
              className="inline-flex items-center gap-3 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:text-accent-blue transition-all group"
            >
              Diagnostic Review <ArrowRight size={14} className="text-accent-blue group-hover:translate-x-2 transition-transform" />
            </button>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <AnimatedSection 
              key={service.title} 
              delay={index * 0.1}
              className="group p-8 rounded-[2.5rem] border border-white/5 bg-[#0A0A0A] hover:bg-[#0F0F0F] hover:border-accent-blue/20 transition-all duration-500 cursor-pointer relative overflow-hidden"
              onClick={() => goToSimulator(service.treatment)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToSimulator(service.treatment);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="w-14 h-14 bg-white/5 border border-white/10 text-accent-blue rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-accent-blue group-hover:text-black transition-all duration-500 shadow-xl">
                <service.icon size={24} />
              </div>
              <h3 className="text-xl font-serif mb-4 text-white leading-tight group-hover:text-accent-blue transition-colors">{service.title}</h3>
              <p className="text-[#606060] leading-relaxed mb-8 text-sm font-medium group-hover:text-[#808080] transition-colors">
                {service.description}
              </p>
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all duration-500">
                <ArrowRight size={16} />
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
