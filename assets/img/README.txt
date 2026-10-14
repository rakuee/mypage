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
   - Carpeta assets/img/: aquí van las imágenes auxiliares. Hoy solo contiene
     este archivo de notas.

2) Favicon (opcional)  ->  favicon.svg
   - 64 x 64 px, cuadrado.
   - Después de guardarlo, en <head> cambia:
       <link rel="icon" ... href="data:image/svg+xml,...">
     por:
       <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
   - Alternativa sin crear archivos: usar el escudo que ya existe con
       <link rel="icon" type="image/png" href="assets/unamlogo.png">

Notas
-----
- Rutas relativas (assets/...), así el sitio funciona igual abierto con file://
  que publicado en tonatiuhliera.com.
- El escudo de la UNAM es una insignia institucional: su uso está restringido a
  los casos permitidos por la institución. Úsalo conforme a los lineamientos de
  identidad de la UNAM para sitios de estudiantes.
