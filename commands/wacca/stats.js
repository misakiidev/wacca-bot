const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Fuse = require("fuse.js");
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
    .setName("stats")
    .setDescription("Find a user's stats on a certain WACCA chart.")
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
    let songScore = scoreData.music.find(
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

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${scoreData.user_name}'s stats:` })
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
          name: "LAMP",
          value: `AM Count: ${songScore.grade_master_count}
		FC Count: ${songScore.full_combo_count}
		Missless Count: ${songScore.missless_count}
		Clear Count: ${songScore.clear_count}
		Failed Count: ${songScore.play_count - songScore.clear_count}`,
          inline: true,
        },
        {
          name: "GRADE",
          value: `${rankEmojis["MASTER"]} › ${songScore.grade_master_count}
		${rankEmojis["SSSPlus"]} › ${songScore.grade_sss_plus_count}
		${rankEmojis["SSS"]} › ${songScore.grade_sss_count}
		${rankEmojis["SSPlus"]} › ${songScore.grade_ss_plus_count}
		${rankEmojis["SS"]} › ${songScore.grade_ss_count}`,
          inline: true,
        }
      );
    return interaction.reply({ embeds: [embed] });
  },
};
