import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("FATAL: MONGO_URI is missing in .env file");
}

let client;
let clientPromise;

const clientOptions = {
  serverSelectionTimeoutMS: 5000,
};

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect();
}

export async function getDb(dbName = "booknook") {
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}

export default clientPromise;
