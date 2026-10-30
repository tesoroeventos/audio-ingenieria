# Tesoro PA

App web para el montaje de sonido. Calcula:

- el delay entre el PA y los subs, o la posición de la perilla de fase cuando la señal va en cadena;
- el delay de cada caja en sistemas distribuidos;
- el mapa de cobertura.

Funciona sin internet una vez instalada.

## Subirla a GitHub Pages

1. Creá un repositorio nuevo (este es `audio-ingenieria`).
2. Subí todo el contenido de esta carpeta tal cual: `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md` y la carpeta `tests`.
3. En el repositorio entrá a Settings > Pages. En Source elegí "Deploy from a branch", la rama `main` y la carpeta `/ (root)`.
4. En un par de minutos queda publicada en `https://tesoroeventos.github.io/audio-ingenieria/`.

## Instalarla en el celular

Abrila una vez con internet, así guarda todo, incluidas las fuentes.

- En Android con Chrome: menú de los tres puntos > Instalar app (o Agregar a pantalla principal).
- En iPhone con Safari: botón Compartir > Agregar a inicio.

Desde ahí abre como una app y funciona sin señal.

## Actualizar

Cuando subas un `index.html` nuevo, la app lo toma sola la próxima vez que la abras con internet. Sin señal, o si la conexión tarda más de 3 segundos, usa la última versión que guardó.

Si algún día cambiás `sw.js`, subí el número de `VERSION` que está al principio del archivo.

## Dónde quedan los datos

Los proyectos, la biblioteca de cajas y los armados guardados quedan en el navegador de cada dispositivo. No se sincronizan entre el celular y la computadora.

Para pasarlos de un dispositivo a otro:

- los proyectos, con Exportar > Archivo del proyecto y después Abrir;
- la biblioteca, con Biblioteca > Importar o copiar biblioteca.

## Tests de los cálculos

Necesitás Node 18 o más nuevo. Desde esta carpeta corré:

```
node --test
```

Los tests controlan:

- la velocidad del sonido;
- el delay entre PA y subs contra una cuenta hecha a mano;
- la posición de la perilla de fase, incluidos los casos que pasan de 180°;
- que el cruce Linkwitz-Riley sume plano;
- el nivel de cajas activas y pasivas;
- la caída por distancia;
- los delays de end-fire y cardioide;
- las cajas distribuidas;
- el ajuste por fase.

Todo el cálculo está en `index.html`, entre las marcas `/* MOTOR:INICIO */` y `/* MOTOR:FIN */`. Si tocás algo ahí, volvé a correr los tests.

Los valores son un punto de partida para el montaje. El ajuste final se hace midiendo en el lugar.
