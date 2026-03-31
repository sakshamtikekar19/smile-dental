import { motion } from "framer-motion";
import { cn } from "../utils/cn";

const AnimatedSection = ({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.8,
  y = 20,
  once = true 
}) => {
  return (
    <motion.section
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once }}
      transition={{ 
        duration, 
        delay, 
        ease: [0.22, 1, 0.36, 1] 
      }}
      className={cn("w-full", className)}
    >
      {children}
    </motion.section>
  );
};

export default AnimatedSection;
