const express = require('express');
const Replicate = require('replicate');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;

const MODEL_SLUG = 'sepal/sdxl-inpainting';
const MODEL_VERSION = 'aca001c8b137114d5e594c68f7084ae6d82f364758aab8d997b233e8ef3c4d93';

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (_req, res) => {
  res.send('Smile Dental API is running. Use /api/health and /api/smile.');
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: MODEL_SLUG,
    timestamp: new Date().toISOString(),
  });
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('Missing REPLICATE_API_TOKEN in server/.env');
}

async function toDataUrlFromRemote(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (_error) {
    return null;
  }
}

app.post('/api/smile', async (req, res) => {
  try {
    const { image, mask, mode = 'whitening' } = req.body;

    if (!image || !mask) {
      return res.status(400).json({ error: 'Image and mask are required' });
    }

    const treatmentPrompts = {
      whitening:
        'Enhance only the masked teeth area. Make teeth visibly whiter and cleaner while preserving natural enamel texture. Keep the change clearly noticeable but medically realistic. Preserve identity, lips, skin tone, face shape, and lighting exactly as in the original photo.',
      alignment:
        'Enhance only the masked teeth area to simulate realistic orthodontic treatment with clearly visible braces on upper and lower teeth. Improve alignment naturally with medically realistic metal brackets and wire. Keep result noticeable but natural. Preserve identity, lips, skin, and lighting exactly.',
      transformation:
        'Enhance only the masked teeth area for a complete smile transformation. Make teeth visibly whiter, cleaner, and more aligned in a realistic dental outcome. Keep results noticeable yet natural and medically plausible. Preserve identity, lips, skin, and lighting exactly.',
    };

    const modeStrength = {
      whitening: 0.65,
      alignment: 0.7,
      transformation: 0.75,
    };

    const normalizedMode = ['whitening', 'alignment', 'transformation'].includes(mode)
      ? mode
      : 'whitening';

    const negativePrompt =
      'distorted face, extra teeth, fake smile, plastic texture, blurry, unrealistic, duplicate mouth, duplicate teeth';

    const modelInput = {
      image,
      mask,
      prompt: treatmentPrompts[normalizedMode],
      negative_prompt: negativePrompt,
      num_inference_steps: 30,
      guidance_scale: 7,
      strength: modeStrength[normalizedMode],
      mask_blur: 4,
    };

    const prediction = await replicate.predictions.create({
      version: MODEL_VERSION,
      input: modelInput,
    });

    let result = await replicate.predictions.get(prediction.id);
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await replicate.predictions.get(prediction.id);
    }

    if (result.status === 'succeeded') {
      const output = Array.isArray(result.output) ? result.output[0] : result.output;
      const outputDataUrl = typeof output === 'string' ? await toDataUrlFromRemote(output) : null;
      return res.json({ output, outputDataUrl, mode: normalizedMode });
    }

    return res.status(500).json({ error: result.error || 'AI processing failed' });
  } catch (error) {
    if (error?.status === 429) {
      return res.status(429).json({
        error: error.message,
        retry_after: error.retryAfter ?? 10,
      });
    }

    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

