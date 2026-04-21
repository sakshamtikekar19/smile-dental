import { Sparkles, ShieldCheck, HeartPulse, ArrowRight } from "lucide-react";
import AnimatedSection from "../components/AnimatedSection";

const services = [
  {
    title: "Teeth Whitening",
    description: "Professional whitening treatments that brighten your smile by several shades in just one visit.",
    icon: Sparkles,
    color: "bg-blue-50 text-blue-500"
  },
  {
    title: "Braces & Aligners",
    description: "Modern orthodontic solutions including Invisalign and clear braces for a perfectly aligned smile.",
    icon: ShieldCheck,
    color: "bg-purple-50 text-purple-500"
  },
  {
    title: "Cosmetic Dentistry",
    description: "Veneers, bonding, and full smile makeovers tailored to your unique facial features.",
    icon: HeartPulse,
    color: "bg-rose-50 text-rose-500"
  }
];

const Services = () => {
  return (
    <section id="services" className="py-32 bg-[#0A0A0A] scroll-mt-28 relative">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <AnimatedSection className="max-w-2xl">
            <span className="text-accent-blue text-[10px] font-bold uppercase tracking-[0.4em] mb-4 block">Expertise</span>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-white leading-tight">
              Crafting Smiles with <br />
              <span className="italic text-[#A0A0A0]">Precision & Care</span>
            </h2>
          </AnimatedSection>
          
          <AnimatedSection delay={0.2} className="md:w-1/3">
            <p className="text-[#A0A0A0] text-lg leading-relaxed mb-8">
              We combine advanced medical technology with an artistic eye to deliver results that are both beautiful and healthy.
            </p>
            <button 
              onClick={() => document.getElementById('simulation').scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-3 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:text-accent-blue transition-all group"
            >
              Diagnostic Review <ArrowRight size={14} className="text-accent-blue group-hover:translate-x-2 transition-transform" />
            </button>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {services.map((service, index) => (
            <AnimatedSection 
              key={service.title} 
              delay={index * 0.1}
              className="group p-10 rounded-[2.5rem] border border-white/5 bg-[#111111] hover:bg-[#161616] hover:border-accent-blue/30 transition-all duration-700 glow-blue"
            >
              <div className="w-16 h-16 bg-accent-blue/10 border border-accent-blue/20 text-accent-blue rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-[0_0_15px_rgba(0,209,255,0.1)]">
                <service.icon size={28} />
              </div>
              <h3 className="text-2xl font-serif mb-5 text-white leading-tight">{service.title}</h3>
              <p className="text-[#A0A0A0] leading-relaxed mb-10 text-sm font-medium opacity-80">
                {service.description}
              </p>
              <button 
                onClick={() => document.getElementById('simulation').scrollIntoView({ behavior: 'smooth' })}
                className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white group-hover:bg-accent-blue group-hover:border-accent-blue group-hover:text-black transition-all duration-500"
              >
                <ArrowRight size={18} />
              </button>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
