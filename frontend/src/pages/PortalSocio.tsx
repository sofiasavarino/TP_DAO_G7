import { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Book = {
  id: number;
  title: string;
  author: string;
  genre: string;
  rating: number;
  image: string;
  branch: string;
};

type Status = "activa" | "retirado" | "finalizada" | "cancelada";
type Reservation = Book & {
  rid: number;
  pickupBranch: string;
  status: Status;
  pickupDate: string; // fecha de retiro (vacía si aún no hay ejemplar)
  dueDate?: string; // fecha de devolución (libro retirado)
  returnedAt?: string;
};
type Review = { id: number; bookId: number; user: string; stars: number; text: string; date: string; verified: boolean; mine?: boolean };
type Sort = "default" | "author" | "rating";
type Profile = { name: string; email: string; phone: string; branch: string; notifyReady: boolean; notifyDue: boolean; notifyNews: boolean };

const photos = [
  "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1535905496755-26ae35d0ae54?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1699443817739-cf2f7cbcd18d?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1600181982553-ce7d36051c01?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1722977735215-d28f2ac6efba?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1645199055511-7c9e27094e50?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1530449561329-34cad7b30266?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1684514038371-3ff332c2b319?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1539197223802-e4380a198081?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1579920279425-5c9c31e5b982?auto=format&fit=crop&w=700&q=85",
];

const books: Book[] = [
  {
    id: 1,
    title: "El gran Gatsby",
    author: "F. Scott Fitzgerald",
    genre: "Literatura clásica",
    rating: 4.8,
    image: photos[0],
    branch: "Sede Central",
  },
  {
    id: 2,
    title: "Cien años de soledad",
    author: "Gabriel García Márquez",
    genre: "Literatura clásica",
    rating: 4.9,
    image: photos[1],
    branch: "Sede Norte",
  },
  {
    id: 3,
    title: "Orgullo y prejuicio",
    author: "Jane Austen",
    genre: "Literatura clásica",
    rating: 4.7,
    image: photos[2],
    branch: "Sede Central",
  },
  {
    id: 4,
    title: "La metamorfosis",
    author: "Franz Kafka",
    genre: "Literatura clásica",
    rating: 4.6,
    image: photos[3],
    branch: "Sede Sur",
  },
  {
    id: 5,
    title: "Crimen y castigo",
    author: "Fiódor Dostoyevski",
    genre: "Literatura clásica",
    rating: 4.9,
    image: photos[4],
    branch: "Sede Norte",
  },
  {
    id: 6,
    title: "Ficciones",
    author: "Jorge Luis Borges",
    genre: "Cuentos",
    rating: 4.8,
    image: photos[5],
    branch: "Sede Central",
  },
  {
    id: 7,
    title: "Casa tomada",
    author: "Julio Cortázar",
    genre: "Cuentos",
    rating: 4.7,
    image: photos[6],
    branch: "Sede Sur",
  },
  {
    id: 8,
    title: "El Aleph",
    author: "Jorge Luis Borges",
    genre: "Cuentos",
    rating: 4.9,
    image: photos[7],
    branch: "Sede Norte",
  },
  {
    id: 9,
    title: "Doce cuentos peregrinos",
    author: "Gabriel García Márquez",
    genre: "Cuentos",
    rating: 4.6,
    image: photos[8],
    branch: "Sede Central",
  },
  {
    id: 10,
    title: "Bestiario",
    author: "Julio Cortázar",
    genre: "Cuentos",
    rating: 4.5,
    image: photos[9],
    branch: "Sede Sur",
  },
  {
    id: 11,
    title: "Dune",
    author: "Frank Herbert",
    genre: "Ciencia ficción",
    rating: 4.8,
    image: photos[4],
    branch: "Sede Central",
  },
  {
    id: 12,
    title: "Fundación",
    author: "Isaac Asimov",
    genre: "Ciencia ficción",
    rating: 4.7,
    image: photos[0],
    branch: "Sede Norte",
  },
  {
    id: 13,
    title: "Solaris",
    author: "Stanisław Lem",
    genre: "Ciencia ficción",
    rating: 4.5,
    image: photos[6],
    branch: "Sede Sur",
  },
  {
    id: 14,
    title: "Fahrenheit 451",
    author: "Ray Bradbury",
    genre: "Ciencia ficción",
    rating: 4.8,
    image: photos[2],
    branch: "Sede Central",
  },
  {
    id: 15,
    title: "El nombre de la rosa",
    author: "Umberto Eco",
    genre: "Misterio",
    rating: 4.7,
    image: photos[9],
    branch: "Sede Norte",
  },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const fmt = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const daysLeft = (s: string) =>
  Math.round((new Date(`${s}T00:00:00`).getTime() - new Date(`${addDays(0)}T00:00:00`).getTime()) / 86400000);
const money = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
// Multa: base de $5.000 + 2% diario acumulado (interés compuesto) por cada día de atraso.
const fineFor = (daysOver: number) => Math.round(5000 * Math.pow(1.02, daysOver));
const LOAN_DAYS = 15;
const LOST_AFTER_DAYS = 60;
const dayLabel = (n: number) => (n === 0 ? "Hoy" : n === 1 ? "Mañana" : fmt(addDays(n)));

const synopses: Record<number, string> = {
  1: "Un millonario misterioso, una fiesta interminable y el sueño americano visto desde sus grietas.",
  2: "La saga de los Buendía en Macondo, entre lo real y lo maravilloso, a lo largo de siete generaciones.",
  3: "Elizabeth Bennet y el orgulloso señor Darcy se enfrentan a sus propios prejuicios en la Inglaterra rural.",
  4: "Gregor Samsa despierta convertido en un insecto y su familia debe aprender a convivir con ello.",
  5: "Un joven estudiante comete un crimen y lidia con la culpa en el San Petersburgo del siglo XIX.",
  6: "Laberintos, bibliotecas infinitas y espejos: cuentos que cambiaron la forma de entender la ficción.",
  7: "Dos hermanos habitan una casa que, poco a poco, es invadida por algo que nunca vemos.",
  8: "Un punto del universo que contiene todos los puntos y otros relatos de Borges.",
  9: "Doce relatos sobre latinoamericanos en Europa, entre el exilio, la nostalgia y lo inexplicable.",
  10: "Primer libro de cuentos de Cortázar: lo fantástico irrumpe en la vida cotidiana.",
  11: "Arrakis, la especia y la lucha por el poder en el planeta desierto más famoso de la ciencia ficción.",
  12: "Un matemático predice la caída de un imperio galáctico y diseña un plan para acortar la oscuridad.",
  13: "Un psicólogo llega a una estación espacial junto a un océano que parece pensar.",
  14: "En un futuro donde los bomberos queman libros, uno de ellos empieza a dudar.",
  15: "Una abadía medieval, una serie de muertes y una biblioteca que guarda un secreto.",
};

const seedReservations = (): Reservation[] => [
  { ...books[2], rid: 1, pickupBranch: books[2].branch, status: "activa", pickupDate: addDays(2) },
  { ...books[0], rid: 2, pickupBranch: books[0].branch, status: "retirado", pickupDate: addDays(-9), dueDate: addDays(6) },
  { ...books[5], rid: 6, pickupBranch: books[5].branch, status: "retirado", pickupDate: addDays(-25), dueDate: addDays(-10) },
  { ...books[4], rid: 3, pickupBranch: books[4].branch, status: "finalizada", pickupDate: addDays(-35), dueDate: addDays(-20), returnedAt: addDays(-24) },
  { ...books[13], rid: 4, pickupBranch: books[13].branch, status: "finalizada", pickupDate: addDays(-70), dueDate: addDays(-55), returnedAt: addDays(-58) },
  { ...books[9], rid: 5, pickupBranch: books[9].branch, status: "cancelada", pickupDate: addDays(-12) },
];

const seedReviews = (): Review[] => [
  { id: 1, bookId: 2, user: "Martín R.", stars: 5, text: "Una obra maestra, me atrapó desde la primera página.", date: addDays(-30), verified: true },
  { id: 2, bookId: 2, user: "Sofía G.", stars: 4, text: "Larga, pero imposible de soltar.", date: addDays(-12), verified: false },
  { id: 3, bookId: 6, user: "Ana P.", stars: 5, text: "Cuentos breves y brillantes.", date: addDays(-9), verified: true },
  { id: 4, bookId: 14, user: "Diego L.", stars: 5, text: "Más actual que nunca.", date: addDays(-4), verified: true },
];

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

function BookDetail({ book, reviews, reserved, myReview, onReserve, onReview, onBack }: {
  book: Book; reviews: Review[]; reserved: boolean; myReview?: Review; onReserve: (b: Book) => void; onReview: (b: Book) => void; onBack: () => void;
}) {
  const own = reviews.filter((r) => r.bookId === book.id);
  const avg = own.length ? own.reduce((s, r) => s + r.stars, 0) / own.length : book.rating;
  return (
    <section className="book-detail">
      <button className="back-link" onClick={onBack}>← Volver al catálogo</button>
      <div className="detail-grid">
        <img src={book.image} alt={`Portada de ${book.title}`} />
        <div>
          <span className="eyebrow">{book.genre.toUpperCase()}</span>
          <h1>{book.title}</h1>
          <p className="detail-author">{book.author}</p>
          <div className="detail-rating"><Stars value={avg} /> <span>{avg.toFixed(1)} · {own.length} {own.length === 1 ? "reseña" : "reseñas"}</span></div>
          <p className="detail-synopsis">{synopses[book.id] ?? "Sinopsis no disponible."}</p>
          <p className="detail-avail">Disponible en <b>{book.branch}</b></p>
          <button className="confirm-reservation" disabled={reserved} onClick={() => onReserve(book)}>
            {reserved ? "Ya lo reservaste" : "Reservar este libro"}
          </button>{" "}
          <button className="ghost-btn" onClick={() => onReview(book)}>
            {myReview ? "Editar tu reseña" : "Escribir una reseña"}
          </button>
        </div>
      </div>
      <h2 className="list-title">Reseñas de los socios</h2>
      <div className="review-list">
        {own.map((r) => (
          <article key={r.id}>
            <div><strong>{r.user}</strong> <small>{fmt(r.date)}</small> <em className={r.verified ? "badge ok" : "badge"}>{r.verified ? "Lectura confirmada" : "Lectura no confirmada"}</em></div>
            <Stars value={r.stars} />
            {r.text && <p>{r.text}</p>}
          </article>
        ))}
        {!own.length && <p className="muted">Todavía no hay reseñas. ¡Sé el primero en dejar una cuando lo leas!</p>}
      </div>
    </section>
  );
}

function ResRow({ r, estimate, review, onCancel, onReview, onFines }: {
  r: Reservation; estimate: string; review?: Review; onCancel: (r: Reservation) => void; onReview: (r: Reservation) => void; onFines: () => void;
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
        {r.status === "activa" && <button onClick={() => onCancel(r)}>Cancelar reserva</button>}
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

function Icon({
  name,
  size = 20,
}: {
  name: "search" | "user" | "chevron" | "arrow" | "bookmark" | "close" | "book" | "menu" | "bell";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

function BookCard({ book, onReserve, onOpen }: { book: Book; onReserve: (book: Book) => void; onOpen: (book: Book) => void }) {
  return (
    <article className="book-card group" role="link" tabIndex={0} style={{ cursor: "pointer" }}
      onClick={() => onOpen(book)} onKeyDown={(e) => e.key === "Enter" && onOpen(book)}>
      <img src={book.image} alt="" />
      <div className="book-spine" />
      <div className="book-overlay">
        <span className="availability">Disponible en {book.branch}</span>
        <div>
          <h3>{book.title}</h3>
          <p>{book.author}</p>
          <div className="rating">
            <span>★</span> {book.rating.toFixed(1)}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onReserve(book); }} aria-label={`Reservar ${book.title}`}>
          Reservar
        </button>
      </div>
    </article>
  );
}

function Shelf({
  title,
  kicker,
  items,
  onReserve,
  onOpen,
}: {
  title: string;
  kicker: string;
  items: Book[];
  onReserve: (book: Book) => void;
  onOpen: (book: Book) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (direction: number) =>
    ref.current?.scrollBy({
      left: direction * Math.min(ref.current.clientWidth * 0.8, 780),
      behavior: "smooth",
    });
  return (
    <section className="shelf-section">
      <div className="section-heading">
        <div>
          <span>{kicker}</span>
          <h2>{title}</h2>
        </div>
        <div className="shelf-actions">
          <button onClick={() => move(-1)} aria-label="Ver libros anteriores" className="prev">
            <Icon name="arrow" />
          </button>
          <button onClick={() => move(1)} aria-label="Ver más libros">
            <Icon name="arrow" />
          </button>
        </div>
      </div>
      <div className="books-row" ref={ref}>
        {items.map((book) => (
          <BookCard key={book.id} book={book} onReserve={onReserve} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export default function PortalSocio() {
  const { usuario, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Todos los géneros");
  const [author, setAuthor] = useState("Todos los autores");
  const [authorSearch, setAuthorSearch] = useState("");
  const [authorOpen, setAuthorOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [limitNotice, setLimitNotice] = useState(false);
  const [pendingBook, setPendingBook] = useState<Book | null>(null);
  const [pickupBranch, setPickupBranch] = useState("");
  const [activeView, setActiveView] = useState<"catalog" | "book" | "reservations" | "loans" | "fines" | "profile">("catalog");
  const [reservations, setReservations] = useState<Reservation[]>(seedReservations);
  const [reviews, setReviews] = useState<Review[]>(seedReviews);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [pickupDay, setPickupDay] = useState(0);
  const [sort, setSort] = useState<Sort>("default");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Book | null>(null);
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
  const activeRes = reservations.filter((r) => r.status === "activa");
  const nameParts = profile.name.trim().split(/\s+/);
  const shortName = `${nameParts[0]} ${nameParts[1]?.[0] ?? ""}.`.replace(" .", "");
  const initials = ((nameParts[0]?.[0] ?? "") + (nameParts[1]?.[0] ?? "")).toUpperCase();

  const matches = useMemo(
    () =>
      books.filter(
        (book) =>
          (!query || `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())) &&
          (genre === "Todos los géneros" || book.genre === genre) &&
          (author === "Todos los autores" || book.author === author) &&
          (!selectedBranches.length || selectedBranches.includes(book.branch)),
      ),
    [query, genre, author, selectedBranches],
  );

  const suggestions = query
    ? books
        .filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
    : books.slice(0, 4);
  const reserve = (book: Book) => {
    if (activeRes.some((b) => b.id === book.id)) return;
    if (activeRes.length >= 2) {
      setLimitNotice(true);
      window.setTimeout(() => setLimitNotice(false), 3500);
      return;
    }
    setPendingBook(book);
    setPickupBranch(book.branch);
  };
  const confirmReservation = () => {
    if (!pendingBook || !pickupBranch) return;
    setReservations((current) => [
      ...current,
      {
        ...pendingBook,
        rid: Date.now(),
        pickupBranch,
        status: "activa",
        pickupDate: pickupBranch === pendingBook.branch ? addDays(pickupDay) : "",
      },
    ]);
    setPickupDay(0);
    setPendingBook(null);
    setPickupBranch("");
  };
  const openBook = (book: Book) => {
    setSelectedBook(book);
    setActiveView("book");
    window.scrollTo({ top: 0 });
  };
  const cancelReservation = () => {
    if (!cancelTarget) return;
    setReservations((cur) => cur.map((r) => (r.rid === cancelTarget.rid ? { ...r, status: "cancelada" as Status } : r)));
    setCancelTarget(null);
  };
  const hasRead = (bookId: number) =>
    reservations.some((r) => r.id === bookId && (r.status === "retirado" || r.status === "finalizada"));
  const ratingOf = (b: Book) => {
    const own = reviews.filter((v) => v.bookId === b.id);
    return own.length ? own.reduce((s, v) => s + v.stars, 0) / own.length : b.rating;
  };
  const sortBooks = (list: Book[]) =>
    sort === "default"
      ? list
      : [...list].sort((x, y) =>
          sort === "author"
            ? x.author.localeCompare(y.author, "es") || x.title.localeCompare(y.title, "es")
            : ratingOf(y) - ratingOf(x) || x.title.localeCompare(y.title, "es"),
        );
  const openReview = (r: Book) => {
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
      review={reviews.find((v) => v.mine && v.bookId === r.id)} onCancel={setCancelTarget} onReview={openReview}
      onFines={() => { setActiveView("fines"); window.scrollTo({ top: 0 }); }} />
  );
  const genres = ["Todos los géneros", ...Array.from(new Set(books.map((b) => b.genre)))];
  const authors = ["Todos los autores", ...Array.from(new Set(books.map((b) => b.author))).sort()];
  const branches = ["Sede Central", "Sede Norte", "Sede Sur"];
  const estimatedDates: Record<string, string> = {
    "Sede Central": "28 de junio",
    "Sede Norte": "1 de julio",
    "Sede Sur": "4 de julio",
  };
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const similarAuthors = authors.filter((name) => {
    if (!authorSearch || name === "Todos los autores") return true;
    const target = normalize(name);
    const search = normalize(authorSearch);
    if (target.includes(search)) return true;
    return (
      search.length > 2 && target.split(" ").some((part) => part.startsWith(search.slice(0, -1)))
    );
  });
  const toggleBranch = (branchName: string) =>
    setSelectedBranches((current) =>
      current.includes(branchName)
        ? current.filter((item) => item !== branchName)
        : [...current, branchName],
    );

  return (
    <div className="app">
      <header>
        <div className="nav-shell">
          <button className="brand" onClick={() => setActiveView("catalog")}>
            <span>Herm</span>
            <i>es</i>
            <b>.</b>
          </button>
          <nav aria-label="Navegación principal">
            <button
              className={activeView === "catalog" ? "active" : ""}
              onClick={() => setActiveView("catalog")}
            >
              Explorar
            </button>
            <button
              className={activeView === "reservations" ? "active" : ""}
              onClick={() => setActiveView("reservations")}
            >
              Mis reservas <small>{activeRes.length}</small>
            </button>
            <button
              className={activeView === "loans" ? "active" : ""}
              onClick={() => setActiveView("loans")}
            >
              Préstamos
            </button>
            <button
              className={activeView === "fines" ? "active" : ""}
              onClick={() => {
                setActiveView("fines");
                setNoticeOpen(false);
              }}
            >
              Multas
            </button>
          </nav>
          <div className="header-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Busca por título o autor"
              aria-label="Buscar libros"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <Icon name="close" size={16} />
              </button>
            )}
            {searchOpen && (
              <div className="suggestions">
                <p>{query ? "Sugerencias" : "Búsquedas populares"}</p>
                {suggestions.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => {
                      setQuery(book.title);
                      setSearchOpen(false);
                    }}
                  >
                    <span>
                      <Icon name="book" size={17} />
                    </span>
                    <div>
                      <strong>{book.title}</strong>
                      <small>{book.author}</small>
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
              <strong>{Math.max(0, 2 - activeRes.length)} de 2</strong>
            </div>
            <button
              onClick={() => {
                setActiveView("profile");
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

      <main
        onClick={() => {
          if (searchOpen) setSearchOpen(false);
          setAuthorOpen(false);
          setBranchOpen(false);
        }}
      >
        {activeView === "catalog" ? (
          <>
            <section className="intro">
              <div>
                <span className="eyebrow">CATÁLOGO DE LA BIBLIOTECA</span>
                <h1>
                  Tu próxima historia
                  <br />
                  empieza <em>aquí.</em>
                </h1>
              </div>
              <p>
                Explora, reserva y disfruta. Más de 12.000 títulos te están esperando en nuestras
                sedes.
              </p>
            </section>

            <section
              className="filters"
              aria-label="Filtros del catálogo"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="filter-label">Filtrar por</span>
              <label>
                <span>Género</span>
                <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                  {genres.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <Icon name="chevron" size={17} />
              </label>
              <div className="filter-control author-filter">
                <span>Autor</span>
                <input
                  value={authorOpen ? authorSearch : author}
                  onChange={(e) => {
                    setAuthorSearch(e.target.value);
                    setAuthorOpen(true);
                  }}
                  onFocus={() => {
                    setAuthorSearch(author === "Todos los autores" ? "" : author);
                    setAuthorOpen(true);
                  }}
                  placeholder="Buscar autor"
                  aria-label="Buscar autor"
                />
                <Icon name="chevron" size={17} />
                {authorOpen && (
                  <div className="filter-dropdown author-options">
                    {similarAuthors.length ? (
                      similarAuthors.map((name) => (
                        <button
                          key={name}
                          onClick={() => {
                            setAuthor(name);
                            setAuthorSearch("");
                            setAuthorOpen(false);
                          }}
                        >
                          {name}
                        </button>
                      ))
                    ) : (
                      <p>No encontramos autores parecidos.</p>
                    )}
                  </div>
                )}
              </div>
              <label>
                <span>Ordenar por</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="default">Relevancia</option>
                  <option value="author">Autor (A–Z)</option>
                  <option value="rating">Puntuación (mayor primero)</option>
                </select>
                <Icon name="chevron" size={17} />
              </label>
              <div className="filter-control branch-filter">
                <span>Disponibilidad</span>
                <button className="filter-trigger" onClick={() => setBranchOpen(!branchOpen)}>
                  {selectedBranches.length
                    ? `${selectedBranches.length} ${selectedBranches.length === 1 ? "sede" : "sedes"}`
                    : "Todas las sedes"}
                </button>
                <Icon name="chevron" size={17} />
                {branchOpen && (
                  <div className="filter-dropdown branch-options">
                    {branches.map((branchName) => (
                      <label key={branchName}>
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(branchName)}
                          onChange={() => toggleBranch(branchName)}
                        />
                        <span className="checkmark" />
                        {branchName}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {(genre !== "Todos los géneros" ||
                author !== "Todos los autores" ||
                sort !== "default" ||
                selectedBranches.length > 0) && (
                <button
                  className="clear-filters"
                  onClick={() => {
                    setGenre("Todos los géneros");
                    setAuthor("Todos los autores");
                    setAuthorSearch("");
                    setSelectedBranches([]);
                    setSort("default");
                  }}
                >
                  Limpiar
                </button>
              )}
            </section>

            {query ||
            genre !== "Todos los géneros" ||
            author !== "Todos los autores" ||
            sort !== "default" ||
            selectedBranches.length > 0 ? (
              <section className="results">
                <div className="section-heading">
                  <div>
                    <span>RESULTADOS</span>
                    <h2>
                      {matches.length}{" "}
                      {matches.length === 1 ? "libro encontrado" : "libros encontrados"}
                    </h2>
                  </div>
                </div>
                {matches.length ? (
                  <div className="results-grid">
                    {sortBooks(matches).map((book) => (
                      <BookCard key={book.id} book={book} onReserve={reserve} onOpen={openBook} />
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <Icon name="search" size={32} />
                    <h3>No encontramos coincidencias</h3>
                    <p>Prueba con otro título, autor o cambia los filtros.</p>
                  </div>
                )}
              </section>
            ) : (
              <>
                <section className="weekly">
                  <div className="weekly-image">
                    <img src={photos[0]} alt="Una biblioteca clásica con estanterías altas" />
                    <span>SELECCIÓN DEL EQUIPO</span>
                  </div>
                  <div className="weekly-copy">
                    <span className="eyebrow">RECOMENDADO DE LA SEMANA</span>
                    <h2>
                      El nombre
                      <br />
                      de la rosa
                    </h2>
                    <p className="author">Umberto Eco · Novela histórica</p>
                    <p className="synopsis">
                      Una abadía, una serie de muertes inexplicables y una biblioteca que oculta más
                      de un secreto. Un misterio sobre el poder de los libros y las ideas.
                    </p>
                    <div className="weekly-meta">
                      <span>
                        <b>4.8</b> ★★★★★
                      </span>
                      <span className="dot" />
                      <span>
                        Disponible en <b>Sede Norte</b>
                      </span>
                    </div>
                    <button onClick={() => reserve(books[14])}>
                      Reservar este libro <Icon name="arrow" />
                    </button>
                  </div>
                  <div className="weekly-number">01</div>
                </section>

                <Shelf
                  title="Literatura clásica"
                  kicker="IMPRESCINDIBLES"
                  items={books.filter((b) => b.genre === "Literatura clásica")}
                  onReserve={reserve}
                  onOpen={openBook}
                />
                <Shelf
                  title="Cuentos para perderse"
                  kicker="LECTURAS BREVES"
                  items={books.filter((b) => b.genre === "Cuentos")}
                  onReserve={reserve}
                  onOpen={openBook}
                />
                <Shelf
                  title="Más allá de este mundo"
                  kicker="CIENCIA FICCIÓN"
                  items={books
                    .filter((b) => b.genre === "Ciencia ficción")
                    .concat(books.slice(0, 2))}
                  onReserve={reserve}
                  onOpen={openBook}
                />
              </>
            )}
          </>
        ) : activeView === "book" && selectedBook ? (
          <BookDetail
            book={selectedBook}
            reviews={reviews}
            reserved={activeRes.some((r) => r.id === selectedBook.id)}
            myReview={reviews.find((v) => v.mine && v.bookId === selectedBook.id)}
            onReview={openReview}
            onReserve={reserve}
            onBack={() => setActiveView("catalog")}
          />
        ) : activeView === "reservations" ? (
          <section className="reservations-page">
            <span className="eyebrow">TU ESPACIO</span>
            <h1>Mis reservas</h1>
            <p>
              Puedes tener hasta 2 reservas activas. Si el libro está disponible, puedes reservarlo
              hasta 3 días a partir de hoy.
            </p>
            <h3 className="list-title">Activas</h3>
            <div className="reservation-list">
              {activeRes.map(renderRow)}
              {!activeRes.length && (
                <div className="empty">
                  <Icon name="bookmark" size={34} />
                  <h3>Aún no tienes reservas activas</h3>
                  <p>Explora el catálogo para encontrar tu próxima lectura.</p>
                  <button onClick={() => setActiveView("catalog")}>Explorar catálogo</button>
                </div>
              )}
            </div>
            <h3 className="list-title">Historial</h3>
            <div className="reservation-list">
              {reservations.filter((r) => r.status !== "activa").slice().reverse().map(renderRow)}
            </div>
          </section>
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
          <ProfileSettings profile={profile} branches={branches} onSave={setProfile} />
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
                  <button className="ghost-btn" onClick={() => setActiveView("loans")}>Ver préstamo</button>
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
        <div className="reservation-modal-backdrop" role="presentation">
          <section
            className="reservation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservation-title"
          >
            <button
              className="modal-close"
              onClick={() => setPendingBook(null)}
              aria-label="Cerrar"
            >
              <Icon name="close" size={18} />
            </button>
            <span className="eyebrow">RESERVAR EJEMPLAR</span>
            <h2 id="reservation-title">¿Dónde quieres retirarlo?</h2>
            <div className="modal-book">
              <img src={pendingBook.image} alt="" />
              <div>
                <strong>{pendingBook.title}</strong>
                <span>{pendingBook.author}</span>
              </div>
            </div>
            <div className="pickup-options">
              {branches.map((branchName) => {
                const available = branchName === pendingBook.branch;
                return (
                  <label key={branchName} className={pickupBranch === branchName ? "selected" : ""}>
                    <input
                      type="radio"
                      name="pickup-branch"
                      value={branchName}
                      checked={pickupBranch === branchName}
                      onChange={() => setPickupBranch(branchName)}
                    />
                    <span className="radio-mark" />
                    <div>
                      <strong>{branchName}</strong>
                      <small className={available ? "available-now" : ""}>
                        {available
                          ? "Disponible para retiro"
                          : `Disponibilidad estimada: ${estimatedDates[branchName]}`}
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
            {pickupBranch === pendingBook.branch && (
              <div className="day-picker">
                <strong>¿Qué día lo retiras?</strong>
                <div>
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} type="button" className={pickupDay === n ? "selected" : ""} onClick={() => setPickupDay(n)}>
                      {dayLabel(n)}
                    </button>
                  ))}
                </div>
                <small>Te guardamos el libro hasta 3 días a partir de hoy.</small>
              </div>
            )}
            <button className="confirm-reservation" onClick={confirmReservation}>
              Confirmar reserva <Icon name="arrow" size={18} />
            </button>
          </section>
        </div>
      )}
      {cancelTarget && (
        <div className="reservation-modal-backdrop" role="presentation">
          <section className="reservation-modal" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title">
            <button className="modal-close" onClick={() => setCancelTarget(null)} aria-label="Cerrar">
              <Icon name="close" size={18} />
            </button>
            <span className="eyebrow">CANCELAR RESERVA</span>
            <h2 id="cancel-title">¿Seguro que quieres cancelarla?</h2>
            <div className="modal-book">
              <img src={cancelTarget.image} alt="" />
              <div><strong>{cancelTarget.title}</strong><span>{cancelTarget.author}</span></div>
            </div>
            <p className="muted">El ejemplar quedará libre para otros socios.</p>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setCancelTarget(null)}>Mantener reserva</button>
              <button className="confirm-reservation" onClick={cancelReservation}>Sí, cancelar</button>
            </div>
          </section>
        </div>
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
              <img src={reviewTarget.image} alt="" />
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
      {limitNotice && (
        <div className="limit-toast" role="status">
          <Icon name="book" size={20} />
          <div>
            <strong>Alcanzaste el máximo de préstamos</strong>
            <span>Devuelve o cancela una reserva para elegir otro libro.</span>
          </div>
          <button onClick={() => setLimitNotice(false)} aria-label="Cerrar aviso">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <footer>
        <button className="brand">
          <span>Herm</span>
          <i>es</i>
          <b>.</b>
        </button>
        <p>Biblioteca pública · Historias para todos.</p>
        <span>© 2025 Hermes</span>
      </footer>
    </div>
  );
}