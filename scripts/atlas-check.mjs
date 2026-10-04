import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in ignored .env.');
if ((process.env.MONGODB_DATABASE || 'sidequest') !== 'sidequest') throw new Error('This check is restricted to the SideQuest database.');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS:10000, connectTimeoutMS:8000 });
const id = `deployment-check-${randomUUID()}`;
let inserted = false;
try {
  await client.connect();
  const db = client.db('sidequest');
  await db.command({ ping:1 });
  const collection = db.collection('deployment_checks');
  await collection.insertOne({ _id:id, purpose:'SideQuest deployment connectivity check' }); inserted = true;
  if (!(await collection.findOne({ _id:id }))) throw new Error('Read-back failed.');
  console.log('Atlas ping, insert and read-back passed.');
} catch (error) {
  console.log(JSON.stringify({ ok:false, type:error.name, code:error.code || null }));
  process.exitCode = 1;
} finally {
  if (inserted) await client.db('sidequest').collection('deployment_checks').deleteOne({ _id:id });
  await client.close();
}
