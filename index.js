require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,

  WELCOME_CHANNEL_ID: "1452047332278538373",
  TICKET_PANEL_CHANNEL_ID: "1452057166721581216",
  TICKET_CATEGORY_ID: "1452057139618119821",

  STAFF_ROLE_ID: "1452057264155267242",
  MEMBER_ROLE_ID: "1452050878839394355",
  CUSTOMER_ROLE_ID: "1452263553234108548",

  SERVICES_CHANNEL_ID: "1452262876155871232",
  PRICES_CHANNEL_ID: "1452262991847227522",
  VOUCH_CHANNEL_ID: "1452263084646338582",
  SALES_CHANNEL_ID: "1452285768742600755",

  SWISH: "0736816921",
  LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
};

/* ================= PRODUKTER ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": {
    "1 Månad": "19 kr",
    "3 Månader": "39 kr",
    "6 Månader": "59 kr",
    "12 Månader": "89 kr"
  },
  "🎬 Netflix 4K UHD Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "📺 HBO Max Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "🍿 Disney+ Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "🔐 NordVPN Plus": {
    "12 Månader": "49 kr"
  },
  "🛡️ Malwarebytes Premium": {
    "12 Månader": "69 kr"
  }
};

/* ================= STATE ================= */
const tickets = new Map();

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot online som ${client.user.tag}`);

  const panel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams – Tickets")
        .setDescription(
          "🛒 Köp konto\n🤝 Samarbete\n❓ Frågor\n\nKlicka nedan:"
        )
        .setColor("#8e44ad")
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Samarbete").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_question").setLabel("❓ Frågor").setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  const role = member.guild.roles.cache.get(CONFIG.MEMBER_ROLE_ID);
  if (role) await member.roles.add(role);

  const ch = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
  if (!ch) return;

  ch.send(`👋 Välkommen **${member.user.username}**!\n🎟 <#${CONFIG.TICKET_PANEL_CHANNEL_ID}>`);
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  /* ===== CREATE TICKET ===== */
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
    await interaction.deferReply({ ephemeral: true });

    const type =
      interaction.customId === "ticket_buy" ? "köp" :
      interaction.customId === "ticket_partner" ? "samarbete" : "frågor";

    const channel = await interaction.guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    tickets.set(channel.id, { userId: interaction.user.id, type });

    if (type === "köp") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder("Välj produkt")
        .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

      await channel.send({
        embeds: [new EmbedBuilder().setTitle("🛒 Välj produkt").setColor("Blue")],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    } else {
      await channel.send({
        content: "Skriv ditt ärende nedan 👇",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Stäng ticket").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    return interaction.editReply({ content: `🎟 Ticket skapad: ${channel}` });
  }

  /* ===== STÄNG TICKET ===== */
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    return interaction.reply({
      content: "❓ Är ärendet löst?",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("resolved_yes").setLabel("✅ Ja").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("resolved_no").setLabel("❌ Nej").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  if (interaction.isButton() && interaction.customId === "resolved_no") {
    return interaction.reply({ content: "👍 Okej, ticketen fortsätter.", ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === "resolved_yes") {
    await interaction.reply("🔒 Ticket stängs om 5 sek...");
    setTimeout(() => interaction.channel.delete(), 5000);
  }
});

/* ================= LOGIN ================= */
client.login(CONFIG.TOKEN);
