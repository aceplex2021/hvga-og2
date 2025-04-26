import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// POST /api/feedback - Submit feedback
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { data, error } = await supabase
      .from('hvga_feedback')
      .insert([{ message: message.trim() }]);

    if (error) {
      console.error('Error submitting feedback:', error);
      return res.status(500).json({ error: 'Failed to submit feedback' });
    }

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error in feedback route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 