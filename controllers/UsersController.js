import dbClient from '../utils/db';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import { ObjectId } from 'mongodb';

class UsersController {
  static async postNew (req, res) {
    const { email, password } = req.body;
    try {
      if (!email) {
        throw new Error('Missing email');
      }
      if (!password) {
        throw new Error('Missing password');
      }
      const user = await dbClient.getUserByEmail(email);
      if (user) {
        return res.status(400).json({ error: 'Already exist' });
      }
      const hashedPassword = sha1(password);
      const newUser = await dbClient.insertUser({ email, password: hashedPassword });
      return res.status(201).json({
        id: newUser.insertedId,
        email
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getMe (req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({ id: user._id, email: user.email });
  }
}

export default UsersController;
