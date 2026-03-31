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
    primary: "bg-black text-white hover:bg-zinc-800",
    secondary: "bg-transparent border border-black text-black hover:bg-black hover:text-white",
    outline: "bg-transparent border border-zinc-200 text-zinc-600 hover:border-black hover:text-black",
    gold: "bg-[#D4AF37] text-white hover:bg-[#B8962E]"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "px-8 py-4 rounded-full font-sans text-sm font-medium tracking-wide transition-all duration-300",
        variants[variant],
        className
      )}
      style={{
        backgroundColor: variant === 'primary' ? '#000' : variant === 'gold' ? '#D4AF37' : 'transparent',
        color: (variant === 'primary' || variant === 'gold') ? '#fff' : '#000',
        border: (variant === 'secondary' || variant === 'outline') ? '1px solid #000' : 'none',
        borderRadius: '9999px',
        padding: '1rem 2rem',
        cursor: 'pointer'
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default PremiumButton;
