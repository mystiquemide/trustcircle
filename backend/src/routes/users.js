const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  /**
   * POST /api/users/preferences
   * Save user notification preferences
   * Body: { walletAddress, email, enablePushNotifications, timezoneName }
   */
  router.post('/preferences', async (req, res) => {
    try {
      const { walletAddress, email, enablePushNotifications = true, timezoneName = 'UTC' } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress required' });
      }

      const preferences = {
        walletAddress: walletAddress.toLowerCase(),
        email: email || '',
        enablePushNotifications,
        timezoneName,
        updatedAt: new Date().toISOString(),
      };

      await db.collection('users').doc(walletAddress.toLowerCase()).set(preferences, { merge: true });

      res.json({
        success: true,
        message: 'User preferences saved',
        data: preferences,
      });
    } catch (err) {
      console.error('Error saving user preferences:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/users/:walletAddress/preferences
   * Get user notification preferences
   */
  router.get('/:walletAddress/preferences', async (req, res) => {
    try {
      const { walletAddress } = req.params;

      const doc = await db.collection('users').doc(walletAddress.toLowerCase()).get();

      if (!doc.exists) {
        return res.json({
          success: true,
          data: {
            walletAddress: walletAddress.toLowerCase(),
            email: '',
            enablePushNotifications: true,
            timezoneName: 'UTC',
          },
        });
      }

      res.json({
        success: true,
        data: doc.data(),
      });
    } catch (err) {
      console.error('Error getting user preferences:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/users/register-device
   * Register device FCM token for push notifications
   * Body: { walletAddress, fcmToken, deviceName (optional) }
   */
  router.post('/register-device', async (req, res) => {
    try {
      const { walletAddress, fcmToken, deviceName } = req.body;

      if (!walletAddress || !fcmToken) {
        return res.status(400).json({ error: 'walletAddress and fcmToken required' });
      }

      const userRef = db.collection('users').doc(walletAddress.toLowerCase());
      const userDoc = await userRef.get();

      let devices = [];
      if (userDoc.exists && userDoc.data().devices) {
        devices = userDoc.data().devices;
      }

      // Check if device already registered (update token if so)
      const existingDeviceIndex = devices.findIndex((d) => d.fcmToken === fcmToken);
      if (existingDeviceIndex >= 0) {
        devices[existingDeviceIndex] = {
          fcmToken,
          deviceName: deviceName || 'Device',
          registeredAt: new Date().toISOString(),
        };
      } else {
        devices.push({
          fcmToken,
          deviceName: deviceName || 'Device',
          registeredAt: new Date().toISOString(),
        });
      }

      await userRef.set({ devices }, { merge: true });

      res.json({
        success: true,
        message: 'Device registered for notifications',
        data: {
          walletAddress: walletAddress.toLowerCase(),
          totalDevices: devices.length,
        },
      });
    } catch (err) {
      console.error('Error registering device:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/users/circles/:walletAddress
   * Get circles that user is a member of (from their preferences)
   */
  router.get('/circles/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;

      const doc = await db.collection('users').doc(walletAddress.toLowerCase()).get();

      if (!doc.exists) {
        return res.json({
          success: true,
          data: {
            circles: [],
          },
        });
      }

      const userData = doc.data();
      const circles = userData.circles || [];

      res.json({
        success: true,
        data: {
          walletAddress: walletAddress.toLowerCase(),
          circles,
          totalCircles: circles.length,
        },
      });
    } catch (err) {
      console.error('Error getting user circles:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/users/track-circle
   * Track a circle for a user (for notification purposes)
   * Body: { walletAddress, contractAddress }
   */
  router.post('/track-circle', async (req, res) => {
    try {
      const { walletAddress, contractAddress } = req.body;

      if (!walletAddress || !contractAddress) {
        return res.status(400).json({ error: 'walletAddress and contractAddress required' });
      }

      const userRef = db.collection('users').doc(walletAddress.toLowerCase());
      const userDoc = await userRef.get();

      let circles = [];
      if (userDoc.exists && userDoc.data().circles) {
        circles = userDoc.data().circles;
      }

      const normalizedAddress = contractAddress.toLowerCase();
      if (!circles.includes(normalizedAddress)) {
        circles.push(normalizedAddress);
      }

      await userRef.set({ circles }, { merge: true });

      res.json({
        success: true,
        message: 'Circle tracked for user',
        data: {
          walletAddress: walletAddress.toLowerCase(),
          contractAddress: normalizedAddress,
          totalTracked: circles.length,
        },
      });
    } catch (err) {
      console.error('Error tracking circle:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
