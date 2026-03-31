import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
import SmileSimulatorAI from "./sections/SmileSimulatorAI";
import Services from "./sections/Services";
import Testimonials from "./sections/Testimonials";
import Footer from "./components/Footer";
import AnimatedSection from "./components/AnimatedSection";
import PremiumButton from "./components/PremiumButton";

function App() {
  return (
    <main className="bg-white min-h-screen selection:bg-brand-gold selection:text-white">
      <Navbar />
      
      <Hero />
      
      <SmileSimulatorAI />
      
      <Services />
      
      <Testimonials />
      
      {/* Final CTA Section */}
      <section className="py-24 bg-brand-blue/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-gold/5 -z-10 blur-3xl rounded-full" />
        <div className="container mx-auto px-6 text-center max-w-4xl relative z-10">
          <AnimatedSection>
            <h2 className="text-5xl md:text-7xl font-serif text-zinc-900 mb-8 leading-tight">
              Ready to <span className="italic text-zinc-500">Transform</span> Your Smile?
            </h2>
            <p className="text-xl text-zinc-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Book your complimentary consultation today and take the first step towards the smile you've always dreamed of.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <PremiumButton className="text-lg py-6 px-12 shadow-xl shadow-black/10">
                Book Your Consultation
              </PremiumButton>
              <PremiumButton variant="secondary" className="text-lg py-6 px-12">
                Contact Our Studio
              </PremiumButton>
            </div>
          </AnimatedSection>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}

export default App;
