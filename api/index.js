// Vercel Function entry point: the same handler server.js runs locally.
import { respond } from '../lib/app.js';

export default function handler(req, res) {
  return respond(req, res);
}

export const config = { api: { bodyParser: false } };
