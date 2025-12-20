
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("3upswish").setDescription("Visar Swish"),
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Skapar ticketpanel")
].map(cmd => cmd.toJSON());

const TOKEN = process.env.DISCORD_TOKEN;

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands("1452052271188934726"),
      { body: commands }
    );
    console.log("Commands deployed");
  } catch (err) {
    console.error(err);
  }
})();
