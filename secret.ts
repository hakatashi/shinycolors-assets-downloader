import {createGunzip} from 'zlib';
import {createHash} from 'crypto';
import path from 'path';
import concatStream from 'concat-stream';

// SHHHHHHHHHHHHHHHHHHHHHHHis
const key = Buffer.from(Buffer.from('楑䱤噗䵤し䩒䡘硚啖㕬ㅤ㌹噚根浣晖䝡祬坡渵㉘と䡤穂楏瘸㉡瘵㉙畴㍢汒浌癎浌睰', 'utf16le').toString(), 'base64');

export const decryptResource = async (data: Buffer) => {
	for (const [i] of data.entries()) {
		data[i] ^= key[i % key.length];
	}
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

export const encryptPath = (inputPath: string) => {
	const basename = path.basename(inputPath, path.extname(inputPath));
	const key = `${basename[0]}${basename[basename.length - 1]}/assets/${inputPath}`;
	return createHash('sha256').update(key, 'utf-8').digest('hex');
};
