# Rol

Actuá como **Senior Software Architect + Product Engineer + UX/UI Designer**.

Quiero que construyas desde cero una aplicación mobile para organizar juntadas de amigos. La aplicación debe tener una arquitectura limpia, mantenible y preparada para agregar nuevas funcionalidades en el futuro.

Antes de comenzar a implementar código, quiero que analices el requerimiento, detectes ambigüedades y me hagas todas las preguntas necesarias para definir correctamente el alcance.

**No empieces a programar hasta que las dudas importantes de producto, UX, arquitectura y funcionalidad hayan sido respondidas.**

---

# 1. Objetivo general

La aplicación está pensada para juntadas de amigos y debe resolver principalmente dos problemas:

1. **Dividir gastos de una juntada**
2. **Llevar el puntaje de juegos de mesa/cartas**

La aplicación debe priorizar:

- Rapidez para crear una juntada.
- Poco ingreso manual de información.
- Reutilización de grupos de amigos frecuentes.
- Buena experiencia mobile.
- Interfaz simple e intuitiva.
- Funcionamiento offline cuando sea razonable.
- Persistencia local de la información.
- Arquitectura preparada para agregar funcionalidades posteriormente.

La aplicación debe sentirse como una herramienta que uno puede abrir durante una juntada y utilizar en pocos segundos.

---

# 2. Módulo: Gastos de juntadas

Debe existir una sección para registrar y dividir gastos.

## Crear una juntada

El usuario debe poder crear una juntada indicando, como mínimo:

- Nombre de la juntada.
- Fecha.
- Personas participantes.

Las personas participantes pueden agregarse de dos maneras:

### Grupos predeterminados

El usuario debe poder crear y guardar grupos de amigos frecuentes.

Por ejemplo:

- "Los pibes"
- "Familia"
- "Fútbol"
- "Trabajo"

Al crear una juntada se debe poder seleccionar uno de estos grupos y cargar automáticamente todos sus integrantes.

Debe ser posible modificar los participantes después de seleccionar el grupo.

Por ejemplo:

> Grupo "Los pibes" → 8 personas → esta juntada solamente participan 6.

### Participantes individuales

También debe ser posible crear una juntada sin utilizar un grupo existente y agregar personas manualmente.

Una persona debería poder reutilizarse en diferentes juntadas sin tener que crearla nuevamente.

---

# 3. Registro de gastos

Dentro de una juntada se deben poder agregar gastos.

Cada gasto debería contemplar, como mínimo:

- Descripción.
- Monto.
- Persona que pagó.
- Personas que participan de ese gasto.

Ejemplo:

Juntada:

> Asado - 8 personas

Gastos:

> Juan pagó $30.000 por la carne  
> Pedro pagó $10.000 por bebidas  
> Martín pagó $5.000 por carbón

La aplicación debe calcular automáticamente cuánto corresponde pagar a cada participante.

---

# 4. División de gastos

La aplicación debe permitir diferentes estrategias para dividir gastos.

Como mínimo quiero contemplar:

### División igualitaria

Si un gasto de $30.000 corresponde a 6 personas:

> $5.000 por persona.

Pero debe existir la posibilidad de que un gasto solamente corresponda a algunas personas.

Ejemplo:

> Pizza $20.000  
> Participan solamente Juan, Pedro y Martín.

Cada uno debería deber:

> $6.666,67

La aplicación debe contemplar correctamente los redondeos.

---

# 5. Liquidación de gastos

Este punto es MUY IMPORTANTE.

Una vez registrados todos los gastos, la aplicación debe calcular quién le debe dinero a quién.

Quiero tener al menos dos modos:

## Modo 1 — Devolver directamente a cada persona que pagó

Ejemplo:

Juan pagó $30.000.

Pedro debe $5.000 a Juan.

Martín debe $5.000 a Juan.

Etc.

Este modo conserva las deudas directamente relacionadas con los pagos originales.

## Modo 2 — Minimizar cantidad de transferencias

Este debe ser el **modo predeterminado**.

La aplicación debe calcular una distribución que minimice la cantidad de pagos necesarios entre las personas.

Ejemplo:

En lugar de:

> Pedro → Juan $5.000  
> Martín → Juan $5.000  
> Lucas → Pedro $3.000  
> etc.

buscar una solución equivalente que minimice la cantidad total de transferencias.

La aplicación debe mostrar claramente:

- Quién paga.
- A quién paga.
- Cuánto.
- Cantidad total de transferencias.

Ejemplo visual:

```text
💸 Pagos necesarios

Pedro
  ↓ $8.500
Juan

Martín
  ↓ $4.200
Lucas

Total de transferencias: 2
```

El algoritmo debe garantizar que la solución sea financieramente equivalente a la deuda original.

---

# 6. Historial de gastos

Cada juntada debería quedar guardada.

