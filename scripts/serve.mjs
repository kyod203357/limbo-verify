// Tiny static server for dist/, to try a build locally: npm run build && npm run preview
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".pem": "text/plain" };
const port = Number(process.env.PORT || 8788);
createServer((req, res) => {
	const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
	let file = join("dist", path);
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
	if (!existsSync(file)) return void res.writeHead(404).end("not found");
	res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "access-control-allow-origin": "*" });
	createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/`));
