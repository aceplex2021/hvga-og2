import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const MEMBERS_PROFILE_URL = process.env.MEMBERS_PROFILE_URL;

router.get('/', async (req, res) => {
  try {
    const response = await fetch(MEMBERS_PROFILE_URL, {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members data' });
  }
});

export default router; 