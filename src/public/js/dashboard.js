// public/js/dashboard.js

// --- CONFIGURACIÓN GLOBAL DE CHART.JS ---
// Establece el color y la fuente por defecto para todos los gráficos.
Chart.defaults.color = '#858796';
Chart.defaults.font.family = "'Nunito', 'sans-serif'";

// --- VARIABLES GLOBALES PARA LOS GRÁFICOS ---
// Se declaran aquí para que sean accesibles desde las funciones de inicialización y actualización.
let ingresosChart;
let planesChart;

/**
 * Inicializa el gráfico de líneas para los ingresos mensuales.
 * @param {number[]} data - Un array con 12 valores numéricos para los ingresos de cada mes.
 */
function initIngresosChart(data) {
    const ctx = document.getElementById('ingresosChart').getContext('2d');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    ingresosChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'Ingresos',
                data: data,
                backgroundColor: 'rgba(78, 115, 223, 0.05)',
                borderColor: '#4e73df',
                pointRadius: 3,
                pointBackgroundColor: '#4e73df',
                pointBorderColor: '#4e73df',
                fill: true
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

/**
 * Inicializa el gráfico de dona para la distribución de planes.
 * @param {object} data - Un objeto con los nombres de los planes y la cantidad de clientes en cada uno.
 */
function initPlanesChart(data) {
    const ctx = document.getElementById('planesChart').getContext('2d');
    
    planesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data), // Obtiene los nombres de los planes del objeto
            datasets: [{
                data: Object.values(data), // Obtiene los valores del objeto
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#f8f9fc'],
                hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf', '#f4b619', '#d92a1a', '#d2d3d5'],
                hoverBorderColor: 'rgba(234, 236, 244, 1)'
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            cutout: '70%'
        }
    });
}

/**
 * Función principal para obtener los datos del backend y actualizar todo el dashboard.
 */
function actualizarDashboard() {
    console.log('Actualizando datos del dashboard...');
    fetch('/dashboard/stats')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 1. Actualizar tarjetas de estadísticas
            document.getElementById('totalClientes').textContent = data.totalClientes;
            document.getElementById('ingresosMensuales').textContent = parseFloat(data.ingresosMensuales).toLocaleString('es-HN', { style: 'currency', currency: 'HNL' });
            document.getElementById('ingresosEsperados').textContent = parseFloat(data.ingresosEsperados || 0).toLocaleString('es-HN', { style: 'currency', currency: 'HNL' });
            document.getElementById('anchoBandaTotal').textContent = `${data.anchoBandaTotal || 0} Mbps`;
            document.getElementById('ticketsPendientes').textContent = data.ticketsPendientes;

            // 2. Actualizar tabla de últimas instalaciones (si existen los datos)
            if (data.ultimasInstalaciones && Array.isArray(data.ultimasInstalaciones)) {
                const tbody = document.getElementById('ultimasInstalaciones');
                tbody.innerHTML = ''; // Limpiar tabla antes de agregar nuevos datos
                data.ultimasInstalaciones.forEach(instalacion => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${instalacion.cliente}</td>
                        <td>${instalacion.plan}</td>
                        <td>${new Date(instalacion.fecha).toLocaleDateString()}</td>
                        <td><span class="badge bg-${instalacion.estado === 'completada' ? 'success' : 'warning'}">${instalacion.estado}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // 3. Actualizar gráfico de ingresos (si existen los datos)
            if (data.ingresosAnuales && ingresosChart) {
                ingresosChart.data.datasets[0].data = data.ingresosAnuales;
                ingresosChart.update();
            }

            // 4. Actualizar gráfico de planes (si existen los datos)
            if (data.distribucionPlanes && planesChart) {
                planesChart.data.labels = Object.keys(data.distribucionPlanes);
                planesChart.data.datasets[0].data = Object.values(data.distribucionPlanes);
                planesChart.update();
            }
            console.log('Dashboard actualizado correctamente.');
        })
        .catch(error => {
            console.error('Error al actualizar el dashboard:', error);
            // Se usa Swal (SweetAlert2) para un mensaje de error más amigable.
            // Asegúrate de tener SweetAlert2 incluido en tu página.
            if (typeof Swal !== 'undefined') {
                 Swal.fire({
                    icon: 'error',
                    title: 'Error de Conexión',
                    text: 'No se pudieron cargar los datos del dashboard. Revisa la conexión con el servidor.'
                });
            }
        });
}

// --- PUNTO DE ENTRADA: Se ejecuta cuando el DOM está completamente cargado ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar los gráficos con datos vacíos o en cero para que se muestren desde el principio.
    initIngresosChart(new Array(12).fill(0));
    initPlanesChart({ 'Sin datos': 1 }); // Un estado inicial para el gráfico de dona

    // 2. Cargar los datos del servidor por primera vez.
    actualizarDashboard();

    // 3. Opcional: Configurar una actualización automática cada 5 minutos.
    // setInterval(actualizarDashboard, 5 * 60 * 1000);
});
