"""Seed de catálogo masivo desde Google Books (una sola corrida).

Uso: desde `backend/`:

    python -m app.seed_catalogo_google

Requiere `GOOGLE_BOOKS_API_KEY` en `backend/.env` (API gratuita; ~108 títulos,
una consulta por título con reintento por título-solo si falla la búsqueda con autor).

Idempotente:
- libro deduplica por ISBN (si no trae ISBN, por nombre exacto en minúsculas);
- ejemplar: sólo crea si falta uno en una sede (código `I-<sede>-<libro>`).

Crea 3 ejemplares por libro, uno por sede activa (asume `app.seeds` corrido antes).
El catálogo existente (los 3 libros sembrados a mano) se reutiliza, no se duplica.
"""

from __future__ import annotations

import sys
import time

from sqlalchemy import select, func

from app.config.database import SessionLocal
from app.integrations.googlebooks import buscar
from app.integrations.googlebooks.mapper import item_a_libro_dto
from app.models.ejemplar import Ejemplar
from app.models.enums import EstadoEjemplar
from app.models.sede import Sede
from app.repositories.ejemplar_repository import EjemplarRepository
from app.services.libro_service import crear_libro_desde_lookup

ejemplar_repo = EjemplarRepository()


def _mejor_item(items: list[dict]) -> dict | None:
    """Mejor item del resultado: preferimos el primero que traiga autores.

    Google a veces devuelve la edición en español correcta pero sin `volumeInfo.authors`;
    el segundo suele traerlos. Si ninguno trae autor, usamos el primero.
    """
    if not items:
        return None
    for item in items:
        if (item.get("volumeInfo") or {}).get("authors"):
            return item
    return items[0]


