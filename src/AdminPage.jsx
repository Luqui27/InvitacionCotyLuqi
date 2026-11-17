import { useCallback, useEffect, useMemo, useState } from "react";
import { TICKET_PRICE_ARS } from "./event-config.js";

const blankCompanion = () => ({ firstName: "", lastName: "", ticketChargeable: true, dietaryNotes: "" });
const money = (amount) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
const chargeableTicketCount = (rsvp) => Number(rsvp.guest.ticketChargeable !== false)
  + rsvp.companions.filter((companion) => companion.ticketChargeable !== false).length;
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function PaymentPanel({ rsvp, onAdd, onDelete }) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(localToday);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const tickets = chargeableTicketCount(rsvp);
  const total = tickets * TICKET_PRICE_ARS;
  const received = rsvp.payments.reduce((sum, payment) => sum + payment.amountArs, 0);
  const overpayment = Math.max(0, received - total);
  const balance = Math.max(0, total - received);
  const status = tickets === 0 ? "free" : received >= total ? "paid" : received > 0 ? "partial" : "pending";

  const submit = async (event) => {
    event.preventDefault();
    const details = event.currentTarget.closest("details");
    setSaving(true);
    setError("");
    try {
      await onAdd(rsvp.id, { amountArs: Number(amount), paidAt, note });
      setAmount("");
      setNote("");
      setPaidAt(localToday());
      details?.removeAttribute("open");
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar el pago.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-payments" aria-label={`Pagos de ${rsvp.guest.firstName} ${rsvp.guest.lastName}`}>
      <div className="admin-payments-heading">
        <h3>Pagos de tarjeta</h3>
        <span className={`admin-payment-status ${status}`}>
          {status === "free" ? "Sin cargo" : status === "paid" ? "Pagada" : status === "partial" ? "Pago parcial" : "Pendiente"}
        </span>
      </div>
      <div className="admin-payment-totals">
        <div><span>Total · {tickets} {tickets === 1 ? "entrada" : "entradas"}</span><strong>{money(total)}</strong></div>
        <div><span>Recibido</span><strong>{money(received)}</strong></div>
        <div><span>{overpayment ? "A favor" : "Saldo"}</span><strong>{money(overpayment || balance)}</strong></div>
      </div>

      {rsvp.payments.length > 0 ? (
        <ul className="admin-payment-history">
          {rsvp.payments.map((payment) => (
            <li key={payment.id}>
              <div>
                <strong>{money(payment.amountArs)}</strong>
                <span>{new Date(`${payment.paidAt}T12:00:00`).toLocaleDateString("es-AR", { dateStyle: "medium" })}{payment.note ? ` · ${payment.note}` : ""}</span>
              </div>
              <button className="admin-payment-delete" type="button" onClick={() => onDelete(rsvp, payment)}>Quitar</button>
            </li>
          ))}
        </ul>
      ) : <p className="admin-payment-empty">{tickets === 0 ? "Esta tarjeta está marcada sin cargo." : "Todavía no hay pagos registrados."}</p>}

      {tickets > 0 && (
        <details className="admin-payment-add">
          <summary>+ Registrar un pago</summary>
          <form onSubmit={submit}>
            <label>Monto recibido (ARS)
              <input type="number" min="1" max="100000000" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej.: 35000" />
            </label>
            <label>Fecha del pago
              <input type="date" required max={localToday()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
            </label>
            <label className="admin-payment-note">Nota opcional
              <input type="text" maxLength="500" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej.: transferencia o segunda cuota" />
            </label>
            {error && <p className="admin-error admin-payment-error" role="alert">{error}</p>}
            <button className="admin-save-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar pago"}</button>
          </form>
        </details>
      )}
    </section>
  );
}

