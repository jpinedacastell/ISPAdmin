document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const content = document.getElementById('content');
    const overlay = document.createElement('div');
    
    // Configuración inicial
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
            console.log('Toggle clicked'); // Debug
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

    // Debug
    console.log('Sidebar script loaded');
    if (sidebarToggle) {
        console.log('Toggle button found');
    } else {
        console.log('Toggle button not found');
    }
}); 