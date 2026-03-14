import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("menu");

  const [phoneError, setPhoneError] = useState(false);

  const [leadData, setLeadData] = useState({
    type: "",
    city: "",
    moveIn: "",
    duration: "",
    budget: "",
    name: "",
    phone: "",
    email: ""
  });

  const updateLeadData = (field, value, nextStep) => {
    setLeadData((prev) => ({
      ...prev,
      [field]: value
    }));
    setStep(nextStep);
  };

  const resetChat = () => {
    setStep("menu");
    setLeadData({
      type: "",
      city: "",
      moveIn: "",
      duration: "",
      budget: "",
      name: "",
      phone: "",
      email: ""
    });
  };

const whatsappMessage = encodeURIComponent(
  `Hallo, ich interessiere mich für ein möbliertes Apartment bei FeelAtHomeNow.

Name: ${leadData.name}
Telefon: ${leadData.phone}
Email: ${leadData.email || "nicht angegeben"}

Art: ${leadData.type}
Stadt: ${leadData.city}
Einzug: ${leadData.moveIn}
Dauer: ${leadData.duration}
Budget: ${leadData.budget}`
);

const whatsappUrl = `https://wa.me/41762398070?text=${whatsappMessage}`;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-5 z-50 bg-[#FF7A3D] text-white rounded-full p-4 shadow-lg"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-40 right-5 w-[340px] bg-white rounded-2xl shadow-2xl border z-50 overflow-hidden">

          <div className="bg-[#FF7A3D] text-white p-4">
            <h3 className="font-semibold text-lg">FeelAtHomeNow Chat</h3>
            <p className="text-sm opacity-90">Wie können wir dir helfen?</p>
          </div>

          <div className="p-4 space-y-3">

            {step === "menu" && (
              <>
                <button
                  onClick={() => updateLeadData("type","Apartment","city")}
                  className="w-full text-left p-3 rounded-xl border"
                >
                  Apartment finden
                </button>

                <button
                  onClick={() => updateLeadData("type","Co-Living","city")}
                  className="w-full text-left p-3 rounded-xl border"
                >
                  Co-Living finden
                </button>

                <button
                  onClick={() => updateLeadData("type","Unternehmen","city")}
                  className="w-full text-left p-3 rounded-xl border"
                >
                  Für Unternehmen
                </button>

                <a
                  href="/contact"
                  className="block w-full text-left p-3 rounded-xl border"
                >
                  Frage stellen
                </a>
              </>
            )}

            {step === "city" && (
              <>
                <p>In welcher Stadt suchst du?</p>

                <button onClick={() => updateLeadData("city","Zürich","moveIn")} className="w-full text-left p-3 border rounded-xl">Zürich</button>

                <button onClick={() => updateLeadData("city","Basel","moveIn")} className="w-full text-left p-3 border rounded-xl">Basel</button>

                <button onClick={() => updateLeadData("city","Bern","moveIn")} className="w-full text-left p-3 border rounded-xl">Bern</button>

                <button onClick={() => updateLeadData("city","Andere","moveIn")} className="w-full text-left p-3 border rounded-xl">Andere</button>
              </>
            )}

            {step === "moveIn" && (
              <>
                <p>Ab wann suchst du?</p>

                <button onClick={() => updateLeadData("moveIn","Sofort","duration")} className="w-full text-left p-3 border rounded-xl">Sofort</button>

                <button onClick={() => updateLeadData("moveIn","Diesen Monat","duration")} className="w-full text-left p-3 border rounded-xl">Diesen Monat</button>

                <button onClick={() => updateLeadData("moveIn","Nächsten Monat","duration")} className="w-full text-left p-3 border rounded-xl">Nächsten Monat</button>
              </>
            )}

            {step === "duration" && (
              <>
                <p>Wie lange möchtest du bleiben?</p>

                <button onClick={() => updateLeadData("duration","1-2 Monate","budget")} className="w-full text-left p-3 border rounded-xl">1-2 Monate</button>

                <button onClick={() => updateLeadData("duration","3-6 Monate","budget")} className="w-full text-left p-3 border rounded-xl">3-6 Monate</button>

                <button onClick={() => updateLeadData("duration","6-12 Monate","budget")} className="w-full text-left p-3 border rounded-xl">6-12 Monate</button>
              </>
            )}

            {step === "budget" && (
              <>
                <p>Wie hoch ist dein Budget?</p>

                <button onClick={() => updateLeadData("budget","unter 1500","name")} className="w-full text-left p-3 border rounded-xl">unter 1500</button>

                <button onClick={() => updateLeadData("budget","1500-2500","name")} className="w-full text-left p-3 border rounded-xl">1500-2500</button>

                <button onClick={() => updateLeadData("budget","2500+","name")} className="w-full text-left p-3 border rounded-xl">2500+</button>
              </>
            )}

{step === "name" && (
  <>
    <p>Wie heisst du?</p>

    <input
      type="text"
      placeholder="Dein Name"
      value={leadData.name}
      onChange={(e) =>
        setLeadData((prev) => ({ ...prev, name: e.target.value }))
      }
      className="w-full border rounded-xl p-3"
    />

    <button
      onClick={() => {
        if (leadData.name.trim() !== "") setStep("phone");
      }}
      className="w-full text-center p-3 rounded-xl bg-[#FF7A3D] text-white"
    >
      Weiter
    </button>
  </>
)}

{step === "phone" && (
  <>
    <p>Deine Telefonnummer?</p>

    <input
      type="tel"
      placeholder="+41..."
      value={leadData.phone}
      onChange={(e) =>
        setLeadData((prev) => ({ ...prev, phone: e.target.value }))
      }
      className="w-full border rounded-xl p-3"
    />
    {phoneError && (
      <p className="text-red-500 text-sm mt-2">
        Bitte eine gültige Telefonnummer eingeben
      </p>
    )}

    <button
  onClick={() => {
    const cleanPhone = leadData.phone.replace(/\s+/g, "").replace(/[^+\d]/g, "");
  if (cleanPhone.length >= 8) {
    setPhoneError(false);
    setStep("email");
  } else {
    setPhoneError(true);
  }
  }}
      className="w-full text-center p-3 rounded-xl bg-[#FF7A3D] text-white"
    >
      Weiter
    </button>
  </>
)}

{step === "email" && (
  <>
    <p>E-Mail (optional)</p>

    <input
      type="email"
      placeholder="name@email.com"
      value={leadData.email}
      onChange={(e) =>
        setLeadData((prev) => ({ ...prev, email: e.target.value }))
      }
      className="w-full border rounded-xl p-3"
    />

    <button
      onClick={() => setStep("result")}
      className="w-full text-center p-3 rounded-xl bg-[#FF7A3D] text-white"
    >
      Weiter
    </button>
  </>
)}

            {step === "result" && (
              <>
                <p>Danke. Anfrage vorbereitet.</p>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center p-3 rounded-xl bg-green-500 text-white"
                >
                  WhatsApp öffnen
                </a>

                <a
                  href="/contact"
                  className="block w-full text-center p-3 border rounded-xl"
                >
                  Formular öffnen
                </a>

                <button
                  onClick={resetChat}
                  className="w-full p-3 text-sm"
                >
                  Neu starten
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
