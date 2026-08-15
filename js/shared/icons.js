window.UtilidadesIconos = (function () {
    const REGLAS_ICONOS = [
        { keywords: ['fiat', 'regatta'], icono: 'fiatold' },
        { keywords: ['peugeot', '208', 'g1'], icono: 'peugeotg1' },
        { keywords: ['peugeot', '206', 'wrc'], icono: 'peugeotg1' },
        { keywords: ['peugeot', '307', 'wrc'], icono: 'peugeotg1' },
        { keywords: ['skoda', 'rs'], icono: 'skodars' },
        { keywords: ['renault', '18'], icono: 'renaultold' },
        { keywords: ['renault', 'clio', 's1600'], icono: 'renaultold' },
        { keywords: ['ford', 'focus', 'wrc01'], icono: 'fordold' },
        { keywords: ['ford', 'focus', 'wrc04'], icono: 'fordold' },
        { keywords: ['ford', 'ka', 'tatoo'], icono: 'fordold' },
    ];

    function obtenerMarcaVehiculo(vehiculo) {
        if (!vehiculo) return '';

        const vehiculoMinuscula = vehiculo.toLowerCase();

        const regla = REGLAS_ICONOS.find(({ keywords }) =>
            keywords.every(keyword => vehiculoMinuscula.includes(keyword))
        );

        if (regla) return regla.icono;

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