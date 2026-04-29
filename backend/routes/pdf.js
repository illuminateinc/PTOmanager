const { Router } = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = Router();

async function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (process.env.ANTHROPIC_API_KEY_SECRET_ARN) {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const secret = await sm.send(new GetSecretValueCommand({ SecretId: process.env.ANTHROPIC_API_KEY_SECRET_ARN }));
    return JSON.parse(secret.SecretString).key;
  }
  throw new Error('No Anthropic API key configured');
}

// POST /api/pdf/parse
router.post('/parse', async (req, res, next) => {
  try {
    const { base64Data, employeeNames } = req.body;
    if (!base64Data) return res.status(400).json({ error: 'base64Data is required' });

    const anthropic = new Anthropic({ apiKey: await getApiKey() });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
          },
          {
            type: 'text',
            text: `Parse this PTO request form. Known employees: ${(employeeNames || []).join(', ')}

Return ONLY valid JSON (no markdown):
{"employeeName":"...","matchedEmployee":"best match from list or null","bucket":"vacation|sick|personal|floatHoliday","from":"YYYY-MM-DD","to":"YYYY-MM-DD","days":N,"note":"...","confidence":"high|medium|low","warnings":[]}

Bucket rules: sick/medical/illness→sick, personal/family→personal, float/comp→floatHoliday, vacation/bereavement/other→vacation`,
          },
        ],
      }],
    });

    const raw = message.content.find(b => b.type === 'text')?.text || '';
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'Could not parse AI response as JSON' });
    }
    next(err);
  }
});

module.exports = router;
