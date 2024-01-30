const fs = require("fs");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

exports.handler = async (event) => {
  try {
    const browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      defaultViewport: chromium.defaultViewport,
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
    });
    const page = await browser.newPage();

    await page.goto(event.url);
    await page.waitForSelector("#image-content .c-code-pane");

    const image = await page.$("#image-content");
    await image.screenshot({
      path: "/tmp/screenshot.png",
      type: "png",
    });
    await browser.close();

    const response = {
      statusCode: 200,
      body: fs.readFileSync("/tmp/screenshot.png", { encoding: "base64" }),
    };
    return response;
  } catch (err) {
    const response = {
      statusCode: 500,
      body: JSON.stringify(err),
    };
    return response;
  }
};
