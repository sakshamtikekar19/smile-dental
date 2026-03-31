import { motion } from "framer-motion";

const AIProcessingLoader = ({ text = "Enhancing your smile..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-zinc-100 shadow-sm">
      <div className="relative w-24 h-24 mb-10">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-2 border-zinc-100 rounded-full"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-t-2 border-brand-gold rounded-full"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-4 bg-zinc-50 rounded-full flex items-center justify-center"
        >
          <div className="w-4 h-4 bg-brand-gold rounded-full" />
        </motion.div>
      </div>
      
      <motion.div 
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-center"
      >
        <h3 className="text-xl font-serif text-zinc-800 mb-2">{text}</h3>
        <p className="text-sm text-zinc-400 font-sans tracking-wide uppercase">AI Engine Processing</p>
      </motion.div>
      
      <div className="mt-12 w-64 h-1 bg-zinc-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-1/2 h-full bg-brand-gold"
        />
      </div>
    </div>
  );
};

export default AIProcessingLoader;
