import dbClient from '../utils/db';
import sha1 from 'sha1';

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
}

export default UsersController;
