import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateNewConversationId } from '../utils/idGenerator';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', async (req: Request, res: Response) => {
  const { name } = req.body;
  const id = generateNewConversationId();
  const conversation = await prisma.conversation.create({
    data: { id, name },
  });
  res.json(conversation);
});

router.get('/', async (req: Request, res: Response) => {
  const conversations = await prisma.conversation.findMany();
  res.json(conversations);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  const updatedConversation = await prisma.conversation.update({
    where: { id },
    data: { name },
  });
  res.json(updatedConversation);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.conversation.delete({
    where: { id },
  });
  res.sendStatus(204);
});

export default router;