const fs = require('fs');
const path = require('path');

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

class LocalDocumentSnapshot {
  constructor(id, value) {
    this.id = id;
    this.exists = value !== undefined;
    this._value = value;
  }

  data() {
    return clone(this._value);
  }
}

class LocalDocumentRef {
  constructor(db, collectionName, id) {
    this.db = db;
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    const collection = this.db.ensureCollection(this.collectionName);
    return new LocalDocumentSnapshot(this.id, collection[this.id]);
  }

  async set(data, options = {}) {
    const collection = this.db.ensureCollection(this.collectionName);
    const nextData = clone(data);

    collection[this.id] = options.merge
      ? { ...(collection[this.id] || {}), ...nextData }
      : nextData;

    this.db.persist();
  }

  async update(data) {
    const collection = this.db.ensureCollection(this.collectionName);
    if (!collection[this.id]) {
      throw new Error(`Document ${this.collectionName}/${this.id} does not exist`);
    }

    collection[this.id] = { ...collection[this.id], ...clone(data) };
    this.db.persist();
  }
}

class LocalQuery {
  constructor(db, collectionName, filters = [], limitValue = null, offsetValue = 0) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitValue = limitValue;
    this.offsetValue = offsetValue;
  }

  where(field, operator, value) {
    return new LocalQuery(
      this.db,
      this.collectionName,
      [...this.filters, { field, operator, value }],
      this.limitValue,
      this.offsetValue
    );
  }

  limit(value) {
    return new LocalQuery(this.db, this.collectionName, this.filters, value, this.offsetValue);
  }

  offset(value) {
    return new LocalQuery(this.db, this.collectionName, this.filters, this.limitValue, value);
  }

  async get() {
    const collection = this.db.ensureCollection(this.collectionName);
    let docs = Object.entries(collection).map(([id, value]) => new LocalDocumentSnapshot(id, value));

    for (const filter of this.filters) {
      docs = docs.filter((doc) => {
        const value = doc.data()?.[filter.field];

        switch (filter.operator) {
          case '==':
            return value === filter.value;
          case '>':
            return value > filter.value;
          case '>=':
            return value >= filter.value;
          case '<':
            return value < filter.value;
          case '<=':
            return value <= filter.value;
          default:
            throw new Error(`Unsupported local Firestore operator: ${filter.operator}`);
        }
      });
    }

    if (this.offsetValue) {
      docs = docs.slice(this.offsetValue);
    }

    if (this.limitValue !== null) {
      docs = docs.slice(0, this.limitValue);
    }

    return { docs };
  }
}

class LocalCollectionRef extends LocalQuery {
  constructor(db, collectionName) {
    super(db, collectionName);
  }

  doc(id) {
    return new LocalDocumentRef(this.db, this.collectionName, String(id));
  }
}

class LocalFirestore {
  constructor(filePath) {
    this.filePath = filePath;
    this.store = this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (error) {
      console.warn('Failed to read local Firestore cache; starting empty:', error.message);
      return {};
    }
  }

  persist() {
    if (!this.filePath) {
      return;
    }

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2));
  }

  ensureCollection(name) {
    if (!this.store[name]) {
      this.store[name] = {};
    }

    return this.store[name];
  }

  collection(name) {
    return new LocalCollectionRef(this, name);
  }
}

const createLocalFirestore = (filePath) => new LocalFirestore(filePath);

module.exports = { createLocalFirestore };
