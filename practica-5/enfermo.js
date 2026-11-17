// Paciente: lógica de clientes de ISPAdmin tal como estaba antes del refactor.
// Funciona, pero es difícil de leer, probar y cambiar.

async function eliminarCliente(repo, id) {
    if (id) {
        if (!isNaN(id) && id % 1 == 0 && id > 0) {
            var e = await repo.existe(parseInt(id));
            if (e) {
                var t = ['facturas', 'movimientos_financieros', 'contratos', 'cliente_plan', 'tickets', 'reportes'];
                var d = ['facturas', 'movimientos financieros', 'contratos', 'historial de planes', 'tickets', 'reportes'];
                var tipo = ['RESTRICT', 'RESTRICT', 'RESTRICT', 'CASCADE', 'CASCADE', 'CASCADE'];
                var b = [];
                var c2 = [];
                for (var i = 0; i < t.length; i++) {
                    var n = await repo.contar(t[i], parseInt(id));
                    switch (tipo[i]) {
                        case 'RESTRICT':
                            if (n > 0) {
                                b.push(n + ' ' + d[i]);
                            }
                            break;
                        case 'CASCADE':
                            if (n > 0) {
                                c2.push(n + ' ' + d[i]);
                            }
                            break;
                    }
                }
                if (b.length == 0) {
                    await repo.eliminar(parseInt(id));
                    if (c2.length > 0) {
                        return { status: 200, body: { success: true, message: 'Cliente eliminado junto con: ' + c2.join(', ') } };
                    } else {
                        return { status: 200, body: { success: true, message: 'Cliente eliminado correctamente' } };
                    }
                } else {
                    return {
                        status: 409,
                        body: { success: false, error: 'No se puede eliminar: el cliente tiene ' + b.join(', ') + '. Desactívelo en su lugar.' }
                    };
                }
            } else {
                return { status: 404, body: { success: false, error: 'Cliente no encontrado' } };
            }
        } else {
            return { status: 400, body: { success: false, error: 'El id de cliente "' + id + '" no es válido' } };
        }
    } else {
        return { status: 400, body: { success: false, error: 'El id de cliente "' + id + '" no es válido' } };
    }
}

function estadoCliente(c) {
    return c.activo === null || c.activo === undefined ? 'sin_plan' : c.activo == 1 || c.activo === true ? 'activo' : 'inactivo';
}

function badgeEstado(c) {
    var e = estadoCliente(c);
    if (e == 'activo') {
        return '<span class="badge bg-success">Activo</span>';
    } else if (e == 'inactivo') {
        return '<span class="badge bg-danger">Inactivo</span>';
    } else if (e == 'sin_plan') {
        return '<span class="badge bg-secondary">Sin plan</span>';
    }
}

function filtrarClientes(lista, f) {
    var r = [];
    for (var i = 0; i < lista.length; i++) {
        if (!f) {
            r.push(lista[i]);
        } else {
            switch (f) {
                case 'activo':
                    if (estadoCliente(lista[i]) == 'activo') r.push(lista[i]);
                    break;
                case 'inactivo':
                    if (estadoCliente(lista[i]) == 'inactivo') r.push(lista[i]);
                    break;
                case 'sin_plan':
                    if (estadoCliente(lista[i]) == 'sin_plan') r.push(lista[i]);
                    break;
            }
        }
    }
    return r;
}

function validarCliente(x) {
    if (x.nombre && String(x.nombre).trim() != '' && x.apellido && String(x.apellido).trim() != '') {
        if (x.dni && String(x.dni).trim() != '') {
            if (!/^\d{13}$/.test(String(x.dni).trim())) {
                return 'El DNI debe tener 13 dígitos numéricos';
            }
        }
        if (x.email && String(x.email).trim() != '') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x.email).trim())) {
                return 'El email no tiene un formato válido';
            }
        }
        return null;
    } else {
        return 'Nombre y apellido son obligatorios';
    }
}

module.exports = { eliminarCliente, estadoCliente, badgeEstado, filtrarClientes, validarCliente };
