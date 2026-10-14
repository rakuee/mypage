# tonatiuhliera.com

Sitio estático de una sola página: minimalista, texto blanco sobre fondo negro.
Sin build step, sin dependencias y sin peticiones a servicios externos.

## Archivos

```
index.html                   página completa (inicio, estudiante, proyectos, contacto)
css/styles.css               tema negro minimalista, responsive
js/main.js                   año del footer, menú móvil, copiar comandos git clone
assets/img/                  RUTAS RESERVADAS: aquí van el escudo y el favicon
assets/img/README.txt        nombres y tamaños exactos que espera el HTML
pokedex/                     ruta /pokedex/ reservada y vacía (solo .gitkeep)
404.html                     página de error con estilo del sitio
robots.txt, sitemap.xml      SEO básico
```

## Lo que falta que agregues tú

| Marcador en `index.html` | Qué hacer |
|---|---|
| `TODO_LOGO_UNAM` | Guarda el escudo en `assets/img/unam-escudo.png`. Si usas otra extensión (`.svg`, `.jpg`, `.webp`), cambia el `src` en esa línea. Sin el archivo se muestra un escudo de respaldo: no se ve roto. |
| `TODO_FAVICON` | Guarda `assets/img/favicon.svg` y cambia el `<link rel="icon">` por `href="assets/img/favicon.svg"`. |
| `TODO_EMAIL` | Sustituye el botón `#mailBtn` por `<a class="btn btn-ghost" href="mailto:tu-correo@dominio.com">Correo</a>`. |
| `TODO_POKEDEX` | Cuando exista `pokedex/index.html`, descomenta el `<a href="pokedex/">` y borra el `<span>` de "aún vacía". |

## Ver en local

Abre `index.html` con doble clic (funciona con `file://` porque todas las rutas son
relativas). Si prefieres un servidor local:

```bash
python -m http.server 8000
# luego visita http://localhost:8000
```

## Publicar el dominio `tonatiuhliera.com`

El sitio es estático puro, así que funciona en cualquier hosting. Elegido el host,
sube el contenido de esta carpeta tal cual (la raíz del sitio debe tener `index.html`).

### Opción A — GitHub Pages

1. Crea un repositorio llamado exactamente `tonatiuhliera.com` (así el proyecto se
   llama igual que el dominio; evita confundirlo con `rakuee/mypage`, que ya existe).
2. Sube estos archivos a la rama `main`.
3. En el repo: *Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save*.
4. Crea un archivo `CNAME` en la raíz del sitio (una línea):

   ```
   tonatiuhliera.com
   ```

   > No lo incluí por defecto porque aún no elegiste el host. Este `CNAME` solo
   > se usa en GitHub Pages.
5. En tu registrador de dominio, configura el DNS:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `rakuee.github.io` |

6. De vuelta en *Settings → Pages*, activa **Enforce HTTPS** (puede tardar unos
   minutos tras propagarse el DNS).

### Opción B — Netlify / Vercel / Cloudflare Pages / hosting propio

No necesitas los registros `A` de GitHub. Publica la carpeta como sitio estático y,
en el panel del host, agrega el dominio `tonatiuhliera.com`; el panel te dirá el
registro exacto a crear (normalmente un `CNAME` de `@` o de `www` hacia el host).

### Comprobar que quedó bien

1. `https://tonatiuhliera.com` carga la página de inicio con el escudo y los tres proyectos.
2. Abre la consola del navegador (F12): sin errores 404.
3. `https://tonatiuhliera.com/pokedex/` muestra la página 404 del sitio mientras esté vacía.
4. `https://tonatiuhliera.com/robots.txt` y `/sitemap.xml` responden.

## Activar la ruta `/pokedex/`

1. Crea `pokedex/index.html` (o sube ahí la app estática).
2. En `index.html` de la raíz, activa el enlace marcado `TODO_POKEDEX`.
3. No hay que tocar DNS ni el resto del sitio.

## Contenido verificado

- Perfil GitHub: <https://github.com/rakuee>
- LinkedIn: <https://www.linkedin.com/in/tonatiuh-liera-374355438/>
- Los textos de los proyectos provienen de los README reales de cada repositorio:

| Proyecto | Repositorio |
|---|---|
| infoEscuelasMX | <https://github.com/Narhada/infoEscuelasMX> |
| Modeling_of_Social_Influence | <https://github.com/rakuee/Modeling_of_Social_Influence> |
| mintic-base | <https://github.com/rakuee/mintic-base> |
