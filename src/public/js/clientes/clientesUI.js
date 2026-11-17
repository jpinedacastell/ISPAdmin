// @ts-check
// Funciones de la vista de clientes (estados, filtro y eliminación)
const ClientesUI = (() => {
    const DURACION_TOAST_MS = 3000;

    const ESTADOS_CLIENTE = Object.freeze({
        activo:   { etiqueta: 'Activo',   claseBadge: 'bg-success' },
        inactivo: { etiqueta: 'Inactivo', claseBadge: 'bg-danger' },
        sin_plan: { etiqueta: 'Sin plan', claseBadge: 'bg-secondary' }
    });

    /**
     * MySQL devuelve activo como 0/1, por eso no se compara con `=== true`
     * @param {{ activo?: number | boolean | null }} cliente
     * @returns {keyof typeof ESTADOS_CLIENTE}
     */
    function claveEstado(cliente) {
        const sinPlan = cliente.activo === null || cliente.activo === undefined;
        if (sinPlan) return 'sin_plan';
        return cliente.activo ? 'activo' : 'inactivo';
    }

    /** @param {{ activo?: number | boolean | null }} cliente */
    function badgeEstado(cliente) {
        const { etiqueta, claseBadge } = ESTADOS_CLIENTE[claveEstado(cliente)];
        return `<span class="badge ${claseBadge}">${etiqueta}</span>`;
    }

    /**
     * @param {string} filtro valor del select ('' = todos)
     * @param {{ activo?: number | boolean | null }} cliente
     */
    function cumpleFiltro(filtro, cliente) {
        return !filtro || claveEstado(cliente) === filtro;
    }

    function obtenerCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') || '' : '';
    }

    /** @param {'success' | 'error'} icono @param {string} texto */
    function notificar(icono, texto) {
        // @ts-ignore Swal es global (SweetAlert2)
        Swal.fire({
            icon: icono,
            title: icono === 'success' ? 'Éxito' : 'No se pudo eliminar',
            text: texto,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: DURACION_TOAST_MS
        });
    }

    /** @param {string} nombreCliente @returns {Promise<boolean>} */
    async function confirmarEliminacion(nombreCliente) {
        // @ts-ignore Swal es global (SweetAlert2)
        const { isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar cliente?',
            text: `Se eliminará a ${nombreCliente}. Esta acción no se puede deshacer.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        return isConfirmed;
    }

    /**
     * @param {number | string} clienteId
     * @param {string} nombreCliente
     * @param {() => void} alEliminar callback para refrescar la tabla
     */
    async function eliminarCliente(clienteId, nombreCliente, alEliminar) {
        const confirmado = await confirmarEliminacion(nombreCliente);
        if (!confirmado) return;

        try {
            const respuesta = await fetch(`/clientes/${clienteId}`, {
                method: 'DELETE',
                headers: { 'CSRF-Token': obtenerCsrfToken() }
            });
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                notificar('error', resultado.error || 'Error al eliminar el cliente');
                return;
            }
            notificar('success', resultado.message);
            alEliminar();
        } catch (error) {
            console.error('Error al eliminar cliente:', error);
            notificar('error', 'Error de conexión al eliminar el cliente');
        }
    }

    return { DURACION_TOAST_MS, claveEstado, badgeEstado, cumpleFiltro, eliminarCliente };
})();
