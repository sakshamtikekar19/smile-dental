import { motion } from "framer-motion";
import { cn } from "../utils/cn";

const PremiumButton = ({ 
  children, 
  onClick, 
  variant = "primary", 
  className,
  ...props 
}) => {
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-[0_10px_20px_rgba(0,0,0,0.1)]",
    secondary: "bg-white text-zinc-900 border border-zinc-100 hover:bg-zinc-50 glass shadow-sm",
    outline: "bg-transparent border border-zinc-200 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900",
    gold: "bg-brand-gold text-white hover:brightness-110 shadow-[0_10px_20px_rgba(212,175,55,0.2)]"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.025, y: -2 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center px-9 py-4 rounded-full font-sans text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};

export default PremiumButton;
