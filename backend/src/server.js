const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { createLocalFirestore } = require('./lib/localFirestore');
require('dotenv').config();

const normalizePrivateKey = (privateKey) =>
  privateKey ? privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n') : undefined;

const serviceAccountFromEnv = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

const serviceAccountKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccountFromFile = fs.existsSync(serviceAccountKeyPath)
  ? require(serviceAccountKeyPath)
  : null;

const serviceAccount = serviceAccountFromFile || serviceAccountFromEnv;
const hasUsableServiceAccount = Boolean(
  serviceAccount.private_key &&
    serviceAccount.private_key.includes('BEGIN PRIVATE KEY') &&
    !serviceAccount.private_key.includes('...')
);

let db;
let messaging = null;

try {
  if (hasUsableServiceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    messaging = admin.messaging();
  } else if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: serviceAccount.project_id || 'demo-project' });
    db = admin.firestore();
    messaging = admin.messaging();
  } else {
    console.warn('Firebase credentials missing or placeholder. Using local development datastore.');
    db = createLocalFirestore(path.join(__dirname, '..', '.local-firestore.json'));
  }
} catch (error) {
  console.error('Firebase initialization failed (check your credentials):', error);
  console.warn('Falling back to local development datastore.');
  db = createLocalFirestore(path.join(__dirname, '..', '.local-firestore.json'));
}

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Routes
const circlesRouter = require('./routes/circles')(db);
const invitesRouter = require('./routes/invites')(db);
const usersRouter = require('./routes/users')(db);

app.use('/api/circles', circlesRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/users', usersRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`TrustCircle backend listening on port ${PORT}`);
  console.log(`Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
});

module.exports = { app, db, messaging };
