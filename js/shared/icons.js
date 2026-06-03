window.UtilidadesIconos = (function () {
    function obtenerMarcaVehiculo(vehiculo) {
        if (!vehiculo) return '';

        const vehiculoMinuscula = vehiculo.toLowerCase();
        if (vehiculoMinuscula.includes('fiat') && vehiculoMinuscula.includes('regatta')) {
            return 'fiatold';
        }

        if (vehiculoMinuscula.includes('peugeot') && vehiculoMinuscula.includes('208') && vehiculoMinuscula.includes('g1')) {
            return 'peugeotg1';
        }

        if (vehiculoMinuscula.includes('skoda') && vehiculoMinuscula.includes('rs')) {
            return 'skodars';
        }

        return vehiculo.split(' ')[0].toLowerCase();
    }

    function obtenerRutaLogoMarca(vehiculo) {
        const marca = obtenerMarcaVehiculo(vehiculo);
        return marca ? `/assets/icon/${marca}.png` : null;
    }

    return {
        obtenerMarcaVehiculo,
        obtenerRutaLogoMarca
    };
})();
