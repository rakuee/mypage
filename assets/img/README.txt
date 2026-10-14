assets/img — archivos que debes colocar aquí
============================================

El HTML ya apunta a estas rutas. No hay respaldo remoto a propósito:
mientras el archivo no exista se muestra un respaldo local, y todo
funciona sin romperse.

1) Escudo de la UNAM  ->  unam-escudo.png
   - Formato: PNG con fondo transparente (sugerido). También sirve .svg, .jpg, .webp.
   - Tamaño: ~600 x 672 px (o cualquier múltiplo, proporción 1024:1151).
   - Si usas otra extensión, edita la línea marcada "TODO_LOGO_UNAM" en index.html
     (busca: assets/img/unam-escudo.png).
   - La sección ya reserva 150 x 168 px; con "height:auto" el CSS respeta la proporción.

2) Favicon (opcional)  ->  favicon.svg
   - 64 x 64 px, cuadrado.
   - Después de guardarlo, en <head> cambia:
       <link rel="icon" ... href="data:image/svg+xml,...">
     por:
       <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">

Notas
-----
- Rutas relativas (assets/...), así el sitio funciona igual abierto con file://
  que publicado en tonatiuhliera.com.
- El escudo de la UNAM es una insignia institucional: su uso está restringido a
  los casos permitidos por la institución. Úsalo conforme a los lineamientos de
  identidad de la UNAM para sitios de estudiantes.
