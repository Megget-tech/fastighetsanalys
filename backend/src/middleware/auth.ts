import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';

/**
 * Inloggning som i Volymstudie: HTTP Basic (webbläsarens egen inloggningsruta) med en användare,
 * FDATA_ANVANDARE och FDATA_LOSENORD.
 *
 * - Båda satta: alla anrop kräver inloggning (utom /health, som Render använder för hälsokontrollen).
 * - Inte satta i produktion (NODE_ENV=production): alla anrop vägras med 503 – tjänsten ligger aldrig öppen.
 * - Inte satta lokalt: ingen inloggning.
 */

const OPEN_PATHS = new Set(['/health']);

// Jämför via hash så att längden inte läcker och jämförelsen tar lika lång tid
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function isLoggedIn(header: string | undefined, user: string, password: string): boolean {
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  const okUser = safeEqual(decoded.slice(0, sep), user);
  const okPassword = safeEqual(decoded.slice(sep + 1), password);
  return okUser && okPassword;
}

export function authStatus(): 'on' | 'off' | 'missing' {
  const configured = Boolean(process.env.FDATA_ANVANDARE && process.env.FDATA_LOSENORD);
  if (configured) return 'on';
  return process.env.NODE_ENV === 'production' ? 'missing' : 'off';
}

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (OPEN_PATHS.has(req.path)) return next();

  const user = process.env.FDATA_ANVANDARE;
  const password = process.env.FDATA_LOSENORD;

  if (user && password) {
    if (isLoggedIn(req.headers.authorization, user, password)) return next();
    res.setHeader('WWW-Authenticate', 'Basic realm="Fastighetsanalys", charset="UTF-8"');
    return res.status(401).type('text/plain').send('Inloggning krävs');
  }

  if (process.env.NODE_ENV === 'production') {
    return res
      .status(503)
      .type('text/plain')
      .send('Inloggning är inte konfigurerad (FDATA_ANVANDARE/FDATA_LOSENORD)');
  }

  next();
}
