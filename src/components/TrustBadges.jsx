import { ShieldCheck, Award, CheckCircle, Star } from "lucide-react";
import AnimatedSection from "./AnimatedSection";

const badges = [
  { icon: ShieldCheck, label: "Certified Clinical Tech", detail: "ISO 13485 Compliant" },
  { icon: Award, label: "Premium Aesthetic Award", detail: "Excellence in Imaging" },
  { icon: CheckCircle, label: "Anatomically Accurate", detail: "98.4% Precision Rate" },
  { icon: Star, label: "Luxury Concierge Care", detail: "Patient-First Approach" }
];

const TrustBadges = () => {
  return (
    <section className="py-12 bg-white border-y border-black/5">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {badges.map((badge, idx) => (
            <AnimatedSection key={idx} delay={0.1 + idx * 0.1} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-accent-gold/5 flex items-center justify-center text-accent-gold mb-4 group-hover:scale-110 transition-transform">
                <badge.icon size={24} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-luxury text-text-primary mb-1">{badge.label}</h4>
              <p className="text-[9px] text-text-secondary font-medium uppercase tracking-widest">{badge.detail}</p>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
