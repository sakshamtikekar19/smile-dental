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
    <section id="services" className="py-24 bg-white scroll-mt-28">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <AnimatedSection className="max-w-2xl">
            <span className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-4 block">Our Expertise</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-zinc-900 leading-tight">
              Crafting Smiles with <br />
              <span className="italic text-zinc-400">Precision & Care</span>
            </h2>
          </AnimatedSection>
          
          <AnimatedSection delay={0.2} className="md:w-1/3">
            <p className="text-zinc-500 text-lg leading-relaxed mb-6">
              We combine advanced medical technology with an artistic eye to deliver results that are both beautiful and healthy.
            </p>
            <button 
              onClick={() => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 text-black font-bold uppercase tracking-wider text-[11px] hover:gap-4 transition-all"
            >
              Consultation <ArrowRight size={16} className="text-brand-gold" />
            </button>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <AnimatedSection 
              key={service.title} 
              delay={index * 0.1}
              className="group p-10 rounded-[2.5rem] border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-500"
            >
              <div className={`w-16 h-16 ${service.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-sm shadow-black/5`}>
                <service.icon size={28} />
              </div>
              <h3 className="text-2xl font-serif mb-4 text-zinc-900 leading-tight">{service.title}</h3>
              <p className="text-zinc-500 leading-relaxed mb-8 text-sm">
                {service.description}
              </p>
              <button 
                onClick={() => document.getElementById('simulation').scrollIntoView({ behavior: 'smooth' })}
                className="w-11 h-11 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-zinc-900 group-hover:border-zinc-900 group-hover:text-white transition-all duration-300"
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
