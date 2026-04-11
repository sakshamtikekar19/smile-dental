import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
// import SmileSimulatorAI from "./sections/SmileSimulatorAI";
import Services from "./sections/Services";
import Testimonials from "./sections/Testimonials";
import Footer from "./components/Footer";
import AnimatedSection from "./components/AnimatedSection";
import PremiumButton from "./components/PremiumButton";

function App() {
  console.log("DIAGNOSTIC: App component rendering full...");
  return (
    <main className="bg-white min-h-screen selection:bg-brand-gold selection:text-white">
      <Navbar />
      <Hero />
      <Services />
      <Testimonials />
      <Footer />
    </main>
  );
}

export default App;
