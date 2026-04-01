const express = require('express');
const Replicate = require('replicate');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;

const ACTIVE_VERSION = 'aca001c8b137114d5e594c68f7084ae6d82f364758aab8d997b233e8ef3c4d93';

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (_req, res) => {
  res.send('Smile Dental API is running. Use /api/health and /api/smile.');
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, active_version: ACTIVE_VERSION, timestamp: new Date().toISOString() });
});

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

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
    const { image, mask } = req.body;

    if (!image || !mask) {
      return res.status(400).json({ error: 'Image and mask are required' });
    }
    if (typeof image !== 'string' || typeof mask !== 'string') {
      return res.status(400).json({ error: 'Image and mask must be base64 strings' });
    }

    const modelInput = {
      image,
      mask,
      prompt:
        'Enhance realism of the teeth and mouth area. Improve lighting, texture, and blending. Do not change shape, alignment, or identity. Keep everything natural.',
      negative_prompt:
        'face change, new teeth, distorted mouth, unrealistic, plastic, beauty filter',
      num_inference_steps: 20,
      guidance_scale: 5,
      strength: 0.25,
      mask_blur: 4,
      width: 512,
      height: 512,
    };

    const prediction = await replicate.predictions.create({
      version: ACTIVE_VERSION,
      input: modelInput,
    });

    let result = await replicate.predictions.get(prediction.id);
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await replicate.predictions.get(prediction.id);
    }

    if (result.status !== 'succeeded') {
      return res.status(500).json({ error: result.error || 'AI processing failed' });
    }

    const output = Array.isArray(result.output) ? result.output[0] : result.output;
    const outputDataUrl = typeof output === 'string' ? await toDataUrlFromRemote(output) : null;
    return res.json({ output, outputDataUrl });
  } catch (error) {
    if (error?.status === 429) {
      return res.status(429).json({ error: error.message, retry_after: error.retryAfter ?? 10 });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
