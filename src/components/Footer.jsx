import AnimatedSection from "../components/AnimatedSection";
import BrandLogo from "./BrandLogo";

const Footer = () => {
  return (
    <footer id="about" className="bg-white text-text-primary py-20 md:py-32 scroll-mt-28 border-t border-black/5">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-20 mb-16 md:mb-24">
          <div className="lg:col-span-1">
            <div className="mb-12">
              <BrandLogo />
            </div>
            <p className="text-text-secondary leading-relaxed mb-10 max-w-xs text-[13px] font-medium">
              We define the union of advanced medical technology and artistic precision in modern cosmetic dentistry.
            </p>
            <div className="flex gap-5">
              {["IG", "FB", "TW", "LI"].map((s) => (
                <a key={s} href="#" className="w-12 h-12 rounded-2xl border border-black/5 flex items-center justify-center text-[10px] font-black tracking-widest text-text-secondary hover:bg-accent-blue hover:text-white hover:border-accent-blue transition-all duration-500 shadow-sm">
                  {s}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-serif text-2xl mb-10 text-text-primary">Services</h4>
            <ul className="space-y-5 text-text-secondary text-[13px] font-bold uppercase tracking-widest">
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Teeth Whitening</a></li>
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Digital Alignment</a></li>
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Smile Makeover</a></li>
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Clinical Diagnostics</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-2xl mb-10 text-text-primary">Quick Links</h4>
            <ul className="space-y-5 text-text-secondary text-[13px] font-bold uppercase tracking-widest">
              <li><a href="#about" className="hover:text-accent-blue transition-colors">About Us</a></li>
              <li><a href="#simulator" className="hover:text-accent-blue transition-colors">Smile Simulator</a></li>
              <li><a href="#gallery" className="hover:text-accent-blue transition-colors">Patient Results</a></li>
              <li><a href="#" className="hover:text-accent-blue transition-colors">Book Consultation</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-16 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-8 text-text-secondary text-[9px] uppercase tracking-[0.4em] font-black">
          <p>© 2026 Smile Studio. Engineering Aesthetics.</p>
          <div className="flex gap-12">
            <a href="#" className="hover:text-accent-blue transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-accent-blue transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