function AdminPage({ onReturn }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dietaryFilter, setDietaryFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadRsvps = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/rsvps", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el listado.");
      setRsvps(data.rsvps);
    } catch {
      setLoadError("No se pudo cargar el listado de invitados. Intentá actualizar la página.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data) => { if (active) setAuthenticated(Boolean(data.authenticated)); })
      .catch(() => { if (active) setLoginError("No se pudo verificar el acceso. Intentá actualizar la página."); })
      .finally(() => { if (active) setCheckingAuth(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authenticated) loadRsvps();
  }, [authenticated, loadRsvps]);

  const login = async (event) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      setPassword("");
      setAuthenticated(true);
    } catch (error) {
      setLoginError(error.message || "No se pudo iniciar sesión.");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Hide the private list locally even if the logout request cannot reach the server.
    } finally {
      setAuthenticated(false);
      setRsvps([]);
      setEditing(null);
    }
  };

  const summary = useMemo(() => {
    const attendees = rsvps.reduce((total, rsvp) => total + (rsvp.guest.attending ? 1 + rsvp.companions.length : 0), 0);
    const chargeableAttendees = rsvps.reduce((total, rsvp) => total + (rsvp.guest.attending
      ? Number(rsvp.guest.ticketChargeable !== false) + rsvp.companions.filter((companion) => companion.ticketChargeable !== false).length
      : 0), 0);
    const received = rsvps.reduce((total, rsvp) => total + (rsvp.payments ?? []).reduce((sum, payment) => sum + payment.amountArs, 0), 0);
    const expected = chargeableAttendees * TICKET_PRICE_ARS;
    return {
      total: rsvps.length,
      attending: rsvps.filter((rsvp) => rsvp.guest.attending).length,
      declined: rsvps.filter((rsvp) => !rsvp.guest.attending).length,
      companions: rsvps.reduce((total, rsvp) => total + rsvp.companions.length, 0),
      attendees,
      chargeableAttendees,
      received,
      expected,
      balance: Math.max(0, expected - received),
      overpayment: Math.max(0, received - expected),
    };
  }, [rsvps]);

  const visibleRsvps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return rsvps.filter((rsvp) => {
      const matchesFilter = filter === "all"
        || (filter === "attending" && rsvp.guest.attending)
        || (filter === "declined" && !rsvp.guest.attending);
      const people = [rsvp.guest, ...rsvp.companions];
      const matchesQuery = !normalizedQuery || people.some((person) =>
        `${person.firstName} ${person.lastName} ${person.dietaryNotes}`.toLocaleLowerCase("es").includes(normalizedQuery),
      );
      const tickets = rsvp.guest.attending ? chargeableTicketCount(rsvp) : 0;
      const amountDue = tickets * TICKET_PRICE_ARS;
      const amountReceived = (rsvp.payments ?? []).reduce((total, payment) => total + payment.amountArs, 0);
      const hasNoChargePerson = rsvp.guest.ticketChargeable === false || rsvp.companions.some((person) => person.ticketChargeable === false);
      const matchesPayment = paymentFilter === "all"
        || (paymentFilter === "free" && hasNoChargePerson)
        || (paymentFilter === "balance" && amountDue > amountReceived)
        || (paymentFilter === "paid" && amountDue > 0 && amountReceived >= amountDue);
      const hasDietaryNotes = people.some((person) => person.dietaryNotes?.trim());
      const matchesDietary = dietaryFilter === "all"
        || (dietaryFilter === "with-notes" && hasDietaryNotes)
        || (dietaryFilter === "without-notes" && !hasDietaryNotes);
      return matchesFilter && matchesQuery && matchesPayment && matchesDietary;
    });
  }, [dietaryFilter, filter, paymentFilter, query, rsvps]);

  const updateEditing = (field, value) => {
    setEditing((current) => ({ ...current, guest: { ...current.guest, [field]: value } }));
  };

  const updateCompanion = (index, field, value) => {
    setEditing((current) => ({
      ...current,
      companions: current.companions.map((companion, companionIndex) => (
        companionIndex === index ? { ...companion, [field]: value } : companion
      )),
    }));
  };

  const saveEditing = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const isNew = !editing.id;
      const response = await fetch(isNew ? "/api/admin/rsvps" : `/api/admin/rsvps/${encodeURIComponent(editing.id)}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest: editing.guest,
          companions: editing.guest.attending ? editing.companions : [],
        }),
      });
      const data = await response.json();
      if (response.status === 401) setAuthenticated(false);
      if (!response.ok) throw new Error(data.error || "No se pudieron guardar los cambios.");
      setEditing(null);
      setNotice(isNew ? "El invitado se agregó al listado." : "Los cambios se guardaron.");
      await loadRsvps();
    } catch (error) {
      setNotice(error.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRsvp = async (rsvp) => {
    const fullName = `${rsvp.guest.firstName} ${rsvp.guest.lastName}`;
    if (!window.confirm(`¿Eliminar la respuesta de ${fullName} y sus acompañantes?`)) return;
    setNotice("");
    try {
      const response = await fetch(`/api/admin/rsvps/${encodeURIComponent(rsvp.id)}`, { method: "DELETE", credentials: "same-origin" });
      const data = await response.json();
      if (response.status === 401) setAuthenticated(false);
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la respuesta.");
      setRsvps((current) => current.filter((item) => item.id !== rsvp.id));
      setNotice("La respuesta y sus acompañantes se eliminaron.");
    } catch (error) {
      setNotice(error.message || "No se pudo eliminar la respuesta.");
    }
  };

  const addPayment = async (rsvpId, payment) => {
    const response = await fetch(`/api/admin/rsvps/${encodeURIComponent(rsvpId)}/payments`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });
    const data = await response.json();
    if (response.status === 401) setAuthenticated(false);
    if (!response.ok) throw new Error(data.error || "No se pudo registrar el pago.");
    setNotice("El pago se registró correctamente.");
    await loadRsvps();
  };

  const removePayment = async (rsvp, payment) => {
    const formattedAmount = money(payment.amountArs);
    if (!window.confirm(`¿Quitar el pago de ${formattedAmount} de ${rsvp.guest.firstName} ${rsvp.guest.lastName}?`)) return;
    setNotice("");
    try {
      const response = await fetch(`/api/admin/rsvps/${encodeURIComponent(rsvp.id)}/payments/${encodeURIComponent(payment.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (response.status === 401) setAuthenticated(false);
      if (!response.ok) throw new Error(data.error || "No se pudo quitar el pago.");
      setNotice(`Se quitó el pago de ${formattedAmount}.`);
      await loadRsvps();
    } catch (error) {
      setNotice(error.message || "No se pudo quitar el pago.");
    }
  };

  const startEditing = (rsvp) => setEditing({
    ...rsvp,
    guest: { ticketChargeable: true, ...rsvp.guest },
    companions: rsvp.companions.map((companion) => ({ ticketChargeable: true, ...companion })),
    payments: rsvp.payments ?? [],
  });

  const startAdding = () => setEditing({
    id: null,
    guest: { firstName: "", lastName: "", attending: true, ticketChargeable: true, dietaryNotes: "" },
    companions: [],
    payments: [],
  });

  if (checkingAuth) {
    return <main className="admin-page"><div className="admin-login-card"><p className="small-title">LUCAS &amp; COTY · PANEL</p><p className="admin-empty">Verificando acceso…</p></div></main>;
  }

  if (!authenticated) {
    return (
      <main className="admin-page">
        <section className="admin-login-card">
          <p className="small-title">LUCAS &amp; COTY · ACCESO PRIVADO</p>
          <h1>Panel de invitados</h1>
          <p>Ingresá la contraseña para administrar respuestas y acompañantes.</p>
          <form className="admin-login-form" onSubmit={login}>
            <label htmlFor="admin-password">Contraseña</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {loginError && <p className="admin-error" role="alert">{loginError}</p>}
            <button className="admin-save-button" type="submit" disabled={loggingIn}>{loggingIn ? "Ingresando…" : "Ingresar"}</button>
          </form>
          <button className="admin-secondary-button" type="button" onClick={onReturn}>Volver a la invitación</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="small-title">LUCAS &amp; COTY · PANEL</p>
            <h1>Listado de invitados</h1>
            <p>Administrá respuestas y acompañantes.</p>
          </div>
          <div className="admin-header-actions">
            <button className="admin-secondary-button" type="button" onClick={onReturn}>Volver a la invitación</button>
            <button className="admin-secondary-button" type="button" onClick={logout}>Cerrar sesión</button>
          </div>
        </header>

        <section className="admin-summary" aria-label="Resumen de respuestas">
          <div><strong>{summary.total}</strong><span>Respuestas</span></div>
          <div><strong>{summary.attending}</strong><span>Asisten</span></div>
          <div><strong>{summary.declined}</strong><span>No asisten</span></div>
          <div><strong>{summary.companions}</strong><span>Acompañantes</span></div>
          <div><strong>{summary.attendees}</strong><span>Invitados + acompañantes</span></div>
        </section>

        <section className="admin-financial-summary" aria-label="Resumen de recaudación">
          <p className="small-title">RESUMEN DE RECAUDACIÓN</p>
          <div className="admin-financial-totals">
            <div><span>Total proyectado</span><strong>{money(summary.expected)}</strong></div>
            <div><span>Dinero recibido</span><strong>{money(summary.received)}</strong></div>
            <div className={summary.overpayment ? "surplus" : ""}>
              <span>{summary.overpayment ? "Saldo a favor" : "Falta cobrar"}</span>
              <strong>{money(summary.overpayment || summary.balance)}</strong>
            </div>
          </div>
          <p className="admin-financial-note">
            Calculado con {summary.chargeableAttendees} entradas a pagar de {summary.attendees} asistentes confirmados, a {money(TICKET_PRICE_ARS)} por persona.
          </p>
        </section>

        <section className="admin-list-section">
          <div className="admin-toolbar">
            <label className="admin-search">
              <span>Buscar invitado o acompañante</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, apellido o nota" />
            </label>
            <label className="admin-filter">
              <span>Asistencia</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">Todas</option>
                <option value="attending">Asisten</option>
                <option value="declined">No asisten</option>
              </select>
            </label>
            <label className="admin-filter">
              <span>Estado de pago</span>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="free">Alguno sin cargo</option>
                <option value="balance">Pago pendiente</option>
                <option value="paid">Pago completo</option>
              </select>
            </label>
            <label className="admin-filter">
              <span>Necesidad alimentaria</span>
              <select value={dietaryFilter} onChange={(event) => setDietaryFilter(event.target.value)}>
                <option value="all">Todas</option>
                <option value="with-notes">Con comentario</option>
                <option value="without-notes">Sin comentario</option>
              </select>
            </label>
            <button className="admin-save-button" type="button" onClick={startAdding}>+ Agregar invitado</button>
            <button className="admin-secondary-button" type="button" onClick={loadRsvps} disabled={loading}>
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          {notice && <p className="admin-notice" role="status">{notice}</p>}
          {loadError && <p className="admin-error" role="alert">{loadError}</p>}
          {loading ? <p className="admin-empty">Cargando respuestas…</p> : null}
          {!loading && !loadError && visibleRsvps.length === 0 && (
            <p className="admin-empty">{rsvps.length ? "No hay resultados con esos filtros." : "Todavía no hay respuestas guardadas."}</p>
          )}

          <div className="admin-rsvp-list">
            {visibleRsvps.map((rsvp) => (
              <article className="admin-rsvp-card" key={rsvp.id}>
                <div className="admin-rsvp-heading">
                  <div>
                    <h2>{rsvp.guest.firstName} {rsvp.guest.lastName}{rsvp.guest.ticketChargeable === false && <span className="admin-no-charge-badge">Sin cargo</span>}</h2>
                    <p>{new Date(rsvp.submittedAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <span className={`admin-attendance ${rsvp.guest.attending ? "yes" : "no"}`}>
                    {rsvp.guest.attending ? "Asiste" : "No asiste"}
                  </span>
                </div>

                {rsvp.guest.dietaryNotes && (
                  <p className="admin-dietary"><strong>Necesidad alimentaria:</strong> {rsvp.guest.dietaryNotes}</p>
                )}

                {rsvp.companions.length > 0 && (
                  <div className="admin-companions">
                    <h3>{rsvp.companions.length === 1 ? "Acompañante" : "Acompañantes"}</h3>
                    {rsvp.companions.map((companion) => (
                      <div className="admin-companion" key={companion.id}>
                        <strong>{companion.firstName} {companion.lastName}{companion.ticketChargeable === false && <span className="admin-no-charge-badge">Sin cargo</span>}</strong>
                        {companion.dietaryNotes && <p><strong>Necesidad alimentaria:</strong> {companion.dietaryNotes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {rsvp.guest.attending && (
                  <PaymentPanel rsvp={{ ...rsvp, payments: rsvp.payments ?? [] }} onAdd={addPayment} onDelete={removePayment} />
                )}

                <div className="admin-card-actions">
                  <button className="admin-secondary-button" type="button" onClick={() => startEditing(rsvp)}>Editar</button>
                  <button className="admin-delete-button" type="button" onClick={() => deleteRsvp(rsvp)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {editing && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
            <header className="admin-modal-header">
              <div>
                <p className="small-title">EDITAR RESPUESTA</p>
                <h2 id="admin-edit-title">{editing.id ? `${editing.guest.firstName} ${editing.guest.lastName}` : "Nuevo invitado"}</h2>
              </div>
              <button type="button" className="admin-close-button" aria-label="Cerrar edición" onClick={() => setEditing(null)} disabled={saving}>×</button>
            </header>

            <form className="admin-edit-form" onSubmit={saveEditing}>
              <label>Nombre<input required maxLength="100" value={editing.guest.firstName} onChange={(event) => updateEditing("firstName", event.target.value)} /></label>
              <label>Apellido<input required maxLength="100" value={editing.guest.lastName} onChange={(event) => updateEditing("lastName", event.target.value)} /></label>
              <label>Asistencia
                <select value={editing.guest.attending ? "yes" : "no"} onChange={(event) => {
                  const attending = event.target.value === "yes";
                  setEditing((current) => ({ ...current, guest: { ...current.guest, attending }, companions: attending ? current.companions : [] }));
                }}>
                  <option value="yes">Asiste</option>
                  <option value="no">No asiste</option>
                </select>
              </label>
              <label className="admin-charge-toggle admin-edit-wide">
                <input type="checkbox" checked={editing.guest.ticketChargeable === false} onChange={(event) => updateEditing("ticketChargeable", !event.target.checked)} />
                <span>No paga tarjeta (sin cargo)</span>
              </label>
              <label className="admin-edit-wide">Alergias o necesidades alimentarias del invitado<textarea maxLength="1500" rows="3" value={editing.guest.dietaryNotes} onChange={(event) => updateEditing("dietaryNotes", event.target.value)} /></label>

              {editing.guest.attending && editing.companions.map((companion, index) => (
                <fieldset className="admin-companion-edit admin-edit-wide" key={companion.id ?? index}>
                  <legend>Acompañante {index + 1}</legend>
                  <label>Nombre<input required maxLength="100" value={companion.firstName} onChange={(event) => updateCompanion(index, "firstName", event.target.value)} /></label>
                  <label>Apellido<input required maxLength="100" value={companion.lastName} onChange={(event) => updateCompanion(index, "lastName", event.target.value)} /></label>
                  <label className="admin-charge-toggle admin-edit-wide">
                    <input type="checkbox" checked={companion.ticketChargeable === false} onChange={(event) => updateCompanion(index, "ticketChargeable", !event.target.checked)} />
                    <span>No paga tarjeta (sin cargo)</span>
                  </label>
                  <label className="admin-edit-wide">Alergias o necesidades alimentarias<textarea maxLength="1500" rows="3" value={companion.dietaryNotes} onChange={(event) => updateCompanion(index, "dietaryNotes", event.target.value)} /></label>
                  <button className="admin-delete-button" type="button" onClick={() => setEditing((current) => ({ ...current, companions: current.companions.filter((_, companionIndex) => companionIndex !== index) }))}>Quitar acompañante</button>
                </fieldset>
              ))}

              {editing.guest.attending && editing.companions.length < 2 && (
                <button className="admin-secondary-button admin-edit-wide" type="button" onClick={() => setEditing((current) => ({ ...current, companions: [...current.companions, blankCompanion()] }))}>
                  + Agregar acompañante
                </button>
              )}

              <div className="admin-modal-actions admin-edit-wide">
                <button className="admin-secondary-button" type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                <button className="admin-save-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default AdminPage;
