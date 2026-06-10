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
    primary: "bg-[#7BA8C9] text-white hover:bg-[#6B98B9] shadow-[0_10px_30px_rgba(123,168,201,0.2)] border-none",
    secondary: "bg-[#F8FAFC] text-[#2C3E50] border border-black/5 hover:bg-[#EBF5FB]",
    outline: "bg-transparent border border-black/10 text-[#5D6D7E] hover:border-[#7BA8C9] hover:text-[#2C3E50]",
    gold: "bg-gradient-to-r from-[#7BA8C9] to-[#B8D4E3] text-white hover:brightness-110 shadow-[0_10px_30px_rgba(123,168,201,0.2)] border-none"
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
