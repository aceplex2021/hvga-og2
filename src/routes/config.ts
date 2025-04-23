import { Router } from 'express';

const router = Router();

router.get('/config', (req, res) => {
  res.json({
    deepgramKey: process.env.DEEPGRAM_API_KEY
  });
});

export default router; 