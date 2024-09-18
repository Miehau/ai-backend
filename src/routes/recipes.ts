import express from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { scrapeRecipe } from '../utils/recipeScraper';
import { extractRecipeFromImage } from '../utils/recipeExtractor';

// Add these interfaces
interface Ingredient {
  name: string;
  amount: string;
}

interface Tag {
  name: string;
}

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer();

// Get all recipes
router.get('/', async (req, res) => {
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: true, methodSteps: true, tags: { include: { tag: true } } },
  });
  res.json(recipes.map(recipe => ({
    ...recipe,
    image: recipe.image ? `${recipe.image.toString('base64')}` : null
  })));
});

// Get a specific recipe
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true, methodSteps: true, tags: { include: { tag: true } } },
  });
  if (recipe) {
    res.json({
      ...recipe,
      image: recipe.image ? `${recipe.image.toString('base64')}` : null
    });
  } else {
    res.status(404).json({ error: 'Recipe not found' });
  }
});

// Create a new recipe
router.post('/', upload.single('image'), async (req, res) => {
  try {
    let { title, ingredients, methodSteps, tags, source, image } = req.body;

    // Handle image upload
    let imageBuffer: Buffer | undefined;
    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (image) {
      // Assume image is base64 encoded
      imageBuffer = Buffer.from(image, 'base64');
    }

    // Handle URL-based scraping
    if (source && !title) {
      const scrapedRecipe = await scrapeRecipe(source);
      ({ title, ingredients, methodSteps, tags, imageBuffer } = scrapedRecipe);
    }
    // Handle image-based recipe extraction
    else if (imageBuffer && (!ingredients || !methodSteps)) {
      const extractedRecipe = await extractRecipeFromImage(imageBuffer);
      title = extractedRecipe.title;
      ingredients = extractedRecipe.ingredients;
      methodSteps = extractedRecipe.methodSteps;
      tags = tags || []; 
    }

    // Create recipe in database
    const recipe = await saveRecipeToDatabase(title, ingredients, methodSteps, tags, imageBuffer, source);

    res.status(201).json({
        ...recipe,
        image: recipe.image ? `${recipe.image.toString('base64')}` : null
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Update a recipe
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    let { title, ingredients, methodSteps, tags, source, image } = req.body;

    // Handle image upload
    let imageBuffer: Buffer | undefined;
    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (image) {
      // Assume image is base64 encoded
      imageBuffer = Buffer.from(image, 'base64');
    }

    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        title,
        image: imageBuffer,
        source,
        ingredients: {
          deleteMany: {},
          create: (ingredients as Ingredient[]).map(ing => ({
            name: ing.name,
            amount: ing.amount
          })),
        },
        methodSteps: {
          deleteMany: {},
          create: (methodSteps as string[]).map((step, index) => ({
            stepNumber: index + 1,
            description: step,
          })),
        },
        tags: {
          deleteMany: {},
          create: (tags as Tag[]).map(tag => ({
            tag: {
              connectOrCreate: {
                where: { name: tag.name },
                create: { name: tag.name },
              },
            },
          })),
        },
      },
      include: { ingredients: true, methodSteps: true, tags: { include: { tag: true } } },
    });

    res.json({
        ...recipe,
        image: recipe.image ? `${recipe.image.toString('base64')}` : null
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// Delete a recipe
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.recipe.delete({ where: { id } });
  res.status(204).end();
});

export default router;

function saveRecipeToDatabase(title: string, ingredients: Ingredient[], methodSteps: string[], tags: Tag[], imageBuffer: Buffer | undefined, source: string | undefined) {
    console.log('Saving recipe to database:', title, ingredients, methodSteps, tags, imageBuffer, source);
  return prisma.recipe.create({
    data: {
      title,
      image: imageBuffer, // Keep it as Buffer
      source,
      ingredients: {
        create: ingredients.map(ing => ({
          name: ing.name,
          amount: ing.amount
        })),
      },
      methodSteps: {
        create: methodSteps.map((step, index) => ({
          stepNumber: index + 1,
          description: step,
        })),
      },
      tags: {
        create: tags.map(tag => ({
            tag: {
              create: { name: tag.name },
            },
          })),
      },
    },
    include: { ingredients: true, methodSteps: true, tags: { include: { tag: true } } },
  });
}
