import { motion } from "framer-motion";
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
    <section id="services" className="py-24 bg-white">
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
            <a href="#" className="inline-flex items-center gap-2 text-black font-semibold hover:gap-4 transition-all">
              View All Services <ArrowRight size={20} />
            </a>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <AnimatedSection 
              key={service.title} 
              delay={index * 0.1}
              className="group p-10 rounded-3xl border border-zinc-100 bg-zinc-50 hover:bg-white hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-500"
            >
              <div className={`w-16 h-16 ${service.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500`}>
                <service.icon size={32} />
              </div>
              <h3 className="text-2xl font-serif mb-4 text-zinc-900">{service.title}</h3>
              <p className="text-zinc-500 leading-relaxed mb-8">
                {service.description}
              </p>
              <div className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-300">
                <ArrowRight size={18} />
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
