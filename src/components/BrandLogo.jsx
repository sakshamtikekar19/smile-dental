import { motion } from "framer-motion";

const BrandLogo = ({ className = "", collapsed = false }) => {
  return (
    <div className={`flex items-center gap-2.5 group cursor-pointer ${className}`}>
      <motion.div 
        whileHover={{ rotate: 90 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-9 h-9 flex items-center justify-center shrink-0"
      >
        <div className="absolute inset-0 bg-brand-gold rounded-xl rotate-45 group-hover:rotate-0 transition-transform duration-500 shadow-lg shadow-brand-gold/20" />
        <div className="absolute inset-1 bg-white rounded-lg rotate-45 group-hover:rotate-0 transition-transform duration-500" />
        <svg 
          viewBox="0 0 24 24" 
          className="relative z-10 w-5 h-5 text-brand-gold"
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M7 12c2 0 3.5-1.5 3.5-3.5S9 5 7 5 3.5 6.5 3.5 8.5 5 12 7 12z" />
          <path d="M17 12c2 0 3.5-1.5 3.5-3.5S19 5 17 5s-3.5 1.5-3.5 3.5S15 12 17 12z" />
          <path d="M7 12c0 4 2 7 5 7s5-3 5-7" />
        </svg>
      </motion.div>
      
      {!collapsed && (
        <div className="flex flex-col">
          <span className="font-serif text-xl font-bold tracking-tight text-zinc-900 leading-none">
            SMILE<span className="text-brand-gold font-normal italic">STUDIO</span>
          </span>
          <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-zinc-400 mt-1 leading-none">
            Aesthetic Excellence
          </span>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
