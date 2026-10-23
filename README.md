# Franquicia

Juego de mesa de franquicias NBA para jugar con amigos: en un solo móvil o en varios con código de sala.

- Versión rápida (rondas ampliables) y estándar, con o sin contratos.
- Contratos: UTE, traspaso, préstamo, pase VIP, cesión de ingresos, opción de compra y compra a plazos.
- Bots para rellenar y piloto automático para quien se ausenta.

Stack: Vite + React, Supabase (tabla `fq_rooms`, funciones `fq_create_room` y `fq_update_room`), Vercel.

Pruebas: `node scripts/unit.mjs` (reglas) y `node scripts/sim.mjs 300` (partidas completas con bots).

En vivo: https://franquicia-nba.vercel.app
