"""
Juegos dentro de las llamadas de voz: ta-te-ti y piedra, papel o tijera.

La lógica corre en el SERVIDOR (no en el navegador): así nadie puede hacer
trampa mandando jugadas inválidas, y en piedra-papel-tijera nadie ve lo que
eligió el otro hasta que los dos eligieron.

Cada canal de voz tiene como máximo un juego activo. Todo vive en memoria,
como los participantes de la llamada. Quien gana suma puntos en el
scoreboard del servidor.
"""

from dataclasses import dataclass, field

PUNTOS_POR_GANAR = {"tateti": 3, "ppt": 2}
NOMBRES = {"tateti": "ta-te-ti", "ppt": "piedra, papel o tijera"}
OPCIONES_PPT = ("piedra", "papel", "tijera")
GANA_A = {"piedra": "tijera", "papel": "piedra", "tijera": "papel"}
LINEAS_TATETI = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),  # filas
    (0, 3, 6), (1, 4, 7), (2, 5, 8),  # columnas
    (0, 4, 8), (2, 4, 6),  # diagonales
]
RONDAS_PARA_GANAR_PPT = 2  # al mejor de 3


class JugadaInvalida(Exception):
    """Se le avisa solo a quien hizo la jugada (no corta la llamada)."""


@dataclass
class Juego:
    tipo: str  # 'tateti' o 'ppt'
    jugadores: list[int]  # ids de usuario; el primero es quien lo creó
    nombres: dict[int, str]
    estado: str = "esperando"  # 'esperando' | 'jugando' | 'terminado'
    ganador: int | None = None
    empate: bool = False
    # ta-te-ti
    tablero: list[int | None] = field(default_factory=lambda: [None] * 9)
    turno: int | None = None
    linea_ganadora: tuple[int, int, int] | None = None
    # piedra, papel o tijera
    elecciones: dict[int, str] = field(default_factory=dict)
    marcador: dict[int, int] = field(default_factory=dict)
    ultima_ronda: dict | None = None

    # ---------- Acciones ----------
    def unirse(self, usuario_id: int, nombre: str) -> None:
        if self.estado != "esperando":
            raise JugadaInvalida("El juego ya empezó")
        if usuario_id in self.jugadores:
            raise JugadaInvalida("Ya estás en este juego")
        self.jugadores.append(usuario_id)
        self.nombres[usuario_id] = nombre
        self.estado = "jugando"
        self.turno = self.jugadores[0]
        self.marcador = {j: 0 for j in self.jugadores}

    def jugar(self, usuario_id: int, datos: dict) -> None:
        if self.estado != "jugando":
            raise JugadaInvalida("El juego no está en curso")
        if usuario_id not in self.jugadores:
            raise JugadaInvalida("No estás jugando esta partida")
        if self.tipo == "tateti":
            self._jugar_tateti(usuario_id, datos.get("casilla"))
        else:
            self._jugar_ppt(usuario_id, datos.get("eleccion"))

    def _jugar_tateti(self, usuario_id: int, casilla) -> None:
        if usuario_id != self.turno:
            raise JugadaInvalida("No es tu turno")
        if not isinstance(casilla, int) or not 0 <= casilla <= 8 or self.tablero[casilla] is not None:
            raise JugadaInvalida("Esa casilla no está libre")
        self.tablero[casilla] = usuario_id
        for linea in LINEAS_TATETI:
            a, b, c = (self.tablero[i] for i in linea)
            if a is not None and a == b == c:
                self._terminar(ganador=a)
                self.linea_ganadora = linea
                return
        if all(c is not None for c in self.tablero):
            self._terminar(ganador=None)
            return
        self.turno = self.jugadores[1] if usuario_id == self.jugadores[0] else self.jugadores[0]

    def _jugar_ppt(self, usuario_id: int, eleccion) -> None:
        if eleccion not in OPCIONES_PPT:
            raise JugadaInvalida("Elegí piedra, papel o tijera")
        if usuario_id in self.elecciones:
            raise JugadaInvalida("Ya elegiste en esta ronda")
        self.elecciones[usuario_id] = eleccion
        if len(self.elecciones) < 2:
            return
        # Los dos eligieron: se resuelve la ronda.
        a, b = self.jugadores
        ea, eb = self.elecciones[a], self.elecciones[b]
        ganador_ronda = None if ea == eb else (a if GANA_A[ea] == eb else b)
        if ganador_ronda is not None:
            self.marcador[ganador_ronda] += 1
        self.ultima_ronda = {"elecciones": {str(k): v for k, v in self.elecciones.items()}, "ganador": ganador_ronda}
        self.elecciones = {}
        if ganador_ronda is not None and self.marcador[ganador_ronda] >= RONDAS_PARA_GANAR_PPT:
            self._terminar(ganador=ganador_ronda)

    def _terminar(self, ganador: int | None) -> None:
        self.estado = "terminado"
        self.ganador = ganador
        self.empate = ganador is None
        self.turno = None

    # ---------- Lo que ven todos ----------
    def publico(self) -> dict:
        datos = {
            "tipo": self.tipo,
            "nombre": NOMBRES[self.tipo],
            "jugadores": [{"usuario_id": j, "username": self.nombres[j]} for j in self.jugadores],
            "estado": self.estado,
            "ganador": self.ganador,
            "empate": self.empate,
            "puntos_por_ganar": PUNTOS_POR_GANAR[self.tipo],
        }
        if self.tipo == "tateti":
            datos.update(tablero=self.tablero, turno=self.turno, linea_ganadora=self.linea_ganadora)
        else:
            # Solo se dice QUIÉN ya eligió, no QUÉ eligió.
            datos.update(
                ya_eligieron=list(self.elecciones.keys()),
                marcador={str(k): v for k, v in self.marcador.items()},
                ultima_ronda=self.ultima_ronda,
            )
        return datos


def crear_juego(tipo: str, usuario_id: int, nombre: str) -> Juego:
    if tipo not in PUNTOS_POR_GANAR:
        raise JugadaInvalida("Juego desconocido")
    return Juego(tipo=tipo, jugadores=[usuario_id], nombres={usuario_id: nombre})
