// These tests exist because nothing else loads index.js. `node --check` parses
// it but doesn't resolve identifiers, so a reference to a deleted variable used
// to reach production and fail every request. Requiring the module and walking
// its branches is most of the value here; the assertions are the rest.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { S3Client } = require("@aws-sdk/client-s3");

const SOLUTION_FIXTURE = require("./dev/fixtures/solution.json");
const PROFILE_FIXTURE = require("./dev/fixtures/profile.json");

// index.js reads env and constructs its S3 client at require time, so both stubs
// have to be in place before it's loaded, and they stay in place for the life of
// the process - nothing in this file wants the real S3 or the real network.
//
// Indirected through a mutable handler so a test can swap the behaviour without
// re-patching something index.js already holds a reference to. fetchHandler is
// seeded rather than left for beforeEach because satori fetches during module
// load, before the first test runs.
let s3Handler;
let fetchHandler = serveFixtures;

S3Client.prototype.send = function (command) {
  return s3Handler(command);
};
globalThis.fetch = function (url) {
  return fetchHandler(url);
};

const { handler } = require("./index");

function noSuchKey() {
  const err = new Error("The specified key does not exist.");
  err.name = "NoSuchKey";
  throw err;
}

// A miss on read, a no-op on write: the default path through to a real render.
function s3Miss(calls) {
  return async (command) => {
    calls.push(command);
    if (command.constructor.name === "GetObjectCommand") noSuchKey();
    return {};
  };
}

function s3Hit(calls, { body, contentType, lastModified }) {
  return async (command) => {
    calls.push(command);
    if (command.constructor.name === "GetObjectCommand") {
      return {
        Body: { transformToByteArray: async () => body },
        ContentType: contentType,
        LastModified: lastModified,
      };
    }
    return {};
  };
}

// Serves the payload the renderer asked for, and 404s anything else. Satori
// fetches assets it finds in the payload too, so this has to be a real Response
// rather than a bare object - a missing asset is a case it handles, a malformed
// response isn't.
async function serveFixtures(url) {
  const target = String(url);

  if (target.includes("/spi/profile_image_data/")) {
    return Response.json(PROFILE_FIXTURE);
  }
  if (target.includes("/spi/solution_image_data/")) {
    return Response.json(SOLUTION_FIXTURE);
  }

  return new Response(null, { status: 404 });
}

let s3Calls;

beforeEach(() => {
  s3Calls = [];
  s3Handler = s3Miss(s3Calls);
  fetchHandler = serveFixtures;
});

const gets = () => s3Calls.filter((c) => c.constructor.name === "GetObjectCommand");
const puts = () => s3Calls.filter((c) => c.constructor.name === "PutObjectCommand");

const PNG_MAGIC = "iVBORw0KGgo";

// The four path shapes the CDN actually sends us.