El usuario debería poder consultar:

- Juntadas anteriores.
- Participantes.
- Gastos.
- Quién pagó.
- Liquidación.
- Fecha.
- Total gastado.

También debería ser posible volver a abrir una juntada y consultar sus datos.

Definir durante la etapa de preguntas si las juntadas finalizadas pueden editarse o si deben quedar bloqueadas.

---

# 7. Módulo: Anotador de juegos

La segunda funcionalidad principal será un anotador para juegos.

Debe existir una sección donde el usuario pueda seleccionar un juego y comenzar una partida.

Inicialmente quiero soportar:

- Truco.
- Generala.
- Skull King.
- Otros juegos que puedan agregarse posteriormente.

La arquitectura debe permitir agregar nuevos juegos sin tener que modificar completamente el sistema.

Idealmente cada juego debería poder definir:

- Cantidad de jugadores permitida.
- Sistema de puntuación.
- Reglas específicas.
- Cómo comienza una partida.
- Cómo se registra una ronda.
- Cómo termina la partida.
- Condición de victoria.

---

# 8. Jugadores

Para comenzar una partida se deben poder agregar jugadores.

Debe funcionar de manera similar a los grupos de amigos de gastos.

### Grupos predeterminados

El usuario puede tener grupos frecuentes.

Ejemplo:

```text
Grupo: Los pibes

Juan
Pedro
Martín
Lucas
Nico
```

Al iniciar un juego puede seleccionar directamente:

> Los pibes

y cargar automáticamente esos jugadores.

También debe poder modificar la lista para una partida específica.

Ejemplo:

```text
Los pibes

☑ Juan
☑ Pedro
☑ Martín
☐ Lucas
☑ Nico
```

### Jugadores individuales

También debe poder comenzar una partida agregando jugadores manualmente.

---

# 9. Anotador

Durante una partida debe existir una pantalla donde se pueda registrar el puntaje de cada jugador.

Debe ser rápida de utilizar desde un celular.

Por ejemplo:

```text
TRUCO

Juan       15
Pedro      12
Martín      8
Lucas       4

----------------

Nueva ronda
```

Dependiendo del juego, la interfaz deberá adaptarse a las reglas específicas.

No quiero simplemente un formulario genérico de "sumar puntos" si el juego necesita reglas específicas.

---

# 10. Historial de partidas

Las partidas deberían quedar almacenadas.

El usuario debería poder consultar:

- Juego.
- Fecha.
- Jugadores.
- Resultado.
- Puntajes.
- Ganador.
- Rondas.

También sería interesante dejar preparada la arquitectura para estadísticas futuras.

Ejemplos de futuras funcionalidades:

- Victorias por jugador.
- Porcentaje de victorias.
- Promedio de puntos.
- Historial contra determinados amigos.
- Ranking entre amigos.

No necesariamente implementarlas ahora, pero la arquitectura debería permitir agregarlas posteriormente.

---

# 11. Grupos de amigos

Los grupos son una funcionalidad transversal.

Debe existir una sección donde administrar:

### Personas

Cada persona debería poder tener:

- Nombre.
- Identificador interno.
- Opcionalmente avatar/color.
- Otros datos que consideres necesarios.

### Grupos

Cada grupo debería tener:

- Nombre.
- Lista de personas.

Ejemplos:

```text
Mis grupos

👥 Los pibes
   Juan
   Pedro
   Martín
   Lucas

⚽ Fútbol
   Juan
   Nico
   Martín

👨‍👩‍👦 Familia
   ...
```

Los grupos deben poder utilizarse tanto para:

- Gastos.
- Juegos.

Debe existir una única fuente de verdad para personas y grupos.

---

# 12. UX/UI

Quiero una aplicación moderna y pensada específicamente para mobile.

Prioridades:

1. Velocidad.
2. Simplicidad.
3. Pocos pasos.
4. Buena legibilidad durante una juntada.
5. Botones grandes y fáciles de tocar.
6. Feedback visual claro.
7. Estados vacíos bien diseñados.
8. Confirmaciones para acciones destructivas.
9. Buena navegación.

Pensar especialmente en el contexto real:

> Hay varias personas hablando, ruido, poca atención disponible y el usuario quiere registrar algo rápidamente.

Evitar interfaces excesivamente complejas.

Proponer una navegación apropiada, por ejemplo:

```text
Inicio
├── Juntada
│   ├── Gastos
│   └── Juegos
│
├── Gastos
│   └── Historial
│
├── Juegos
│   └── Historial
│
└── Grupos
```

Pero no asumir esta navegación como definitiva. Evaluarla y proponer una alternativa si considerás que existe una mejor UX.

---

# 13. Persistencia

Quiero que la aplicación conserve la información aunque se cierre.

Priorizar una estrategia local/offline-first.

