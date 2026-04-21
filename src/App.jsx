import Navbar from "./components/Navbar";
import Hero from "./sections/Hero";
import Services from "./sections/Services";
import SmileSimulatorAI from "./sections/SmileSimulatorAI";
import Testimonials from "./sections/Testimonials";
import Footer from "./components/Footer";

function App() {
  console.log("DIAGNOSTIC: App component rendering full layout...");
  return (
    <main className="bg-[#050505] min-h-screen">
      <Navbar />
      <Hero />
      <Services />
      <SmileSimulatorAI />
      <Testimonials />
      <Footer />
    </main>
  );
}

export default App;

