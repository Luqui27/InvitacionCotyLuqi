import { useEffect, useState } from "react";
import "./App.css";

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

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [copied, setCopied] = useState(false);
  const [visibleSections, setVisibleSections] = useState({});
  const [easterEggDismissed, setEasterEggDismissed] = useState(false);

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
    await navigator.clipboard.writeText("bodaluqi.coty");

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  return (
    <>
    <main className="invitation">

      {/* PORTADA */}

      <section className="hero" id="inicio">
        <LeafSprig className="sprig-left" />
        <LeafSprig className="sprig-right" />

        <nav className="site-nav" aria-label="Navegación principal">
          <a href="#inicio" aria-current="page" onClick={(event) => navigateToSection(event, "inicio")}>INICIO</a>
          <a href="#detalles" onClick={(event) => navigateToSection(event, "detalles")}>DETALLES</a>
          <a href="#tarjeta" onClick={(event) => navigateToSection(event, "tarjeta")}>TARJETA</a>
          <a href="#confirmacion" onClick={(event) => navigateToSection(event, "confirmacion")}>CONFIRMACIÓN</a>
        </nav>

        <div className="hero-content">
          <p className="subtitle">¡NOS CASAMOS!</p>

          <h1>
            Lucas <span>&</span> Coty
          </h1>

          <div className="divider">
            <span></span>
            <span className="heart">♥</span>
            <span></span>
          </div>

          <p className="date">17 · 04 · 2027</p>

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
            <a href="https://maps.app.goo.gl/Va5xpdAXktsaQyV78" target="_blank" rel="noreferrer" className="map-button">VER UBICACIÓN</a>
          </div>

          <div className="event-item event-item-four">
            <EventIcon type="gift" />
            <h3>Confirmar asistencia</h3>
            <p>¡Nos encantaría<br />que seas parte!</p>
            <a href="#confirmacion" onClick={(event) => navigateToSection(event, "confirmacion")} className="map-button">CONFIRMAR</a>
          </div>
        </div>

        <section className="countdown-section" aria-label="Cuenta regresiva">
          <LeafSprig className="countdown-sprig countdown-sprig-left" />
          <LeafSprig className="countdown-sprig countdown-sprig-right" />
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

        <p className="ticket-price">
          $70.000
          <span>por persona</span>
        </p>

        <div className="alias-box">
          <span>ALIAS</span>

          <strong>bodaluqi.coty</strong>

          <button onClick={copyAlias}>
            {copied ? "✓ ALIAS COPIADO" : "COPIAR ALIAS"}
          </button>
        </div>

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
        <p className="small-title">
          CONFIRMACIÓN DE ASISTENCIA
        </p>

        <h2>¿Nos acompañás?</h2>

        <p>
          Nos ayudaría mucho que confirmes tu asistencia
          para poder organizar este día tan especial.
        </p>

        <button className="confirmation-button">
          CONFIRMAR ASISTENCIA
        </button>
      </section>

      {/* CIERRE */}

      <footer>
        <LeafSprig className="footer-sprig footer-sprig-left" />
        <LeafSprig className="footer-sprig footer-sprig-right" />
        <h2>¡Te esperamos!</h2>

        <p>
          Lucas & Coty ♡
        </p>

        <span>17 · 04 · 2027</span>
        {!easterEggDismissed && (
          <aside className="easter-popup" role="status" aria-live="polite">
            <span>tocame papi</span>
            <button type="button" aria-label="Cerrar easter egg" onClick={() => setEasterEggDismissed(true)}>×</button>
          </aside>
        )}
      </footer>

    </main>
    </>
  );
}

export default App;
