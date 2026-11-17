// Ejecutar: node --test practica-5/tests/
// Los mismos casos se corren contra enfermo.js y sano.js:
// el refactor no debe cambiar el comportamiento.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const enfermo = require('../enfermo');
const sano = require('../sano');

/** Repositorio en memoria: { existe, conteos por tabla } */
function repoFalso({ existe = true, conteos = {} } = {}) {
    const llamadas = { eliminar: [] };
    return {
        llamadas,
        existe: async () => existe,
        contar: async (tabla) => conteos[tabla] ?? 0,
        eliminar: async (id) => { llamadas.eliminar.push(id); }
    };
}

for (const [nombre, modulo] of [['enfermo', enfermo], ['sano', sano]]) {
    describe(`${nombre}.js`, () => {
        describe('eliminarCliente', () => {
            for (const idInvalido of [undefined, '', 'abc', '0', '-3', '1.5']) {
                it(`rechaza el id ${JSON.stringify(idInvalido)} con 400`, async () => {
                    const repo = repoFalso();
                    const { status, body } = await modulo.eliminarCliente(repo, idInvalido);
                    assert.equal(status, 400);
                    assert.match(body.error, /no es válido/);
                    assert.equal(repo.llamadas.eliminar.length, 0);
                });
            }

            it('responde 404 si el cliente no existe', async () => {
                const { status, body } = await modulo.eliminarCliente(repoFalso({ existe: false }), '7');
                assert.equal(status, 404);
                assert.equal(body.error, 'Cliente no encontrado');
            });

            it('bloquea con 409 si tiene facturas o movimientos', async () => {
                const repo = repoFalso({ conteos: { facturas: 23, movimientos_financieros: 9, tickets: 2 } });
                const { status, body } = await modulo.eliminarCliente(repo, '6');
                assert.equal(status, 409);
                assert.equal(body.error, 'No se puede eliminar: el cliente tiene 23 facturas, 9 movimientos financieros. Desactívelo en su lugar.');
                assert.equal(repo.llamadas.eliminar.length, 0);
            });

            it('elimina e informa lo borrado en cascada', async () => {
                const repo = repoFalso({ conteos: { tickets: 2, cliente_plan: 1 } });
                const { status, body } = await modulo.eliminarCliente(repo, '6');
                assert.equal(status, 200);
                assert.equal(body.message, 'Cliente eliminado junto con: 1 historial de planes, 2 tickets');
                assert.deepEqual(repo.llamadas.eliminar, [6]);
            });

            it('elimina un cliente sin registros relacionados', async () => {
                const { status, body } = await modulo.eliminarCliente(repoFalso(), 6);
                assert.equal(status, 200);
                assert.equal(body.message, 'Cliente eliminado correctamente');
            });
        });

        describe('estadoCliente y badgeEstado', () => {
            const casos = [
                [{ activo: 1 }, 'activo', 'bg-success'],
                [{ activo: true }, 'activo', 'bg-success'],
                [{ activo: 0 }, 'inactivo', 'bg-danger'],
                [{ activo: false }, 'inactivo', 'bg-danger'],
                [{ activo: null }, 'sin_plan', 'bg-secondary'],
                [{}, 'sin_plan', 'bg-secondary']
            ];
            for (const [cliente, estado, clase] of casos) {
                it(`${JSON.stringify(cliente)} → ${estado}`, () => {
                    assert.equal(modulo.estadoCliente(cliente), estado);
                    assert.match(modulo.badgeEstado(cliente), new RegExp(clase));
                });
            }
        });

        describe('filtrarClientes', () => {
            const clientes = [{ id: 1, activo: 1 }, { id: 2, activo: 0 }, { id: 3, activo: null }, { id: 4, activo: 1 }];
            const ids = (lista) => lista.map((c) => c.id);

            it('sin filtro devuelve todos', () => assert.deepEqual(ids(modulo.filtrarClientes(clientes, '')), [1, 2, 3, 4]));
            it('filtra activos', () => assert.deepEqual(ids(modulo.filtrarClientes(clientes, 'activo')), [1, 4]));
            it('filtra inactivos', () => assert.deepEqual(ids(modulo.filtrarClientes(clientes, 'inactivo')), [2]));
            it('filtra sin plan', () => assert.deepEqual(ids(modulo.filtrarClientes(clientes, 'sin_plan')), [3]));
        });

        describe('validarCliente', () => {
            const base = { nombre: 'Ana', apellido: 'López' };

            it('DNI y email son opcionales', () => assert.equal(modulo.validarCliente(base), null));
            it('acepta DNI de 13 dígitos y email válido', () =>
                assert.equal(modulo.validarCliente({ ...base, dni: '0801199900123', email: 'ana@isp.hn' }), null));
            it('exige nombre y apellido', () =>
                assert.equal(modulo.validarCliente({ nombre: 'Ana', apellido: '  ' }), 'Nombre y apellido son obligatorios'));
            it('rechaza DNI incorrecto', () =>
                assert.equal(modulo.validarCliente({ ...base, dni: '123' }), 'El DNI debe tener 13 dígitos numéricos'));
            it('rechaza email incorrecto', () =>
                assert.equal(modulo.validarCliente({ ...base, email: 'ana@' }), 'El email no tiene un formato válido'));
        });
    });
}

describe('sano.js — piezas nuevas', () => {
    it('ClienteId solo acepta enteros positivos', () => {
        assert.equal(new sano.ClienteId('15').valor, 15);
        assert.throws(() => new sano.ClienteId('x'), sano.ClienteIdInvalidoError);
    });

    it('cada dependencia decide si bloquea (sin switch)', () => {
        const bloqueante = new sano.DependenciaBloqueante({ tabla: 't', descripcion: 'd' });
        const cascada = new sano.DependenciaEnCascada({ tabla: 't', descripcion: 'd' });
        assert.equal(bloqueante.impideEliminar(1), true);
        assert.equal(bloqueante.impideEliminar(0), false);
        assert.equal(cascada.impideEliminar(5), false);
    });

    it('se puede agregar una regla nueva sin tocar eliminarCliente (abierto/cerrado)', async () => {
        const dependencias = [...sano.DEPENDENCIAS_CLIENTE, new sano.DependenciaBloqueante({ tabla: 'equipos', descripcion: 'equipos' })];
        const repo = repoFalso({ conteos: { equipos: 1 } });
        const { status, body } = await sano.eliminarCliente(repo, '6', dependencias);
        assert.equal(status, 409);
        assert.match(body.error, /1 equipos/);
    });
});
