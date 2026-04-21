import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import PremiumButton from "../components/PremiumButton";
import BrandLogo from "./BrandLogo";

const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "Simulator", href: "#simulation" },
  { label: "Results", href: "#gallery" },
  { label: "About", href: "#about" },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (href) => {
    const id = href.replace("#", "");
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
    setMobileOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isScrolled || mobileOpen 
          ? "py-4 bg-black/60 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.8)] border-b border-white/5" 
          : "py-8 bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        <a 
          href="#" 
          className="relative transition-transform duration-300 hover:scale-[1.02]" 
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        >
          <BrandLogo />
        </a>

        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => scrollTo(item.href)}
              className="text-[11px] uppercase tracking-widest font-bold text-[#A0A0A0] hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <PremiumButton
            variant="primary"
            className="hidden md:inline-flex py-2.5 px-6"
            onClick={() => scrollTo("#contact")}
          >
            Book Now
          </PremiumButton>

          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-white hover:bg-white/5 transition-colors"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden border-t border-white/5 bg-[#0A0A0A]"
          >
            <div className="container mx-auto px-6 py-6 flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => scrollTo(item.href)}
                  className="text-left py-4 text-xs font-bold uppercase tracking-widest text-[#A0A0A0] border-b border-white/5 last:border-0"
                >
                  {item.label}
                </button>
              ))}
              <PremiumButton variant="primary" className="mt-4 w-full justify-center py-4" onClick={() => scrollTo("#contact")}>
                Book Now
              </PremiumButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
