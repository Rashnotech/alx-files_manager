import redisClient from '../utils/redis.js';
import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db.js';

class AuthController {
  static async getConnect (req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authCredentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const email = authCredentials[0];
    const password = authCredentials[1];

    const user = await dbClient.getUserByEmail(email);
    if (!user || user.password !== sha1(password)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 86400);

    return res.status(200).json({ token });
  }

  static async getDisconnect (req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await redisClient.del(`auth_${token}`);
    return res.status(204).end();
  }
}

export default AuthController;
