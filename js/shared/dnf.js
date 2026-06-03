window.UtilidadesDNF = (function () {
    function obtenerPeorTiempo(pilotos) {
        let peorTiempo = 0;

        pilotos.forEach(piloto => {
            if (piloto.tiempoSegundos < 999999 && piloto.tiempoSegundos > peorTiempo) {
                peorTiempo = piloto.tiempoSegundos;
            }
        });

        return peorTiempo;
    }

    function calcularTiempoDNF(peorTiempo) {
        return peorTiempo + 60;
    }

    return {
        obtenerPeorTiempo,
        calcularTiempoDNF
    };
})();
