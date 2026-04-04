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

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

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
