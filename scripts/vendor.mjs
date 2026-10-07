// Fetch the pinned verifier package from npm, check it against vendor.lock.json, and unpack the two files we ship into .vendor/.
// Nothing downloaded is trusted until its sha512 matches the lock. Usage: node scripts/vendor.mjs [--release]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const release = process.argv.includes("--release");
const lock = JSON.parse(readFileSync("vendor.lock.json", "utf8"));

// A prerelease verifier must never reach a tagged release by accident.
if (release && /canary|alpha|beta|rc/i.test(lock.version) && !process.env.ALLOW_PRERELEASE_VERIFIER) {
	console.error(`Refusing to release with prerelease verifier ${lock.version}.\nUpdate vendor.lock.json to a stable version, or set ALLOW_PRERELEASE_VERIFIER=1 to override knowingly.`);
	process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "limbo-vendor-"));
try {
	const spec = `${lock.package}@${lock.version}`;
	const out = execFileSync("npm", ["pack", spec, "--pack-destination", work, "--silent"], { encoding: "utf8" }).trim().split("\n").pop();
	const tgz = join(work, out);
	const actual = `sha512-${createHash("sha512").update(readFileSync(tgz)).digest("base64")}`;
	if (actual !== lock.integrity) {
		console.error(`Integrity mismatch for ${spec}\n  expected ${lock.integrity}\n  got      ${actual}`);
		process.exit(1);
	}
	execFileSync("tar", ["-xzf", tgz, "-C", work]);
	mkdirSync(".vendor", { recursive: true });
	for (const f of lock.files) {
		const src = join(work, "package", f);
		if (!existsSync(src)) throw new Error(`missing ${f} in ${spec}`);
		copyFileSync(src, join(".vendor", basename(f)));
	}
	console.log(`vendored ${spec} (${lock.files.length} files, integrity ok)`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
