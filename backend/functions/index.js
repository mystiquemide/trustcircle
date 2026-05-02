/**
 * Firebase Cloud Functions for TrustCircle
 * Deploy with: firebase deploy --only functions
 * 
 * Scheduled trigger runs every hour to check for upcoming contribution deadlines
 * and send push notifications to users 48 hours before deadline.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const express = require('express');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

const apiApp = express();
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());

const normalizeAddress = (address) => String(address || '').toLowerCase();
const createInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

apiApp.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

apiApp.post('/api/circles/metadata', async (req, res) => {
  try {
    const { contractAddress, name, description, isPublic, circleId } = req.body;

    if (!contractAddress || !name) {
      return res.status(400).json({ error: 'contractAddress and name required' });
    }

    const normalizedAddress = normalizeAddress(contractAddress);
    const docRef = db.collection('circles').doc(normalizedAddress);
    const existingDoc = await docRef.get();
    const now = new Date().toISOString();
    const metadata = {
      contractAddress: normalizedAddress,
      name,
      description: description || '',
      updatedAt: now,
    };

    if (!existingDoc.exists) {
      metadata.createdAt = now;
    }

    if (typeof isPublic === 'boolean') {
      metadata.isPublic = isPublic;
    }

    if (Number.isInteger(circleId) && circleId >= 0) {
      metadata.circleId = circleId;
    }

    await docRef.set(metadata, { merge: true });

    res.json({ success: true, message: 'Circle metadata saved', data: metadata });
  } catch (err) {
    console.error('Error saving circle metadata:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.get('/api/circles/:contractAddress', async (req, res) => {
  try {
    const doc = await db.collection('circles').doc(normalizeAddress(req.params.contractAddress)).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    res.json({ success: true, data: doc.data() });
  } catch (err) {
    console.error('Error getting circle metadata:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.get('/api/circles', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let query = db.collection('circles');
    if (req.query.isPublic === 'true') {
      query = query.where('isPublic', '==', true);
    }

    const snapshot = await query.limit(limit + 1).offset(offset).get();
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

apiApp.put('/api/circles/:contractAddress', async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const updateData = { updatedAt: new Date().toISOString() };

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = !!isPublic;

    await db.collection('circles').doc(normalizeAddress(req.params.contractAddress)).update(updateData);

    res.json({ success: true, message: 'Circle metadata updated', data: updateData });
  } catch (err) {
    console.error('Error updating circle metadata:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.post('/api/invites', async (req, res) => {
  try {
    const { contractAddress, expiresIn = 30 * 24 } = req.body;

    if (!contractAddress) {
      return res.status(400).json({ error: 'contractAddress required' });
    }

    const shortCode = createInviteCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresIn);

    const inviteData = {
      shortCode,
      contractAddress: normalizeAddress(contractAddress),
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

apiApp.get('/api/invites/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const doc = await db.collection('invites').doc(code).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Invite code not found' });
    }

    const invite = doc.data();
    if (new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Invite code expired' });
    }

    const circleDoc = await db.collection('circles').doc(invite.contractAddress).get();
    const circleName = circleDoc.exists ? circleDoc.data().name : 'Unknown Circle';

    res.json({
      success: true,
      data: {
        shortCode: code,
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

apiApp.post('/api/invites/:code/joined', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const docRef = db.collection('invites').doc(code);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Invite code not found' });
    }

    const invite = doc.data();
    const joinedMembers = invite.joinedMembers || [];
    const normalizedAddress = normalizeAddress(walletAddress);

    if (!joinedMembers.includes(normalizedAddress)) {
      joinedMembers.push(normalizedAddress);
      await docRef.update({ joinedMembers });
    }

    res.json({
      success: true,
      message: 'User recorded in invite',
      data: {
        shortCode: code,
        contractAddress: invite.contractAddress,
        totalJoined: joinedMembers.length,
      },
    });
  } catch (err) {
    console.error('Error recording invite join:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.post('/api/users/preferences', async (req, res) => {
  try {
    const { walletAddress, email, enablePushNotifications = true, timezoneName = 'UTC' } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const preferences = {
      walletAddress: normalizeAddress(walletAddress),
      email: email || '',
      enablePushNotifications,
      timezoneName,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(preferences.walletAddress).set(preferences, { merge: true });

    res.json({ success: true, message: 'User preferences saved', data: preferences });
  } catch (err) {
    console.error('Error saving user preferences:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.get('/api/users/:walletAddress/preferences', async (req, res) => {
  try {
    const walletAddress = normalizeAddress(req.params.walletAddress);
    const doc = await db.collection('users').doc(walletAddress).get();

    if (!doc.exists) {
      return res.json({
        success: true,
        data: { walletAddress, email: '', enablePushNotifications: true, timezoneName: 'UTC' },
      });
    }

    res.json({ success: true, data: doc.data() });
  } catch (err) {
    console.error('Error getting user preferences:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.post('/api/users/track-circle', async (req, res) => {
  try {
    const { walletAddress, contractAddress } = req.body;

    if (!walletAddress || !contractAddress) {
      return res.status(400).json({ error: 'walletAddress and contractAddress required' });
    }

    const normalizedWallet = normalizeAddress(walletAddress);
    const normalizedCircle = normalizeAddress(contractAddress);
    const userRef = db.collection('users').doc(normalizedWallet);
    const userDoc = await userRef.get();
    const circles = userDoc.exists && userDoc.data().circles ? userDoc.data().circles : [];

    if (!circles.includes(normalizedCircle)) {
      circles.push(normalizedCircle);
    }

    await userRef.set({ walletAddress: normalizedWallet, circles, updatedAt: new Date().toISOString() }, { merge: true });

    res.json({
      success: true,
      message: 'Circle tracked for user',
      data: { walletAddress: normalizedWallet, contractAddress: normalizedCircle, totalTracked: circles.length },
    });
  } catch (err) {
    console.error('Error tracking circle:', err);
    res.status(500).json({ error: err.message });
  }
});

apiApp.get('/api/users/circles/:walletAddress', async (req, res) => {
  try {
    const walletAddress = normalizeAddress(req.params.walletAddress);
    const doc = await db.collection('users').doc(walletAddress).get();

    if (!doc.exists) {
      return res.json({ success: true, data: { walletAddress, circles: [], totalCircles: 0 } });
    }

    const circles = doc.data().circles || [];
    res.json({ success: true, data: { walletAddress, circles, totalCircles: circles.length } });
  } catch (err) {
    console.error('Error getting user circles:', err);
    res.status(500).json({ error: err.message });
  }
});

exports.backend = functions.https.onRequest(apiApp);

/**
 * Scheduled Cloud Function - runs every hour
 * Checks for upcoming contribution deadlines and sends notifications
 */
