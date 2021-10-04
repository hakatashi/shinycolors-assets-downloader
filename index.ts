import {promises as fs} from 'fs';
import path from 'path';
import Axios from 'axios';
import mkdirp from 'mkdirp';
import {encryptPath, decryptResource} from './secret';

const axios = Axios.create({
	baseURL: 'https://shinycolors.enza.fun/assets/',
	responseType: 'arraybuffer',
});

const downloadAsset = async (assetPath: string, v?: number) => {
	const localPath = path.join(__dirname, 'assets', assetPath);
	await mkdirp(path.dirname(localPath));

	const hash = encryptPath(assetPath);

	console.log(`Downloading ${assetPath} (hash = ${hash})...`);
	await new Promise((resolve) => setTimeout(resolve, 1000));
	const {data, headers} = await axios.get(v === undefined ? hash : `${hash}?v=${v}`);
	const contentType = headers['content-type'] || '';

	if (contentType.startsWith('text/')) {
		const plainData = await decryptResource(data);
		const dataObj = JSON.parse(plainData.toString());
		await fs.writeFile(localPath, JSON.stringify(dataObj, null, '  '));
		return dataObj;
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
