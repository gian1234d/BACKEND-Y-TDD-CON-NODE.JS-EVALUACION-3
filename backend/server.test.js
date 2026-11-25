import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from './server.js';

test('la API lee publicaciones y sus propietarios desde SQLite', async () => {
  const { app, db } = createApp(':memory:');
  db.prepare('INSERT INTO usuarios(nombre, correo, password_hash) VALUES (?, ?, ?)')
    .run('Estudiante', 'estudiante@example.test', 'solo-dato-de-prueba');
  db.prepare(`INSERT INTO publicaciones(propietario_id, titulo, descripcion, categoria, modalidad)
    VALUES (1, 'Calculadora', 'En buen estado', 'Materiales', 'DONACION')`).run();

  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    const health = await fetch(base + '/api/salud');
    assert.deepEqual(await health.json(), { estado: 'ok' });
    const catalog = await fetch(base + '/api/publicaciones');
    assert.equal(catalog.status, 200);
    const posts = await catalog.json();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].propietario, 'Estudiante');
    assert.equal(posts[0].estado, 'DISPONIBLE');
    assert.equal('password_hash' in posts[0], false);
    const missing = await fetch(base + '/api/inexistente');
    assert.equal(missing.status, 404);
    await missing.json();
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
});
