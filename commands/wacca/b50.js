const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("b50")
    .setDescription("See your best 50 scores.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Kamaitachi Username")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const username = interaction.options.getString("username");
    const { waccaSongs } = require("../../waccaSongs.js");
    const { createCanvas, loadImage } = require("canvas");
    const fs = require("fs");
    const moment = require("moment");

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

    fetchScores().then((data) => {
      if (!data) {
        interaction.editReply({
          content:
            "Error fetching data. Please check the username or try again later.",
          ephemeral: true,
        });
        return;
      }

      if (data) {
        const pbs = data.body.pbs;
        const songs = data.body.songs;
        const charts = data.body.charts;

        pbs.sort((a, b) => {
          if (b.calculatedData.rate === a.calculatedData.rate) {
            return b.scoreData.score - a.scoreData.score;
          }
          return b.calculatedData.rate - a.calculatedData.rate;
        });

        const bestOldScores = pbs
          .filter((score) => {
            const song = songs.find((song) => song.id === score.songID);
            let chart = charts.find((chart) => chart.chartID === score.chartID);
            let difficulty = chart.difficulty;
            switch (difficulty) {
              case "NORMAL":
                difficulty = 1;
                break;
              case "HARD":
                difficulty = 2;
                break;
              case "EXPERT":
                difficulty = 3;
                break;
              case "INFERNO":
                difficulty = 4;
                break;
            }
            const waccaSong = waccaSongs.find((waccaSong) => {
              const titles = [song.title, song.altTitles?.[0]];
              return (
                titles.includes(waccaSong.title) ||
                titles.includes(waccaSong.titleEnglish)
              );
            });

            return waccaSong &&
              waccaSong.sheets[difficulty - 1].gameVersion !== 5 &&
              waccaSong.sheets[difficulty - 1].gameVersion !== 6
              ? song
              : null;
          })
          .slice(0, 35);

        bestOldScores.forEach((score) => {
          let songName = songs.find((song) => song.id === score.songID).title;
          let altSongName =
            songs.find((song) => song.id === score.songID)?.altTitles?.[0] ||
            songName;
          let chart = charts.find((chart) => chart.chartID === score.chartID);
          let levelNum = chart.levelNum;
          let difficulty = chart.difficulty;
          const englishSongName =
            waccaSongs.find(
              (waccaSong) =>
                [waccaSong.title, waccaSong.titleEnglish].includes(songName) ||
                [waccaSong.title, waccaSong.titleEnglish].includes(altSongName)
            )?.titleEnglish || songName;
          let imageName = waccaSongs.find(
            (waccaSong) =>
              [waccaSong.title, waccaSong.titleEnglish].includes(songName) ||
              [waccaSong.title, waccaSong.titleEnglish].includes(altSongName)
          )?.imageName;
          let judgements = score.scoreData.judgements;
          let judgementString = `${judgements.marvelous}/${judgements.great}/${judgements.good}/${judgements.miss}`;
          let time = moment(score.timeAchieved).fromNow();

          oldScores.push([
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
          ]);
        });

        const bestNewScores = pbs
          .filter((score) => {
            const song = songs.find((song) => song.id === score.songID);
            let chart = charts.find((chart) => chart.chartID === score.chartID);
            let difficulty = chart.difficulty;
            switch (difficulty) {
              case "NORMAL":
                difficulty = 1;
                break;
              case "HARD":
                difficulty = 2;
                break;
              case "EXPERT":
                difficulty = 3;
                break;
              case "INFERNO":
                difficulty = 4;
                break;
            }
            const waccaSong = waccaSongs.find((waccaSong) => {
              const titles = [song.title, song.altTitles?.[0]];
              return (
                titles.includes(waccaSong.title) ||
                titles.includes(waccaSong.titleEnglish)
              );
            });

            return waccaSong &&
              (waccaSong.sheets[difficulty - 1].gameVersion === 5 ||
                waccaSong.sheets[difficulty - 1].gameVersion === 6)
              ? song
              : null;
          })
          .slice(0, 15);

        bestNewScores.forEach((score) => {
          let songName = songs.find((song) => song.id === score.songID).title;
          let altSongName =
            songs.find((song) => song.id === score.songID)?.altTitles?.[0] ||
            songName;
          let chart = charts.find((chart) => chart.chartID === score.chartID);
          let levelNum = chart.levelNum;
          let difficulty = chart.difficulty;
          const englishSongName =
            waccaSongs.find((waccaSong) => {
              const titles = [waccaSong.title, waccaSong.titleEnglish];
              return titles.includes(songName) || titles.includes(altSongName);
            })?.titleEnglish || songName;
          let imageName = waccaSongs.find(
            (waccaSong) =>
              [waccaSong.title, waccaSong.titleEnglish].includes(songName) ||
              [waccaSong.title, waccaSong.titleEnglish].includes(altSongName)
          )?.imageName;
          let judgements = score.scoreData.judgements;
          let judgementString = `${judgements.marvelous}/${judgements.great}/${judgements.good}/${judgements.miss}`;
          let time = moment(score.timeAchieved).fromNow();

          newScores.push([
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
          ]);
        });
      }
      makeImages();
    });

    const makeImages = async () => {
      try {
        const background = await loadImage(
          require("path").resolve(__dirname, "../../assets/background.png")
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
        const canvas = createCanvas(background.width, background.height);
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
        ctx.drawImage(background, 0, 0);

        const columns = 5;
        const xOffset = 30;
        let yOffset = 425;
        const xSpacing = 365;
        const ySpacing = 240;
        let totalRate = 0;

        for (const [index, score] of oldScores.entries()) {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const x = xOffset + col * xSpacing;
          const y = yOffset + row * ySpacing;
          totalRate += score[3];
          let imageToDraw;
          switch (score[5]) {
            case "INFERNO":
              imageToDraw = inferno;
              break;
            case "EXPERT":
              imageToDraw = expert;
              break;
            case "HARD":
              imageToDraw = hard;
              break;
            case "NORMAL":
              imageToDraw = normal;
              break;
            default:
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
          ctx.font = "bold 32px Falling Sky, Segoe UI, sans-serif";
          drawShortenedText(score[0], 320, x + 10, y + 25);
          ctx.font = "bold 36px Falling Sky, Segoe UI, sans-serif";
          const formattedScore = score[1].toLocaleString();
          ctx.fillText(`${formattedScore}`, x + 130, y + 75);
          ctx.font = "bold 24px Falling Sky, Segoe UI, sans-serif";
          let lampText = "";
          switch (score[7]) {
            case "ALL MARVELOUS":
              lampText = "[AM]";
              break;
            case "FULL COMBO":
              lampText = "[FC]";
              break;
            case "MISSLESS":
              lampText = "[ML]";
              break;
            default:
              lampText = "";
          }
          ctx.fillText(`[${score[2]}] ${lampText}`, x + 130, y + 110);
          ctx.font = "bold 26px Falling Sky, Segoe UI, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            `${score[4] % 1 === 0 ? score[4].toFixed(1) : score[4]}`,
            x + 160,
            y + 150
          );
          ctx.textAlign = "left";
          ctx.font = "bold 36px Falling Sky, Segoe UI, sans-serif";
          ctx.fillText(`${score[3].toFixed(2)}`, x + 230, y + 150);
          ctx.font = "bold 20px Falling Sky, Segoe UI, sans-serif";
          ctx.fillText(`${score[8]} | ${score[9]}`, x + 10, y + 196);
        }
        ctx.fillStyle = "#000000";
        ctx.font = "bold 50px Falling Sky, Segoe UI, sans-serif";
        ctx.fillText(`${totalRate.toFixed(3)}`, 410, 360);
        ctx.fillStyle = "#FFFFFF";
        let totalNewRate = 0;
        yOffset = 2235;

        for (const [index, score] of newScores.entries()) {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const x = xOffset + col * xSpacing;
          const y = yOffset + row * ySpacing;
          totalNewRate += score[3];
          let imageToDraw;
          switch (score[5]) {
            case "INFERNO":
              imageToDraw = inferno;
              break;
            case "EXPERT":
              imageToDraw = expert;
              break;
            case "HARD":
              imageToDraw = hard;
              break;
            case "NORMAL":
              imageToDraw = normal;
              break;
            default:
              console.error("Unknown difficulty:", score[5]);
              return;
          }
          ctx.drawImage(imageToDraw, x, y);
          const imageX = x + 10;
          const imageY = y + 60;
          const imageSize = 110;
          const cover = await loadImage(
            `https://webui.wacca.plus/wacca/img/covers/${score[6]}`
          );

          ctx.drawImage(cover, imageX, imageY, imageSize, imageSize);
          ctx.font = "bold 32px Falling Sky, Segoe UI, sans-serif";
          drawShortenedText(score[0], 320, x + 10, y + 25);
          ctx.font = "bold 36px Falling Sky, Segoe UI, sans-serif";
          const formattedScore = score[1].toLocaleString();
          ctx.fillText(`${formattedScore}`, x + 130, y + 75);
          ctx.font = "bold 24px Falling Sky, Segoe UI, sans-serif";
          let lampText = "";
          switch (score[7]) {
            case "ALL MARVELOUS":
              lampText = "[AM]";
              break;
            case "FULL COMBO":
              lampText = "[FC]";
              break;
            case "MISSLESS":
              lampText = "[ML]";
              break;
            default:
              lampText = "";
          }
          ctx.fillText(`[${score[2]}] ${lampText}`, x + 130, y + 110);
          ctx.font = "bold 26px Falling Sky, Segoe UI, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            `${score[4] % 1 === 0 ? score[4].toFixed(1) : score[4]}`,
            x + 160,
            y + 150
          );
          ctx.textAlign = "left";
          ctx.font = "bold 36px Falling Sky, Segoe UI, sans-serif";
          ctx.fillText(`${score[3].toFixed(2)}`, x + 230, y + 151);
          ctx.font = "bold 20px Falling Sky, Segoe UI, sans-serif";
          ctx.fillText(`${score[8]} | ${score[9]}`, x + 10, y + 196);
        }
        ctx.fillStyle = "#000000";
        ctx.font = "bold 50px Falling Sky, Segoe UI, sans-serif";
        ctx.fillText(`${totalNewRate.toFixed(3)}`, 410, 2170);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "black 72px Falling Sky, Segoe UI, sans-serif";
        totalRate = totalRate + totalNewRate;
        ctx.textAlign = "center";
        ctx.fillText(
          `${username} - Best Scores - Rate: ${totalRate.toFixed(1)}`,
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