exports.notifyContributionDeadlines = functions.pubsub
  .schedule('0 * * * *') // Every hour
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting contribution deadline notification check...');

      const now = Date.now();
      const notificationWindow = 48 * 60 * 60 * 1000; // 48 hours in ms
      const notificationThreshold = now + notificationWindow;

      // Get all tracked user circles
      const usersSnapshot = await db.collection('users').get();

      let notificationsSent = 0;
      let errors = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const walletAddress = userData.walletAddress;
        const circles = userData.circles || [];
        const devices = userData.devices || [];
        const enableNotifications = userData.enablePushNotifications !== false;

        if (!enableNotifications || devices.length === 0) {
          continue;
        }

        // Check each circle the user is in
        for (const circleAddress of circles) {
          try {
            // Get circle metadata from Firestore
            const circleDoc = await db.collection('circles').doc(circleAddress).get();
            if (!circleDoc.exists) {
              continue;
            }

            const circleData = circleDoc.data();
            const circleName = circleData.name || 'Circle';

            // TODO: In production, would call Arc RPC to get actual cycle data
            // For now, this is a placeholder for the logic structure
            // const cycleStart = await getRpcData(circleAddress, 'cycleStart');
            // const cycleDuration = await getRpcData(circleAddress, 'cycleDuration');
            // const deadline = cycleStart + cycleDuration;

            // Example structure (replace with actual RPC calls):
            // if (deadline > now && deadline < notificationThreshold) {
            //   // Send notification
            //   const message = {
            //     notification: {
            //       title: `${circleName} Contribution Due Soon`,
            //       body: `Contribute to ${circleName} in 48 hours`,
            //     },
            //     webpush: {
            //       data: {
            //         circleAddress,
            //         circleName,
            //         type: 'contribution_reminder',
            //       },
            //     },
            //   };

            //   for (const device of devices) {
            //     await messaging.send({
            //       ...message,
            //       token: device.fcmToken,
            //     });
            //   }
            //   notificationsSent++;
            // }
          } catch (err) {
            console.error(`Error checking circle ${circleAddress}:`, err);
            errors++;
          }
        }
      }

      console.log(`Notifications sent: ${notificationsSent}, Errors: ${errors}`);
      return { notificationsSent, errors };
    } catch (err) {
      console.error('Error in notifyContributionDeadlines:', err);
      throw err;
    }
  });

