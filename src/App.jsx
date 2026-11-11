import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import AdminPage from "./AdminPage.jsx";

function BotanicalSprig({ className = "", src = "/florals/botanical-arrangement.png?v=3" }) {
  return (
    <div className={`botanical-sprig ${className}`} aria-hidden="true">
      <img src={src} alt="" />
    </div>
  );
}

function LeafSprig({ className = "" }) {
  return (
    <svg className={`leaf-sprig ${className}`} viewBox="0 0 220 280" aria-hidden="true">
      <path d="M18 264C70 211 109 143 177 22M40 228c-25-4-39-23-32-47 24 1 40 17 32 47Zm28-39c-23-9-31-31-19-51 23 6 34 25 19 51Zm28-44c-19-14-20-37-3-53 20 11 25 32 3 53Zm27-43c-14-17-9-39 11-50 16 15 15 35-11 50Zm-57 99c-1-25 15-41 39-39 4 24-10 41-39 39Zm29-46c3-24 22-37 45-29 0 24-17 39-45 29Zm27-47c8-22 29-30 49-17-5 23-25 34-49 17Z" fill="currentColor" fillOpacity=".38" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 264C70 211 109 143 177 22" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EventIcon({ type }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /><path d="M12 8a2 2 0 1 0 4 0c0-1.1-.9-2-2-2s-2 .9-2 2Zm2 2 2 2" /></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M12 8v13M2 12h20M12 8H7.5a2.5 2.5 0 1 1 2.5-2.5V8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5V8Z" /></>,
  };
  return <svg className="event-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

function MapChooser() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <div className="map-chooser">
      <button
        ref={triggerRef}
        className="map-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        ELEGIR APP DE MAPAS
      </button>
      {isOpen && createPortal(
        <div className="map-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
          <section className="map-modal" role="dialog" aria-modal="true" aria-labelledby="map-modal-title">
            <button ref={closeButtonRef} className="map-modal-close" type="button" aria-label="Cerrar opciones de mapa" onClick={() => setIsOpen(false)}>×</button>
            <p className="small-title">CÓMO LLEGAR</p>
            <h2 id="map-modal-title">Elegí tu app de mapas</h2>
            <p className="map-modal-location">La Zoraida Eventos · Tafí Viejo</p>
            <div className="map-modal-options">
              <a href="https://maps.app.goo.gl/Va5xpdAXktsaQyV78" target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>Google Maps</a>
              <a href="https://maps.apple.com/?q=La%20Zoraida%20Eventos&ll=-26.7228137,-65.2693801" target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>Apple Maps</a>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function navigateToSection(event, sectionId) {
  event.preventDefault();
  const section = document.getElementById(sectionId);
  if (!section) return;

  window.history.replaceState(null, "", `#${sectionId}`);
  section.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

function App() {
  const weddingDate = new Date("2027-04-17T20:00:00");
  const [showRsvpPage, setShowRsvpPage] = useState(() => window.location.pathname === "/confirmar");
  const [showAdminPage, setShowAdminPage] = useState(() => window.location.pathname === "/admin");

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);
  const [visibleSections, setVisibleSections] = useState({});
  const [easterEggDismissed, setEasterEggDismissed] = useState(false);
  const [attendance, setAttendance] = useState("");
  const [hasCompanion, setHasCompanion] = useState("no");
  const [hasSecondCompanion, setHasSecondCompanion] = useState("no");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname;
      setShowRsvpPage(path === "/confirmar");
      setShowAdminPage(path === "/admin");
      if (path === "/" && window.location.hash) {
        const sectionId = window.location.hash.slice(1);
        window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ block: "start" }), 0);
      }
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const difference = weddingDate - new Date();

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        });

        return;
      }
      

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference / (1000 * 60 * 60)) % 24
        ),
        minutes: Math.floor(
          (difference / (1000 * 60)) % 60
        ),
        seconds: Math.floor(
          (difference / 1000) % 60
        ),
      });
    };

    updateCountdown();

    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
  const sections = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleSections((previous) => ({
            ...previous,
            [entry.target.id]: true,
          }));

          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
    }
  );

  sections.forEach((section) => {
    observer.observe(section);
  });

  return () => observer.disconnect();
}, []);

  const copyAlias = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText("BODA.LC");
      } else {
        const temporaryField = document.createElement("textarea");
        temporaryField.value = "BODA.LC";
        temporaryField.style.position = "fixed";
        temporaryField.style.opacity = "0";
        document.body.appendChild(temporaryField);
        temporaryField.select();
        const didCopy = document.execCommand("copy");
        temporaryField.remove();
        if (!didCopy) throw new Error("Clipboard unavailable");
      }
      setCopied(true);
      setCopyStatus({ type: "success", message: "¡Alias copiado con éxito!" });
    } catch {
      setCopied(false);
      setCopyStatus({ type: "error", message: "No se pudo copiar el alias. Mantené presionado para copiarlo." });
    }

    window.setTimeout(() => {
      setCopied(false);
      setCopyStatus(null);
    }, 3000);
  };

  const openRsvpPage = (event) => {
    event.preventDefault();
    window.history.pushState(null, "", "/confirmar");
    setShowRsvpPage(true);
    window.scrollTo(0, 0);
  };

  const returnToInvitation = (event) => {
    event.preventDefault();
    window.history.pushState(null, "", "/#inicio");
    setShowRsvpPage(false);
    setShowAdminPage(false);
    window.setTimeout(() => document.getElementById("inicio")?.scrollIntoView({ block: "start" }), 0);
  };

  const submitRsvp = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const attending = formData.get("attendance") === "yes";
    const companions = [];

    if (attending && hasCompanion === "yes") {
      companions.push({
        firstName: formData.get("companionName"),
        lastName: formData.get("companionSurname"),
        dietaryNotes: formData.get("companionComment"),
      });
    }
    if (attending && hasCompanion === "yes" && hasSecondCompanion === "yes") {
      companions.push({
        firstName: formData.get("secondCompanionName"),
        lastName: formData.get("secondCompanionSurname"),
        dietaryNotes: formData.get("secondCompanionComment"),
      });
    }

    setIsSubmitting(true);
    setSubmissionStatus({ type: "", message: "" });
    try {
      const response = await fetch("/api/rsvps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest: {
            firstName: formData.get("guestName"),
            lastName: formData.get("guestSurname"),
            attending,
            dietaryNotes: attending ? formData.get("guestDietaryComment") : "",
          },
          companions,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la confirmación.");

      form.reset();
      setAttendance("");
      setHasCompanion("no");
      setHasSecondCompanion("no");
      setSubmissionStatus({ type: "success", message: "¡Gracias! Tu confirmación quedó registrada." });
    } catch (error) {
      setSubmissionStatus({ type: "error", message: "No se pudo enviar el formulario." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rsvpForm = (
    <form className="rsvp-form" onSubmit={submitRsvp}>
      <div className="rsvp-field">
        <label htmlFor="guest-name">Tu nombre</label>
        <input id="guest-name" name="guestName" type="text" autoComplete="given-name" placeholder="Nombre" required />
      </div>

      <div className="rsvp-field">
        <label htmlFor="guest-surname">Tu apellido</label>
        <input id="guest-surname" name="guestSurname" type="text" autoComplete="family-name" placeholder="Apellido" required />
      </div>

      <fieldset className="rsvp-attendance">
        <legend>¿Vas a poder acompañarnos?</legend>
        <label>
          <input type="radio" name="attendance" value="yes" checked={attendance === "yes"} onChange={() => setAttendance("yes")} required />
          Sí, ahí estaré
        </label>
        <label>
          <input type="radio" name="attendance" value="no" checked={attendance === "no"} onChange={() => { setAttendance("no"); setHasCompanion("no"); setHasSecondCompanion("no"); }} />
          No voy a poder
        </label>
      </fieldset>

      {attendance === "yes" && (
        <>
          <div className="rsvp-field dietary-comment">
            <label htmlFor="guest-dietary-comment">¿Tenés alguna alergia o necesidad alimentaria? <span>(opcional)</span></label>
            <textarea id="guest-dietary-comment" name="guestDietaryComment" rows="3" placeholder="Contanos si hay algo que debamos tener en cuenta para la comida" />
          </div>

          <div className="rsvp-field">
            <label htmlFor="has-companion">¿Vas a llevar acompañante?</label>
            <select id="has-companion" name="hasCompanion" value={hasCompanion} onChange={(event) => { setHasCompanion(event.target.value); if (event.target.value === "no") setHasSecondCompanion("no"); }}>
              <option value="no">No</option>
              <option value="yes">Sí</option>
            </select>
          </div>

          {hasCompanion === "yes" && (
            <div className="companion-fields">
              <div className="rsvp-field">
                <label htmlFor="companion-name">Nombre del acompañante</label>
                <input id="companion-name" name="companionName" type="text" autoComplete="off" placeholder="Nombre" required />
              </div>
              <div className="rsvp-field">
                <label htmlFor="companion-surname">Apellido del acompañante</label>
                <input id="companion-surname" name="companionSurname" type="text" autoComplete="off" placeholder="Apellido" required />
              </div>
              <div className="rsvp-field companion-comment">
                <label htmlFor="companion-comment">¿Tu acompañante tiene alguna alergia o necesidad alimentaria? <span>(opcional)</span></label>
                <textarea id="companion-comment" name="companionComment" rows="3" placeholder="Contanos si hay algo que debamos tener en cuenta para su comida" />
              </div>

            </div>
          )}

          {hasCompanion === "yes" && (
            <div className="rsvp-field add-second-companion">
              <label htmlFor="has-second-companion">¿Querés agregar otro acompañante?</label>
              <select id="has-second-companion" name="hasSecondCompanion" value={hasSecondCompanion} onChange={(event) => setHasSecondCompanion(event.target.value)}>
                <option value="no">No</option>
                <option value="yes">Sí</option>
              </select>
            </div>
          )}

          {hasCompanion === "yes" && hasSecondCompanion === "yes" && (
            <div className="companion-fields second-companion-fields">
              <div className="rsvp-field">
                <label htmlFor="second-companion-name">Nombre del segundo acompañante</label>
                <input id="second-companion-name" name="secondCompanionName" type="text" autoComplete="off" placeholder="Nombre" required />
              </div>
              <div className="rsvp-field">
                <label htmlFor="second-companion-surname">Apellido del segundo acompañante</label>
                <input id="second-companion-surname" name="secondCompanionSurname" type="text" autoComplete="off" placeholder="Apellido" required />
              </div>
              <div className="rsvp-field companion-comment">
                <label htmlFor="second-companion-comment">¿El segundo acompañante tiene alguna alergia o necesidad alimentaria? <span>(opcional)</span></label>
                <textarea id="second-companion-comment" name="secondCompanionComment" rows="3" placeholder="Contanos si hay algo que debamos tener en cuenta para su comida" />
              </div>
            </div>
          )}
        </>
      )}

      <button className="confirmation-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "ENVIANDO…" : "CONFIRMAR ASISTENCIA"}
      </button>
      {submissionStatus.type === "error" && (
        <div className="rsvp-feedback error" role="alert" aria-live="assertive">
          <h2>No se pudo enviar</h2>
          <p>{submissionStatus.message} Intentá de nuevo en unos minutos.</p>
          <button className="confirmation-button" type="button" onClick={() => setSubmissionStatus({ type: "", message: "" })}>
            REINTENTAR
          </button>
        </div>
      )}
    </form>
  );

  if (showAdminPage) return <AdminPage onReturn={returnToInvitation} />;

  if (showRsvpPage) {
    return (
      <main className="rsvp-page">
        <div className="rsvp-page-content">
          {submissionStatus.type === "success" ? (
            <section className="rsvp-feedback success" role="status" aria-live="polite">
              <p className="small-title">LUCAS &amp; COTY · 17.04.2027</p>
              <h1>¡Gracias!</h1>
              <p>Tu confirmación quedó registrada.</p>
              <a className="confirmation-button rsvp-return-button" href="/#inicio" onClick={returnToInvitation}>
                VOLVER A LA INVITACIÓN PRINCIPAL
              </a>
            </section>
          ) : (
            <>
              <a className="rsvp-back" href="/#inicio" onClick={returnToInvitation} aria-label="Volver a la invitación">← Volver a la invitación</a>
              <p className="small-title">LUCAS &amp; COTY · 17.04.2027</p>
              <h1>Confirmar asistencia</h1>
              {rsvpForm}
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
    <main className="invitation">

      {/* PORTADA */}

      <section className="hero" id="inicio">
          <BotanicalSprig className="sprig-left hero-floral hero-upper-left-floral" src="/florals/upper-left-featured-sprig.png?v=2" />
          <BotanicalSprig className="sprig-right hero-floral hero-lower-right-floral" src="/florals/lower-right-fewer-leaves.png" />

        <nav className="site-nav" aria-label="Navegación principal">
          <a href="#inicio" aria-current="page" onClick={(event) => navigateToSection(event, "inicio")}>INICIO</a>
          <a href="#detalles" onClick={(event) => navigateToSection(event, "detalles")}>DETALLES</a>
          <a href="#tarjeta" onClick={(event) => navigateToSection(event, "tarjeta")}>TARJETA</a>
          <a href="#confirmacion" onClick={(event) => navigateToSection(event, "confirmacion")}>CONFIRMACIÓN</a>
        </nav>

        <div className="hero-content">
          <p className="subtitle">¡NOS CASAMOS!</p>

            <div className="couple-mark" aria-label="Lucas y Coty, 17 de abril de 2027">
              <h1 className="couple-monogram"><span>L</span><i aria-hidden="true"></i><span>C</span></h1>
              <p className="couple-names"><span>LUCAS</span><span className="couple-amp">&amp;</span><span>COTY</span></p>
              <p className="couple-date">17.04.27</p>
            </div>

          <p className="message">Tenemos el placer de invitarte a compartir uno de los días más importantes de nuestras vidas.</p>
          <a className="discover-button" href="#detalles" onClick={(event) => navigateToSection(event, "detalles")} aria-label="Ir a Una nueva historia comienza">
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* BIENVENIDA */}

      <section
  className={`welcome reveal ${
    visibleSections.detalles ? "visible" : ""
  }`}
  id="detalles"
>
        <span className="section-kicker" id="nos-casamos">17 · 04 · 2027</span>
        <p className="small-title">NUESTRO GRAN DÍA</p>

        <h2>Una nueva historia comienza</h2>

        <p>
          Hay momentos que se vuelven aún más especiales cuando se
          comparten con las personas que queremos.
        </p>

        <div className="event-card">
          <div className="event-item event-item-one">
            <EventIcon type="calendar" />
            <h3>Fecha</h3>
            <p>17 de abril de 2027</p>
          </div>

          <div className="event-item event-item-two">
            <EventIcon type="pin" />
            <h3>Lugar</h3>
            <p>La Zoraida Eventos</p>
            <small>Pasaje Güemes y Cochabamba<br />Tafí Viejo, Tucumán</small>
          </div>

          <div className="event-item event-item-three">
            <EventIcon type="map" />
            <h3>Cómo llegar</h3>
            <p>Elegí tu app de mapas</p>
            <MapChooser />
          </div>

        </div>

        <section className="countdown-section" aria-label="Cuenta regresiva">
          <BotanicalSprig className="countdown-sprig countdown-sprig-left" src="/florals/countdown-right-arrangement.png" />
          <BotanicalSprig className="countdown-sprig countdown-sprig-right" src="/florals/countdown-right-arrangement.png" />
          <p className="small-title">FALTA POCO...</p>
          <div className="countdown">
            <div><strong>{timeLeft.days}</strong><span>DÍAS</span></div>
            <div><strong>{String(timeLeft.hours).padStart(2, "0")}</strong><span>HORAS</span></div>
            <div><strong>{String(timeLeft.minutes).padStart(2, "0")}</strong><span>MINUTOS</span></div>
            <div><strong>{String(timeLeft.seconds).padStart(2, "0")}</strong><span>SEGUNDOS</span></div>
          </div>
          <p className="countdown-note">La cuenta regresiva ya empezó</p>
          <div className="ornament-divider"><span></span><b>♥</b><span></span></div>
        </section>

        <a className="section-jump" href="#tarjeta" onClick={(event) => navigateToSection(event, "tarjeta")} aria-label="Ir a Nos encantaría compartir este día con vos">
          <b aria-hidden="true">↓</b>
        </a>
      </section>

      {/* INFORMACIÓN DE LA TARJETA */}

      <section
  className={`card-information reveal ${
    visibleSections.tarjeta ? "visible" : ""
  }`}
  id="tarjeta"
>
        <p className="small-title">
          INFORMACIÓN DE LA TARJETA
        </p>

        <h2>Nos encantaría compartir este día con vos</h2>

        <p className="card-text">
          Tu presencia es el regalo más importante para nosotros.
        </p>

        <p className="card-text">
          Para acompañarnos en este día tan especial,
          el valor de la tarjeta es de:
        </p>

        <p className="ticket-price" aria-label="70.000 pesos por persona">
          <span className="peso-sign" aria-hidden="true">S<i /></span>70.000
          <span>por persona</span>
        </p>

        <div className="alias-box">
          <span>ALIAS</span>

          <strong>BODA.LC</strong>
          <p className="alias-owner">Cuenta a nombre de Lucas Gonzalo D’Mayo · Naranja X</p>

          <button type="button" onClick={copyAlias}>
            {copied ? "✓ ALIAS COPIADO" : "COPIAR ALIAS"}
          </button>
        </div>
        {copyStatus && createPortal(
          <div className={`copy-toast ${copyStatus.type}`} role="status" aria-live="polite">
            {copyStatus.message}
          </div>,
          document.body,
        )}

        <a className="section-jump" href="#confirmacion" onClick={(event) => navigateToSection(event, "confirmacion")} aria-label="Ir a ¿Nos acompañás?">
          <b aria-hidden="true">↓</b>
        </a>
      </section>

      {/* CONFIRMACIÓN */}

      <section
  className={`confirmation-section reveal ${
    visibleSections.confirmacion ? "visible" : ""
  }`}
  id="confirmacion"
>
        <BotanicalSprig className="confirmation-floral" src="/florals/countdown-right-arrangement.png" />
        <BotanicalSprig className="confirmation-floral confirmation-floral-upper-left" src="/florals/upper-left-featured-sprig.png?v=2" />
        <p className="small-title">
          CONFIRMACIÓN DE ASISTENCIA
        </p>

        <h2>¿Nos acompañás?</h2>

        <p>
          Nos ayudaría mucho que confirmes tu asistencia
          para poder organizar este día tan especial.
        </p>

        <a className="confirmation-button rsvp-open-button" href="/confirmar" onClick={openRsvpPage}>CONFIRMAR ASISTENCIA</a>
        <div className="confirmation-signoff">
          <h2>¡Te esperamos!</h2>
          <div className="couple-mark confirmation-logo" aria-label="Lucas y Coty, 17 de abril de 2027">
            <h1 className="couple-monogram"><span>L</span><i aria-hidden="true"></i><span>C</span></h1>
            <p className="couple-names"><span>LUCAS</span><span className="couple-amp">&amp;</span><span>COTY</span></p>
            <p className="couple-date">17.04.27</p>
          </div>
        </div>
        {!easterEggDismissed && (
          <aside className="easter-popup" role="status" aria-live="polite">
            <span>tocame papi</span>
            <button type="button" aria-label="Cerrar easter egg" onClick={() => setEasterEggDismissed(true)}>×</button>
          </aside>
        )}
      </section>

    </main>
    </>
  );
}

export default App;
