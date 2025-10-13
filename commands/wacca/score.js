const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Fuse = require("fuse.js");
const { distance } = require("jimp");
const { normalize } = require("path");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(
  require("path").resolve(__dirname, "../../access_codes.db")
);

const fuse = new Fuse([], {
  keys: ["title", "titleEnglish"],
  threshold: 0.3,
  includeScore: true,
  ignoreDiacritics: true,
  useExtendedSearch: true,
  ignoreLocation: true,
});

function findSong(query, minSimilarity = 0.6) {
  const result = fuse.search(query, { limit: 1 })[0];

  if (!result) return { song: null, similarity: 0 };

  const similarity = 1 - (result.score ?? 1);

  if (similarity < minSimilarity) {
    return { song: null, similarity };
  }

  return { song: result.item, similarity };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("score")
    .setDescription("Find a user's score on a certain WACCA chart.")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("The song to search for.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("difficulty")
        .setDescription("The difficulty of the chart.")
        .addChoices(
          { name: "Normal", value: "Normal" },
          { name: "Hard", value: "Hard" },
          { name: "Expert", value: "Expert" },
          { name: "Inferno", value: "Inferno" }
        )
        .setRequired(false)
    )
    .addMentionableOption((option) =>
      option
        .setName("user")
        .setDescription("The user to see scores for.")
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
    fuse.setCollection(waccaSongs);
    if (!scoreData) {
      return interaction.reply({
        content: "Failed to fetch score data. Please try again later.",
      });
    }

    const songQuery = interaction.options.getString("song");
    let difficulty = interaction.options.getString("difficulty");
    let difficultyLevel = null;
    let chartConstant = null;
    const difficultyMap = {
      Normal: 1,
      Hard: 2,
      Expert: 3,
      Inferno: 4,
    };
    const { song, similarity } = findSong(songQuery);

    if (!song) {
      return interaction.reply({
        content: `No song found for "${songQuery}".`,
      });
    }

    if (difficulty) {
      difficultyLevel = difficultyMap[difficulty];
      chartConstant = song.sheets[difficultyLevel - 1].difficulty;
    }
    if (difficultyLevel === null) {
      difficultyLevel = song.sheets.length;
      difficulty =
        song.sheets.length === 4
          ? "Inferno"
          : song.sheets.length === 3
          ? "Expert"
          : song.sheets.length === 2
          ? "Hard"
          : "Normal";
      chartConstant = song.sheets[difficultyLevel - 1].difficulty;
    }
    const songId = song.id;
    const songScore = scoreData.music.find(
      (entry) =>
        entry.music_id === songId && entry.music_difficulty === difficultyLevel
    );
    if (!songScore) {
      return interaction.reply({
        content: `No score found for ${song.title} (${difficulty} ${chartConstant}).`,
      });
    }

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

    const rankOrder = [
      "MASTER",
      "SSSPlus",
      "SSS",
      "SSPlus",
      "SS",
      "SPlus",
      "S",
      "AAA",
      "AA",
      "A",
      "B",
      "C",
      "D",
    ];
    let highestRank = null;
    for (const rank of rankOrder) {
      let count = 0;
      switch (rank) {
        case "D":
          count = songScore.grade_d_count;
          break;
        case "C":
          count = songScore.grade_c_count;
          break;
        case "B":
          count = songScore.grade_b_count;
          break;
        case "A":
          count = songScore.grade_a_count;
          break;
        case "AA":
          count = songScore.grade_aa_count;
          break;
        case "AAA":
          count = songScore.grade_aaa_count;
          break;
        case "S":
          count = songScore.grade_s_count;
          break;
        case "SPlus":
          count = songScore.grade_s_plus_count;
          break;
        case "SS":
          count = songScore.grade_ss_count;
          break;
        case "SSPlus":
          count = songScore.grade_ss_plus_count;
          break;
        case "SSS":
          count = songScore.grade_sss_count;
          break;
        case "SSSPlus":
          count = songScore.grade_sss_plus_count;
          break;
        case "MASTER":
          count = songScore.grade_master_count;
          break;
      }
      if (count > 0) {
        highestRank = rank;
        break;
      }
    }

    const highestLamp =
      songScore.all_marvelous_count > 0
        ? "ALL MARVELOUS"
        : songScore.full_combo_count > 0
        ? "FULL COMBO"
        : songScore.missless_count > 0
        ? "MISSLESS"
        : "CLEAR";

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

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${scoreData.user_name}'s score:` })
      .setTitle(
        `${
          song.titleEnglish ? song.titleEnglish : song.title
        } (${difficulty} ${chartConstant})`
      )
      .setThumbnail(
        `https://webui.wacca.plus/wacca/img/covers/${song.imageName}`
      )
      .addFields(
        {
          name: "SCORE",
          value: `${rankEmojis[highestRank]} › ${songScore.score}`,
          inline: true,
        },
        {
          name: "RATING",
          value: `${calculateRate(songScore.score, chartConstant).toFixed(3)}`,
          inline: true,
        },
        { name: "LAMP", value: `${highestLamp}`, inline: true },
        { name: "COMBO", value: `${songScore.combo}`, inline: true },
        { name: "PLAY COUNT", value: `${songScore.play_count}`, inline: true }
      );

    const fetchAdditionalData = async () => {
      try {
        const response = await fetch(
          `https://mithical-backend.guegan.de/wacca/user/${access_code}/music/${songId}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching additional music data:", error);
        return null;
      }
    };

    const additionalData = await fetchAdditionalData();

    const matchingPlaylog = additionalData.find(
      (log) =>
        log.info.music_difficulty === difficultyLevel &&
        log.info.score === songScore.score
    );

    if (matchingPlaylog) {
      embed.addFields({
        name: "JUDGEMENTS",
        value: `${matchingPlaylog.info.judge.marvelous}/${matchingPlaylog.info.judge.great}/${matchingPlaylog.info.judge.good}/${matchingPlaylog.info.judge.miss}`,
        inline: true,
      });
      const playDate = new Date(matchingPlaylog.info.user_play_date);
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
      embed.setFooter({
        text: `Played on ${formattedDate} at ${playDate.toLocaleTimeString(
          "en-US",
          { timeZone: "UTC" }
        )} UTC`,
      });
    } else {
      console.log("No matching playlog found.");
    }

    console.log(
      `Score for ${user.tag}: ${song.title} (${difficulty} ${chartConstant}) - ${songScore.score}`
    );
    return interaction.reply({ embeds: [embed] });
  },
};
