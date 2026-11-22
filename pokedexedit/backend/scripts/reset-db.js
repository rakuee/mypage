/* Restaura data/db.json con los 100 Pokémon originales:  npm run db:reset */
'use strict';

require('../db').reset()
  .then((n) => console.log('Base restaurada: ' + n + ' Pokémon.'))
  .catch((err) => { console.error(err); process.exit(1); });
