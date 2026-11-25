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

test('registra usuarios, valida credenciales y cierra sesiones', async () => {
  const { app, db } = createApp(':memory:');
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const account = { nombre: 'Ana', correo: 'ana@example.test', password: 'clave-de-prueba' };
    const post = (path, body) => fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal((await post('/registro', { ...account, password: 'corta' })).status, 400);
    const registered = await post('/registro', { ...account, rol: 'ADMIN' });
    assert.equal(registered.status, 201);
    const usuario = await registered.json();
    assert.equal(usuario.rol, 'USUARIO');
    assert.equal('password_hash' in usuario, false);
    const stored = db.prepare('SELECT password_hash FROM usuarios WHERE id = ?').get(usuario.id);
    assert.match(stored.password_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal((await post('/registro', { ...account, correo: 'ANA@example.test' })).status, 409);
    assert.equal((await post('/sesion', { ...account, password: 'clave-incorrecta' })).status, 401);
    const login = await post('/sesion', account);
    assert.equal(login.status, 200);
    const { token } = await login.json();
    const headers = { Authorization: 'Bearer ' + token };
    assert.equal((await fetch(base + '/sesion')).status, 401);
    const session = await fetch(base + '/sesion', { headers });
    assert.deepEqual(await session.json(), usuario);
    assert.equal((await fetch(base + '/sesion', { method: 'DELETE', headers })).status, 204);
    assert.equal((await fetch(base + '/sesion', { headers })).status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
});
