import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import conversationsRouter from './routes/conversations';
import chatRouter from './routes/chat';
import errorHandler from './middleware/errorHandler';
import dotenv from 'dotenv';
import recipeRoutes from './routes/recipes';
import nano from 'nano';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

const couchDbUsername = process.env.COUCHDB_USERNAME;
const couchDbPassword = process.env.COUCHDB_PASSWORD;
const dbAuthenticatedUrl = `http://${couchDbUsername}:${couchDbPassword}@localhost:5984`;


dotenv.config();

// Initialize CouchDB connection
const couchDb = nano(dbAuthenticatedUrl);
const db = couchDb.use('ai_backend');

app.use(cors({
  origin: 'http://localhost:1420', // Adjust as necessary
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

export { app, prisma, db };