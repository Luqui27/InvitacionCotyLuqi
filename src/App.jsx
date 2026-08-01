import { useEffect, useState } from "react";
import "./App.css";

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
    <main className="invitation">

      {/* PORTADA */}

      <section className="hero">
        <div className="hero-overlay"></div>

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

          <p className="message">
            Tenemos el placer de invitarte a compartir
            uno de los días más importantes de nuestras vidas.
          </p>

          <button
  className="discover-button"
  onClick={() => {
    document
      .getElementById("detalles")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }}
>
  DESCUBRÍ NUESTRA HISTORIA
  <span>↓</span>
</button>
        </div>
      </section>

      {/* BIENVENIDA */}

      <section
  className={`welcome reveal ${
    visibleSections.detalles ? "visible" : ""
  }`}
  id="detalles"
>
        <p className="small-title">NUESTRO GRAN DÍA</p>

        <h2>Una nueva historia comienza</h2>

        <p>
          Hay momentos que se vuelven aún más especiales cuando se
          comparten con las personas que queremos.
        </p>

        <div className="event-card">
          <div className="event-item event-item-one">
  <span>📅</span>

  <h3>Fecha</h3>

  <p>17 de abril de 2027</p>

  <div className="mini-countdown">
    <div>
      <strong>{timeLeft.days}</strong>
      <span>días</span>
    </div>

    <div>
      <strong>
        {String(timeLeft.hours).padStart(2, "0")}
      </strong>
      <span>hs</span>
    </div>

    <div>
      <strong>
        {String(timeLeft.minutes).padStart(2, "0")}
      </strong>
      <span>min</span>
    </div>

    <div>
      <strong>
        {String(timeLeft.seconds).padStart(2, "0")}
      </strong>
      <span>seg</span>
    </div>
  </div>
</div>

          <div className="event-item event-item-two">
  <span>📍</span>

            <h3>Lugar</h3>

            <p>La Zoraida Eventos</p>

            <small>
              Pasaje Güemes y Cochabamba, Tafí Viejo
            </small>

            <a
              href="https://maps.app.goo.gl/Va5xpdAXktsaQyV78"
              target="_blank"
              rel="noreferrer"
              className="map-button"
            >
              CÓMO LLEGAR
            </a>
          </div>
        </div>
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
        <h2>¡Te esperamos!</h2>

        <p>
          Lucas & Coty ♡
        </p>

        <span>17 · 04 · 2027</span>
      </footer>

    </main>
  );
}

export default App;