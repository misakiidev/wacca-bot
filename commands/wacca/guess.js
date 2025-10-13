const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { waccaSongs } = require("../../waccaSongs.js");
const { AttachmentBuilder } = require("discord.js");
const { loadImage, createCanvas } = require("canvas");

// Map to track active guessing games per channel
const guessCooldown = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guess")
    .setDescription("Guess the song based off of a cutout of the jacket"),

  async execute(interaction) {
    // Prevent starting a new game if there's already one active in the channel
    if (guessCooldown.has(interaction.channel.id)) {
      await interaction.reply({
        content:
          "A guessing game is already active in this channel. Please wait until it finishes before starting a new one.",
        ephemeral: true,
      });
      return;
    }
    // Set cooldown active for this channel
    guessCooldown.set(interaction.channel.id, true);

    const randomSong =
      waccaSongs[Math.floor(Math.random() * waccaSongs.length)];
    const imageUrl = `https://webui.wacca.plus/wacca/img/covers/${randomSong.imageName}`;
    try {
      const imageData = await loadImage(imageUrl);
      const { width, height } = imageData;
      const randomX = Math.floor(Math.random() * (width - 80));
      const randomY = Math.floor(Math.random() * (height - 80));
      const canvas = createCanvas(80, 80);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imageData, randomX, randomY, 80, 80, 0, 0, 80, 80);
      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, { name: "guess.png" });
      await interaction.reply({
        content:
          "Guess the song! You have 15 seconds to type the song name in the chat to guess.",
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
        time: 15000,
      });

      collector.on("collect", async (m) => {
        collector.stop();
        const guessInput = normalize(m.content);
        const dist = levenshtein(guessInput, answer);
        const maxLen = Math.max(guessInput.length, answer.length);
        const similarity = maxLen === 0 ? 1 : 1 - dist / maxLen;
        const accuracy = Math.floor(similarity * 100);
        const originalAttachment = new AttachmentBuilder(imageUrl, {
          name: randomSong.imageName,
        });
        await interaction.followUp({
          content: `${
            m.author
          } guessed correctly with an accuracy of ${accuracy}%! The correct answer was: ${
            randomSong.titleEnglish || randomSong.title
          }`,
          files: [originalAttachment],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("guess_again")
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
            files: [
              new AttachmentBuilder(imageUrl, { name: randomSong.imageName }),
            ],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("guess_again")
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
          "There was an error generating the guess image. Please try again later.",
        ephemeral: true,
      });
      // Ensure we remove the cooldown if an error occurs
      guessCooldown.delete(interaction.channel.id);
    }
  },
};
