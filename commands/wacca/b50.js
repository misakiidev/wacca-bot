const { SlashCommandBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(
  require("path").resolve(__dirname, "../../access_codes.db")
);

function calculateRate(score, internalLevel) {
  let scoreCoef = 1;

  if (score >= 995_000) {
    scoreCoef = 4.05;
  } else if (score >= 994_000) {
    scoreCoef = 4.04;
  } else if (score >= 993_000) {
    scoreCoef = 4.03;
  } else if (score >= 992_000) {
    scoreCoef = 4.02;
  } else if (score >= 991_000) {
    scoreCoef = 4.01;
  } else if (score >= 990_000) {
    scoreCoef = 4;
  } else if (score >= 985_000) {
    scoreCoef = 3.875;
  } else if (score >= 980_000) {
    scoreCoef = 3.75;
  } else if (score >= 975_000) {
    scoreCoef = 3.625;
  } else if (score >= 970_000) {
    scoreCoef = 3.5;
  } else if (score >= 965_000) {
    scoreCoef = 3.375;
  } else if (score >= 960_000) {
    scoreCoef = 3.25;
  } else if (score >= 955_000) {
    scoreCoef = 3.125;
  } else if (score >= 950_000) {
    scoreCoef = 3;
  } else if (score >= 940_000) {
    scoreCoef = 2.75;
  } else if (score >= 920_000) {
    scoreCoef = 2.5;
  } else if (score >= 900_000) {
    scoreCoef = 2;
  } else if (score >= 850_000) {
    scoreCoef = 1.5;
  }

  return scoreCoef * internalLevel;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("b50")
    .setDescription("See your best 50 scores.")

    .addMentionableOption((option) =>
      option
        .setName("user")
        .setDescription("The user to see scores for.")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("naive")
        .setDescription(
          "Use the naive rating system instead of the in-game one."
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const user = interaction.options.getMentionable("user") || interaction.user;
    const naive = interaction.options.getBoolean("naive");
    const { waccaSongs } = require("../../waccaSongs.js");
    const { createCanvas, loadImage, registerFont } = require("canvas");
    const fs = require("fs");

    access_code = await new Promise((resolve, reject) => {
      db.get(
        "SELECT access_code FROM users WHERE id = ?",
        [user.id],
        (err, row) => {
          if (err) {
            console.error("Database error:", err);
            interaction.editReply({
              content: "An error occurred while fetching the access code.",
            });
            return reject(err);
          }
          if (!row) {
            interaction.editReply({
              content:
                "No access code found for the specified account. Please /login with your access code first or ask them to do so.",
            });
            return resolve(null);
          }
          resolve(row.access_code);
        }
      );
    });
    if (!access_code) return;

    const fetchScores = async () => {
      try {
        const response = await fetch(
          `https://mithical-backend.guegan.de/wacca/user/${access_code}/400`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        global.username = data.user_name;
        function convertToRoman(num) {
          if (num == 0) {
            return "None";
          }
          const romanLookup = [
            { value: 10, numeral: "X" },
            { value: 9, numeral: "IX" },
            { value: 5, numeral: "V" },
            { value: 4, numeral: "IV" },
            { value: 1, numeral: "I" },
          ];
          let roman = "";
          for (const { value, numeral } of romanLookup) {
            while (num >= value) {
              roman += numeral;
              num -= value;
            }
          }
          return roman;
        }

        global.rank = convertToRoman(data.version_data["400"].rank);

        if (data.version_data["400"].dan_rank == 1) {
          global.danRank = "(Blue)";
        } else if (data.version_data["400"].dan_rank == 2) {
          global.danRank = "(Silver)";
        } else if (data.version_data["400"].dan_rank == 3) {
          global.danRank = "(Gold)";
        } else if (data.version_data["400"].dan_rank == 0) {
          global.danRank = "";
        }

        return data;
      } catch (error) {
        console.error("Error fetching scores:", error);
        return null;
      }
    };

    let oldScores = [];
    let newScores = [];
    // regardless of the game version, we will always show the best 50 scores
    let bestScores = [];

    const processScores = (scores) => {
      return scores.map((score) => {
        const songInfo = waccaSongs.find((song) => song.id === score.music_id);
        const title = songInfo
          ? songInfo.titleEnglish !== null
            ? songInfo.titleEnglish
            : songInfo.title
          : "Unknown Title";
        const difficulty = score.music_difficulty;
        const level =
          songInfo?.sheets?.[score.music_difficulty - 1]?.difficulty ||
          "Unknown Level";
        const rate = calculateRate(score.score, level);
        let lamp = "[CLEAR]";
        if (score.all_marvelous_count > 0) {
          lamp = "[AM]";
        } else if (score.full_combo_count > 0) {
          lamp = "[FC]";
        } else if (score.missless_count > 0) {
          lamp = "[ML]";
        }
        const imageUrl = songInfo ? songInfo.imageName : "Unknown Image";
        const pb = score.score;
        const version =
          songInfo?.sheets?.[score.music_difficulty - 1]?.gameVersion ||
          "Unknown Version";
        return [title, difficulty, level, rate, lamp, imageUrl, pb, version];
      });
    };

    fetchScores().then((data) => {
      if (!data) {
        interaction.editReply({
          content: "Error fetching data. Please try again later.",
        });
        return;
      }

      oldScores = processScores(data.music)
        .filter((score) => !isNaN(score[3]))
        .filter((score) => parseInt(score[7]) < 400)
        .sort((a, b) => {
          if (b[3] === a[3]) {
            return b[6] - a[6];
          } else {
            return b[3] - a[3];
          }
        })
        .slice(0, 35);

      newScores = processScores(data.music)
        .filter((score) => !isNaN(score[3]))
        .filter((score) => parseInt(score[7]) >= 400)
        .sort((a, b) => {
          if (b[3] === a[3]) {
            return b[6] - a[6];
          } else {
            return b[3] - a[3];
          }
        })
        .slice(0, 15);

      bestScores = processScores(data.music)
        .filter((score) => !isNaN(score[3]))
        .sort((a, b) => {
          if (b[3] === a[3]) {
            return b[6] - a[6];
          } else {
            return b[3] - a[3];
          }
        })
        .slice(0, 50);

      makeImages();
    });

    const makeImages = async () => {
      try {
        const background = await loadImage(
          require("path").resolve(__dirname, "../../assets/background.png")
        );
        const background_naive = await loadImage(
          require("path").resolve(
            __dirname,
            "../../assets/background_naive.png"
          )
        );
        const inferno = await loadImage(
          require("path").resolve(__dirname, "../../assets/inferno.png")
        );
        const expert = await loadImage(
          require("path").resolve(__dirname, "../../assets/expert.png")
        );
        const hard = await loadImage(
          require("path").resolve(__dirname, "../../assets/hard.png")
        );
        const normal = await loadImage(
          require("path").resolve(__dirname, "../../assets/normal.png")
        );
        registerFont(
          require("path").resolve(__dirname, "../../assets/segoeui.ttf"),
          {
            family: "Segoe UI",
          }
        );
        registerFont(
          require("path").resolve(__dirname, "../../assets/fallingskybd.ttf"),
          {
            family: "Falling Sky",
          }
        );
        registerFont(
          require("path").resolve(__dirname, "../../assets/yugothic.ttf"),
          {
            family: "Yu Gothic",
          }
        );
        const canvas = createCanvas(
          naive ? background_naive.width : background.width,
          naive ? background_naive.height : background.height
        );
        const ctx = canvas.getContext("2d");
        ctx.textRendering = "optimizeLegibility";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FFFFFF";

        function drawShortenedText(text, maxWidth, x, y) {
          let shortenedText = text;

          while (ctx.measureText(shortenedText).width > maxWidth) {
            if (shortenedText.length <= 1) break;
            shortenedText = shortenedText.slice(0, -1);
          }
          if (shortenedText !== text) {
            shortenedText = shortenedText.slice(0, -3) + "...";
          }
          ctx.fillText(shortenedText, x, y);
        }
        ctx.drawImage(naive ? background_naive : background, 0, 0);

        const columns = 5;
        const xOffset = 30;
        const xSpacing = 365;
        const ySpacing = 240;

        const drawScores = async (scores, yOffsetStart, totalRateCallback) => {
          let yOffset = yOffsetStart;
          let totalRate = 0;

          for (const [index, score] of scores.entries()) {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const x = xOffset + col * xSpacing;
            const y = yOffset + row * ySpacing;
            totalRate += score[3];

            const difficultyImages = {
              1: normal,
              2: hard,
              3: expert,
              4: inferno,
            };

            const difficultyKey = score[1];
            const imageToDraw = difficultyImages[difficultyKey];
            if (!imageToDraw) {
              console.error("Unknown difficulty:", difficultyKey);
              continue;
            }

            ctx.drawImage(imageToDraw, x, y);
            const imageX = x + 10;
            const imageY = y + 60;
            const imageSize = 110;
            const cover = await loadImage(
              `https://webui.wacca.plus/wacca/img/covers/${score[5]}`
            );

            ctx.drawImage(cover, imageX, imageY, imageSize, imageSize);
            ctx.font = "bold 32px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            drawShortenedText(score[0], 320, x + 10, y + 25);
            ctx.font = "bold 36px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${score[6].toLocaleString()}`, x + 130, y + 75);

            ctx.font = "bold 24px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${score[4]}`, x + 130, y + 110);

            ctx.font = "bold 26px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
              `${score[2] % 1 === 0 ? score[2].toFixed(1) : score[2]}`,
              x + 160,
              y + 150
            );
            ctx.textAlign = "left";
            ctx.font = "bold 36px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${score[3].toFixed(3)}`, x + 230, y + 150);
          }

          totalRateCallback(totalRate);
        };

        if (!naive) {
          await drawScores(oldScores, 425, (rate) => {
            ctx.fillStyle = "#000000";
            ctx.font = "bold 50px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${rate.toFixed(3)}`, 410, 360);
            ctx.fillStyle = "#FFFFFF";
          });

          await drawScores(newScores, 2235, (rate) => {
            ctx.fillStyle = "#000000";
            ctx.font = "bold 50px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${rate.toFixed(3)}`, 410, 2170);
            ctx.fillStyle = "#FFFFFF";
          });
        } else {
          await drawScores(bestScores, 320, () => {
            ctx.font = "bold 50px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillStyle = "#FFFFFF";
          });
        }

        const totalRate = naive
          ? bestScores.reduce((sum, score) => sum + score[3], 0)
          : oldScores.reduce((sum, score) => sum + score[3], 0) +
            newScores.reduce((sum, score) => sum + score[3], 0);

        ctx.font = "black 72px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          naive
            ? `${username} - Rate: ${(
                Math.floor(totalRate * 1000) / 1000
              ).toFixed(3)} - Stage Up: ${global.rank} ${global.danRank}`
            : `${username} - Rate: ${(Math.floor(totalRate * 10) / 10).toFixed(
                1
              )} - Stage Up: ${global.rank} ${global.danRank}`,
          936,
          230
        );

        const out = fs.createWriteStream(`./${user.id}.png`);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on("finish", async () => {
          await interaction.editReply({
            files: [require("path").resolve(__dirname, `../../${user.id}.png`)],
          });
          fs.unlink(`./${user.id}.png`, (err) => {
            if (err) {
              console.error(`Error deleting image: ${err}`);
            }
          });
        });
      } catch (error) {
        console.error("Error combining images:", error);
      }
    };
  },
};
