import {createGunzip} from 'zlib';
import concatStream from 'concat-stream';
import fs from 'fs-extra';
import path from 'path';
import Axios from 'axios';
import mkdirp from 'mkdirp';
import {encryptPath, decryptResource} from './secret';

const axios = Axios.create({
	baseURL: 'https://shinycolors.enza.fun/assets/',
	responseType: 'arraybuffer',
});

const decompress = async (data: Buffer) => {
	const gunzip = createGunzip();
	const res = await new Promise<Buffer>((resolve) => {
		const concatter = concatStream({encoding: 'buffer'}, resolve);
		gunzip.pipe(concatter);
		gunzip.on('error', () => {
			concatter.end();
		});
		gunzip.end(data);
	});
	return res;
};

const downloadAsset = async (assetPath: string, v: number) => {
	const localPath = path.join(__dirname, 'assets', assetPath);
	await mkdirp(path.dirname(localPath));

	if (!assetPath.startsWith('asset-map') && (await fs.pathExists(localPath))) {
		console.log(`Skippig ${assetPath}...`);
		return;
	}

	const hash = encryptPath(assetPath);
	const assetExtname = path.extname(assetPath);
	const extname = (assetExtname === '.mp4' || assetExtname === '.m4a') ? assetExtname : '';

	console.log(`Downloading ${assetPath} (hash = ${hash})...`);
	await new Promise((resolve) => setTimeout(resolve, 1000));
	if (extname === '.m4a') {
		const {data} = await axios.get(`${hash}${extname}?v=${v}`, {decompress: false});
		const decompressed = await decompress(data);
		await fs.writeFile(localPath, decompressed);
		return decompressed;
	}

	const {data, headers} = await axios.get(`${hash}${extname}?v=${v}`);
	const contentType = headers['content-type'] || '';

	if (contentType.startsWith('text/') && contentType !== 'text/html') {
		const plainData = await decryptResource(data);
		try {
			const dataObj = JSON.parse(plainData.toString());
			await fs.writeFile(localPath, JSON.stringify(dataObj, null, '  '));
			return dataObj;
		} catch (e) {
			await fs.writeFile(localPath, plainData);
			return plainData;
		}
	}

	await fs.writeFile(localPath, data);
	return data;
};

const main = async () => {
	await mkdirp('assets');
	const assetMapHash = encryptPath('asset-map.json');
	const {data: assetMapBuffer} = await axios.get(`asset-map-${assetMapHash}`);
	const assetMap = JSON.parse((await decryptResource(assetMapBuffer)).toString());

	await fs.writeFile(`${__dirname}/assets/asset-map.json`, JSON.stringify(assetMap, null, '  '));
	const chunks: {[path: string]: number}[] = assetMap.chunks;

	for (const chunk of chunks) {
		for (const [assetPath, version] of Object.entries(chunk)) {
			const assets: {[path: string]: number} = await downloadAsset(assetPath, version);
			for (const [assetPath, version] of Object.entries(assets)) {
				await downloadAsset(assetPath, version);
			}
		}
	}
};

main();
