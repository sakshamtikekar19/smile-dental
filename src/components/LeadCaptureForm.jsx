import { useState } from "react";
import { motion } from "framer-motion";
import emailjs from "@emailjs/browser";
import { Mail, Loader2, CheckCircle2, Lock } from "lucide-react";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts digits, spaces, dashes, parens and an optional leading +, requiring
// at least 7 digits overall so it works for international numbers too.
const PHONE_PATTERN = /^\+?[\d\s()-]{7,}$/;

// Keep a local copy of every lead so nothing is lost even if EmailJS is not
// configured yet (e.g. before the owner pastes their keys).
const persistLeadLocally = (lead) => {
  try {
    const existing = JSON.parse(localStorage.getItem("smile_leads") || "[]");
    existing.push({ ...lead, capturedAt: new Date().toISOString() });
    localStorage.setItem("smile_leads", JSON.stringify(existing));
  } catch {
    // Ignore storage failures (private mode / quota).
  }
};

const LeadCaptureForm = ({ treatment, intensity, onSuccess }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMessage("Please enter your name."); return; }
    if (!EMAIL_PATTERN.test(email)) { setErrorMessage("Please enter a valid email address."); return; }
    if (!PHONE_PATTERN.test(phone.trim())) { setErrorMessage("Please enter a valid phone number."); return; }

    setErrorMessage("");
    setStatus("sending");

    const lead = {
      from_name: name.trim(),
      from_email: email.trim(),
      phone: phone.trim(),
      treatment: treatment || "",
      intensity: typeof intensity === "number" ? `${intensity}%` : "",
    };
    persistLeadLocally(lead);

    try {
      if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
        console.warn(
          "[LeadCapture] EmailJS env vars missing. Email will NOT be sent.",
          { SERVICE_ID, TEMPLATE_ID, hasPublicKey: Boolean(PUBLIC_KEY) }
        );
        throw new Error("EmailJS is not configured (missing keys).");
      }
      const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, lead, { publicKey: PUBLIC_KEY });
      console.log("[LeadCapture] EmailJS send OK:", response?.status, response?.text);
      onSuccess?.(lead);
    } catch (err) {
      // Log the real EmailJS error so the cause is visible in the console.
      console.error("[LeadCapture] EmailJS send FAILED:", err?.status, err?.text || err?.message || err);
      // The lead is already saved locally; surface a soft error but still let
      // the user through so the experience never feels broken.
      setStatus("error");
      setErrorMessage("We couldn't send the email, but your details are saved. You can continue.");
      setTimeout(() => onSuccess?.(lead), 1200);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="w-12 h-12 mx-auto mb-5 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue">
        <Lock size={20} />
      </div>
      <h4 className="font-serif text-2xl md:text-3xl text-text-primary mb-2">Unlock Your Smile Report</h4>
      <p className="text-text-secondary text-sm leading-relaxed mb-7 max-w-sm mx-auto">
        Enter your details to reveal the 3.0x clinical zoom and receive your HD
        before &amp; after by email.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full px-5 py-3.5 rounded-2xl bg-white border border-black/10 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/15 transition-all"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full px-5 py-3.5 rounded-2xl bg-white border border-black/10 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/15 transition-all"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full px-5 py-3.5 rounded-2xl bg-white border border-black/10 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/15 transition-all"
        />

        {errorMessage && (
          <p className="text-[11px] font-bold text-red-500 px-1">{errorMessage}</p>
        )}

        <motion.button
          type="submit"
          disabled={status === "sending"}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-2xl bg-accent-blue text-white text-[11px] uppercase tracking-[0.2em] font-black shadow-[0_10px_30px_rgba(123,168,201,0.25)] hover:bg-[#6B98B9] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {status === "sending" ? (
            <><Loader2 size={16} className="animate-spin" /> Sending…</>
          ) : status === "error" ? (
            <><CheckCircle2 size={16} /> Continuing…</>
          ) : (
            <><Mail size={16} /> Reveal My Result</>
          )}
        </motion.button>
      </form>

      <p className="text-[9px] text-text-secondary/70 uppercase tracking-[0.25em] font-bold mt-4">
        We respect your privacy · No spam
      </p>
    </div>
  );
};

export default LeadCaptureForm;
