import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

// Forecasts written by scripts/tabpfn_busyness.py: one document per Google place with a 7x15 grid of
// usual busyness (Sunday first, 8 AM to 10 PM), from Google popular times where known, TabPFN otherwise.
// Without a database (a local run on SQLite), the same documents are read from .data/busyness.json,
// written by `python scripts/tabpfn_busyness.py publish --out .data/busyness.json`.
let collection, file;
const open = () => collection ||= process.env.MONGODB_URI
  ? new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect()
    .then(client => client.db(process.env.MONGODB_DATABASE || 'sidequest').collection('busyness'))
  : Promise.resolve(null);
const fromFile = async ids => {
  file ||= readFile(new URL('../.data/busyness.json', import.meta.url), 'utf8').then(JSON.parse).catch(() => []);
  return (await file).filter(doc => ids.includes(doc._id));
};
const lookup = async ids => process.env.MONGODB_URI ? (await open())?.find({ _id: { $in: ids } }).toArray() ?? [] : fromFile(ids);

export function crowdLabel(score) {
  if (score < 40) return 'Usually quiet';
  return score < 70 ? 'Usually a little busy' : 'Usually busy';
}

export async function crowdAt(placeIds, date, minute, find = lookup) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(), hour = Math.floor(minute / 60);
  if (!placeIds.length || hour < 8 || hour > 22) return new Map();
  return new Map((await find(placeIds)).flatMap(doc => {
    const score = doc.week?.[day]?.[hour - 8];
    return score == null ? [] : [[doc._id, { score: Math.round(score), label: crowdLabel(score), source: doc.source, hour }]];
  }));
}
