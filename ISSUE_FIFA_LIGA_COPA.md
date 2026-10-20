# [Juego] Agregar juego "FIFA" (Liga / Copa)

## Objetivo
Agregar un nuevo juego al módulo **Juegos** de Juntadadpp llamado **FIFA**, que permita jugar partidos registrados manualmente desde la app, llevando el historial, tabla/cuadro y siempre indicando el próximo partido a disputar.

## Modos de juego
Al crear una partida de FIFA se debe poder elegir entre dos modos:

- **Liga** (todos contra todos)
- **Copa** (eliminación directa)

## Flujo general
- Al iniciar la partida se seleccionan los **equipos/jugadores participantes** (mismos mecanismos que usan los otros juegos del módulo).
- Se genera el calendario según el modo elegido.
- La UI debe mostrar siempre **"Próximo partido a jugar"** (equipos enfrentados).
- Al **registrar el resultado** del partido actual, se debe **actualizar automáticamente al siguiente partido** a jugar.
- Se debe llevar el **historial de partidos jugados** con su resultado.
- Los partidos se registran manualmente desde la app (se asume que se juegan en consola).

## Modo LIGA

### Configuración
- **Por defecto: sin límite / "infinito"**. Es decir, no cortar la liga por cantidad fija de partidos totales a menos que el usuario lo especifique.
- **Configurable: "Partidos contra cada equipo"**. 
  - Valor por defecto: `1`? o permitir "Sin límite". Si se deja sin límite, se generan partidos según lo que corresponda hasta decidir cortar manualmente? O bien el comportamiento por defecto es generar con `1` partido contra cada equipo pero con la opción de poner `2`, `3`, etc.
  - Ejemplo con 3 equipos (A,B,C):
    - `1 partido contra cada equipo` -> cada equipo juega **2** partidos (A vs B, A vs C)
    - `2 partidos contra cada equipo` -> cada equipo juega **4** partidos
- La cantidad total de partidos debe calcularse correctamente según **cantidad de equipos × partidos contra cada equipo × (n-1)/...** teniendo en cuenta enfrentamientos entre todos los participantes.

### Clasificación
Se debe mostrar una **tabla de posiciones** con al menos:
- Posición
- Equipo/Jugador
- PJ (Partidos Jugados)
- PG (Partidos Ganados)
- PE (Partidos Empatados)
- PP (Partidos Perdidos)
- GF (Goles a favor)
- GC (Goles en contra)
- DIF (Diferencia)
- PTS (Puntos)

Reglas de puntos a definir de forma clara (sugerido: victoria 3, empate 1, derrota 0). Mantener consistente con lo esperado para FIFA.

### Comportamiento
- Mostrar tabla actualizada tras registrar cada resultado.
- Seguir mostrando próximo partido mientras existan partidos pendientes o mientras esté en modo "infinito" y el usuario quiera seguir jugando (ver criterios de finalización).
- Permitir seguir agregando/enfrentando según la configuración elegida.

## Modo COPA

### Configuración
- Formato **eliminación directa**.
- Permitir cantidad de participantes acorde a cuadro (ideal poder armar con 2,4,8,... o manejar byes si no es potencia de 2). Definir comportamiento razonable.
- Al crear la copa se debe generar el **cuadro de eliminación** (llaves/rondas).

### Comportamiento
- Mostrar **cuadro de eliminación** con rondas, partidos, ganadores avanzando automáticamente.
- Mostrar siempre **próximo partido a jugar**.
- Al registrar resultado, el **ganador avanza** a la siguiente ronda y se actualiza el cuadro.
- En caso de empate **¿cómo resolver?**: definir mecanismo (penales / sorteo / volver a pedir resultado con desempate). Proponer una opción clara en la implementación (ej: permitir cargar resultado con ganador por desempate o agregar campo "ganador por penales").
- Mostrar campeón al finalizar el torneo.

## Requisitos técnicos

### Dominio (`src/domain/games/fifa/`)
Crear lógica pura, testeable y sin dependencias de RN/Expo.

Sugerido:
- `fifa.types.ts` - Tipos (modo, equipo, partido, resultado, tabla, cuadro, estado)
- `fifa.rules.ts` - Cálculo de calendario (liga con `matchesPerOpponent` + modo infinito), generación de cuadro copa, puntos, clasificación, avance de copa
- `fifa.state.ts` / helpers - Transiciones: registrar resultado -> actualizar estado -> calcular próximo partido
- Tests unitarios en `tests/domain/games/fifa/` cubriendo:
  - Generación liga con 3 equipos, 1 vs cada uno
  - Generación liga con 3 equipos, 2 vs cada uno
  - Cálculo de tabla tras varios resultados
  - Generación copa y avance de ganador
  - Determinación de "próximo partido"
  - Actualización al registrar resultado

### Persistencia / Integración
- Integrar con el esquema/modelo de juegos existente (seguir el patrón de Truco/Generala/Skull King).
- Guardar estado completo de la partida FIFA (modo, config, participantes, partidos, resultados, tabla/cuadro, histórico).
- Poder reanudar la partida desde el historial.

### UI
- Agregar FIFA a la lista de juegos disponibles en el flujo de "Agregar juego" de una juntada.
- Pantalla/scorer específico para FIFA:
  - Selector de modo (Liga/Copa)
  - Configuración: participantes + (Liga) "Partidos contra cada equipo" (permite vacío/infinito o valor numérico). 
  - Vista **"Próximo partido"** prominente
  - Formulario para **registrar resultado** (goles/equipos + validación)
  - **Tabla** (modo Liga)
  - **Cuadro/Brackets** (modo Copa)
  - **Historial de partidos**
  - Botón/flujo que tras guardar resultado lleve al próximo partido

## Criterios de aceptación
- [ ] Se puede crear una partida FIFA eligiendo **Liga** o **Copa**
- [ ] En **Liga**, por defecto se comporta sin límite; se puede configurar **"partidos contra cada equipo"** (1 -> rota correctamente, 2 -> duplica enfrentamientos)
- [ ] En **Liga** se visualiza **tabla de posiciones** actualizada al registrar resultados
- [ ] En **Copa** se visualiza **cuadro de eliminación** y el ganador avanza correctamente
- [ ] Siempre se muestra **cuál es el próximo partido a jugar**
- [ ] Al registrar el resultado del partido, la app pasa **automáticamente** al próximo partido
- [ ] Se registra el resultado y se lleva la **cuenta/historial** de partidos
- [ ] Lógica en `src/domain/games/fifa/` con tests unitarios
- [ ] Integrado al módulo de juegos siguiendo convenciones del proyecto
- [ ] `npm run typecheck`, `npm run lint`, `npm test` pasan

## Notas de implementación
- Mantener **inglés** en código/tipos, **español** en textos de UI (siguiendo convenciones de `README.md`).
- Toda la lógica de negocio debe vivir en `src/domain` (nunca en componentes).
- Seguir estructura y patrones existentes para agregar un nuevo juego.
- Definir explícitamente el comportamiento de "liga infinita" (ej: si no hay límite, seguir generando siguiente ronda/enfrentamiento según configuración o permitir "generar siguiente fecha" sin tope).