import { Sparkles, HeartPulse, Layers, ArrowRight } from "lucide-react";
import AnimatedSection from "../components/AnimatedSection";

const services = [
  {
    title: "Teeth Whitening",
    description: "Professional whitening treatments that brighten your smile by several shades in just one visit.",
    icon: Sparkles,
    color: "bg-[#D4E6F1] text-[#7BA8C9]",
    treatment: "whitening"
  },
  {
    title: "Alignment",
    description: "Digital alignment preview for straighter tooth positioning and improved smile symmetry.",
    icon: Layers,
    color: "bg-[#EBF5FB] text-[#7BA8C9]",
    treatment: "alignment"
  },
  {
    title: "Full Smile Transformation",
    description: "Combined aesthetic simulation to preview a complete smile makeover in one view.",
    icon: HeartPulse,
    color: "bg-[#F4ECF7] text-[#A569BD]",
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
    <section id="services" className="py-16 md:py-24 bg-white scroll-mt-28 relative overflow-hidden">
      {/* Subtle Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-accent-blue/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-accent-blue-pale/20 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-16 gap-8">
          <AnimatedSection className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-[1px] bg-accent-blue" />
              <span className="text-accent-blue text-[10px] font-bold uppercase tracking-[0.4em]">Expertise</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-text-primary leading-tight">
              Crafting Smiles with <br />
              <span className="text-accent-blue italic">Precision & Artistry</span>
            </h2>
          </AnimatedSection>
          
          <AnimatedSection delay={0.2} className="w-full md:w-1/3">
            <p className="text-text-secondary text-lg leading-relaxed mb-8">
              We combine advanced medical technology with an artistic eye to deliver results that are both beautiful and healthy.
            </p>
            <button 
              onClick={() => goToSimulator()}
              className="inline-flex items-center gap-3 text-text-primary font-bold uppercase tracking-[0.2em] text-[10px] hover:text-accent-blue transition-all group"
            >
              Diagnostic Review <ArrowRight size={14} className="text-accent-blue group-hover:translate-x-2 transition-transform" />
            </button>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {services.map((service, index) => (
            <AnimatedSection 
              key={service.title} 
              delay={0.2 + index * 0.15}
              className="group p-8 rounded-[2.5rem] border border-black/5 bg-[#F8FAFC] hover:bg-white hover:border-accent-blue/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.03)] transition-all duration-500 cursor-pointer relative overflow-hidden"
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
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-all duration-500 shadow-sm`}>
                <service.icon size={24} />
              </div>
              <h3 className="text-xl font-serif mb-4 text-text-primary leading-tight group-hover:text-accent-blue transition-colors">{service.title}</h3>
              <p className="text-text-secondary leading-relaxed mb-8 text-sm font-medium group-hover:text-text-primary transition-colors">
                {service.description}
              </p>
              <div className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center text-text-primary group-hover:bg-accent-blue group-hover:text-white group-hover:border-accent-blue transition-all duration-500">
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
