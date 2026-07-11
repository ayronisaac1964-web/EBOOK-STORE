// Cached Mongo client across warm serverless invocations. One connection,
// reused. Never call MongoClient.connect() per-request without caching —
// that exhausts Atlas connection limits under load.

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI env var");

// process-global cache — survives across invocations on the same warm lambda
let cachedClient = global._mongoClient;
let cachedDb = global._mongoDb;

async function getDb() {
  if (cachedDb) return cachedDb;

  const client = cachedClient || new MongoClient(uri, { maxPoolSize: 10 });
  if (!cachedClient) {
    await client.connect();
    cachedClient = client;
    global._mongoClient = client;
  }

  const dbName = process.env.MONGODB_DB_NAME || undefined; // undefined = use db from URI
  const db = client.db(dbName);
  cachedDb = db;
  global._mongoDb = db;
  return db;
}

module.exports = { getDb };
