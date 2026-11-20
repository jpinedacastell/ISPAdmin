# Guion (5 min): Eliminar clientes con Clean Code y SOLID

**Código de verificación:** `LEARN-CAP-7AA6B634`

> Tip: no hay que leerlo palabra por palabra. Cada parte tiene una **idea clave**; si te
> acuerdas de esa idea, lo demás sale solo.
> Las líneas **📂 Mostrar** dicen qué archivo y qué líneas abrir en pantalla.
> En VS Code: `Ctrl+P` → nombre del archivo → `Ctrl+G` → número de línea.

---

## 1. El problema (30 seg)

**Idea clave:** no se podían borrar clientes.

> "En la pantalla de Clientes no se podía eliminar a nadie, por dos razones:
> 1. No había botón de eliminar.
> 2. Aunque lo hubiera, la base de datos no deja borrar a un cliente que tiene facturas,
>    y el sistema solo mostraba un error 500 sin explicar nada.
>
> Lo arreglamos y aprovechamos para dejar el código limpio."

📂 **Mostrar:** `src/views/clientes/index.ejs`
- **Líneas 197–201**: el botón 🗑️ nuevo.
- **Líneas 354–357**: lo que pasa al hacer clic.

---

## 2. SOLID: cada quien hace su trabajo (1 min)

**Idea clave:** antes una sola función hacía todo; ahora cada pieza tiene un solo trabajo.

> "Piénsenlo como un restaurante: el mesero toma el pedido, el cocinero cocina y el
> bodeguero trae los ingredientes. Nadie hace el trabajo del otro."

| En el restaurante | En el código | Archivo y líneas |
|---|---|---|
| Mesero | La **ruta** | `src/routes/clienteRoutes.js` líneas **531–555** |
| Cocinero | El **servicio** | `src/services/clientes/EliminarClienteService.js` líneas **30–45** |
| Bodeguero | El **repositorio** | `src/repositories/ClienteRepository.js` líneas **7–43** |

> "Así se ve SOLID:"

| Letra | Qué decir | 📂 Mostrar |
|---|---|---|
| **S** | "Cada clase hace una sola cosa. Hasta abrir y cerrar la transacción está aparte." | `src/database/conTransaccion.js` líneas **10–23** |
| **O** | "Si aparece una tabla nueva, agrego una línea a la lista sin tocar lo demás." | `src/domain/clientes/dependenciasCliente.js` líneas **42–49** |
| **L** | "Las dos clases de regla se usan igual; el servicio no tiene que preguntar cuál es." | `dependenciasCliente.js` líneas **26–38** |
| **I** | "El repositorio solo tiene los 3 métodos que se necesitan: existe, contar, eliminar." | `ClienteRepository.js` líneas **14, 27 y 40** |
| **D** | "Al servicio le *pasamos* el repositorio desde fuera, así que podemos probarlo con uno falso." | `EliminarClienteService.js` línea **21** |

---

## 3. Tabla en vez de muchos if (45 seg)

**Idea clave:** las reglas están en una lista, no en un montón de `if`.

> "En vez de escribir:
> *si tiene facturas, no borres; si tiene contratos, no borres; si tiene tickets, sí borra...*
>
> hicimos una **lista** (eso es el *método de tabla*):"

📂 **Mostrar:** `src/domain/clientes/dependenciasCliente.js` líneas **42–49**

```js
facturas          -> bloquea
contratos         -> bloquea
tickets           -> se borran junto con el cliente
```

> "Y cada regla **sabe sola** si bloquea o no. Eso es **polimorfismo en lugar de enum**:
> no hay un `switch` que pregunte '¿de qué tipo eres?'."

📂 **Mostrar:** `dependenciasCliente.js`
- **Línea 28**: la regla que bloquea devuelve `cantidad > 0`.
- **Línea 35**: la regla en cascada devuelve `false`.

📂 **Otras tablas** (si da tiempo):
- `src/routes/clienteRoutes.js` líneas **507–529**: cada resultado tiene su respuesta.
- `src/public/js/clientes/clientesUI.js` líneas **6–10**: los estados Activo, Inactivo y Sin plan.

