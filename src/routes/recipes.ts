import express from 'express';
import multer from 'multer';
import { scrapeRecipe } from '../utils/recipeScraper';
import { extractRecipeFromImage } from '../utils/recipeExtractor';
import { db } from '../app'; // Import the CouchDB instance
import { DocumentResponseRow } from 'nano';

// Define types
interface Ingredient {
  name: string;
  amount: string;
}

interface MethodStep {
  stepNumber: number;
  description: string;
}

interface Tag {
  name: string;
}

interface Recipe {
  _id?: string;
  _rev?: string;
  title: string;
  image?: Buffer;
  source?: string;
  ingredients: Ingredient[];
  methodSteps: MethodStep[];
  tags: Tag[];
  type: 'recipe';
}

const router = express.Router();
const upload = multer();

// Get all recipes
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.list({ include_docs: true });
    const recipes = rows
      .filter((row): row is DocumentResponseRow<Recipe> => 
        row.doc !== null && 
        typeof row.doc === 'object' && 
        'type' in row.doc && 
        row.doc.type === 'recipe'
      )
      .map(row => {
        const recipe = row.doc;
        return {
          ...recipe,
          image: recipe!!.image
            ? `data:image/jpeg;base64,${Buffer.from(recipe!!.image).toString('base64')}`
            : null
        };
      });
    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get a specific recipe
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await db.get(id);
    if (recipe) {
      if ('image' in recipe && recipe.image instanceof Buffer) {
        res.json({
          ...recipe,
          image: recipe.image.toString('base64')
        });
      } else {
        res.json(recipe);
      }
    }
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: 'Recipe not found' });
  }
});

// Create a new recipe
router.post('/', upload.single('image'), async (req, res) => {
  try {
    let { title, ingredients, methodSteps, tags, source, image } = req.body;
    console.log(req.body);
    // Handle image upload
    let imageBuffer: Buffer | undefined;
    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (image) {
      // Assume image is base64 encoded
      imageBuffer = Buffer.from(image.split(',')[1], 'base64');
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
    // Handle manually added recipe
    else {
      ingredients = ingredients;
      methodSteps = methodSteps;
      tags = tags;
    }

    // Create recipe in database
    const recipe = await saveRecipeToDatabase(title, ingredients, methodSteps, tags, imageBuffer, source);

    res.status(201).json({
      ...recipe,
      image: recipe.image ? `data:image/jpeg;base64,${Buffer.from(recipe.image).toString('base64')}` : null
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

    const existingRecipe = await db.get(id);
    const updatedRecipe = {
      ...existingRecipe,
      title,
      image: imageBuffer,
      source,
      ingredients: ingredients.map((ing: Ingredient) => ({
        name: ing.name,
        amount: ing.amount
      })),
      methodSteps: methodSteps.map((step: string, index: number) => ({
        stepNumber: index + 1,
        description: step,
      })),
      tags: tags.map((tag: Tag) => ({
        name: tag.name,
      })),
    };

    const response = await db.insert(updatedRecipe);
    if (response.ok) {
      res.json({
        ...updatedRecipe,
        image: updatedRecipe.image ? `${Buffer.from(updatedRecipe.image).toString('base64')}` : null
      });
    } else {
      throw new Error('Failed to update recipe');
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// Delete a recipe
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await db.get(id);
    await db.destroy(id, recipe._rev);
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

export default router;

async function saveRecipeToDatabase(
  title: string,
  ingredients: Ingredient[],
  methodSteps: MethodStep[],
  tags: Tag[],
  imageBuffer: Buffer | undefined,
  source: string | undefined
): Promise<Recipe> {
  console.log('Saving recipe to database:', title, ingredients, methodSteps, tags, imageBuffer, source);
  const recipe: Recipe = {
    title,
    image: imageBuffer,
    source,
    ingredients,
    methodSteps: methodSteps,
    tags,
    type: 'recipe',
  };

  const response = await db.insert(recipe);
  if (response.ok) {
    return { ...recipe, _id: response.id, _rev: response.rev };
  } else {
    throw new Error('Failed to save recipe');
  }
}
