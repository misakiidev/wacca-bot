const { Events, MessageFlags } = require("discord.js");
const BannedUsers = new Set(["296311533762248715", "360037421636648960"]);

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      if (BannedUsers.has(interaction.user.id)) {
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return;
      }
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`,
        );
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "There was an error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } else if (
      interaction.isButton() &&
      interaction.customId === "guess_again"
    ) {
      try {
        const guessCommand = interaction.client.commands.get("guess");

        if (!guessCommand) {
          console.error("Guess command not found.");
          await interaction.reply({
            content: "Guess command not found.",
            ephemeral: true,
          });
          return;
        }

        await guessCommand.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: "Error processing the guess_again button.",
          ephemeral: true,
        });
      }
    } else if (
      interaction.isButton() &&
      interaction.customId === "chartle_again"
    ) {
      try {
        const chartleCommand = interaction.client.commands.get("chartle");

        if (!chartleCommand) {
          console.error("Chartle command not found.");
          await interaction.reply({
            content: "Chartle command not found.",
            ephemeral: true,
          });
          return;
        }

        await chartleCommand.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: "Error processing the chartle_again button.",
          ephemeral: true,
        });
      }
    }
  },
};
