import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { contentType } from 'mime-types';
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
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    console.log(data);
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
        userId: user._id, name, type, parentId,
      };
      const folderInsert = await dbClient.addNewFile(data);
      const retFile = {
        id: folderInsert._id,
        userId: user._id,
        type,
        isPublic,
        parentId,
      };
      return res.status(201).json(retFile);
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
    const id = req.params ? req.params.id : null;
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
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

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

  static async putPublish(req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id || null;
    const filter = { _id: ObjectId(fileId), userId: user._id };
    const file = await dbClient.getFile(filter);
    if (!file) return res.status(404).json({ error: 'Not found' });
    await dbClient.updateFile(filter, { $set: { isPublic: true } });
    const update = await dbClient.getFile(filter);
    return res.json(update);
  }

  static async putUnpublish (req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id || null;
    const filter = { _id: ObjectId(fileId), userId: user._id };
    const file = await dbClient.getFile(filter);
    if (!file) return res.status(404).json({ error: 'Not found' });
    await dbClient.updateFile(filter, { $set: { isPublic: false } });
    const update = await dbClient.getFile(filter);
    return res.json(update);
  }

  static async getFile (req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);
    if (!userId) return res.status(401).json({error: 'Unauthorized' });

    const user = await dbClient.getUserById({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id || null; 

    const file = await dbClient.getFile({ _id: ObjectId(fileId) });
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.isPublic && file.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const path = fs.realpathSync(file.localPath);
    res.setHeader('Content-Type', contentType(file.name || 'text/plain; charset=utf-8'));
    return res.sendFile(path);
  }
}

export default FilesController;
