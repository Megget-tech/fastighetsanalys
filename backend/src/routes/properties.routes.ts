import { Router, Request, Response } from 'express';
import { searchPropertyByBeteckning, parseBeteckning } from '../services/lantmateriet.service';

const router = Router();

/**
 * Search for property by fastighetsbeteckning
 * GET /api/properties/search?q=NACKA%20SALTSJÖ-BOO%201:123
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 3) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Fastighetsbeteckning måste anges (ex: "NACKA SALTSJÖ-BOO 1:123")'
      });
    }

    console.log(`[API] Searching property: ${query}`);

    // Validate format
    const parsed = parseBeteckning(query);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format: "KOMMUN TRAKT BLOCK:ENHET" (ex: "NACKA SALTSJÖ-BOO 1:123")'
      });
    }

    // Search in Lantmäteriet
    const property = await searchPropertyByBeteckning(query);

    if (!property) {
      return res.status(404).json({
        error: 'Not found',
        message: `Fastigheten "${query}" hittades inte`
      });
    }

    res.json(property);

  } catch (error: any) {
    console.error('[API] Error in /properties/search:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Validate fastighetsbeteckning format
 * GET /api/properties/validate?q=NACKA%20SALTSJÖ-BOO%201:123
 */
router.get('/validate', async (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ valid: false, message: 'No query provided' });
  }

  const parsed = parseBeteckning(query);

  if (!parsed) {
    return res.json({
      valid: false,
      message: 'Ogiltigt format. Använd "KOMMUN TRAKT BLOCK:ENHET"'
    });
  }

  res.json({
    valid: true,
    parsed
  });
});

export default router;
