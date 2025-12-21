require("dotenv").config();
const {
  Client, GatewayIntentBits, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType, PermissionsBitField,
  EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle
} = require("discord.js");

/* ================= CONFIG ================= */
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,

  WELCOME_CHANNEL_ID: "1452047332278538373",
  TICKET_PANEL_CHANNEL_ID: "1452057166721581216",
  TICKET_CATEGORY_ID: "1452057139618119821",
  ADMIN_ROLE_ID: "1452057264155267242",

  SERVICES_CHANNEL_ID: "1452262876155871232",
  PRICES_CHANNEL_ID: "1452262991847227522",
  VOUCH_CHANNEL_ID: "1452263084646338582",
  SALES_CHANNEL_ID: "1452285768742600755",

  SWISH: "0736816921",
  LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
};
/* ========================================== */

const PRODUCTS = {
  "Spotify Premium ⭐ MOST POPULAR": {
    "1 Month": "19 kr",
    "3 Months": "39 kr"
  },
  "Netflix 4K UHD ⭐ MOST POPULAR": {
    "6 Months": "39 kr",
    "12 Months": "59 kr"
  },
  "HBO Max Premium": {
    "6 Months": "39 kr",
    "12 Months": "59 kr"
  },
  "Disney+ Premium": {
    "6 Months": "39 kr",
    "12 Months": "59 kr"
  },
  "NordVPN Plus": {
    "12 Months": "49 kr"
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

/* ===== ANTI-SPAM ===== */
const activeTickets = new Map();
const orders = new Map();

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`Bot online som ${client.user.tag}`);

  /* Welcome */
  client.on(Events.GuildMemberAdd, member => {
    const ch = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
    if (!ch) return;
    ch.send(
      `👋 **Välkommen ${member.user.username}!**\n\n` +
      `🛒 Se **#tjänster** & **#priser**\n` +
      `🎟️ Öppna ticket i **#ticket**`
    );
  });

  /* Ticket Panel */
  const panel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Skapa ticket")
        .setDescription("Välj vad ditt ärende gäller")
        .setColor("Purple")
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("partner").setLabel("🤝 Samarbete").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("question").setLabel("❓ Frågor").setStyle(ButtonStyle.Secondary)
      )
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== CREATE TICKET ===== */
  if (interaction.isButton() && ["buy","partner","question"].includes(interaction.customId)) {

    if (activeTickets.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Du har redan en öppen ticket.",
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.customId}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: CONFIG.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    activeTickets.set(interaction.user.id, channel.id);

    if (interaction.customId === "buy") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("product")
        .setPlaceholder("Välj produkt")
        .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

      channel.send({
        embeds: [new EmbedBuilder().setTitle("🛒 Välj produkt")],
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    } else {
      channel.send("✍️ Beskriv ditt ärende.");
    }

    interaction.reply({ content: `🎟 Ticket skapad: ${channel}`, ephemeral: true });
  }

  /* ===== PRODUCT ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "product") {
    const product = interaction.values[0];
    const menu = new StringSelectMenuBuilder()
      .setCustomId("period")
      .setPlaceholder("Välj period")
      .addOptions(
        Object.entries(PRODUCTS[product]).map(([d,p]) => ({
          label: `${d} – ${p}`,
          value: `${product}|${d}|${p}`
        }))
      );

    interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
  }

  /* ===== PERIOD ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "period") {
    const [product, duration, price] = interaction.values[0].split("|");
    orders.set(interaction.channel.id, { product, duration, price, user: interaction.user });

    interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛒 Beställning")
          .setDescription(`**${product}**\n${duration}\n💰 ${price}`)
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("approve").setLabel("✅ Godkänn").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("deny").setLabel("❌ Neka").setStyle(ButtonStyle.Danger)
        )
      ]
    });

    interaction.reply({ content: "⏳ Väntar på admin...", ephemeral: true });
  }

  /* ===== APPROVE ===== */
  if (interaction.isButton() && interaction.customId === "approve") {
    if (!interaction.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) return;

    interaction.update({
      embeds: [new EmbedBuilder().setTitle("💳 Välj betalning")],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("swish").setLabel("Swish").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("ltc").setLabel("LTC").setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /* ===== PAYMENT ===== */
  if (interaction.isButton() && ["swish","ltc"].includes(interaction.customId)) {
    interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Betalning")
          .setDescription(
            interaction.customId === "swish"
              ? `Swish: **${CONFIG.SWISH}**`
              : `LTC:\n\`${CONFIG.LTC}\``
          )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("paid").setLabel("✅ Jag har betalat").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  /* ===== PAID ===== */
  if (interaction.isButton() && interaction.customId === "paid") {
    interaction.channel.send(`<@&${CONFIG.ADMIN_ROLE_ID}> Kunden har betalat.`);
    interaction.reply({ content: "⏳ Väntar på kontroll...", ephemeral: true });
  }

  /* ===== DELIVER ===== */
  if (interaction.isButton() && interaction.customId === "deliver") {
    const modal = new ModalBuilder().setCustomId("deliver").setTitle("Skicka konto");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("email").setLabel("E-post").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short)
      )
    );
    interaction.showModal(modal);
  }

  /* ===== CLOSE & CLEAN ===== */
  if (interaction.isModalSubmit() && interaction.customId === "deliver") {
    const order = orders.get(interaction.channel.id);
    await order.user.send(
      `📦 **Ditt konto**\n📧 ${interaction.fields.getTextInputValue("email")}\n🔑 ${interaction.fields.getTextInputValue("password")}`
    );

    interaction.channel.send("✅ Konto skickat. Lämna omdöme.");
    activeTickets.delete(order.user.id);
  }
});

client.login(CONFIG.TOKEN);
