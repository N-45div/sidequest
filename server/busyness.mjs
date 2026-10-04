import { MongoClient } from 'mongodb';

// Forecasts written by scripts/tabpfn_busyness.py: one document per Google place with a 7x15 grid of
// usual busyness (Sunday first, 8 AM to 10 PM), from Google popular times where known, TabPFN otherwise.
let collection;
const open = () => collection ||= process.env.MONGODB_URI
  ? new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect()
    .then(client => client.db(process.env.MONGODB_DATABASE || 'sidequest').collection('busyness'))
  : Promise.resolve(null);

export function crowdLabel(score) {
  if (score < 40) return 'Usually quiet';
  return score < 70 ? 'Usually a little busy' : 'Usually busy';
}

export async function crowdAt(placeIds, date, minute, find = async ids => (await open())?.find({ _id: { $in: ids } }).toArray() ?? []) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(), hour = Math.floor(minute / 60);
  if (!placeIds.length || hour < 8 || hour > 22) return new Map();
  return new Map((await find(placeIds)).flatMap(doc => {
    const score = doc.week?.[day]?.[hour - 8];
    return score == null ? [] : [[doc._id, { score: Math.round(score), label: crowdLabel(score), source: doc.source, hour }]];
  }));
}
