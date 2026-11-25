import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const sessionDuration = 8 * 60 * 60 * 1000;
const dummySalt = Buffer.alloc(16);
const dummyKey = Buffer.alloc(64);

function credentials(body) {
  const correo = typeof body?.correo === 'string' ? body.correo.trim().toLowerCase() : '';
  const password = body?.password;
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
      || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return null;
  }
  return { correo, password };
}

export function installAuth(app, db) {
  const sessions = new Map();
  const findUser = db.prepare('SELECT * FROM usuarios WHERE correo = ?');
  const profile = db.prepare('SELECT id, nombre, correo, rol, activo FROM usuarios WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO usuarios(nombre, correo, password_hash) VALUES (?, ?, ?)
    ON CONFLICT(correo) DO NOTHING
  `);

  function authenticate(req, res, next) {
    const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return res.status(401).json({ error: 'Inicia sesión para continuar' });
    }
    const user = profile.get(session.userId);
    if (!user?.activo) {
      sessions.delete(token);
      return res.status(401).json({ error: 'Inicia sesión para continuar' });
    }
    req.sessionToken = token;
    req.usuario = user;
    next();
  }

  app.post('/api/registro', async (req, res) => {
    const data = credentials(req.body);
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!data || !nombre || nombre.length > 120) {
      return res.status(400).json({ error: 'Revisa el nombre, el correo y la contraseña (8 a 128 caracteres)' });
    }
    const salt = randomBytes(16);
    const key = await deriveKey(data.password, salt, 64);
    const { changes, lastInsertRowid } = insert.run(
      nombre, data.correo, salt.toString('hex') + ':' + key.toString('hex'),
    );
    if (!changes) return res.status(409).json({ error: 'El correo ya está registrado' });
    res.status(201).json(profile.get(lastInsertRowid));
  });

  app.post('/api/sesion', async (req, res) => {
    const data = credentials(req.body);
    if (!data) return res.status(400).json({ error: 'Revisa el correo y la contraseña' });
    const user = findUser.get(data.correo);
    const [saltHex, keyHex] = user?.password_hash.split(':') ?? [];
    const validHash = /^[0-9a-f]{32}$/.test(saltHex ?? '') && /^[0-9a-f]{128}$/.test(keyHex ?? '');
    const salt = validHash ? Buffer.from(saltHex, 'hex') : dummySalt;
    const storedKey = validHash ? Buffer.from(keyHex, 'hex') : dummyKey;
    const key = await deriveKey(data.password, salt, 64);
    if (!timingSafeEqual(key, storedKey) || !validHash || !user?.activo) {
      return res.status(401).json({ error: 'No se pudo iniciar sesión con esas credenciales' });
    }
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expiresAt: now + sessionDuration });
    res.json({ token, usuario: profile.get(user.id) });
  });

  app.get('/api/sesion', authenticate, (req, res) => res.json(req.usuario));
  app.delete('/api/sesion', authenticate, (req, res) => {
    sessions.delete(req.sessionToken);
    res.status(204).end();
  });
}
