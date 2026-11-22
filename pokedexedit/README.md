# Pokédex editable

Pokédex con backend propio: los primeros 100 Pokémon en una base de datos pequeña
que el frontend consulta y modifica mediante una API REST.

Se publica en **https://tonatiuhliera.com/pokedexedit/**.

```
pokedexedit/
├── index.html          ← página (la sirve GitHub Pages)
├── pokedexedit.js      ← lógica: consume GET / POST / PUT / DELETE
├── pokedexedit.css     ← estilos extra (la base es ../pokedex/pokedex.css)
├── config.js           ← URL del backend en producción y en local
└── backend/            ← API en Node + Express (se despliega en Render)
    ├── server.js       ← rutas
    ├── db.js           ← base de datos en archivo JSON
    ├── validate.js     ← validación de datos
    ├── data/pokemon-seed.json   ← los 100 Pokémon originales
    ├── scripts/        ← regenerar la semilla / restaurar la base
    └── test/           ← pruebas de las rutas (npm test)
```

## API

| Método | Ruta           | Qué hace                                        |
|--------|----------------|-------------------------------------------------|
| GET    | `/get`         | Lista todos (filtros opcionales `?q=` `?type=`) |
| GET    | `/get/:id`     | Un Pokémon                                      |
| POST   | `/post`        | Crea un Pokémon (cuerpo JSON completo)          |
| PUT    | `/put/:id`     | Actualiza un Pokémon (sólo los campos enviados) |
| DELETE | `/delete/:id`  | Elimina un Pokémon                              |
| POST   | `/reset`       | Restaura los 100 originales                     |
| GET    | `/health`      | Estado del servicio                             |

Ejemplo de cuerpo para `POST /post`:

```json
{
  "name": "Pikachu Surf",
  "types": ["electric", "water"],
  "stats": { "hp": 35, "attack": 55, "defense": 40, "specialAttack": 50, "specialDefense": 50, "speed": 90 },
  "height": 0.4,
  "weight": 6,
  "abilities": ["static"],
  "image": "https://…/imagen.png",
  "description": "Opcional."
}
```

## Probar en local

```powershell
cd pokedexedit/backend
npm install
npm start
```

Abre http://localhost:3000/pokedexedit/ (en desarrollo el backend también sirve el sitio).
Las pruebas de la API se ejecutan con `npm test`.

## Publicar en el dominio

GitHub Pages sirve sólo archivos estáticos: la página `pokedexedit/` se publica sola
con cada push a `main`, pero el backend necesita un servidor. El repositorio incluye
`render.yaml` para desplegarlo gratis en [Render](https://render.com):

1. Entra a Render con tu cuenta de GitHub → **New → Blueprint** → elige el repositorio
   `rakuee/mypage`. Render lee `render.yaml` y crea el servicio `pokedexedit-api`.
2. Cuando termine, copia la URL del servicio (p. ej. `https://pokedexedit-api.onrender.com`).
3. Si la URL es distinta, cámbiala en `pokedexedit/config.js` (`PRODUCCION`) y haz push.
4. Desde entonces cada push a `main` actualiza a la vez la página (GitHub Pages) y el API (Render).

Notas del plan gratuito de Render:

- El servicio se duerme tras ~15 min sin uso; la primera petición tarda hasta ~1 min.
  La página muestra «Despertando el servidor…» mientras tanto.
- El disco no es persistente: al reiniciarse o redesplegar, la base vuelve a los 100
  originales. Para conservar cambios, añade un disco (plan de pago) y define
  `DB_FILE=/var/data/db.json`, o cambia `db.js` por una base de datos externa.

Si usas otro proveedor (Railway, Fly.io, un VPS…), basta con ejecutar `npm start` en
`pokedexedit/backend` con las variables de `.env.example`.
