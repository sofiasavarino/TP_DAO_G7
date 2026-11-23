import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../components/socio/Icon";
import Portada from "../components/socio/Portada";
import ReservaModal from "../components/socio/ReservaModal";
import { useAuth } from "../context/AuthContext";
import { useCatalogoSocio } from "../hooks/useCatalogoSocio";
import { ApiError } from "../services/api";
import { reservasService } from "../services/reservasService";
import type { LibroListado } from "../types/libros";
import { ESTADOS_RESERVA_VIVA, type Reserva } from "../types/reservas";
import { addDays, daysLeft, fmt } from "../utils/fechas";
import { nombresAutores } from "../utils/libros";
import CatalogoPage, { coincideBusqueda, type OrdenCatalogo } from "./socio/CatalogoPage";
import LibroDetalle from "./socio/LibroDetalle";
import MisReservasPage from "./socio/MisReservasPage";
import { estimatedDates, seedReservations, type Reservation } from "./socio/datosDePrueba";

// Reseñas: el backend todavía no tiene endpoints, así que viven solo en la sesión.
type Review = { id: number; bookId: number; user: string; stars: number; text: string; date: string; verified: boolean; mine?: boolean };
/** Lo mínimo que necesita el modal de reseña (sirve para un libro real o una reserva de prueba). */
type ReviewTarget = { id: number; title: string; author: string; image: string | null };
type Profile = { name: string; email: string; phone: string; branch: string; notifyReady: boolean; notifyDue: boolean; notifyNews: boolean };
type View = "catalog" | "book" | "reservations" | "loans" | "fines" | "profile";

const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
// Multa: base de $5.000 + 2% diario acumulado (interés compuesto) por cada día de atraso.
const fineFor = (daysOver: number) => Math.round(5000 * Math.pow(1.02, daysOver));
const LOST_AFTER_DAYS = 60;

const aTarget = (libro: LibroListado): ReviewTarget => ({
  id: libro.id,
  title: libro.nombre,
  author: nombresAutores(libro),
  image: libro.imagen_url,
});

