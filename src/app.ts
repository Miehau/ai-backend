import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Meal Planning and AI Chat Backend');
});

// Meal planning route (placeholder)
app.get('/api/meal-plan', (req: Request, res: Response) => {
  res.json({ message: 'Meal planning endpoint' });
});

// AI chat route (placeholder)
app.post('/api/chat', (req: Request, res: Response) => {
  res.json({ message: 'AI chat endpoint' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});