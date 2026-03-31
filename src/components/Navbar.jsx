import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PremiumButton from "../components/PremiumButton";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? "bg-white/80 backdrop-blur-md py-4 shadow-sm" : "bg-transparent py-8"
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-tight">SMILE STUDIO</span>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          {["Services", "Simulation", "Gallery", "About"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium text-zinc-600 hover:text-black transition-colors"
            >
              {item}
            </a>
          ))}
        </div>

        <PremiumButton variant="primary" className="hidden md:block py-2.5 px-6">
          Book Now
        </PremiumButton>
      </div>
    </motion.nav>
  );
};

export default Navbar;
