// ⚠️ Datos de prueba exportados de Figma que TODAVÍA usan las vistas de "Mis reservas",
// "Préstamos" y "Multas" del portal de socios. El catálogo y la reserva (F3) ya usan el
// backend; estas vistas se conectan en sus propias tareas y entonces este archivo se borra.
// Los ids son negativos para que nunca choquen con los libros reales del catálogo.
import { addDays } from '../../utils/fechas';

export type Book = {
  id: number;
  title: string;
  author: string;
  genre: string;
  image: string;
  branch: string;
};

export type Status = 'activa' | 'retirado' | 'finalizada' | 'cancelada';

export type Reservation = Book & {
  rid: number;
  pickupBranch: string;
  status: Status;
  pickupDate: string; // fecha de retiro (vacía si aún no hay ejemplar)
  dueDate?: string; // fecha de devolución (libro retirado)
  returnedAt?: string;
};

const foto = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=700&q=85`;

const mockBooks: Book[] = [
  { id: -1, title: 'El gran Gatsby', author: 'F. Scott Fitzgerald', genre: 'Literatura clásica', image: foto('1535905557558-afc4877a26fc'), branch: 'Sede Central' },
  { id: -3, title: 'Orgullo y prejuicio', author: 'Jane Austen', genre: 'Literatura clásica', image: foto('1699443817739-cf2f7cbcd18d'), branch: 'Sede Central' },
  { id: -5, title: 'Crimen y castigo', author: 'Fiódor Dostoyevski', genre: 'Literatura clásica', image: foto('1722977735215-d28f2ac6efba'), branch: 'Sede Norte' },
  { id: -6, title: 'Ficciones', author: 'Jorge Luis Borges', genre: 'Cuentos', image: foto('1645199055511-7c9e27094e50'), branch: 'Sede Central' },
  { id: -10, title: 'Bestiario', author: 'Julio Cortázar', genre: 'Cuentos', image: foto('1579920279425-5c9c31e5b982'), branch: 'Sede Sur' },
  { id: -14, title: 'Fahrenheit 451', author: 'Ray Bradbury', genre: 'Ciencia ficción', image: foto('1699443817739-cf2f7cbcd18d'), branch: 'Sede Central' },
];
const [gatsby, orgullo, crimen, ficciones, bestiario, fahrenheit] = mockBooks;

export const seedReservations = (): Reservation[] => [
  { ...orgullo, rid: 1, pickupBranch: orgullo.branch, status: 'activa', pickupDate: addDays(2) },
  { ...gatsby, rid: 2, pickupBranch: gatsby.branch, status: 'retirado', pickupDate: addDays(-9), dueDate: addDays(6) },
  { ...ficciones, rid: 6, pickupBranch: ficciones.branch, status: 'retirado', pickupDate: addDays(-25), dueDate: addDays(-10) },
  { ...crimen, rid: 3, pickupBranch: crimen.branch, status: 'finalizada', pickupDate: addDays(-35), dueDate: addDays(-20), returnedAt: addDays(-24) },
  { ...fahrenheit, rid: 4, pickupBranch: fahrenheit.branch, status: 'finalizada', pickupDate: addDays(-70), dueDate: addDays(-55), returnedAt: addDays(-58) },
  { ...bestiario, rid: 5, pickupBranch: bestiario.branch, status: 'cancelada', pickupDate: addDays(-12) },
];

export const estimatedDates: Record<string, string> = {
  'Sede Central': '28 de junio',
  'Sede Norte': '1 de julio',
  'Sede Sur': '4 de julio',
};