La aplicación debería poder utilizarse sin conexión a Internet para las funcionalidades principales.

En esta primera versión NO asumir que necesitamos backend, login o sincronización entre dispositivos.

Primero evaluar si tiene sentido construir una aplicación completamente local.

Si considerás que alguna funcionalidad requiere backend, explicá por qué antes de implementarla.

---

# 14. Arquitectura

Quiero una arquitectura limpia y mantenible.

Separar claramente:

- UI.
- Estado.
- Dominio.
- Persistencia.
- Lógica de negocio.
- Algoritmos.
- Reglas específicas de cada juego.

La lógica para calcular deudas NO debe estar mezclada con componentes visuales.

La lógica de cada juego tampoco debe estar acoplada a las pantallas.

Por ejemplo, conceptualmente:

```text
UI
 ↓
Application / Use Cases
 ↓
Domain
 ├── Expenses
 ├── Groups
 ├── People
 └── Games
      ├── Truco
      ├── Generala
      └── Skull King
 ↓
Persistence
```

El objetivo es poder agregar posteriormente:

```text
Nuevo juego
Nuevo tipo de gasto
Estadísticas
Sincronización
Backend
Login
Compartir juntadas
```

sin tener que reescribir la aplicación.

---

# 15. Tecnología

Antes de elegir el stack definitivo, analizá las necesidades de la aplicación.

Preferencia inicial:

- React Native.
- TypeScript.
- Expo si resulta conveniente.
- Persistencia local apropiada para React Native.
- Arquitectura modular.

Pero no quiero que tomes estas decisiones como absolutas.

Si existe una alternativa técnicamente superior para este proyecto, explicala y proponela.

Antes de implementar, quiero que definas:

- Framework.
- Lenguaje.
- Navegación.
- Manejo de estado.
- Persistencia.
- Testing.
- Linting.
- Formatting.
- Estructura de carpetas.
- Manejo de errores.
- Estrategia de migraciones de datos.
- Estrategia para agregar nuevos juegos.

---

# 16. Testing

El proyecto debe tener tests.

Como mínimo quiero tests para:

### Gastos

- División igualitaria.
- Gastos con participantes diferentes.
- Persona que paga y participa.
- Persona que paga pero no participa.
- Múltiples gastos.
- Balances positivos/negativos.
- Redondeos.
- Cálculo de deudas.
- Algoritmo de minimización de transferencias.
- Casos donde una persona debe pagar a varias.
- Casos donde una persona cobra de varias.
- Casos donde se puede reducir la cantidad de transferencias.

### Juegos

Tests unitarios para la lógica de cada juego.

Ejemplo:

```text
Truco
Generala
Skull King
```

La lógica de negocio debe ser testeable sin necesidad de renderizar componentes React Native.

---

# 17. Documentación y contexto permanente del proyecto

Esta parte es MUY IMPORTANTE.

Quiero que el proyecto tenga un archivo:

```text
CONTEXT.md
```

Este archivo funcionará como el contexto permanente del proyecto para futuras sesiones de desarrollo con OpenCode.

Su objetivo es que otro agente pueda entender rápidamente el proyecto sin tener que leer todo el código.

Debe contener como mínimo:

```text
# Project Context

## Project Overview

## Product Goals

## Current Features

## Architecture

## Tech Stack

## Folder Structure

## Domain Model

## Data Model

## Main Business Rules

## Expense Calculation

## Debt Minimization Algorithm

## Games Architecture

## Supported Games

## Navigation

## State Management

## Persistence

## Testing Strategy

## Important Design Decisions

## Known Limitations

## Future Features

## Development Guidelines

## How To Add A New Game

## How To Add A New Feature

## Important Files

## Current Project Status
```

El archivo debe mantenerse actualizado.

Cada vez que una nueva funcionalidad importante sea implementada o se tome una decisión arquitectónica relevante, actualizar `CONTEXT.md`.

No quiero que sea una documentación gigantesca que repita todo el código.

Debe ser un **resumen de alto valor para agentes de IA**.

El objetivo es que ante una futura tarea pueda decir:

> "Leé CONTEXT.md y agregá estadísticas de victorias"

y el agente pueda entender rápidamente dónde y cómo implementar la funcionalidad.

---

# 18. ADRs / decisiones arquitectónicas

Evaluá también la creación de:

```text
docs/adr/
```

para decisiones arquitectónicas importantes.

Por ejemplo:

```text
docs/adr/
├── 001-local-first.md
├── 002-expense-debt-algorithm.md
├── 003-games-architecture.md
└── ...
```

No crear ADRs innecesariamente. Utilizarlos solamente cuando exista una decisión técnica relevante que valga la pena conservar.

---

# 19. README

Crear un `README.md` que explique:

