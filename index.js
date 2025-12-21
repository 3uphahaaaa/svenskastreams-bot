require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,

  // 📣 Kanaler
  WELCOME_CHANNEL_ID: "1452047332278538373",
  TICKET_PANEL_CHANNEL_ID: "1452057166721581216",
  TICKET_CATEGORY_ID: "1452057139618119821",
  SERVICES_CHANNEL_ID: "1452262876155871232",
  PRICES_CHANNEL_ID: "1452262991847227522",

  // 👮 Staff/Admin
  STAFF_ROLE_ID: "1452057264155267242"
};
/* ========================================== */

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot online som ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return;

  /* ===== AUTO PERMISSIONS (ANTI RAID) ===== */
  const everyone = guild.roles.everyone;
  const staff = guild.roles.cache.get(CONFIG.STAFF_ROLE_ID);

  const ticketCh = guild.channels.cache.get(CONFIG.TICKET_PANEL_CHANNEL_ID);
  const pricesCh = guild.channels.cache.get(CONFIG.PRICES_CHANNEL_ID);
  const servicesCh = guild.channels.cache.get(CONFIG.SERVICES_CHANNEL_ID);

  if (ticketCh) {
    await ticketCh.permissionOverwrites.set([
      {
        id: everyone.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages]
      },
      {
        id: staff.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ]);
  }

  if (pricesCh) {
    await pricesCh.permissionOverwrites.set([
      {
        id: everyone.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ]);
  }

  if (servicesCh) {
    await servicesCh.permissionOverwrites.set([
      {
        id: everyone.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ]);
  }

  console.log("🔒 Kanalbehörigheter satta");

  /* ===== TICKET PANEL ===== */
  const panel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams – Tickets")
        .setDescription(
          "Välj vad ditt ärende gäller.\n\n" +
          "🛒 **Köp** – köp ett konto\n" +
          "🤝 **Samarbete** – partnerskap\n" +
          "❓ **Frågor** – support"
        )
        .setColor("Purple")
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_buy")
          .setLabel("🛒 Köp")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("ticket_partner")
          .setLabel("🤝 Samarbete")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("ticket_question")
          .setLabel("❓ Frågor")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, member => {
  const ch = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
  if (!ch) return;

  ch.send(
    `👋 **Välkommen ${member.user.username}!**\n\n` +
    `🛒 Tjänster → <#${CONFIG.SERVICES_CHANNEL_ID}>\n` +
    `💰 Priser → <#${CONFIG.PRICES_CHANNEL_ID}>\n` +
    `🎟 Köp → <#${CONFIG.TICKET_PANEL_CHANNEL_ID}>\n\n` +
    `Klicka på **Köp** i ticket-kanalen för att handla.`
  );
});

/* ================= TICKETS ================= */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith("ticket_")) return;

  await interaction.deferReply({ ephemeral: true });

  const type =
    interaction.customId === "ticket_buy"
      ? "köp"
      : interaction.customId === "ticket_partner"
      ? "samarbete"
      : "frågor";

  const channel = await interaction.guild.channels.create({
    name: `ticket-${type}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: CONFIG.TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      },
      {
        id: CONFIG.STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ]
  });

  await channel.send(
    `👋 Hej **${interaction.user.username}**!\n\n` +
    `Detta är din **${type}-ticket**.\n` +
    `Skriv vad du behöver hjälp med så svarar staff snart.`
  );

  await interaction.editReply({
    content: `🎟 Ticket skapad: ${channel}`
  });
});

client.login(CONFIG.TOKEN);
