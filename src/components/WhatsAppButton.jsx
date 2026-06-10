import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const WhatsAppButton = () => {
  const phoneNumber = "1234567890"; // Placeholder, update with real number
  const message = "Hello, I'm interested in a premium smile consultation.";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.1, y: -5 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-8 right-8 z-[100] w-16 h-16 rounded-full bg-white/80 backdrop-blur-xl border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center text-[#25D366] group"
    >
      <div className="absolute inset-0 rounded-full bg-[#25D366]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <MessageCircle size={32} fill="currentColor" className="text-white" />
      <MessageCircle size={32} className="absolute z-10" />
      
      {/* Tooltip */}
      <div className="absolute right-full mr-4 px-4 py-2 rounded-xl bg-white border border-black/5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        <p className="text-[10px] font-black uppercase tracking-luxury text-text-primary">Concierge Support</p>
      </div>
    </motion.a>
  );
};

export default WhatsAppButton;
