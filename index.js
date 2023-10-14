import express from 'express';
import fs from 'fs/promises'; 
import { EventEmitter } from 'events';

const dbPath = './db.json';

class Stater extends EventEmitter {
  constructor(props) {
    super(props);
    this.state = true;
  }

  setState(newState) {
    this.state = newState || false;
    this.emit('set', newState);
  }

  waitForTrue(newState) {
    return new Promise((resolve) => {
      const check = () => {
        if (this.state) {
          this.off('set', check);
          resolve();
        }
      };
      this.on('set', check);
      check();
    });
  }
}

const isOpen = new Stater();

const app = express();

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  await isOpen.waitForTrue();
  isOpen.setState(false);

  try {
    const fileData = await fs.readFile(dbPath, 'utf8');
    res.send(fileData);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Internal Server Error',
    });
  } finally {
    isOpen.setState(true);
  }
});

app.post('/', async (req, res) => {
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(401).json({
      error: 'Invalid Type',
      message: 'Content-Type must be application/json',
    });
  }

  await isOpen.waitForTrue();
  isOpen.setState(false);

  try {
    const body = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    });
    req.on('end', async () => {
      const requestBody = Buffer.concat(body).toString();
      await fs.writeFile(dbPath, requestBody, 'utf8');
      isOpen.setState(true);
      res.sendStatus(200);
    });
  } catch (error) {
    console.error(error);
    isOpen.setState(true);
    res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
