assets — imágenes del sitio
===========================

1) Escudo de la UNAM  ->  YA COLOCADO
   - Archivo en uso:  assets/unamlogo.png  (320 x 320 px, PNG con transparencia).
   - index.html ya apunta a esa ruta: no hay respaldo ni logo temporal; si el
     archivo falta, el navegador muestra la imagen rota.
   - El escudo es azul institucional (#003070) sobre fondo transparente. En el
     tema oscuro del sitio va sobre una placa clara (#f5f5f2) definida en la
     regla .logo-img de css/styles.css, para que se lea sin alterar sus colores.
   - Si cambias el archivo, respeta la proporción cuadrada y actualiza (si hace
     falta) el width/height del <img> en la sección "Estudiante" de index.html.

2) Calendario del sol (marca del encabezado)  ->  YA COLOCADO
   - Archivo en uso:  assets/calendariodelsol.jpg  (612 x 561 px, 87 KB).
   - Sustituye a las iniciales "TL" en la regla .brand-mark de css/styles.css:
     caja de 2 rem con recorte cuadrado (object-fit: cover).
   - La foto trae fondo negro y la piedra centrada con 45-70 px de margen, así
     que el recorte cuadrado no le corta los extremos.

3) Fondo del inicio  ->  YA COLOCADO
   - Archivo en uso:  "assets/fondo del calendario del sol.jpg" (1200 x 480 px,
     248 KB). Ojo: el nombre lleva espacios, por eso en el CSS va entre comillas.
   - En css/styles.css la ruta se escribe así:
       url("../assets/fondo del calendario del sol.jpg")
     El ../ es obligatorio: dentro de una hoja de estilo las rutas se resuelven
     respecto al propio .css (que está en css/), no respecto al index.html. Sin
     el ../ el navegador pide /css/assets/... y la imagen no aparece.
   - Sólo se usa en la portada (.hero de css/styles.css), no en el resto del
     sitio.
   - Encima lleva un velo negro (78 % arriba, 80 % al centro, 94 % abajo) para
     que el texto blanco y el oro se lean sobre los brillos de la piedra: el
     contraste medido va de 11.9:1 (blanco) a 4.7:1 (gris) en el peor caso.
   - Al imprimir se quita (regla .hero dentro de @media print).

4) Favicon (opcional)  ->  favicon.svg
   - 64 x 64 px, cuadrado.
   - Después de guardarlo, en <head> cambia:
       <link rel="icon" ... href="data:image/svg+xml,...">
     por:
       <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
   - Alternativas sin crear archivos: usar el escudo que ya existe con
       <link rel="icon" type="image/png" href="assets/unamlogo.png">
     o el calendario del sol con
       <link rel="icon" type="image/jpeg" href="assets/calendariodelsol.jpg">

Notas
-----
- Rutas relativas (assets/...), así el sitio funciona igual abierto con file://
  que publicado en tonatiuhliera.com.
- Pesos a vigilar: entre la marca (87 KB) y el fondo de la portada (248 KB) la
  primera pantalla carga ~335 KB de imágenes. Si se quiere aligerar, conviene
  generar copias reducidas (por ejemplo 96 x 96 para la marca y 1200 px de ancho
  con calidad 80 para el fondo) y apuntar el HTML/CSS a esas copias.
- El escudo de la UNAM es una insignia institucional: su uso está restringido a
  los casos permitidos por la institución. Úsalo conforme a los lineamientos de
  identidad de la UNAM para sitios de estudiantes.
- Carpeta assets/img/: aquí van las imágenes auxiliares del sitio; hoy sólo
  contiene este archivo de notas.
