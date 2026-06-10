import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
import TrustBadges from "./components/TrustBadges";
import Services from "./sections/Services";
import SmileSimulatorAI from "./sections/SmileSimulatorAI";
import Testimonials from "./sections/Testimonials";
import FAQ from "./components/FAQ";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";

function App() {
  console.log("DIAGNOSTIC: App component rendering full layout...");
  return (
    <main className="bg-white min-h-screen bg-luxury-texture">
      <Navbar />
      <Hero />
      <TrustBadges />
      <Services />
      <SmileSimulatorAI />
      <Testimonials />
      <FAQ />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}

export default App;

