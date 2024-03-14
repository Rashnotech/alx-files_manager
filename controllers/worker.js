import Queue from 'bull';
import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import path from 'path';
import fs from 'fs';
import dbClient from '../utils/db';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.getFile({ _id: ObjectId(fileId), userId });
  if (!file) throw new Error('File not found');

  const sizes = [500, 250, 100];
  for (const size of sizes) {
    const thumbPath = path.join(file.localPath, `_${size}`);
    const options = {
      width: size,
      height: size,
      responseType: 'base64',
    };
    imageThumbnail(file.localPath, options)
      .then((thumbnail) => {
        fs.writeFileSync(thumbPath, Buffer.from(thumbnail, 'base64'));
      });
  }
});

export default fileQueue;
