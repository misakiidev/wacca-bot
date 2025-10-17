const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { waccaSongs } = require("../../waccaSongs.js");
const { AttachmentBuilder } = require("discord.js");
const { loadImage, createCanvas } = require("canvas");
const { execFile } = require("child_process");
const fs = require("fs");

// Map to track active guessing games per channel
const guessCooldown = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chartle")
    .setDescription("Guess the song based off of a screenshot of the chart"),

  async execute(interaction) {
    // Prevent starting a new game if there's already one active in the channel
    if (guessCooldown.has(interaction.channel.id)) {
      await interaction.reply({
        content:
          "Chartle is already active in this channel. Please wait until it finishes before starting a new one.",
        ephemeral: true,
      });
      return;
    }
    // Set cooldown active for this channel
    guessCooldown.set(interaction.channel.id, true);

    await interaction.deferReply();

    const exePath =
      "C:\\Users\\misakii\\Documents\\SaturnStuff\\SaturnImageGenerator\\bin\\Release\\net8.0\\win-x64\\publish\\SaturnImageGenerator.exe";
    await new Promise((resolve, reject) => {
      execFile(exePath, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          console.error("Error executing file:", error);
          return reject(error);
        }
        if (stderr) console.error("Error output:", stderr);
        resolve();
      });
    });
    const id = fs.readFileSync("chartle.txt", "utf8").trim().slice(0, 4);
    const level = fs.readFileSync("chartle.txt", "utf8").trim().slice(6);
    console.log(`ID: ${id}, Level: ${level}`);
    const randomSong = waccaSongs.find((song) => song.id === Number(id));
    try {
      const attachment = new AttachmentBuilder("chartle.png", {
        name: "chartle.png",
      });
      await interaction.editReply({
        content:
          "Guess the song! You have 30 seconds to type the song name in the chat to guess.",
        files: [attachment],
      });
      const answer = (randomSong.titleEnglish || randomSong.title)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ");

      const normalize = (str) =>
        str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, " ");

      // Simple Levenshtein distance implementation
      const levenshtein = (a, b) => {
        const matrix = [];
        const aLen = a.length;
        const bLen = b.length;
        for (let i = 0; i <= aLen; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= bLen; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= aLen; i++) {
          for (let j = 1; j <= bLen; j++) {
            if (a.charAt(i - 1) === b.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + 1
              );
            }
          }
        }
        return matrix[aLen][bLen];
      };

      const filter = (m) => {
        if (m.author.bot) return false;
        const guessInput = normalize(m.content);
        const dist = levenshtein(guessInput, answer);
        const maxLen = Math.max(guessInput.length, answer.length);
        if (maxLen === 0) return false;
        const similarity = 1 - dist / maxLen;
        const wordMatch = guessInput
          .split(/\s+/)
          .some(
            (word) => word.length >= 5 && answer.split(/\s+/).includes(word)
          );
        return similarity >= 0.5 || (wordMatch && similarity >= 0.25);
      };
      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 30000,
      });

      const midTimer = setTimeout(() => {
        interaction.followUp({
          content: `Here's a hint: this chart is a ${randomSong.sheets[level].difficulty}!`,
        });
      }, 15000);

      // Ensure the mid-timer is cleared if someone guesses early or the collector ends
      collector.on("collect", () => clearTimeout(midTimer));
      collector.on("end", () => clearTimeout(midTimer));

      collector.on("collect", async (m) => {
        collector.stop();
        const guessInput = normalize(m.content);
        const dist = levenshtein(guessInput, answer);
        const maxLen = Math.max(guessInput.length, answer.length);
        const similarity = maxLen === 0 ? 1 : 1 - dist / maxLen;
        const accuracy = Math.floor(similarity * 100);
        await interaction.followUp({
          content: `${
            m.author
          } guessed correctly with an accuracy of ${accuracy}%! The correct answer was: ${
            randomSong.titleEnglish || randomSong.title
          }`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("chartle_again")
                .setLabel("Play Again")
                .setStyle(ButtonStyle.Primary)
            ),
          ],
        });
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          await interaction.followUp({
            content: `Time's up! The correct answer was: ${
              randomSong.titleEnglish || randomSong.title
            }`,
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("chartle_again")
                  .setLabel("Play Again")
                  .setStyle(ButtonStyle.Primary)
              ),
            ],
          });
        }
        // Remove the channel from cooldown after the game is over
        guessCooldown.delete(interaction.channel.id);
      });
    } catch (error) {
      console.error("Error loading image:", error);
      await interaction.reply({
        content:
          "There was an error generating the chartle image. Please try again later.",
        ephemeral: true,
      });
      // Ensure we remove the cooldown if an error occurs
      guessCooldown.delete(interaction.channel.id);
    }
  },
};