test("renders a timestamped solution URL", async () => {
  const response = await handler({
    rawPath: "/tracks/ruby/exercises/two-fer/solutions/ihid-1700000000.jpg",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.isBase64Encoded);
  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a PNG body");
  assert.strictEqual(response.headers["Content-Type"], "image/png");
});

test("renders a legacy, untimestamped solution URL", async () => {
  const response = await handler({
    rawPath: "/tracks/ruby/exercises/two-fer/solutions/ihid.jpg",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a PNG body");
});

test("renders a profile URL", async () => {
  const response = await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a PNG body");
});

test("renders a timestamped profile URL", async () => {
  const response = await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a PNG body");
});

test("500s with a readable message on a path we can't map", async () => {
  const response = await handler({ rawPath: "/nonsense" });

  assert.strictEqual(response.statusCode, 500);
  assert.match(response.body, /Could not map raw path '\/nonsense'/);
});

// The handle is the last segment, so a track or exercise slug containing one of
// the literal path words is the case a greedy regex gets wrong.
test("picks the right renderer for each kind", async () => {
  const dataUrls = [];
  fetchHandler = async (url) => {
    if (String(url).includes("/spi/")) dataUrls.push(String(url));
    return serveFixtures(url);
  };

  await handler({ rawPath: "/tracks/ruby/exercises/two-fer/solutions/ihid.jpg" });
  await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.match(dataUrls[0], /\/spi\/solution_image_data\/ruby\/two-fer\/ihid$/);
  assert.match(dataUrls[1], /\/spi\/profile_image_data\/ihid$/);
});

// Cache metadata.

test("caches a timestamped URL forever and dates it from the timestamp", async () => {
  const response = await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  assert.strictEqual(
    response.headers["Cache-Control"],
    "public, max-age=31536000, immutable"
  );
  assert.strictEqual(
    response.headers["Last-Modified"],
    new Date(1700000000 * 1000).toUTCString()
  );
});

test("caches a legacy URL for a day", async () => {
  const response = await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.strictEqual(response.headers["Cache-Control"], "public, max-age=86400");
});

test("etags the body, so identical renders collapse at the CDN", async () => {
  const first = await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });
  const second = await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  assert.match(first.headers["Etag"], /^W\/"[0-9a-f]{32}"$/);
  assert.strictEqual(first.headers["Etag"], second.headers["Etag"]);
});

// S3 keys and the read-through cache.

test("derives the S3 key from the raw path under the prefix", async () => {
  await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  const [get] = gets();
  assert.strictEqual(get.input.Key, "generated-images/profiles/ihid-1700000000.jpg");
  assert.strictEqual(puts()[0].input.Key, get.input.Key);
});

test("writes a fresh render back to S3 with its cache header", async () => {
  await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  const [put] = puts();
  assert.strictEqual(put.input.CacheControl, "public, max-age=31536000, immutable");
  assert.strictEqual(put.input.ContentType, "image/png");
  assert.ok(put.input.Body.length > 0);
});

test("serves a cached object without rendering or re-writing it", async () => {
  let fetched = false;
  fetchHandler = async () => {
    fetched = true;
    throw new Error("should not have rendered");
  };
  s3Handler = s3Hit(s3Calls, {
    body: Buffer.from("cached-bytes"),
    contentType: "image/jpg",
    lastModified: new Date(),
  });

  const response = await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(Buffer.from(response.body, "base64").toString(), "cached-bytes");
  // Per object, so images stored before the renderer switched formats keep serving.
  assert.strictEqual(response.headers["Content-Type"], "image/jpg");
  assert.strictEqual(puts().length, 0);
  assert.strictEqual(fetched, false);
});

test("re-renders a legacy URL whose cached copy has gone stale", async () => {
  s3Handler = s3Hit(s3Calls, {
    body: Buffer.from("stale-bytes"),
    contentType: "image/jpg",
    lastModified: new Date(Date.now() - 2 * 86400 * 1000),
  });

  const response = await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a fresh render");
  assert.strictEqual(puts().length, 1);
});

test("keeps serving a timestamped object however old it is", async () => {
  s3Handler = s3Hit(s3Calls, {
    body: Buffer.from("ancient-bytes"),
    contentType: "image/png",
    lastModified: new Date(Date.now() - 400 * 86400 * 1000),
  });

  const response = await handler({ rawPath: "/profiles/ihid-1700000000.jpg" });

  assert.strictEqual(Buffer.from(response.body, "base64").toString(), "ancient-bytes");
  assert.strictEqual(puts().length, 0);
});

// A cache problem should never stop us serving an image.

test("renders anyway when reading from S3 blows up", async () => {
  s3Handler = async (command) => {
    s3Calls.push(command);
    if (command.constructor.name === "GetObjectCommand") {
      throw new Error("S3 is having a day");
    }
    return {};
  };

  const response = await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a PNG body");
});

test("still serves the image when writing to S3 blows up", async () => {
  s3Handler = async (command) => {
    s3Calls.push(command);
    if (command.constructor.name === "GetObjectCommand") noSuchKey();
    throw new Error("S3 is still having a day");
  };

  const response = await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.body.startsWith(PNG_MAGIC), "expected a PNG body");
});

test("500s when the data endpoint is unhappy", async () => {
  fetchHandler = async () => new Response(null, { status: 502 });

  const response = await handler({ rawPath: "/profiles/ihid.jpg" });

  assert.strictEqual(response.statusCode, 500);
  assert.match(response.body, /502/);
});
