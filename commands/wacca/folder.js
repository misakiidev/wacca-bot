const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(
  require("path").resolve(__dirname, "../../access_codes.db")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("folder")
    .setDescription("Find a user's stats on a certain WACCA folder.")
    .addStringOption((option) =>
      option
        .setName("level")
        .setDescription("The folder level to search for.")
        .setRequired(true)
        .addChoices([
          { name: "1", value: "1" },
          { name: "2", value: "2" },
          { name: "3", value: "3" },
          { name: "4", value: "4" },
          { name: "5", value: "5" },
          { name: "5+", value: "5+" },
          { name: "6", value: "6" },
          { name: "6+", value: "6+" },
          { name: "7", value: "7" },
          { name: "7+", value: "7+" },
          { name: "8", value: "8" },
          { name: "8+", value: "8+" },
          { name: "9", value: "9" },
          { name: "9+", value: "9+" },
          { name: "10", value: "10" },
          { name: "10+", value: "10+" },
          { name: "11", value: "11" },
          { name: "11+", value: "11+" },
          { name: "12", value: "12" },
          { name: "12+", value: "12+" },
          { name: "13", value: "13" },
          { name: "13+", value: "13+" },
          { name: "14", value: "14" },
          { name: "15", value: "15" },
        ])
    )
    .addMentionableOption((option) =>
      option
        .setName("user")
        .setDescription("The user to see folder stats for.")
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
    const levelQuery = interaction.options.getString("level");
    let minDifficulty, maxDifficulty;
    if (levelQuery.endsWith("+")) {
      minDifficulty = parseInt(levelQuery) + 0.7;
      maxDifficulty = parseInt(levelQuery) + 0.9;
    } else {
      minDifficulty = parseInt(levelQuery);
      maxDifficulty = parseInt(levelQuery) + 0.6;
    }

    const songsInLevel = waccaSongs.filter((song) =>
      song.sheets.some(
        (sheet) =>
          sheet.difficulty >= minDifficulty && sheet.difficulty <= maxDifficulty
      )
    );

    const scoredSongsInLevel = scoreData.music.filter((score) =>
      songsInLevel.some((song) => {
        const sheetIndex = score.music_difficulty - 1; // difficulty 1–4 → index 0–3
        const sheet = song.sheets[sheetIndex];
        return (
          song.id === score.music_id &&
          sheet &&
          sheet.difficulty >= minDifficulty &&
          sheet.difficulty <= maxDifficulty
        );
      })
    );

    const lampCounts = scoredSongsInLevel.reduce(
      (acc, songScore) => {
        let lamp;
        // Determine the highest lamp for this chart in descending order of merit
        if (songScore.grade_master_count > 0) {
          lamp = "amsCount";
        } else if (songScore.full_combo_count > 0) {
          lamp = "fcsCount";
        } else if (songScore.missless_count > 0) {
          lamp = "misslessCount";
        }
        if (songScore.clear_count > 0) {
          acc.clearsCount = (acc.clearsCount || 0) + 1;
        } else {
          acc.failedCount = (acc.failedCount || 0) + 1;
        }

        acc[lamp] = (acc[lamp] || 0) + 1;
        return acc;
      },
      {
        amsCount: 0,
        fcsCount: 0,
        misslessCount: 0,
        clearsCount: 0,
        failedCount: 0,
      }
    );
    const gradeCounts = scoredSongsInLevel.reduce((acc, s) => {
      let bestGrade = null;
      if (s.grade_master_count > 0) {
        bestGrade = "MASTER";
      } else if (s.score >= 995000) {
        bestGrade = "995";
      } else if (s.grade_sss_plus_count > 0) {
        bestGrade = "SSSPlus";
      } else if (s.grade_sss_count > 0) {
        bestGrade = "SSS";
      } else if (s.grade_ss_plus_count > 0) {
        bestGrade = "SSPlus";
      } else if (s.grade_ss_count > 0) {
        bestGrade = "SS";
      }
      if (bestGrade) {
        acc[bestGrade] = (acc[bestGrade] || 0) + 1;
      }
      return acc;
    }, {});

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
      995: "<:grade_995:1427146159826403439>",
      MASTER: "<:grade_master:1423409823176986735>",
    };

    const rankOrder = [
      "MASTER",
      "995",
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

    const randomSong =
      songsInLevel[Math.floor(Math.random() * songsInLevel.length)];
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${scoreData.user_name}'s ${levelQuery} folder stats:`,
      })
      .setThumbnail(
        `https://webui.wacca.plus/wacca/img/covers/${randomSong.imageName}`
      )
      .addFields(
        {
          name: "LAMP",
          value: `AM Count: ${lampCounts.amsCount}
				FC Count: ${lampCounts.fcsCount}
				Missless Count: ${lampCounts.misslessCount}
				Clear Count: ${lampCounts.clearsCount}
				Failed Count: ${lampCounts.failedCount}`,
          inline: true,
        },
        {
          name: "GRADE",
          value: `${rankEmojis["MASTER"]} › ${gradeCounts["MASTER"] || 0}
${rankEmojis["995"]} › ${gradeCounts["995"] || 0}
${rankEmojis["SSSPlus"]} › ${gradeCounts["SSSPlus"] || 0}
${rankEmojis["SSS"]} › ${gradeCounts["SSS"] || 0}
${rankEmojis["SSPlus"]} › ${gradeCounts["SSPlus"] || 0}
${rankEmojis["SS"]} › ${gradeCounts["SS"] || 0}`,
          inline: true,
        },
        {
          name: "PLAYED",
          value: `${scoredSongsInLevel.length} / ${songsInLevel.length} (${(
            (scoredSongsInLevel.length / songsInLevel.length) *
            100
          ).toFixed(2)}%)`,
          inline: true,
        },
        {
          name: "AVERAGE SCORE",
          value: `${(
            scoredSongsInLevel.reduce((acc, s) => acc + s.score, 0) /
              scoredSongsInLevel.length || 0
          ).toFixed(0)}`,
          inline: true,
        },
        {
          name: "BEST SCORE",
          value: `${(
            scoredSongsInLevel.reduce((acc, s) => Math.max(acc, s.score), 0) ||
            0
          ).toFixed(0)}`,
          inline: true,
        },
        {
          name: "WORST SCORE",
          value: `${(
            scoredSongsInLevel
              .slice(1)
              .reduce(
                (acc, s) => Math.min(acc, s.score),
                scoredSongsInLevel[0].score
              ) || 0
          ).toFixed(0)}`,
          inline: true,
        }
      );
    return interaction.reply({ embeds: [embed] });
  },
};
