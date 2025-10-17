const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Fuse = require("fuse.js");
const score = require("./score.js");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(
  require("path").resolve(__dirname, "../../access_codes.db")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("recent")
    .setDescription("Show a user's most recent WACCA play.")
    .addStringOption((option) =>
      option
        .setName("count")
        .setDescription("How many recent plays to show (3-4).")
        .setRequired(false)
        .addChoices({ name: "3", value: "3" }, { name: "4", value: "4" })
    )
    .addMentionableOption((option) =>
      option
        .setName("user")
        .setDescription("The user to see stats for.")
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getMentionable("user") || interaction.user;
    const { waccaSongs } = require("../../waccaSongs.js");

    access_code = await new Promise((resolve, reject) => {
      db.get(
        "SELECT access_code FROM users WHERE id = ?",
        [user.id],
        (err, row) => {
          if (err) {
            console.error("Database error:", err);
            interaction.reply({
              content: "An error occurred while fetching the access code.",
            });
            return reject(err);
          }
          if (!row) {
            interaction.reply({
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
        return data;
      } catch (error) {
        console.error("Error fetching score:", error);
        return null;
      }
    };

    const scoreData = await fetchScores();

    if (!scoreData) {
      return interaction.reply({
        content: "Failed to fetch score data. Please try again later.",
      });
    }

    const playlog = scoreData.playlog;
    const count = Math.min(
      parseInt(interaction.options.getString("count")) || 3,
      10
    );
    const recentPlays = playlog.slice(0, count);

    const rankEmojis = {
      D: "<:grade_d:1423409845272445110>",
      C: "<:grade_c:1423409875420975125>",
      B: "<:grade_b:1423409842227253389>",
      A: "<:grade_a:1423409840851783691>",
      AA: "<:grade_aa:1423409839584841729>",
      AAA: "<:grade_aaa:1423409837047545956>",
      S: "<:grade_s:1423409835575214220>",
      SPlus: "<:grade_s_plus:1423409833591181432>",
      SS: "<:grade_ss:1423409831473319977>",
      SSPlus: "<:grade_ss_plus:1423409829610786898>",
      SSS: "<:sss:1423409827496988815>",
      SSSPlus: "<:grade_sss_plus:1423409825034932274>",
      MASTER: "<:grade_master:1423409823176986735>",
    };

    const gradeMap = {
      0: "D",
      1: "C",
      2: "B",
      3: "A",
      4: "AA",
      5: "AAA",
      6: "S",
      7: "SPlus",
      8: "SS",
      9: "SSPlus",
      10: "SSS",
      11: "SSSPlus",
      12: "MASTER",
    };

    const getLamp = (clear) => {
      if (clear.is_all_marvelous) return "ALL MARVELOUS";
      if (clear.is_full_combo) return "FULL COMBO";
      if (clear.is_missless) return "MISSLESS";
      if (clear.is_clear) return "CLEAR";
      return "FAILED";
    };

    const getDifficultyName = (diff) => {
      switch (diff) {
        case 1:
          return "Normal";
        case 2:
          return "Hard";
        case 3:
          return "Expert";
        case 4:
          return "Inferno";
        default:
          return "?";
      }
    };

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

    const embeds = [];

    for (const play of recentPlays) {
      const info = play.info;
      const song = waccaSongs.find((s) => s.id === info.music_id);

      if (!song) continue;

      const difficulty = getDifficultyName(info.music_difficulty);
      const chart = song.sheets[info.music_difficulty - 1];
      const chartConstant = chart?.difficulty ?? "?";

      const grade = gradeMap[info.grade - 1] || "?";
      const rankEmoji = rankEmojis[grade] || "";
      const lamp = getLamp(info.clear_status);
      const playDate = new Date(info.user_play_date);
      const day = playDate.getUTCDate();
      const month = playDate.toLocaleString("en-US", {
        month: "long",
        timeZone: "UTC",
      });
      const year = playDate.getUTCFullYear();

      function getOrdinalSuffix(day) {
        if (day > 3 && day < 21) return day + "th";
        switch (day % 10) {
          case 1:
            return day + "st";
          case 2:
            return day + "nd";
          case 3:
            return day + "rd";
          default:
            return day + "th";
        }
      }

      const formattedDate = `${month} ${getOrdinalSuffix(day)} ${year}`;

      const embed = new EmbedBuilder()
        .setAuthor({ name: `${scoreData.user_name}'s recent play:` })
        .setTitle(
          `${song.titleEnglish || song.title} (${difficulty} ${chartConstant})`
        )
        .setThumbnail(
          `https://webui.wacca.plus/wacca/img/covers/${song.imageName}`
        )
        .addFields(
          {
            name: "SCORE",
            value: `${rankEmoji} › ${info.score}`,
            inline: true,
          },
          {
            name: "RATING",
            value: `${calculateRate(info.score, chartConstant).toFixed(3)}`,
            inline: true,
          },
          {
            name: "LAMP",
            value: lamp,
            inline: true,
          },
          {
            name: "COMBO",
            value: `${info.combo}`,
            inline: true,
          },
          {
            name: "FAST/LATE",
            value: `${info.fast}/${info.late}`,
            inline: true,
          },
          {
            name: "JUDGEMENTS",
            value: `${info.judge.marvelous}/${info.judge.great}/${info.judge.good}/${info.judge.miss}`,
            inline: true,
          }
        );
      embed.setFooter({
        text: `Played on ${formattedDate} at ${playDate.toLocaleTimeString(
          "en-US",
          {
            timeZone: "UTC",
          }
        )} UTC`,
      });

      embeds.push(embed);
    }

    if (embeds.length === 0) {
      return interaction.reply({
        content: "No recent plays found for this user.",
        ephemeral: true,
      });
    }

    return interaction.reply({ embeds });
  },
};
