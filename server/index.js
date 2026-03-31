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

app.get('/api/replicate-account', async (_req, res) => {
  try {
    const token = process.env.REPLICATE_API_TOKEN || '';
    const maskedToken = token.length > 12 ? `${token.slice(0, 6)}...${token.slice(-4)}` : 'missing';

    const response = await fetch('https://api.replicate.com/v1/account', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return res.status(response.status).json({
      ok: response.ok,
      token_hint: maskedToken,
      account: data,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    active_version: ACTIVE_VERSION,
    timestamp: new Date().toISOString(),
  });
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

async function createPrediction(modelInput) {
  return replicate.predictions.create({
    version: ACTIVE_VERSION,
    input: modelInput,
  });
}

app.post('/api/smile', async (req, res) => {
  try {
    const { image, mask, mode = 'whitening' } = req.body;
    if (!image || !mask) {
      return res.status(400).json({ error: 'Image and mask are required' });
    }

    const prompts = {
      whitening:
        'Enhance only the teeth to simulate professional teeth whitening. Make teeth visibly whiter and cleaner while keeping natural texture. Do not change shape or alignment. Do not modify lips, skin, or face.',
      alignment:
        'Enhance only the teeth to simulate improved alignment. Make teeth slightly straighter and evenly spaced while keeping natural imperfections. Do not modify face, lips, or identity.',
      transformation:
        'Enhance only the teeth to create a visibly improved smile. Teeth should be whiter and slightly aligned while keeping result natural. Do not modify face, lips, or identity.',
    };

    const normalizedMode = ['whitening', 'alignment', 'transformation'].includes(mode) ? mode : 'whitening';

    const modelInput = {
      image,
      mask,
      prompt: prompts[normalizedMode],
      negative_prompt:
        'face change, skin smoothing, eye enhancement, hair change, extra teeth, distorted mouth, unrealistic smile, beauty filter',
      num_inference_steps: 30,
      guidance_scale: 7,
      strength: 0.6,
      mask_blur: 2,
    };

    const prediction = await createPrediction(modelInput);
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
    return res.json({ output, outputDataUrl, mode: normalizedMode });
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

