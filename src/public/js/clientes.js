document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const clientesTable = document.getElementById('clientesTable');
    const editarClienteModal = new bootstrap.Modal(document.getElementById('editarClienteModal'));
    const editarClienteForm = document.getElementById('editarClienteForm');
    const guardarCambiosBtn = document.getElementById('guardarCambios');

    // Inicializar DataTable
    const table = $('#clientesTable').DataTable({
        ajax: {
            url: '/clientes/list',
            dataSrc: ''
        },
        columns: [
            { 
                data: 'dni',
                render: function(data) {
                    return data ? data.toUpperCase() : '';
                }
            },
            { 
                data: null,
                render: function(data) {
                    return `<a href="/clientes/${data.id}" class="text-decoration-none">
                        ${data.nombre} ${data.apellido}
                    </a>`;
                }
            },
            { data: 'email' },
            { data: 'telefono' },
            { 
                data: null,
                render: function(data) {
                    if (data.plan_nombre) {
                        return `${data.plan_nombre}<br>
                               <small class="text-muted">
                                   ↓${data.velocidad_descarga}Mbps ↑${data.velocidad_subida}Mbps
                               </small>`;
                    }
                    return '<span class="text-muted">Sin plan</span>';
                }
            },
            {
                data: null,
                render: function(data) {
                    const estado = data.activo;
                    if (estado === undefined || estado === null) {
                        return '<span class="badge bg-secondary">Sin plan</span>';
                    }
                    return estado ? 
                        '<span class="badge bg-success">Activo</span>' : 
                        '<span class="badge bg-danger">Inactivo</span>';
                }
            },
            {
                data: null,
                orderable: false,
                render: function(data) {
                    const toggleBtn = data.activo !== undefined ?
                        `<button class="btn btn-sm btn-${data.activo ? 'danger' : 'success'} toggle-cliente me-1" 
                                 data-cliente-id="${data.id}" title="${data.activo ? 'Desactivar' : 'Activar'}">
                            <i class="fas fa-${data.activo ? 'ban' : 'check'}"></i>
                        </button>` : '';

                    return `
                        ${toggleBtn}
                        <button class="btn btn-sm btn-primary editar-cliente" 
                                data-cliente-id="${data.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    `;
                }
            }
        ],
        order: [[1, 'asc']],
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json'
        },
        responsive: true,
        pageLength: 10,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>'
    });

    // Evento para el botón de nuevo cliente
    document.querySelector('.btn-primary[href="/clientes/nuevo"]').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/clientes/nuevo';
    });

    // Evento para editar cliente
    clientesTable.addEventListener('click', async function(e) {
        const editBtn = e.target.closest('.editar-cliente');
        if (!editBtn) return;

        const clienteId = editBtn.dataset.clienteId;
        try {
            const response = await fetch(`/clientes/${clienteId}`);
            const cliente = await response.json();

            // Llenar el formulario con los datos del cliente
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('editNombre').value = cliente.nombre;
            document.getElementById('editApellido').value = cliente.apellido;
            document.getElementById('editDni').value = cliente.dni;
            document.getElementById('editEmail').value = cliente.email;
            document.getElementById('editTelefono').value = cliente.telefono || '';
            document.getElementById('editDireccion').value = cliente.direccion || '';
            document.getElementById('editPlan').value = cliente.plan_id || '';

            editarClienteModal.show();
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cargar la información del cliente'
            });
        }
    });

    // Evento para guardar cambios
    guardarCambiosBtn.addEventListener('click', async function() {
        const clienteId = document.getElementById('clienteId').value;
        const formData = {
            nombre: document.getElementById('editNombre').value,
            apellido: document.getElementById('editApellido').value,
            dni: document.getElementById('editDni').value,
            email: document.getElementById('editEmail').value,
            telefono: document.getElementById('editTelefono').value,
            direccion: document.getElementById('editDireccion').value,
            plan_id: document.getElementById('editPlan').value
        };

        try {
            const response = await fetch(`/clientes/${clienteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'Cliente actualizado correctamente',
                    showConfirmButton: false,
                    timer: 1500
                });
                editarClienteModal.hide();
                table.ajax.reload();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar el cliente'
            });
        }
    });

    // Evento para toggle de estado del cliente
    clientesTable.addEventListener('click', async function(e) {
        const toggleBtn = e.target.closest('.toggle-cliente');
        if (!toggleBtn) return;

        const clienteId = toggleBtn.dataset.clienteId;
        const isActive = toggleBtn.classList.contains('btn-danger'); // Si es danger, está activo

        try {
            const response = await fetch(`/clientes/${clienteId}/toggle`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({ activo: !isActive })
            });

            const result = await response.json();

            if (result.success) {
                table.ajax.reload();
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: `Cliente ${isActive ? 'desactivado' : 'activado'} correctamente`,
                    showConfirmButton: false,
                    timer: 1500
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cambiar el estado del cliente'
            });
        }
    });

    // Cargar planes en el select de edición
    async function cargarPlanes() {
        try {
            const response = await fetch('/planes/list');
            const planes = await response.json();
            
            const planSelect = document.getElementById('editPlan');
            planSelect.innerHTML = '<option value="">Sin plan</option>';
            
            planes.filter(plan => plan.activo).forEach(plan => {
                const option = document.createElement('option');
                option.value = plan.id;
                option.textContent = `${plan.nombre} - ↓${plan.velocidad_descarga}Mbps ↑${plan.velocidad_subida}Mbps - $${plan.precio}`;
                planSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar planes:', error);
        }
    }

    // Cargar planes al iniciar
    cargarPlanes();
}); 