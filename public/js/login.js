document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        usuario: document.getElementById('usuario').value,
        password: document.getElementById('password').value,
        _csrf: document.querySelector('input[name="_csrf"]').value
    };

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': formData._csrf
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            // Redirigir al dashboard
            window.location.href = data.redirect;
        } else {
            // Mostrar error
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.error || 'Error al iniciar sesión',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al procesar la solicitud',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    }
}); 