---

## 4. Código fácil de leer (45 seg)

**Idea clave:** el código se lee de arriba hacia abajo, como una historia.

📂 **Mostrar:** `src/services/clientes/EliminarClienteService.js` líneas **30–45**

> "El servicio hace esto:
> - ¿El cliente no existe? Me salgo. → **línea 34**
> - ¿Tiene facturas? Me salgo y aviso. → **línea 39**
> - Si no, lo borro. → **línea 41**
>
> Eso es bajar la **complejidad condicional**: en vez de un `if` dentro de otro `if`,
> salimos temprano."

> "Y somos **declarativos**: usamos `filter` y `map`, que dicen *qué* quiero
> ('dame las reglas que bloquean'), en lugar de un `for` con índices." → **líneas 38 y 43**

---

## 5. Tipos, números y ternario (45 seg)

**Idea clave:** que el código se explique solo.

| Tema | Qué decir | 📂 Mostrar |
|---|---|---|
| **Tipado fuerte** | "El id no puede ser cualquier cosa. Si llega `'abc'`, se rechaza de una vez." | `src/domain/clientes/ClienteId.js` líneas **21–23** |
| | "Y el resultado no es un simple true o false, sino un tipo claro." | `src/domain/clientes/ResultadoEliminacion.js` líneas **3–7** |
| **Números mágicos** | "Antes había `404` o `3000` sueltos; ahora tienen nombre." | `src/constants/http.js` líneas **2–8** y `clientesUI.js` línea **4** |
| **Ternario elegante** | "Uno solo y corto, sin ternarios dentro de ternarios." | `clientesUI.js` línea **20** y `clienteRoutes.js` líneas **512–514** |

---

## 6. Demo (45 seg)

1. Abrir **Clientes** y presionar el botón 🗑️.
2. Aparece: "¿Eliminar cliente?"
3. Si tiene facturas, el sistema dice claramente: *"No se puede eliminar: tiene 23 facturas. Desactívelo en su lugar."*
4. Si no tiene historial, lo borra y la tabla se actualiza sola.

> "De paso encontramos dos errores más: el botón Editar no cargaba los datos y el filtro
> de Activos e Inactivos no funcionaba. Los dos quedaron corregidos."

📂 **Mostrar:** `src/views/clientes/index.ejs`
- **Línea 273**: Editar ahora pide los datos a la dirección correcta.
- **Línea 223**: el filtro arreglado.

---

## 7. Cierre (15 seg)

> "Clean Code no es escribir más, es escribir código que **cualquiera entienda**.
> Ahora agregar una regla es agregar una línea, y el usuario ve un mensaje claro en
> lugar de un error. Gracias."

---

## Acordeón rápido (todo en una tabla)

| Concepto | Archivo | Líneas |
|---|---|---|
| Elegancia del ternario | `src/public/js/clientes/clientesUI.js` | 20 |
| Tipado fuerte | `src/domain/clientes/ClienteId.js` | 14–31 |
| Números mágicos | `src/constants/http.js` | 2–8 |
| Complejidad condicional | `src/services/clientes/EliminarClienteService.js` | 34, 39 |
| Polimorfismo vs Enum | `src/domain/clientes/dependenciasCliente.js` | 26–38 |
| Ser declarativo | `src/services/clientes/EliminarClienteService.js` | 38, 43 |
| Método de tabla | `src/domain/clientes/dependenciasCliente.js` | 42–49 |
| S – Responsabilidad única | `src/database/conTransaccion.js` | 10–23 |
| O – Abierto/Cerrado | `src/domain/clientes/dependenciasCliente.js` | 42–49 |
| L – Liskov | `src/domain/clientes/dependenciasCliente.js` | 26–38 |
| I – Interfaces | `src/repositories/ClienteRepository.js` | 14, 27, 40 |
| D – Inversión de dependencias | `src/services/clientes/EliminarClienteService.js` | 21 |
