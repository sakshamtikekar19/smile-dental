import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import AnimatedSection from "./AnimatedSection";

const faqs = [
  {
    question: "How accurate is the digital smile preview?",
    answer: "Our clinical imaging engine uses high-precision anatomical mapping with a 98.4% accuracy rate. It provides a realistic visualization of what professional whitening and alignment can achieve for your specific dental structure."
  },
  {
    question: "Is this simulation a guarantee of results?",
    answer: "While highly accurate, the preview is a diagnostic tool designed for visualization. Final clinical results depend on individual biological response and the specific treatment plan developed during your professional consultation."
  },
  {
    question: "How does the whitening technology work?",
    answer: "The system analyzes the current shade of your enamel and applies a clinical-grade subtractive color correction to remove yellowing while preserving the natural translucency and texture of your teeth."
  },
  {
    question: "Can I use the preview for orthodontic planning?",
    answer: "Yes, the alignment mode provides a digital projection of orthodontic movement. It is an excellent starting point for discussing clear aligner or traditional brace options with your specialist."
  }
];

const FAQItem = ({ faq, isOpen, toggle }) => {
  return (
    <div className="border-b border-black/5 last:border-0">
      <button
        onClick={toggle}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-sm md:text-base font-bold text-text-primary group-hover:text-accent-blue transition-colors">
          {faq.question}
        </span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-black/5 transition-all ${isOpen ? 'bg-accent-blue border-accent-blue text-white' : 'text-text-secondary group-hover:border-accent-blue/30'}`}>
          {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-sm text-text-secondary leading-relaxed max-w-2xl">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20">
          <div className="lg:col-span-4">
            <AnimatedSection>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-[1px] bg-accent-gold" />
                <span className="text-accent-gold text-[10px] font-bold uppercase tracking-luxury text-nowrap">Common Inquiries</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-serif text-text-primary mb-6">
                Clinical <br /><span className="italic text-accent-blue">Clarification</span>
              </h2>
              <p className="text-text-secondary text-base leading-relaxed">
                Everything you need to know about our digital smile imaging technology and treatment process.
              </p>
            </AnimatedSection>
          </div>
          <div className="lg:col-span-8">
            <AnimatedSection delay={0.2}>
              <div className="bg-[#F8FAFC] rounded-[32px] p-6 md:p-10 border border-black/5">
                {faqs.map((faq, idx) => (
                  <FAQItem 
                    key={idx} 
                    faq={faq} 
                    isOpen={openIndex === idx} 
                    toggle={() => setOpenIndex(openIndex === idx ? -1 : idx)} 
                  />
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
