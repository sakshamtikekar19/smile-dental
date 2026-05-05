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
    primary: "bg-gradient-to-r from-accent-blue to-accent-purple text-white hover:brightness-110 shadow-[0_0_30px_rgba(0,209,255,0.2)] border-none",
    secondary: "bg-white/5 text-white border border-white/10 hover:bg-white/10 backdrop-blur-xl",
    outline: "bg-transparent border border-white/10 text-[#808080] hover:border-accent-blue hover:text-white",
    gold: "bg-gradient-to-r from-accent-blue to-accent-purple text-white hover:brightness-110 shadow-[0_0_30px_rgba(0,209,255,0.2)] border-none"
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
