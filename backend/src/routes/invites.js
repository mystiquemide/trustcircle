const express = require('express');
const { v4: uuidv4 } = require('uuid');

module.exports = (db) => {
  const router = express.Router();

  /**
   * POST /api/invites
   * Generate a short invite code for a circle
   * Body: { contractAddress, expiresIn (optional, hours) }
   */
  router.post('/', async (req, res) => {
    try {
      const { contractAddress, expiresIn = 30 * 24 } = req.body;

      if (!contractAddress) {
        return res.status(400).json({ error: 'contractAddress required' });
      }

      // Generate short invite code (8-char alphanumeric)
      const shortCode = uuidv4().substring(0, 8).toUpperCase();

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);

      const inviteData = {
        shortCode,
        contractAddress: contractAddress.toLowerCase(),
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        used: false,
        joinedMembers: [],
      };

      await db.collection('invites').doc(shortCode).set(inviteData);

      res.json({
        success: true,
        message: 'Invite code generated',
        data: {
          shortCode,
          inviteUrl: `/join/${shortCode}`,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (err) {
      console.error('Error generating invite code:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/invites/:code
   * Resolve invite code to contract address
   */
  router.get('/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const doc = await db.collection('invites').doc(code.toUpperCase()).get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Invite code not found' });
      }

      const invite = doc.data();

      // Check if invite expired
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'Invite code expired' });
      }

      // Get circle metadata
      const circleDoc = await db.collection('circles').doc(invite.contractAddress).get();
      const circleName = circleDoc.exists ? circleDoc.data().name : 'Unknown Circle';

      res.json({
        success: true,
        data: {
          shortCode: code.toUpperCase(),
          contractAddress: invite.contractAddress,
          circleName,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          usersJoined: invite.joinedMembers.length,
        },
      });
    } catch (err) {
      console.error('Error resolving invite code:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/invites/:code/joined
   * Record a user joining via invite
   */
  router.post('/:code/joined', async (req, res) => {
    try {
      const { code } = req.params;
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress required' });
      }

      const doc = await db.collection('invites').doc(code.toUpperCase()).get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Invite code not found' });
      }

      const invite = doc.data();
      const normalizedAddress = walletAddress.toLowerCase();

      // Add wallet to joinedMembers if not already present
      if (!invite.joinedMembers.includes(normalizedAddress)) {
        invite.joinedMembers.push(normalizedAddress);
        await db.collection('invites').doc(code.toUpperCase()).update({
          joinedMembers: invite.joinedMembers,
        });
      }

      res.json({
        success: true,
        message: 'User recorded in invite',
        data: {
          shortCode: code.toUpperCase(),
          contractAddress: invite.contractAddress,
          totalJoined: invite.joinedMembers.length,
        },
      });
    } catch (err) {
      console.error('Error recording invite join:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/invites
   * List all active invites (admin)
   */
  router.get('/', async (req, res) => {
    try {
      const snapshot = await db
        .collection('invites')
        .where('expiresAt', '>', new Date().toISOString())
        .limit(50)
        .get();

      const invites = snapshot.docs.map((doc) => doc.data());

      res.json({
        success: true,
        data: invites,
        total: invites.length,
      });
    } catch (err) {
      console.error('Error listing invites:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