/**
 * HTTP Cloud Function - send test notification
 * Usage: POST https://region-projectid.cloudfunctions.net/sendTestNotification
 * Body: { walletAddress, title, body }
 */
exports.sendTestNotification = functions.https.onRequest(async (req, res) => {
  try {
    // Verify API key in production
    const { walletAddress, title, body } = req.body;

    if (!walletAddress || !title || !body) {
      return res.status(400).json({ error: 'walletAddress, title, and body required' });
    }

    const userDoc = await db.collection('users').doc(walletAddress.toLowerCase()).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const devices = userDoc.data().devices || [];

    if (devices.length === 0) {
      return res.status(400).json({ error: 'No devices registered for notifications' });
    }

    const message = {
      notification: {
        title,
        body,
      },
    };

    let sentCount = 0;
    const errors = [];

    for (const device of devices) {
      try {
        await messaging.send({
          ...message,
          token: device.fcmToken,
        });
        sentCount++;
      } catch (err) {
        errors.push(`Device ${device.deviceName}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: 'Test notifications sent',
      sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Error in sendTestNotification:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * HTTP Cloud Function - send batch notifications
 * Usage: POST https://region-projectid.cloudfunctions.net/notifyCircleMembers
 * Body: { circleAddress, title, body, memberAddresses (optional) }
 */
exports.notifyCircleMembers = functions.https.onRequest(async (req, res) => {
  try {
    const { circleAddress, title, body, memberAddresses } = req.body;

    if (!circleAddress || !title || !body) {
      return res.status(400).json({ error: 'circleAddress, title, and body required' });
    }

    // Get all users or specific members
    let query = db.collection('users');
    if (memberAddresses && memberAddresses.length > 0) {
      const normalizedAddresses = memberAddresses.map((addr) => addr.toLowerCase());
      query = query.where('walletAddress', 'in', normalizedAddresses);
    }

    const usersSnapshot = await query.get();

    const message = {
      notification: {
        title,
        body,
      },
      webpush: {
        data: {
          circleAddress: circleAddress.toLowerCase(),
          type: 'circle_notification',
        },
      },
    };

    let sentCount = 0;
    const errors = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Check if user tracks this circle
      if (userData.circles && !userData.circles.includes(circleAddress.toLowerCase())) {
        continue;
      }

      // Check if notifications enabled
      if (userData.enablePushNotifications === false) {
        continue;
      }

      const devices = userData.devices || [];

      for (const device of devices) {
        try {
          await messaging.send({
            ...message,
            token: device.fcmToken,
          });
          sentCount++;
        } catch (err) {
          errors.push(`${userData.walletAddress} - ${device.deviceName}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: 'Circle notifications sent',
      sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Error in notifyCircleMembers:', err);
    res.status(500).json({ error: err.message });
  }
});
