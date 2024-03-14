import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(req, res) {
    const token = `auth_${req.headers['x-token']}`;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    console.log(user);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId !== 0) {
      const parentFile = dbClient.getFileById({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      const data = {
        userId: user.id, name, type, parentId,
      };
      const folderInsert = await dbClient.addNewFile(data);
      return res.status(201).json(folderInsert);
    }
    let localPath = '';
    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const fileName = `${uuidv4()}`;
      localPath = path.join(folderPath, fileName);
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
    }
    const newFile = await dbClient.addNewFile({
      userId: user._id,
      name,
      type,
      parentId,
      isPublic,
      localPath,
    });

    const retFile = {
      id: newFile._id,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    };
    return res.status(201).json(retFile);
  }

  static async getShow(req, res) {
    const { id } = req.params;
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.getFile({ userId: user._id, _id: ObjectId(id) });
    if (!file) return res.status(404).json({ error: 'Not found' });
    return res.json(file);
  }

  static async getIndex(req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    if (!user) res.status(401).json({ error: 'Unauthorized' });

    let { parentId, page } = req.query;
    page = parseInt(page, 10) || 0;
    parentId = parentId ? ObjectId(parentId) : '0';
    const filter = { userId: user._id, parentId };
    const options = {
      limit: 20,
      skip: page * 20,
    };

    const files = await dbClient.getFiles(filter, options);
    return res.status(200).json(files);
  }
}

export default FilesController;
