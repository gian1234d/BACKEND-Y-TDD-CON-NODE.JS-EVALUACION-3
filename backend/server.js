import express from 'express';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

export function createApp(dbPath = process.env.DB_PATH || 'campus.sqlite') {
  const db = new DatabaseSync(dbPath);
  db.exec(readFileSync(new URL('./db/schema.sql', import.meta.url), 'utf8'));

  const app = express();
  const catalog = db.prepare(`
    SELECT p.id, p.titulo, p.descripcion, p.categoria, p.modalidad,
      p.estado, p.fecha_publicacion, u.nombre AS propietario
    FROM publicaciones p
    JOIN usuarios u ON u.id = p.propietario_id
    ORDER BY p.id DESC
  `);

  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.get('/api/publicaciones', (_req, res) => res.json(catalog.all()));
  app.use((_req, res) => res.status(404).json({ error: 'Ruta inexistente' }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'No se pudo completar la operación' });
  });

  return { app, db };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  createApp().app.listen(port, '127.0.0.1', () => {
    console.log('API disponible en http://127.0.0.1:' + port);
  });
}
