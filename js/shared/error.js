window.UtilidadesError = (function () {
    function mostrarError(contenedor, mensaje, onReintentar) {
        if (!contenedor) return;

        const mensajeHtml = String(mensaje || '').replace(/\n/g, '<br>');

        contenedor.innerHTML =
            '<div class="error-box">' +
                '<div class="error-box-mensaje">' + mensajeHtml + '</div>' +
                '<button type="button" class="error-box-boton">Reintentar</button>' +
            '</div>';

        const boton = contenedor.querySelector('.error-box-boton');
        if (!boton || typeof onReintentar !== 'function') return;

        boton.addEventListener('click', function () {
            boton.disabled = true;
            boton.textContent = 'Reintentando...';

            Promise.resolve()
                .then(onReintentar)
                .catch(function (error) {
                    console.error('Error al reintentar:', error);
                })
                .finally(function () {
                    // Si seguimos mostrando este mismo cartel (el reintento no lo reemplazó
                    // porque volvió a fallar), lo reactivamos para permitir un nuevo intento.
                    if (boton.isConnected) {
                        boton.disabled = false;
                        boton.textContent = 'Reintentar';
                    }
                });
        });
    }

    return { mostrarError };
})();