import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import conversationsRouter from './routes/conversations';
import chatRouter from './routes/chat';
import errorHandler from './middleware/errorHandler';
import dotenv from 'dotenv';
import recipeRoutes from './routes/recipes';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

dotenv.config();

app.use(cors({
  origin: 'http://localhost:1420', // Adjust as necessary
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/conversations', conversationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/recipes', recipeRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export { app, prisma };