# (título, autor) — 108 títulos reales de literatura latinoamericana/española, clásica y juvenil.
TITULOS = [
    # García Márquez (6)
    ("Cien años de soledad", "Gabriel García Márquez"),
    ("El amor en los tiempos del cólera", "Gabriel García Márquez"),
    ("Crónica de una muerte anunciada", "Gabriel García Márquez"),
    ("El coronel no tiene quien le escriba", "Gabriel García Márquez"),
    ("Doce cuentos peregrinos", "Gabriel García Márquez"),
    ("Memoria de mis putas tristes", "Gabriel García Márquez"),
    # Cortázar (6)
    ("Rayuela", "Julio Cortázar"),
    ("Bestiario", "Julio Cortázar"),
    ("Final del juego", "Julio Cortázar"),
    ("Los premios", "Julio Cortázar"),
    ("Todos los fuegos el fuego", "Julio Cortázar"),
    ("Historias de cronopios y de famas", "Julio Cortázar"),
    # Borges (7)
    ("Ficciones", "Jorge Luis Borges"),
    ("El Aleph", "Jorge Luis Borges"),
    ("El libro de arena", "Jorge Luis Borges"),
    ("El hacedor", "Jorge Luis Borges"),
    ("Otras inquisiciones", "Jorge Luis Borges"),
    ("Historia universal de la infamia", "Jorge Luis Borges"),
    ("El informe de Brodie", "Jorge Luis Borges"),
    # Sábato (3)
    ("El túnel", "Ernesto Sabato"),
    ("Sobre héroes y tumbas", "Ernesto Sabato"),
    ("Abaddón el exterminador", "Ernesto Sabato"),
    # Piglia (4)
    ("Respiración artificial", "Ricardo Piglia"),
    ("Nombre falso", "Ricardo Piglia"),
    ("La ciudad ausente", "Ricardo Piglia"),
    ("Plata quemada", "Ricardo Piglia"),
    # Saer (4)
    ("El limonero real", "Juan José Saer"),
    ("El entenado", "Juan José Saer"),
    ("Glosa", "Juan José Saer"),
    ("El río sin orillas", "Juan José Saer"),
    # Tomás Eloy Martínez (4)
    ("Santa Evita", "Tomás Eloy Martínez"),
    ("La novela de Perón", "Tomás Eloy Martínez"),
    ("El cantor de tango", "Tomás Eloy Martínez"),
    ("Mascaró", "Haroldo Conti"),
    # Onetti (3)
    ("El astillero", "Juan Carlos Onetti"),
    ("La vida breve", "Juan Carlos Onetti"),
    ("Los adioses", "Juan Carlos Onetti"),
    # Arlt (3)
    ("Los siete locos", "Roberto Arlt"),
    ("Los lanzallamas", "Roberto Arlt"),
    ("El juguete rabioso", "Roberto Arlt"),
    # Bioy Casares (2)
    ("La invención de Morel", "Adolfo Bioy Casares"),
    ("El sueño de los héroes", "Adolfo Bioy Casares"),
    # Silvina Ocampo (2)
    ("Viaje olvidado", "Silvina Ocampo"),
    ("Cornelia frente al espejo", "Silvina Ocampo"),
    # Quiroga (2)
    ("Cuentos de la selva", "Horacio Quiroga"),
    ("Cuentos de amor de locura y de muerte", "Horacio Quiroga"),
    # Hernández / Güiraldes / Rivera / Isaacs (4)
    ("Martín Fierro", "José Hernández"),
    ("Don Segundo Sombra", "Ricardo Güiraldes"),
    ("La vorágine", "José Eustasio Rivera"),
    ("María", "Jorge Isaacs"),
    # Vargas Llosa (5)
    ("La ciudad y los perros", "Mario Vargas Llosa"),
    ("Conversación en La Catedral", "Mario Vargas Llosa"),
    ("La fiesta del chivo", "Mario Vargas Llosa"),
    ("La tía Julia y el escribidor", "Mario Vargas Llosa"),
    ("Travesuras de la niña mala", "Mario Vargas Llosa"),
    # Allende (3)
    ("La casa de los espíritus", "Isabel Allende"),
    ("De amor y de sombra", "Isabel Allende"),
    ("Eva Luna", "Isabel Allende"),
    # Esquivel / Donoso / Carpentier / Ribeyro / Revueltas / Rulfo (7)
    ("Como agua para chocolate", "Laura Esquivel"),
    ("El obsceno pájaro de la noche", "José Donoso"),
    ("El reino de este mundo", "Alejo Carpentier"),
    ("El siglo de las luces", "Alejo Carpentier"),
    ("La palabra del mudo", "Julio Ramón Ribeyro"),
    ("El apando", "José Revueltas"),
    ("Pedro Páramo", "Juan Rulfo"),
    # Rulfo, Soriano, Conti, Puig (4)
    ("El llano en llamas", "Juan Rulfo"),
    ("Cuarteles de invierno", "Osvaldo Soriano"),
    ("En vida", "Haroldo Conti"),
    ("El beso de la mujer araña", "Manuel Puig"),
    # Ruiz Zafón (4)
    ("La sombra del viento", "Carlos Ruiz Zafón"),
    ("El príncipe de la niebla", "Carlos Ruiz Zafón"),
    ("Marina", "Carlos Ruiz Zafón"),
    ("El prisionero del cielo", "Carlos Ruiz Zafón"),
    # Cervantes / Lazarillo / Celestina / Cid (4)
    ("Don Quijote de la Mancha", "Miguel de Cervantes"),
    ("Lazarillo de Tormes", "Anónimo"),
    ("La Celestina", "Fernando de Rojas"),
    ("Cantar de Mio Cid", "Anónimo"),
    # Galdós / Clarín / Calderón (4)
    ("Fortunata y Jacinta", "Benito Pérez Galdós"),
    ("Doña Perfecta", "Benito Pérez Galdós"),
    ("La Regenta", "Leopoldo Alas"),
    ("La vida es sueño", "Pedro Calderón de la Barca"),
    # Neruda / Lorca (4)
    ("Veinte poemas de amor y una canción desesperada", "Pablo Neruda"),
    ("Residencia en la tierra", "Pablo Neruda"),
    ("La casa de Bernarda Alba", "Federico García Lorca"),
    ("Bodas de sangre", "Federico García Lorca"),
    # Shakespeare / Molière / Goethe (6)
    ("Hamlet", "William Shakespeare"),
    ("Macbeth", "William Shakespeare"),
    ("Romeo y Julieta", "William Shakespeare"),
    ("Tartufo", "Molière"),
    ("El avaro", "Molière"),
    ("Fausto", "Johann Wolfgang von Goethe"),
    # Woolf / Austen / Brontë / Melville / Verne / Dahl / Tolkien / Lewis / Saint-Exupéry (9)
    ("Mrs Dalloway", "Virginia Woolf"),
    ("Orgullo y prejuicio", "Jane Austen"),
    ("Cumbres borrascosas", "Emily Brontë"),
    ("Moby Dick", "Herman Melville"),
    ("Veinte mil leguas de viaje submarino", "Julio Verne"),
    ("Matilda", "Roald Dahl"),
    ("El hobbit", "J. R. R. Tolkien"),
    ("El león, la bruja y el armario", "C. S. Lewis"),
    ("El principito", "Antoine de Saint-Exupéry"),
    # Serie Harry Potter (8)
    ("Harry Potter y la piedra filosofal", "J. K. Rowling"),
    ("Harry Potter y la cámara secreta", "J. K. Rowling"),
    ("Harry Potter y el prisionero de Azkaban", "J. K. Rowling"),
    ("Harry Potter y el cáliz de fuego", "J. K. Rowling"),
    ("Harry Potter y la Orden del Fénix", "J. K. Rowling"),
    ("Harry Potter y el misterio del príncipe", "J. K. Rowling"),
    ("Harry Potter y las reliquias de la muerte", "J. K. Rowling"),
    ("Harry Potter y el legado maldito", "J. K. Rowling"),
]


