document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const content = document.getElementById('content');
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');
    document.body.appendChild(overlay);

    // Función para alternar el estado del sidebar
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        content.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    // Event Listeners
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function(e) {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // Cerrar sidebar al hacer clic en el overlay
    overlay.addEventListener('click', function() {
        if (sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

    // Manejar gestos táctiles para el sidebar
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const swipeThreshold = 100;
        const swipeDistance = touchEndX - touchStartX;

        if (Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance > 0 && !sidebar.classList.contains('active')) {
                // Deslizar hacia la derecha - Abrir sidebar
                toggleSidebar();
            } else if (swipeDistance < 0 && sidebar.classList.contains('active')) {
                // Deslizar hacia la izquierda - Cerrar sidebar
                toggleSidebar();
            }
        }
    }

    // Ajustar sidebar en cambios de tamaño de ventana
    window.addEventListener('resize', function() {
        if (window.innerWidth > 991.98) {
            if (overlay.classList.contains('active')) {
                overlay.classList.remove('active');
            }
        }
    });

    // Configuración de DataTables
    if (typeof $.fn.DataTable !== 'undefined') {
        $.extend(true, $.fn.dataTable.defaults, {
            responsive: true,
            language: {
                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json'
            },
            dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
                 "<'row'<'col-sm-12'tr>>" +
                 "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        });
    }

    // Los dropdowns se manejan de forma nativa con Bootstrap.
    // Evitamos handlers táctiles custom para no romper la apertura/cierre en móviles.

    // Ajustar altura de contenedores en móvil
    function adjustHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    adjustHeight();
    window.addEventListener('resize', adjustHeight);
}); 
