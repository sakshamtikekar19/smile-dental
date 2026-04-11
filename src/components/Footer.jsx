import AnimatedSection from "../components/AnimatedSection";
import PremiumButton from "../components/PremiumButton";
import BrandLogo from "./BrandLogo";

const Footer = () => {
  return (
    <footer id="about" className="bg-zinc-950 text-white py-24 scroll-mt-28">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
          <div className="lg:col-span-1">
            <div className="mb-10">
              <BrandLogo className="brightness-200 grayscale contrast-200" />
            </div>
            <p className="text-zinc-500 leading-relaxed mb-8 max-w-xs text-sm">
              We define the union of advanced medical technology and artistic precision in modern cosmetic dentistry.
            </p>
            <div className="flex gap-4">
              {["IG", "FB", "TW", "LI"].map((s) => (
                <a key={s} href="#" className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-xs font-bold hover:bg-white hover:text-black transition-all">
                  {s}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-serif text-xl mb-8">Services</h4>
            <ul className="space-y-4 text-zinc-400">
              <li><a href="#services" className="hover:text-white transition-colors">Teeth Whitening</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Invisalign</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Veneers</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Dental Implants</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-xl mb-8">Quick Links</h4>
            <ul className="space-y-4 text-zinc-400">
              <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#simulation" className="hover:text-white transition-colors">Smile Simulator</a></li>
              <li><a href="#gallery" className="hover:text-white transition-colors">Our Gallery</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-xl mb-8">Newsletter</h4>
            <p className="text-zinc-400 mb-6">Join our community for the latest in dental care and exclusive offers.</p>
            <div className="relative">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="w-full bg-zinc-800 border border-zinc-700 rounded-full py-4 px-6 text-sm focus:outline-none focus:border-white transition-colors"
              />
              <button className="absolute right-2 top-2 bottom-2 bg-white text-black px-6 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-500 text-xs uppercase tracking-widest font-bold">
          <p>© 2026 Smile Studio. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
