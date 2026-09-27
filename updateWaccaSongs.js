const https = require("https");
const fs = require("fs");
const path = require("path");

const URL =
  "https://raw.githubusercontent.com/Stabyourself/mithical/master/assets/wacca/waccaSongsPlus.js";

const OUTPUT = path.join(__dirname, "waccaSongs.js");

https
  .get(URL, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Download failed: HTTP ${res.statusCode}`);
      res.resume();
      return;
    }

    let data = "";

    res.setEncoding("utf8");

    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      // Replace the original ES module export
      data = data.replace(
        /export\s+default\s+waccaSongs\s*;?\s*$/,
        "module.exports = { waccaSongs };",
      );

      fs.writeFileSync(OUTPUT, data, "utf8");

      console.log(`Downloaded and updated ${OUTPUT}`);
    });
  })
  .on("error", (err) => {
    console.error("Download failed:", err.message);
  });
