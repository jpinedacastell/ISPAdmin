document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');

    console.log('Login form initialized'); // Log de inicialización

    // Función para mostrar errores
    function showError(message) {
        console.log('Showing error:', message); // Log de error
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
    }

    // Función para ocultar errores
    function hideError() {
        errorMessage.textContent = '';
        errorMessage.classList.add('d-none');
    }

    // Función para mostrar/ocultar contraseña
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Cambiar el icono
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }

    // Manejar el envío del formulario
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const usuario = document.getElementById('usuario').value.trim();
        const password = document.getElementById('password').value;

        if (!usuario || !password) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos requeridos',
                text: 'Por favor, complete todos los campos',
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        try {
            // Mostrar loading
            Swal.fire({
                title: 'Iniciando sesión',
                text: 'Por favor espere...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                },
                body: JSON.stringify({ usuario, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Redireccionar directamente sin mostrar mensaje
                window.location.href = data.redirect || '/dashboard';
            } else {
                throw new Error(data.error || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Error al iniciar sesión',
                confirmButtonColor: '#2563eb'
            });
        }
    });

    // Limpiar errores cuando el usuario empiece a escribir
    document.getElementById('usuario').addEventListener('input', () => {
        errorMessage.textContent = '';
        errorMessage.classList.add('d-none');
    });
    
    document.getElementById('password').addEventListener('input', () => {
        errorMessage.textContent = '';
        errorMessage.classList.add('d-none');
    });

    // Animación de entrada
    const card = document.querySelector('.card');
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100);
    }

    console.log('Login form setup complete'); // Log de finalización
}); 