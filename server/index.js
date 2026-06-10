const express = require('express');
const Replicate = require('replicate');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;

// Render (and most hosts) put the app behind a proxy, so trust it to get the
// real client IP for rate limiting.
app.set('trust proxy', 1);

const ACTIVE_VERSION = 'aca001c8b137114d5e594c68f7084ae6d82f364758aab8d997b233e8ef3c4d93';

// Restrict who can call this API. Set ALLOWED_ORIGINS on the server (comma
// separated, e.g. "https://user.github.io,http://localhost:5173"). If it is
// not set we fall back to open CORS so existing deployments keep working, but
// a warning is logged to nudge proper lockdown.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn(
    '[security] ALLOWED_ORIGINS is not set — CORS is open to all origins. ' +
    'Set ALLOWED_ORIGINS to your site URL(s) to protect your Replicate credits.'
  );
}

const corsOptions = {
  origin(origin, callback) {
    // No allowlist configured → allow all (legacy behavior).
    if (allowedOrigins.length === 0) return callback(null, true);
    // Allow same-origin / non-browser requests (no Origin header) and health checks.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Lightweight in-memory rate limiter for the expensive AI endpoint. Prevents a
// single client from draining Replicate credits. Tune via env if needed.
const RATE_LIMIT_WINDOW_MS = Math.max(1000, parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000);
const RATE_LIMIT_MAX = Math.max(1, parseInt(process.env.RATE_LIMIT_MAX || '15', 10) || 15);
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retry_after: retryAfter });
  }

  bucket.count += 1;
  return next();
}

// Periodically clear stale buckets so the map does not grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

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
  } catch {
    return null;
  }
}

const ALLOWED_TREATMENTS = ['whitening', 'alignment', 'transformation'];

app.post('/api/smile', rateLimit, async (req, res) => {
  try {
    const { image, mask, treatment, midlineX } = req.body;

    if (!image || !mask) {
      return res.status(400).json({ error: 'Image and mask are required' });
    }
    if (typeof image !== 'string' || typeof mask !== 'string') {
      return res.status(400).json({ error: 'Image and mask must be base64 strings' });
    }
    // Only accept data-URL image payloads to avoid the server being used to
    // fetch arbitrary remote URLs (SSRF) via the model input.
    if (!image.startsWith('data:image/') || !mask.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Image and mask must be data URLs' });
    }

    const activeTreatment = ALLOWED_TREATMENTS.includes(treatment) ? treatment : 'whitening';
    /** Whitening-only: no words implying hardware (client composites vectors). Describe exclusions without naming appliances. */
    const whiteningNegative =
      'facial structure change, new teeth, distorted mouth, unrealistic, plastic beauty filter, recolored lips or gums, lip color change, skin discoloration near mouth, unnatural or painted gum line, gum tissue recoloring, non-enamel surface attachments, stray specular blobs on enamel';
    const baseNegative =
      'braces, wires, brackets, dental appliances, face change, new teeth, distorted mouth, unrealistic, plastic, beauty filter, recolored lips or gums, lip color change, skin discoloration near mouth, unnatural or painted gum line, gum tissue recoloring';
    const alignmentNegativeExtra =
      'extra teeth, crowded teeth, overlapping enamel, double teeth, blurred gum-line, inverted teeth, downward tapering, v-shaped smile, jagged biting edges';

    let prompt;
    let negative_prompt;
    let prompt_strength;

    if (activeTreatment === 'alignment') {
      prompt =
        'Surgically straight dental alignment, perfectly level occlusal plane, horizontal biting edge, perpendicular midline (vertical line between central incisors, square to the occlusal plane), perfect midline symmetry, professionally straightened teeth, anatomical tooth separation, high-end orthodontic results, 8k dental photography.';
      if (typeof midlineX === 'number' && Number.isFinite(midlineX)) {
        prompt += ' Incisors centered on facial midline.';
      }
      negative_prompt = `${baseNegative}, ${alignmentNegativeExtra}`;
      prompt_strength = 0.40;
    } else if (activeTreatment === 'transformation') {
      prompt =
        'Full-arch smile refinement: natural straight alignment, level occlusal plane, closed interdental contacts with no black gaps or voids, seamless enamel continuity, realistic translucency, crisp incisal edges, photorealistic 8k dental portrait, medical photography.';
      if (typeof midlineX === 'number' && Number.isFinite(midlineX)) {
        prompt += ' Central incisors aligned to facial midline.';
      }
      negative_prompt = `${baseNegative}, ${alignmentNegativeExtra}, black holes between teeth, dark vertical gaps, duplicated teeth, ghosting, double exposure, stretched smeared enamel, plastic block teeth, jagged white artifacts, blue or gray digital corruption`;
      prompt_strength = 0.39;
    } else if (activeTreatment === 'whitening') {
      prompt =
        'Pristine natural dentition, flawlessly whitened translucent enamel, professional in-office whitening, lifelike enamel depth and translucency, realistic inter-tooth separation, photorealistic oral close-up, 8k dental photography.';
      negative_prompt = whiteningNegative;
      prompt_strength = 0.46;
    } else {
      prompt =
        'Individual human teeth, natural enamel translucency, professional dental cleaning, realistic tooth separation, high-contrast tooth edges, 8k dental photography.';
      negative_prompt = baseNegative;
      prompt_strength = 0.46;
    }

    // sepal/sdxl-inpainting (aca001c8…): documented inputs are prompt, negative_prompt, image, mask,
    // num_inference_steps, guidance_scale, prompt_strength, seed — not content_weight/strength/mask_blur/width.
    // Fewer steps = faster runs (~linear in step count). Default favors speed; raise REPLICATE_INFERENCE_STEPS for quality.
    const stepsRaw = parseInt(process.env.REPLICATE_INFERENCE_STEPS || '10', 10);
    const num_inference_steps = Number.isFinite(stepsRaw) ? Math.min(30, Math.max(8, stepsRaw)) : 12;

    const modelInput = {
      image,
      mask,
      prompt,
      negative_prompt,
      num_inference_steps,
      guidance_scale: 5,
      prompt_strength,
    };

    const prediction = await replicate.predictions.create({
      version: ACTIVE_VERSION,
      input: modelInput,
    });

    const pollMs = Math.min(2000, Math.max(200, parseInt(process.env.REPLICATE_POLL_MS || '320', 10) || 320));
    const maxPolls = Math.min(400, Math.max(40, parseInt(process.env.REPLICATE_MAX_POLLS || '200', 10) || 200));
    let result = await replicate.predictions.get(prediction.id);
    let polls = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      polls += 1;
      if (polls > maxPolls) {
        return res.status(504).json({
          error: 'AI job timed out while waiting for Replicate. Try again or increase REPLICATE_MAX_POLLS.',
        });
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
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