def main() -> None:
    ok = nuevos_ejemplares = 0
    fallidos = []
    with SessionLocal() as session:
        sedes = list(
            session.scalars(select(Sede).where(Sede.activo.is_(True)).order_by(Sede.id))
        )
        if not sedes:
            print("No hay sedes activas; corré primero `python -m app.seeds`.", file=sys.stderr)
            sys.exit(1)

        print(f"Sembrando {len(TITULOS)} títulos desde Google Books (sedes: {[s.nombre for s in sedes]})")
        for i, (titulo, autor) in enumerate(TITULOS, 1):
            try:
                items = buscar(f'intitle:"{titulo}" inauthor:"{autor}"', max_results=4)
                if not items:
                    items = buscar(f'intitle:"{titulo}"', max_results=4)
            except Exception as e:  # noqa: BLE001 — la importación debe tolerar fallos de red
                print(f"[{i}/{len(TITULOS)}] ✗ {titulo} — {autor} (error: {e})")
                fallidos.append(f"{titulo} — {autor}")
                time.sleep(0.3)
                continue
            item = _mejor_item(items)
            if item is None:
                print(f"[{i}/{len(TITULOS)}] ✗ {titulo} — {autor} (no encontrado)")
                fallidos.append(f"{titulo} — {autor}")
                time.sleep(0.3)
                continue

            dto = item_a_libro_dto(item)
            libro, es_nuevo = crear_libro_desde_lookup(session, dto)
            session.flush()

            existentes = ejemplar_repo.listar_por_libro(session, libro.id)
            creados = 0
            for sede in sedes:
                if any(e.sede_actual_id == sede.id for e in existentes):
                    continue
                session.add(
                    Ejemplar(
                        codigo_inventario=f"I-{sede.id}-{libro.id}",
                        estado=EstadoEjemplar.DISPONIBLE,
                        libro_id=libro.id,
                        sede_origen_id=sede.id,
                        sede_actual_id=sede.id,
                    )
                )
                creados += 1
            nuevos_ejemplares += creados
            session.commit()
            ok += 1
            tag = "nuevo" if es_nuevo else "reusa"
            print(f"[{i}/{len(TITULOS)}] ✓ {libro.nombre[:60]} ({tag}, +{creados} ej.)")
            time.sleep(0.3)

    print()
    print(f"Listo: {ok} libros procesados, {nuevos_ejemplares} ejemplares creados.")
    if fallidos:
        print("Sin resultado / con error (se saltearon):")
        for f in fallidos:
            print(f"  - {f}")


if __name__ == "__main__":
    main()
