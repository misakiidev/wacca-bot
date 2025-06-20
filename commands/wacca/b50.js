const { SlashCommandBuilder } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(
  require("path").resolve(__dirname, "../../usernames.db")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("b50")
    .setDescription("See your best 50 scores.")

    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Kamaitachi Username")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("naive")
        .setDescription(
          "Use the naive rating system instead of the in-game one."
        )
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("plus")
        .setDescription("Include charts from WACCA+")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    let username = interaction.options.getString("username");
    const naive = interaction.options.getBoolean("naive");
    const includePlus = interaction.options.getBoolean("plus") ?? true;
    const { waccaSongs } = require("../../waccaSongs.js");
    const { createCanvas, loadImage, registerFont } = require("canvas");
    const fs = require("fs");
    const moment = require("moment");

    if (!username) {
      username = await new Promise((resolve, reject) => {
        db.get(
          "SELECT username FROM users WHERE id = ?",
          [interaction.user.id],
          (err, row) => {
            if (err) {
              console.error("Database error:", err);
              interaction.editReply({
                content: "An error occurred while fetching your username.",
              });
              return reject(err);
            }
            if (!row) {
              interaction.editReply({
                content:
                  "No username found for your account. Please set your username first.",
              });
              return resolve(null);
            }
            resolve(row.username);
          }
        );
      });
      if (!username) return;
    }

    const fetchScores = async () => {
      try {
        const response = await fetch(
          `https://kamai.tachi.ac/api/v1/users/${username}/games/wacca/Single/pbs/all`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching best scores:", error);
        return null;
      }
    };

    let oldScores = [];
    let newScores = [];
    // regardless of the game version, we will always show the best 50 scores
    let bestScores = [];

    const processScores = (pbs, songs, charts, filterCondition, limit) => {
      return pbs
        .filter((score) => {
          const song = songs.find((song) => song.id === score.songID);
          const chart = charts.find((chart) => chart.chartID === score.chartID);
          let difficulty = chart.difficulty;
          const difficultyMap = { NORMAL: 1, HARD: 2, EXPERT: 3, INFERNO: 4 };
          difficulty = difficultyMap[difficulty];

          const waccaSong = waccaSongs.find((waccaSong) => {
            const titles = [song.title, song.altTitles?.[0]];
            return (
              titles.includes(waccaSong.title) ||
              titles.includes(waccaSong.titleEnglish)
            );
          });

          return waccaSong && filterCondition(waccaSong, difficulty)
            ? song
            : null;
        })
        .slice(0, limit)
        .map((score) => {
          const song = songs.find((song) => song.id === score.songID);
          const chart = charts.find((chart) => chart.chartID === score.chartID);
          const difficulty = chart.difficulty;
          const levelNum = chart.levelNum;
          const matchedSong = waccaSongs.find((waccaSong) => {
            const titles = [waccaSong.title, waccaSong.titleEnglish];
            return (
              titles.includes(song.title) ||
              titles.includes(song.altTitles?.[0])
            );
          });
          const englishSongName = matchedSong?.titleEnglish || song.title;
          const imageName = matchedSong?.imageName;
          const judgements = score.scoreData.judgements;
          const judgementString = `${judgements.marvelous}/${judgements.great}/${judgements.good}/${judgements.miss}`;
          const time =
            score.timeAchieved === 0
              ? "Unknown"
              : moment(score.timeAchieved).fromNow();

          return [
            englishSongName,
            score.scoreData.score,
            score.scoreData.grade,
            score.calculatedData.rate,
            levelNum,
            difficulty,
            imageName,
            score.scoreData.lamp,
            time,
            judgementString,
          ];
        });
    };

    fetchScores().then((data) => {
      if (!data) {
        interaction.editReply({
          content:
            "Error fetching data. Please check the username or try again later.",
        });
        return;
      }

      const { pbs, songs, charts } = data.body;

      pbs.sort((a, b) => {
        if (b.calculatedData.rate === a.calculatedData.rate) {
          return b.scoreData.score - a.scoreData.score;
        }
        return b.calculatedData.rate - a.calculatedData.rate;
      });

      oldScores = processScores(
        pbs,
        songs,
        charts,
        (waccaSong, difficulty) =>
          waccaSong.sheets[difficulty - 1].gameVersion !== 300 &&
          // old scores don't require plus filtering since plus songs are already excluded from here.
          waccaSong.sheets[difficulty - 1].gameVersion !== 400,
        35
      );

      newScores = processScores(
        pbs,
        songs,
        charts,
        (waccaSong, difficulty) => {
          if (!includePlus) {
            return (
              waccaSong.sheets[difficulty - 1].gameVersion === 300
            );
          }
          return waccaSong.sheets[difficulty - 1].gameVersion === 300 ||
            waccaSong.sheets[difficulty - 1].gameVersion === 400;
        },
        15
      );

      bestScores = processScores(pbs, songs, charts, (waccaSong, difficulty) => {
          if (!includePlus) {
            return (
              waccaSong.sheets[difficulty - 1].gameVersion !== 400
            );
          }
          return true;

      }, 50);

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
              INFERNO: inferno,
              EXPERT: expert,
              HARD: hard,
              NORMAL: normal,
            };
            const imageToDraw = difficultyImages[score[5]];
            if (!imageToDraw) {
              console.error("Unknown difficulty:", score[5]);
              continue;
            }

            ctx.drawImage(imageToDraw, x, y);
            const imageX = x + 10;
            const imageY = y + 60;
            const imageSize = 110;
            const cover = await loadImage(
              `https://webui.wacca.plus/wacca/img/covers/${score[6]}`
            );

            ctx.drawImage(cover, imageX, imageY, imageSize, imageSize);
            ctx.font = "bold 32px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            drawShortenedText(score[0], 320, x + 10, y + 25);
            ctx.font = "bold 36px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${score[1].toLocaleString()}`, x + 130, y + 75);

            ctx.font = "bold 24px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            const lampTextMap = {
              "ALL MARVELOUS": "[AM]",
              "FULL COMBO": "[FC]",
              MISSLESS: "[ML]",
            };
            const lampText = lampTextMap[score[7]] || "";
            ctx.fillText(`[${score[2]}] ${lampText}`, x + 130, y + 110);

            ctx.font = "bold 26px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
              `${score[4] % 1 === 0 ? score[4].toFixed(1) : score[4]}`,
              x + 160,
              y + 150
            );
            ctx.textAlign = "left";
            ctx.font = "bold 36px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${score[3].toFixed(2)}`, x + 230, y + 150);

            ctx.font = "bold 20px Falling Sky, Segoe UI, Yu Gothic, sans-serif";
            ctx.fillText(`${score[8]} | ${score[9]}`, x + 10, y + 196);
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
            ? `${username} - Naive Best Scores - Rate: ${totalRate.toFixed(2)}`
            : `${username} - Best Scores - Rate: ${totalRate.toFixed(1)}`,
          936,
          230
        );

        const out = fs.createWriteStream(`./${username}.png`);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on("finish", async () => {
          console.log(`Image successfully created as ${username}.png`);
          await interaction.editReply({
            files: [
              require("path").resolve(__dirname, `../../${username}.png`),
            ],
          });
          fs.unlink(`./${username}.png`, (err) => {
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