- Qué es el proyecto.
- Funcionalidades.
- Stack.
- Cómo instalar.
- Cómo ejecutar.
- Cómo ejecutar tests.
- Estructura general.
- Convenciones.
- Cómo agregar un juego.
- Cómo contribuir.

El README debe ser más orientado a desarrolladores.

`CONTEXT.md` debe estar orientado principalmente a agentes de IA que necesiten continuar el desarrollo.

---

# 20. Reglas para el desarrollo

Seguí estas reglas:

1. No inventes requerimientos importantes.
2. Si algo no está definido y puede afectar arquitectura o UX, preguntame.
3. Antes de implementar funcionalidades grandes, proponé la solución.
4. Priorizá soluciones simples.
5. Evitá sobreingeniería.
6. No agregues dependencias innecesarias.
7. Mantené separación entre UI y lógica de negocio.
8. Escribí código TypeScript fuertemente tipado.
9. Evitá `any` salvo que exista una razón justificada.
10. Todo algoritmo importante debe tener tests.
11. Los nombres de variables, clases, funciones y archivos deben estar en inglés.
12. La documentación técnica debe estar en inglés, salvo que te indique lo contrario.
13. La UI puede estar preparada para internacionalización desde el principio.
14. No implementes backend si no es necesario.
15. No implementes autenticación si no es necesaria.
16. No agregues funcionalidades "porque podrían ser útiles" sin consultarme.
17. Antes de borrar o modificar datos de manera destructiva, considerar confirmaciones y recuperación.
18. Mantener `CONTEXT.md` actualizado.

---

# 21. Flujo obligatorio antes de programar

Antes de crear código:

### Paso 1

Analizá todo este requerimiento.

### Paso 2

Identificá:

- Ambigüedades.
- Decisiones de producto pendientes.
- Decisiones UX pendientes.
- Decisiones técnicas pendientes.
- Casos borde.
- Riesgos.

### Paso 3

Haceme preguntas agrupadas por categorías:

```text
PRODUCTO
UX/UI
GASTOS
GRUPOS Y PERSONAS
JUEGOS
PERSISTENCIA
ARQUITECTURA
TECNOLOGÍA
```

Priorizá las preguntas importantes.

No hagas preguntas cuya respuesta no cambie significativamente la implementación.

Podés sugerir una respuesta recomendada cuando sea útil.

Por ejemplo:

> ¿Las juntadas deberían poder editarse después de cerrarlas?

> Recomendación: Sí, pero registrar el estado "cerrada" y permitir reabrirla.

---

# 22. No comenzar a implementar todavía

En esta primera interacción NO quiero que empieces a crear toda la aplicación.

Primero quiero que:

1. Analices el requerimiento.
2. Me hagas las preguntas necesarias.
3. Esperes mis respuestas.
4. Una vez respondidas, propongas:
   - Arquitectura.
   - Stack.
   - Modelo de datos.
   - Estructura de carpetas.
   - Navegación.
   - UX.
   - Algoritmo de gastos.
   - Arquitectura de juegos.
   - Estrategia de testing.
5. Me pidas confirmación.
6. Recién después comiences la implementación.

---

# 23. Implementación incremental

Una vez aprobado el diseño, implementar de forma incremental.

Orden sugerido:

```text
1. Project setup
2. Architecture
3. Design system / base UI
4. People
5. Friend groups
6. Expense domain
7. Expense calculation
8. Debt minimization
9. Expense UI
10. Expense history
11. Game architecture
12. Truco
13. Generala
14. Skull King
15. Game history
16. Tests
17. Documentation
18. CONTEXT.md
```

Podés modificar este orden si encontrás una estrategia mejor, pero explicá por qué.

Después de cada etapa:

- Ejecutar tests.
- Ejecutar lint.
- Verificar que el proyecto compile.
- Actualizar documentación cuando corresponda.
- Actualizar `CONTEXT.md`.

---

# 24. Definition of Done

Una funcionalidad se considera terminada únicamente cuando:

- Está implementada.
- Tiene una UX funcional.
- Tiene tests cuando corresponde.
- No rompe funcionalidades existentes.
- Pasa lint.
- Compila correctamente.
- La lógica de negocio está separada de la UI.
- La documentación relevante está actualizada.
- `CONTEXT.md` refleja los cambios importantes.

---

# Primera respuesta esperada

Tu primera respuesta debe ser **únicamente el análisis del requerimiento y las preguntas que necesitás hacerme**.

No empieces todavía a crear archivos ni código.

Quiero que actúes como un Product Owner/Architect que está haciendo el refinamiento inicial del proyecto.

Agrupá las preguntas por categorías y marcá cuáles son:

- 🔴 Bloqueantes.
- 🟡 Importantes.
- 🟢 Opcionales.

Cuando terminemos de responderlas, recién ahí avanzaremos con el diseño técnico y la implementación.