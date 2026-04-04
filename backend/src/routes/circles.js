const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  /**
   * POST /api/circles/metadata
   * Save circle metadata (display name, description)
   * Body: { contractAddress, name, description }
   */
  router.post('/metadata', async (req, res) => {
    try {
      const { contractAddress, name, description } = req.body;

      if (!contractAddress || !name) {
        return res.status(400).json({ error: 'contractAddress and name required' });
      }

      const metadata = {
        contractAddress: contractAddress.toLowerCase(),
        name,
        description: description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('circles').doc(contractAddress.toLowerCase()).set(metadata, { merge: true });

      res.json({
        success: true,
        message: 'Circle metadata saved',
        data: metadata,
      });
    } catch (err) {
      console.error('Error saving circle metadata:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/circles/:contractAddress
   * Get circle metadata by contract address
   */
  router.get('/:contractAddress', async (req, res) => {
    try {
      const { contractAddress } = req.params;

      const doc = await db.collection('circles').doc(contractAddress.toLowerCase()).get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Circle not found' });
      }

      res.json({
        success: true,
        data: doc.data(),
      });
    } catch (err) {
      console.error('Error getting circle metadata:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/circles
   * Get all circles (paginated)
   */
  router.get('/', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = parseInt(req.query.offset) || 0;

      const snapshot = await db
        .collection('circles')
        .limit(limit + 1)
        .offset(offset)
        .get();

      const circles = snapshot.docs.map((doc) => doc.data());
      const hasMore = circles.length > limit;

      res.json({
        success: true,
        data: circles.slice(0, limit),
        hasMore,
        total: circles.length,
      });
    } catch (err) {
      console.error('Error getting circles:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * PUT /api/circles/:contractAddress
   * Update circle metadata
   */
  router.put('/:contractAddress', async (req, res) => {
    try {
      const { contractAddress } = req.params;
      const { name, description } = req.body;

      const updateData = {
        updatedAt: new Date().toISOString(),
      };

      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      await db.collection('circles').doc(contractAddress.toLowerCase()).update(updateData);

      res.json({
        success: true,
        message: 'Circle metadata updated',
        data: updateData,
      });
    } catch (err) {
      console.error('Error updating circle metadata:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
