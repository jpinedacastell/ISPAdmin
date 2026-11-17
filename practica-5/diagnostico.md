# Diagnóstico: clínica de código

**Paciente:** [enfermo.js](enfermo.js), la lógica de clientes de ISPAdmin (eliminar, estado, filtro y validación).
**Alta:** [sano.js](sano.js), el mismo comportamiento después del tratamiento.
**Comprobación:** [tests/clinica.test.js](tests/clinica.test.js). Los mismos casos pasan en los dos archivos.

---

## Síntomas y tratamiento

| # | Síntoma (Clean Code) | En `enfermo.js` | Tratamiento | En `sano.js` |
|---|---|---|---|---|
| 1 | **Ternario poco elegante:** dos ternarios encadenados en una línea | línea 54 | Cláusula de guarda y un solo ternario corto | líneas 143–144 |
| 2 | **Tipado débil:** el id llega como cualquier valor y se valida con `isNaN`, `% 1` y `parseInt` repetido | líneas 5–7 | Value Object `ClienteId`: si existe, es un entero positivo | líneas 27–42 y 100 |
| 3 | **Números mágicos:** `200`, `400`, `404`, `409`, `0` y `13` sueltos | líneas 32–49, 93 | Constantes con nombre: `HTTP_STATUS`, `SIN_REGISTROS`, `DNI_LONGITUD` | líneas 4–13 |
| 4 | **Complejidad condicional:** cinco niveles de `if/else` anidados, y el mensaje de id inválido repetido | líneas 5–50 | Cláusulas de guarda: cada caso sale temprano | líneas 105, 114, 121 |
| 5 | **Enum + switch:** arreglo `tipo` con `'RESTRICT'`/`'CASCADE'` y un `switch` que pregunta el tipo | líneas 11, 16 | **Polimorfismo:** cada `Dependencia` decide en `impideEliminar()` | líneas 46–70 y 113 |
| 6 | **Imperativo:** `for` con índices y `push` manual para contar y filtrar | líneas 14–28, 70–86 | **Declarativo:** `map`, `filter`, `find` y `Promise.all` | líneas 109, 113, 158, 179 |
| 7 | **Cadenas de `if/else` y `switch`:** para el badge, el filtro y las validaciones | líneas 57–66, 74–85, 90–106 | **Método de tabla:** `DEPENDENCIAS_CLIENTE`, `ESTADOS_CLIENTE` y `REGLAS_CLIENTE` | líneas 72, 130, 165 |

Otros síntomas menores:
- **Nombres sin significado** (`t`, `d`, `b`, `c2`, `x`, `f`, `e`): pasan a ser `conteos`, `bloqueos`, `enCascada`, `datos` y `filtro`.
- **`var` y `==`:** pasan a ser `const` y `===`.
- **Dos arreglos paralelos** (`t` y `d`, que deben coincidir por índice): cada dependencia es un solo objeto con `tabla` y `descripcion`.

## SOLID

| Principio | Cómo se aplica en `sano.js` |
|---|---|
| **S** – Responsabilidad única | `ClienteId` valida el id, cada `Dependencia` decide si bloquea, `eliminarCliente` solo coordina, y la validación vive en `REGLAS_CLIENTE`. |
| **O** – Abierto/Cerrado | Para una tabla nueva (por ejemplo `equipos`) se agrega una entrada a `DEPENDENCIAS_CLIENTE` y `eliminarCliente` no cambia. Hay un test que lo demuestra. |
| **L** – Sustitución de Liskov | `DependenciaBloqueante` y `DependenciaEnCascada` se usan igual donde se espera una `DependenciaCliente`. |
| **I** – Segregación de interfaces | El repositorio solo necesita `existe`, `contar` y `eliminar`. |
| **D** – Inversión de dependencias | `eliminarCliente` recibe el repositorio como parámetro, así que los tests usan uno en memoria, sin base de datos. |

## Pruebas

```bash
npm run test:practica5
# o
node --test practica-5/tests/
```

Resultado: **53 pruebas, 0 fallos**.
- 25 casos se corren contra `enfermo.js`, y los mismos 25 contra `sano.js`. Así se comprueba que el refactor no cambió el comportamiento.
- 3 casos extra prueban solo las piezas nuevas de `sano.js`: `ClienteId`, el polimorfismo y la regla abierto/cerrado.

## Pronóstico

`sano.js` es la versión que se aplicó en el proyecto real:
- [src/services/clientes/EliminarClienteService.js](../src/services/clientes/EliminarClienteService.js)
- [src/domain/clientes/](../src/domain/clientes/)
- [src/public/js/clientes/clientesUI.js](../src/public/js/clientes/clientesUI.js)
