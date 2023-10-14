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
		const fileStream = await fs.createReadStream(dbPath);
		fileStream.pipe(res);
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
		const fileStream = fs.createWriteStream(dbPath, { flags: 'w' });
		req.pipe(fileStream);
		fileStream.on('finish', () => {
			isOpen.setState(true);
			res.sendStatus(200);
		});
		fileStream.on('error', (err) => {
			console.error(err);
			isOpen.setState(true);
			res.status(500).json({
				error: 'Internal Server Error',
			});
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
