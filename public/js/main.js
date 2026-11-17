document.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    const overlay = document.createElement('div');
    overlay.classList.add('sidebar-overlay');
    document.body.appendChild(overlay);

    function toggleSidebar(show) {
        if (show) {
            sidebar.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Verificar el tamaño de la pantalla al cargar
    if (window.innerWidth <= 991.98) {
        toggleSidebar(false);
    } else {
        toggleSidebar(true);
    }

    if (sidebarCollapse) {
        sidebarCollapse.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isActive = sidebar.classList.contains('active');
            toggleSidebar(!isActive);
        });
    }

    // Cerrar sidebar al hacer clic en el overlay
    overlay.addEventListener('click', function() {
        toggleSidebar(false);
    });

    // Cerrar sidebar al hacer clic en los enlaces del menú en móvil
    const sidebarLinks = document.querySelectorAll('.sidebar a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 991.98) {
                toggleSidebar(false);
            }
        });
    });

    // Manejar cambios de tamaño de ventana
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 991.98) {
                toggleSidebar(true);
                sidebar.style.transition = 'all 0.3s';
            } else {
                toggleSidebar(false);
            }
        }, 250);
    });

    // Configuración global para DataTables
    $.extend(true, $.fn.dataTable.defaults, {
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json'
        },
        responsive: true,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>'
    });

    // Inicializar DataTables con configuración responsiva
    const tables = document.querySelectorAll('.datatable');
    tables.forEach(table => {
        new DataTable(table, {
            responsive: true,
            language: {
                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json'
            },
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip'
        });
    });

    // Manejar modales en dispositivos móviles
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('shown.bs.modal', function() {
            // Ajustar el scroll en dispositivos móviles
            if (window.innerWidth < 576) {
                modal.querySelector('.modal-dialog').scrollTop = 0;
            }
        });
    });

    // Ajustar tamaño de inputs en dispositivos móviles
    const adjustInputSize = () => {
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="password"]');
        if (window.innerWidth < 576) {
            inputs.forEach(input => {
                input.style.fontSize = '16px';
            });
        }
    };

    adjustInputSize();
    window.addEventListener('resize', adjustInputSize);
}); 