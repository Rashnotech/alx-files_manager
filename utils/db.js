import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const db = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}/${db}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect();
    this.client.on('error', (err) => {
      console.log(err);
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }

  async getUserByEmail(email) {
    return this.client.db().collection('users').findOne({ email });
  }

  async insertUser(data) {
    return this.client.db().collection('users').insertOne(data);
  }

  async getUserById(userId) {
    return this.client.db().collection('users').findOne({ userId });
  }

  async getFileById(fileId) {
    return this.client.db().collection('files').findOne({ fileId });
  }

  async addNewFile(data) {
    return this.client.db().collection('files').insertOne(data);
  }

  async getFile(data) {
    return this.client.db().collection('files').findOne(data);
  }

  async getFiles(filter, options) {
    return this.client.db().collection('files').find(filter, options).toArray();
  }
}

const dbClient = new DBClient();

export default dbClient;
