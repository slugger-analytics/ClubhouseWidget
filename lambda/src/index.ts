import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import serverlessExpress from '@codegenie/serverless-express';
import path from 'path';

import usersRouter from './routes/users';
import tasksRouter from './routes/tasks';
import inventoryRouter from './routes/inventory';
import teamsRouter from './routes/teams';
import gamesRouter from './routes/games';
import mealsRouter from './routes/meals';

const app = express();
const BASE_PATH = process.env.BASE_PATH || '/widgets/clubhouse';

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint
app.get(`${BASE_PATH}/health`, async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'ClubhouseWidget Lambda is running',
    timestamp: new Date().toISOString(),
    basePath: BASE_PATH,
  });
});

// API Routes
app.use(`${BASE_PATH}/api/users`, usersRouter);
app.use(`${BASE_PATH}/api/tasks`, tasksRouter);
app.use(`${BASE_PATH}/api/inventory`, inventoryRouter);
app.use(`${BASE_PATH}/api/teams`, teamsRouter);
app.use(`${BASE_PATH}/api/games`, gamesRouter);
app.use(`${BASE_PATH}/api/meals`, mealsRouter);

// Root API endpoint
app.get(`${BASE_PATH}/api`, (req: Request, res: Response) => {
  res.json({
    message: 'ClubhouseWidget API',
    version: '1.0.0',
    endpoints: {
      health: `${BASE_PATH}/health`,
      users: `${BASE_PATH}/api/users`,
      tasks: `${BASE_PATH}/api/tasks`,
      inventory: `${BASE_PATH}/api/inventory`,
      teams: `${BASE_PATH}/api/teams`,
      games: `${BASE_PATH}/api/games`,
      meals: `${BASE_PATH}/api/meals`,
    },
  });
});

// Serve static files for SPA
app.use(BASE_PATH, express.static(path.join(__dirname, '..', 'public')));

// SPA fallback - serve index.html for all non-API routes
app.get(`${BASE_PATH}/*`, (req: Request, res: Response) => {
  // Don't serve index.html for API routes
  if (req.path.includes('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Handle root path
app.get(BASE_PATH, (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Lambda handler
export const handler = serverlessExpress({ app });

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 ClubhouseWidget Lambda running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}${BASE_PATH}/health`);
    console.log(`📋 API: http://localhost:${PORT}${BASE_PATH}/api`);
  });
}

export { app };
