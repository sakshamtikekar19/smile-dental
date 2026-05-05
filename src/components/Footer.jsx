import AnimatedSection from "../components/AnimatedSection";
import PremiumButton from "../components/PremiumButton";
import BrandLogo from "./BrandLogo";

const Footer = () => {
  return (
    <footer id="about" className="bg-[#030303] text-white py-20 md:py-32 scroll-mt-28 border-t border-white/5">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-20 mb-16 md:mb-24">
          <div className="lg:col-span-1">
            <div className="mb-12">
              <BrandLogo />
            </div>
            <p className="text-[#6B7280] leading-relaxed mb-10 max-w-xs text-[13px] font-medium">
              We define the union of advanced medical technology and artistic precision in modern cosmetic dentistry.
            </p>
            <div className="flex gap-5">
              {["IG", "FB", "TW", "LI"].map((s) => (
                <a key={s} href="#" className="w-12 h-12 rounded-2xl border border-[#1F1F1F] flex items-center justify-center text-[10px] font-black tracking-widest hover:bg-accent-blue hover:text-black hover:border-accent-blue transition-all duration-500">
                  {s}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-serif text-2xl mb-10 text-white">Services</h4>
            <ul className="space-y-5 text-[#6B7280] text-[13px] font-bold uppercase tracking-widest">
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Teeth Whitening</a></li>
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Invisalign</a></li>
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Veneers</a></li>
              <li><a href="#services" className="hover:text-accent-blue transition-colors">Dental Implants</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-2xl mb-10 text-white">Quick Links</h4>
            <ul className="space-y-5 text-[#6B7280] text-[13px] font-bold uppercase tracking-widest">
              <li><a href="#about" className="hover:text-accent-blue transition-colors">About Us</a></li>
              <li><a href="#simulator" className="hover:text-accent-blue transition-colors">Smile Simulator</a></li>
              <li><a href="#gallery" className="hover:text-accent-blue transition-colors">Our Gallery</a></li>
              <li><a href="#contact" className="hover:text-accent-blue transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-2xl mb-10 text-white">Newsletter</h4>
            <p className="text-[#6B7280] mb-8 text-[13px] leading-relaxed font-medium">Join our community for the latest in dental care and exclusive offers.</p>
            <div className="relative group flex flex-col sm:block gap-3">
              <input 
                type="email" 
                placeholder="Diagnostic Updates" 
                className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl py-5 px-8 text-sm text-white focus:outline-none focus:border-accent-blue/50 transition-all placeholder:text-[#333333] placeholder:uppercase placeholder:text-[10px] placeholder:tracking-[0.2em]"
              />
              <button className="sm:absolute sm:right-2 sm:top-2 sm:bottom-2 bg-accent-blue text-black px-8 py-3 sm:py-0 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,209,255,0.2)]">
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="pt-16 border-t border-[#1F1F1F] flex flex-col md:flex-row justify-between items-center gap-8 text-[#333333] text-[9px] uppercase tracking-[0.4em] font-black">
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
