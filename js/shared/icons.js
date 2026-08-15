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

        if (vehiculoMinuscula.includes('peugeot') && vehiculoMinuscula.includes('206') && vehiculoMinuscula.includes('wrc')) {
            return 'peugeotg1';
        }

        if (vehiculoMinuscula.includes('peugeot') && vehiculoMinuscula.includes('307') && vehiculoMinuscula.includes('wrc')) {
            return 'peugeotg1';
        }

        if (vehiculoMinuscula.includes('skoda') && vehiculoMinuscula.includes('rs')) {
            return 'skodars';
        }

        if (vehiculoMinuscula.includes('renault') && vehiculoMinuscula.includes('18')) {
            return 'renaultold';
        }

        if (vehiculoMinuscula.includes('renault') && vehiculoMinuscula.includes('clio') && vehiculoMinuscula.includes('s1600')) {
            return 'renaultold';
        }

        if (vehiculoMinuscula.includes('ford') && vehiculoMinuscula.includes('focus') && vehiculoMinuscula.includes('wrc01')) {
            return 'fordold';
        }

        if (vehiculoMinuscula.includes('ford') && vehiculoMinuscula.includes('focus') && vehiculoMinuscula.includes('wrc04')) {
            return 'fordold';
        }

        if (vehiculoMinuscula.includes('ford') && vehiculoMinuscula.includes('ka') && vehiculoMinuscula.includes('tatoo')) {
            return 'fordold';
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