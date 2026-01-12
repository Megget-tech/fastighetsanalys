import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  initializeDatabase,
  checkConnection,
  cleanupCache
} from './config/database';
import areasRoutes from './routes/areas.routes';
import dataRoutes from './routes/data.routes';
import propertiesRoutes from './routes/properties.routes';
import booliRoutes from './routes/booli.routes';
import { getSCBQueueStats } from './utils/rate-limiter';
import { getCacheStats } from './services/cache.service';

dotenv.config();

// Increase max listeners to prevent warnings during hot reload (tsx watch mode)
process.setMaxListeners(20);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Support large GeoJSON polygons
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const dbConnected = await checkConnection();

  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Stats endpoint
app.get('/api/stats', (req: Request, res: Response) => {
  const scbQueueStats = getSCBQueueStats();
  const cacheStats = getCacheStats();

  res.json({
    scb_queue: scbQueueStats,
    cache: cacheStats,
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/areas', areasRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/booli', booliRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err);

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Startup
async function startServer() {
  try {
    console.log('🚀 Starting Fastighetsanalys Backend...\n');

    // Check database connection
    console.log('1. Checking database connection...');
    const dbConnected = await checkConnection();

    if (!dbConnected) {
      console.error('\n❌ Database connection failed!');
      console.error('   Make sure PostgreSQL is running:');
      console.error('   > docker-compose up -d\n');
      process.exit(1);
    }

    // Initialize database schema
    console.log('\n2. Initializing database schema...');
    await initializeDatabase();

    // Check for DeSO data
    console.log('\n3. Checking for DeSO geodata...');
    const { query } = await import('./config/database');
    const result = await query('SELECT COUNT(*) FROM deso_areas');
    const desoCount = parseInt(result.rows[0].count, 10);

    if (desoCount === 0) {
      console.error('\n⚠️  WARNING: No DeSO geodata found!');
      console.error('   You need to import DeSO data before using the API:');
      console.error('   > cd backend');
      console.error('   > npm run import-deso\n');
      console.error('   Server will start, but geo queries will fail.\n');
    } else {
      console.log(`✓ Found ${desoCount} DeSO areas in database`);
    }

    // Cleanup old cache
    console.log('\n4. Cleaning up expired cache...');
    await cleanupCache();

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('✅ FASTIGHETSANALYS BACKEND RUNNING');
      console.log('='.repeat(60));
      console.log(`Server:      http://localhost:${PORT}`);
      console.log(`Health:      http://localhost:${PORT}/health`);
      console.log(`Stats:       http://localhost:${PORT}/api/stats`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(60));
      console.log('\nEndpoints:');
      console.log('  POST /api/areas/find-deso');
      console.log('  GET  /api/areas/deso/:desoCode');
      console.log('  GET  /api/areas/boundaries/deso?codes=...');
      console.log('  GET  /api/data/metrics/:desoCode');
      console.log('  GET  /api/data/timeseries/:desoCode/:metric');
      console.log('  GET  /api/data/kommun/:kommunCode');
      console.log('  GET  /api/data/riket');
      console.log('  POST /api/booli/upload');
      console.log('  GET  /api/booli/sales');
      console.log('  GET  /api/booli/trends');
      console.log('  GET  /api/booli/summary');
      console.log('\n✨ Ready to accept requests!\n');
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      console.log(`\n⏹️  ${signal} received, shutting down gracefully...`);

      // Close server (stop accepting new connections)
      server.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Close database pool
      const { pool } = await import('./config/database');
      await pool.end();
      console.log('✅ Database connections closed');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('\n❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