function Stars({ value }: { value: number }) {
  return (
    <b className="stars" aria-label={`${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= Math.round(value) ? "on" : ""}>★</i>
      ))}
    </b>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5`}
          className={n <= value ? "on" : ""} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}

function ResRow({ r, estimate, review, onReview, onFines }: {
  r: Reservation; estimate: string; review?: Review; onReview: (r: ReviewTarget) => void; onFines: () => void;
}) {
  const ready = r.pickupBranch === r.branch;
  const plural = (n: number) => `${n} ${Math.abs(n) === 1 ? "día" : "días"}`;
  let label = "";
  let lines: string[] = [];
  let overdueDays = 0;
  if (r.status === "activa") {
    label = ready ? "LISTO PARA RETIRAR" : `DISPONIBLE DESDE EL ${estimate.toUpperCase()}`;
    lines = [ready ? `Retira hasta el ${fmt(r.pickupDate)}` : `Disponibilidad estimada: ${estimate}`];
  } else if (r.status === "retirado") {
    const d = daysLeft(r.dueDate!);
    overdueDays = d < 0 ? -d : 0;
    label = overdueDays ? "VENCIDO" : "LIBRO RETIRADO";
    lines = [
      `Retirado el ${fmt(r.pickupDate)}`,
      `Debes devolverlo el ${fmt(r.dueDate!)}`,
      d > 0 ? `Te quedan ${plural(d)}` : d === 0 ? "Vence hoy" : `Vencido hace ${plural(overdueDays)}`,
    ];
  } else if (r.status === "finalizada") {
    label = "FINALIZADA";
    lines = [`Retirado el ${fmt(r.pickupDate)}`, `Devuelto el ${fmt(r.returnedAt!)}`];
  } else {
    label = "CANCELADA";
    lines = ["Reserva cancelada"];
  }
  const canReview = r.status === "retirado" || r.status === "finalizada";
  return (
    <article className={overdueDays ? "is-overdue" : ""}>
      <img src={r.image} alt="" />
      <div>
        <span>{label}</span>
        <h2>{r.title}</h2>
        <p>{r.author}</p>
        {lines.map((l, i) => (
          <small key={i} className={overdueDays && i === 2 ? "overdue-line" : ""}>{l}</small>
        ))}
        <small>{r.pickupBranch}</small>
        {overdueDays > 0 && (
          <small className="overdue-line">
            Multa acumulada: {money(fineFor(overdueDays))} ·{" "}
            <a href="#multas" onClick={(e) => { e.preventDefault(); onFines(); }}>Ver multas</a>
          </small>
        )}
        {review && <small><Stars value={review.stars} /> Tu reseña</small>}
      </div>
      <div className="row-actions">
        {canReview && <button onClick={() => onReview(r)}>{review ? "Editar reseña" : "Calificar y reseñar"}</button>}
      </div>
    </article>
  );
}

function ProfileSettings({ profile, branches, onSave }: { profile: Profile; branches: string[]; onSave: (p: Profile) => void }) {
  const [d, setD] = useState(profile);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setD((c) => ({ ...c, [k]: v }));
    setSaved(false);
  };
  const toggles: [keyof Profile, string, string][] = [
    ["notifyReady", "Reserva lista para retirar", "Te avisamos cuando tu libro esté disponible."],
    ["notifyDue", "Recordatorios de devolución", "Un aviso antes de que venza tu préstamo."],
    ["notifyNews", "Novedades de la biblioteca", "Nuevos títulos y actividades."],
  ];
  return (
    <section className="reservations-page profile-page">
      <span className="eyebrow">TU CUENTA</span>
      <h1>Configuración del perfil</h1>
      <p>Actualiza tus datos y elige cómo quieres que te avisemos.</p>
      <form className="profile-form" onSubmit={(e) => { e.preventDefault(); onSave(d); setSaved(true); }}>
        <label>Nombre y apellido<input required value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>Correo electrónico<input required type="email" value={d.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label>Teléfono<input type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label>Sede preferida
          <select value={d.branch} onChange={(e) => set("branch", e.target.value)}>
            {branches.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <h3 className="list-title">Notificaciones</h3>
        {toggles.map(([key, title, hint]) => (
          <label key={key} className="switch-row">
            <input type="checkbox" checked={d[key] as boolean} onChange={(e) => set(key, e.target.checked as never)} />
            <div><strong>{title}</strong><small>{hint}</small></div>
          </label>
        ))}
        <button className="confirm-reservation" type="submit">Guardar cambios</button>
        {saved && <p className="saved-note" role="status">Cambios guardados.</p>}
      </form>
    </section>
  );
}


export default function PortalSocio() {
  const { usuario, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState<OrdenCatalogo>("default");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [activeView, setActiveView] = useState<View>("catalog");
  const [selectedBook, setSelectedBook] = useState<LibroListado | null>(null);

  // ----- F3: catálogo real (libros, sedes y copias disponibles por sede)
  const catalogo = useCatalogoSocio(orden === "autor" ? "default" : orden);
  const { libros, sedes, disponibilidad, recargarDisponibilidad } = catalogo;

  // ----- F3.4: libro a reservar (abre el modal) y libros con reserva viva del socio
  const [pendingBook, setPendingBook] = useState<LibroListado | null>(null);
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);
  const [cargandoReservas, setCargandoReservas] = useState(true);
  const [errorReservas, setErrorReservas] = useState<string | null>(null);
  const cargarReservas = useCallback(async () => {
    if (!usuario?.socio_id) {
      setCargandoReservas(false);
      return;
    }
    setCargandoReservas(true);
    setErrorReservas(null);
    try {
      setMisReservas(await reservasService.mias(usuario.socio_id));
    } catch (e) {
      setErrorReservas(e instanceof ApiError ? e.message : "Verificá que el backend esté levantado.");
    } finally {
      setCargandoReservas(false);
    }
  }, [usuario?.socio_id]);
  useEffect(() => {
    void cargarReservas();
  }, [cargarReservas]);
  const reservasVivas = useMemo(
    () => misReservas.filter((r) => ESTADOS_RESERVA_VIVA.includes(r.estado)),
    [misReservas],
  );
  // Libros con reserva viva: el botón "Reservar" pasa a "Ya reservado"
  const reservados = useMemo(() => new Set(reservasVivas.map((r) => r.libro_id)), [reservasVivas]);

  // ----- Vistas todavía con datos de prueba (Mis reservas / Préstamos / Multas)
  const [reservations] = useState<Reservation[]>(seedReservations);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [stars, setStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [profile, setProfile] = useState<Profile>(() => ({
    name:
      [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") ||
      usuario?.nombre_usuario ||
      "",
    email: usuario?.email ?? "",
    phone: "",
    branch: usuario?.sede.nombre ?? "",
    notifyReady: true, notifyDue: true, notifyNews: false,
  }));
  const nameParts = profile.name.trim().split(/\s+/);
  const shortName = `${nameParts[0]} ${nameParts[1]?.[0] ?? ""}.`.replace(" .", "");
  const initials = ((nameParts[0]?.[0] ?? "") + (nameParts[1]?.[0] ?? "")).toUpperCase();

  const suggestions = useMemo(
    () => (query ? libros.filter((l) => coincideBusqueda(l, query)).slice(0, 5) : libros.slice(0, 4)),
    [libros, query],
  );

  const go = (view: View) => {
    setActiveView(view);
    window.scrollTo({ top: 0 });
  };
  const openBook = (libro: LibroListado) => {
    setSelectedBook(libro);
    setSearchOpen(false);
    go("book");
  };
  const reserve = (libro: LibroListado) => setPendingBook(libro);
  const onReservada = () => {
    void recargarDisponibilidad();
    void cargarReservas();
  };

  const hasRead = (bookId: number) =>
    reservations.some((r) => r.id === bookId && (r.status === "retirado" || r.status === "finalizada"));
  const openReview = (r: ReviewTarget) => {
    const prev = reviews.find((v) => v.mine && v.bookId === r.id);
    setStars(prev?.stars ?? 0);
    setReviewText(prev?.text ?? "");
    setReviewTarget(r);
  };
  const submitReview = () => {
    if (!reviewTarget || !stars) return;
    setReviews((cur) => [
      ...cur.filter((v) => !(v.mine && v.bookId === reviewTarget.id)),
      { id: Date.now(), bookId: reviewTarget.id, user: shortName, stars, text: reviewText.trim(), date: addDays(0), verified: hasRead(reviewTarget.id), mine: true },
    ]);
    setReviewTarget(null);
  };
  const overdueLoans = reservations.filter((r) => r.status === "retirado" && daysLeft(r.dueDate!) < 0);
  const totalFine = overdueLoans.reduce((s, r) => s + fineFor(-daysLeft(r.dueDate!)), 0);
  const renderRow = (r: Reservation) => (
    <ResRow key={r.rid} r={r} estimate={estimatedDates[r.pickupBranch]}
      review={reviews.find((v) => v.mine && v.bookId === r.id)} onReview={openReview}
      onFines={() => go("fines")} />
  );
  const bookReviews = selectedBook ? reviews.filter((r) => r.bookId === selectedBook.id) : [];
  const myBookReview = selectedBook ? reviews.find((v) => v.mine && v.bookId === selectedBook.id) : undefined;

  return (
    <div className="app">
      <header>
        <div className="nav-shell">
          <button className="brand" onClick={() => go("catalog")}>
            <span>Herm</span>
            <i>es</i>
            <b>.</b>
          </button>
          <nav aria-label="Navegación principal">
            <button className={activeView === "catalog" ? "active" : ""} onClick={() => go("catalog")}>
              Explorar
            </button>
            <button className={activeView === "reservations" ? "active" : ""} onClick={() => go("reservations")}>
              Mis reservas <small>{reservasVivas.length}</small>
            </button>
            <button className={activeView === "loans" ? "active" : ""} onClick={() => go("loans")}>
              Préstamos
            </button>
            <button
              className={activeView === "fines" ? "active" : ""}
              onClick={() => {
                go("fines");
                setNoticeOpen(false);
              }}
            >
              Multas
            </button>
          </nav>
          <div className="header-search" onClick={(e) => e.stopPropagation()}>
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
                if (activeView !== "catalog") setActiveView("catalog");
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => e.key === "Enter" && setSearchOpen(false)}
              placeholder="Buscá por título, autor o ISBN"
              aria-label="Buscar libros"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <Icon name="close" size={16} />
              </button>
            )}
            {searchOpen && (
              <div className="suggestions">
                <p>{query ? (suggestions.length ? "Sugerencias" : "Sin coincidencias") : "Del catálogo"}</p>
                {suggestions.map((libro) => (
                  <button key={libro.id} onClick={() => openBook(libro)}>
                    <span>
                      <Icon name="book" size={17} />
                    </span>
                    <div>
                      <strong>{libro.nombre}</strong>
                      <small>{nombresAutores(libro)}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="notification-button has-notifications"
            onClick={() => {
              setNoticeOpen(!noticeOpen);
            }}
            aria-label="Ver notificaciones"
          >
            <Icon name="bell" size={21} />
            <span />
          </button>
          <button
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="Abrir perfil"
          >
            <span>{initials}</span>
            <div>
              <strong>{shortName}</strong>
              <small>Socia lectora</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
          <button className="mobile-menu" aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
        </div>
        {noticeOpen && (
          <div className="header-popover notice-popover">
            <span className="popover-kicker">NOTIFICACIONES</span>
            <strong>Tu reserva está lista</strong>
            <p>“Orgullo y prejuicio” te espera en Sede Central hasta el {fmt(addDays(2))}.</p>
          </div>
        )}
        {profileOpen && (
          <div className="profile-popover">
            <div className="profile-main">
              <span>{initials}</span>
              <div>
                <strong>{profile.name}</strong>
                <small>{profile.email}</small>
              </div>
            </div>
            <div className="profile-stat">
              <span>Préstamos disponibles</span>
              <strong>{Math.max(0, 2 - reservasVivas.length)} de 2</strong>
            </div>
            <button
              onClick={() => {
                go("profile");
                setProfileOpen(false);
              }}
            >
              Configuración del perfil <Icon name="arrow" size={17} />
            </button>
            <button onClick={logout}>
              Cerrar sesión <Icon name="arrow" size={17} />
            </button>
          </div>
        )}
      </header>

      <main onClick={() => searchOpen && setSearchOpen(false)}>
        {activeView === "catalog" ? (
          <CatalogoPage
            libros={libros}
            sedes={sedes}
            disponibilidad={disponibilidad}
            cargando={catalogo.cargando}
            error={catalogo.error}
            onReintentar={catalogo.reintentar}
            query={query}
            orden={orden}
            onOrden={setOrden}
            sedePropia={usuario?.sede ?? null}
            reservados={reservados}
            onOpen={openBook}
            onReserve={reserve}
          />
        ) : activeView === "book" && selectedBook ? (
          <LibroDetalle
            libro={selectedBook}
            sedes={sedes}
            disponibilidad={disponibilidad}
            sedePropiaId={usuario?.sede.id ?? null}
            reservado={reservados.has(selectedBook.id)}
            onReserve={reserve}
            onBack={() => go("catalog")}
          >
            <h2 className="list-title">Reseñas de los socios</h2>
            <button className="ghost-btn" onClick={() => openReview(aTarget(selectedBook))}>
              {myBookReview ? "Editar tu reseña" : "Escribir una reseña"}
            </button>
            <div className="review-list">
              {bookReviews.map((r) => (
                <article key={r.id}>
                  <div><strong>{r.user}</strong> <small>{fmt(r.date)}</small> <em className={r.verified ? "badge ok" : "badge"}>{r.verified ? "Lectura confirmada" : "Lectura no confirmada"}</em></div>
                  <Stars value={r.stars} />
                  {r.text && <p>{r.text}</p>}
                </article>
              ))}
              {!bookReviews.length && <p className="muted">Todavía no hay reseñas. ¡Sé el primero en dejar una cuando lo leas!</p>}
            </div>
          </LibroDetalle>
        ) : activeView === "reservations" ? (
          <MisReservasPage
            reservas={misReservas}
            cargando={cargandoReservas}
            error={errorReservas}
            onReintentar={cargarReservas}
            libros={libros}
            sedes={sedes}
            onCancelada={onReservada}
            onExplore={() => go("catalog")}
            onOpenLibro={openBook}
          />
        ) : activeView === "loans" ? (
          <section className="reservations-page">
            <span className="eyebrow">TU CUENTA</span>
            <h1>Préstamos</h1>
            <p>Los libros que tienes en casa, cuándo devolverlos y tu historial de lecturas.</p>
            <h3 className="list-title">Para devolver</h3>
            <div className="reservation-list">
              {reservations.filter((r) => r.status === "retirado").map(renderRow)}
              {!reservations.some((r) => r.status === "retirado") && (
                <p className="muted">No tienes libros pendientes de devolución.</p>
              )}
            </div>
            <h3 className="list-title">Anteriores</h3>
            <div className="reservation-list">
              {reservations.filter((r) => r.status === "finalizada").map(renderRow)}
              {!reservations.some((r) => r.status === "finalizada") && (
                <p className="muted">Aún no tienes préstamos finalizados.</p>
              )}
            </div>
          </section>
        ) : activeView === "profile" ? (
          <ProfileSettings profile={profile} branches={sedes.map((s) => s.nombre)} onSave={setProfile} />
        ) : (
          <section className="reservations-page fines-page">
            <span className="eyebrow">TU CUENTA</span>
            <h1>Multas</h1>
            <p>Cargos por devolución fuera de plazo, calculados según tus préstamos vencidos.</p>
            <div className="fines-summary">
              <div>
                <span>SALDO PENDIENTE</span>
                <strong>{money(totalFine)}</strong>
              </div>
              <div>
                <span>ESTADO DE LA CUENTA</span>
                <strong className={totalFine ? "account-bad" : "account-ok"}>
                  {totalFine ? "Con multa" : "Al día"}
                </strong>
              </div>
            </div>
            {overdueLoans.map((r) => {
              const over = -daysLeft(r.dueDate!);
              const total = fineFor(over);
              return (
                <article className="fine-card" key={r.rid}>
                  <span className="eyebrow">VENCIDO HACE {over} {over === 1 ? "DÍA" : "DÍAS"}</span>
                  <h2>{r.title}</h2>
                  <p>{r.author} · retirado el {fmt(r.pickupDate)}, vencía el {fmt(r.dueDate!)}</p>
                  <dl>
                    <div><dt>Cargo base</dt><dd>{money(5000)}</dd></div>
                    <div><dt>Recargo 2% diario acumulado</dt><dd>{money(total - 5000)}</dd></div>
                    <div className="total"><dt>Total a abonar</dt><dd>{money(total)}</dd></div>
                  </dl>
                  <p className="muted">
                    Al abonar la multa quedas suspendido 15 días sin poder pedir libros.
                  </p>
                  {over > LOST_AFTER_DAYS && (
                    <p className="fine-alert">
                      Pasaron más de 2 meses: el libro se considera perdido y el socio puede ser dado
                      de baja. Para volver a asociarte se cobra el valor del libro más un 50%.
                    </p>
                  )}
                  <button className="ghost-btn" onClick={() => go("loans")}>Ver préstamo</button>
                </article>
              );
            })}
            {!overdueLoans.length && (
              <div className="empty fines-empty">
                <Icon name="bookmark" size={34} />
                <h3>No tienes multas pendientes</h3>
                <p>Tu historial de préstamos está al día.</p>
              </div>
            )}
            <h3 className="list-title">Otras sanciones</h3>
            <ul className="rules">
              <li>Libro devuelto con daños menores (reparables): suspensión de 15 días.</li>
              <li>Daños mayores (irreparables): multa del 100% del costo del libro y suspensión hasta abonarla. Pasados los 15 días se suma un recargo del 2% diario.</li>
              <li>Más de 2 meses de atraso: el libro se da por perdido y el socio se da de baja.</li>
            </ul>
          </section>
        )}
      </main>
      {pendingBook && (
        <ReservaModal
          libro={pendingBook}
          sedes={sedes}
          disponibilidad={disponibilidad}
          onClose={() => setPendingBook(null)}
          onReservada={onReservada}
        />
      )}
      {reviewTarget && (
        <div className="reservation-modal-backdrop" role="presentation">
          <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <button className="modal-close" onClick={() => setReviewTarget(null)} aria-label="Cerrar">
              <Icon name="close" size={18} />
            </button>
            <span className="eyebrow">TU RESEÑA</span>
            <h2 id="review-title">¿Qué te pareció?</h2>
            <div className="modal-book">
              <Portada src={reviewTarget.image} titulo={reviewTarget.title} className="mini" />
              <div><strong>{reviewTarget.title}</strong><span>{reviewTarget.author}</span></div>
            </div>
            <StarInput value={stars} onChange={setStars} />
            {!hasRead(reviewTarget.id) && (
              <p className="muted">
                Se publicará como “lectura no confirmada”, porque aún no registramos un préstamo
                tuyo de este libro.
              </p>
            )}
            <textarea className="review-text" maxLength={280} rows={4} value={reviewText}
              onChange={(e) => setReviewText(e.target.value)} placeholder="Cuéntanos brevemente tu opinión (opcional)" />
            <small className="muted">{reviewText.length}/280</small>
            <button className="confirm-reservation" disabled={!stars} onClick={submitReview}>Publicar reseña</button>
          </section>
        </div>
      )}
      <footer>
        <button className="brand" onClick={() => go("catalog")}>
          <span>Herm</span>
          <i>es</i>
          <b>.</b>
        </button>
        <p>Biblioteca pública · Historias para todos.</p>
        <span>© 2026 Hermes</span>
      </footer>
    </div>
  );
}
