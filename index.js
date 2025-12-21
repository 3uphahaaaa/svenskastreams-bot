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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,

  // 📣 Information
  WELCOME_CHANNEL_ID: "1452047332278538373",

  // 🎟 Tickets
  TICKET_PANEL_CHANNEL_ID: "1452057166721581216",
  TICKET_CATEGORY_ID: "1452057139618119821",

  // 👮 Admin
  ADMIN_ROLE_ID: "1452057264155267242",

  // 🛒 Marknad
  SERVICES_CHANNEL_ID: "1452262876155871232",
  PRICES_CHANNEL_ID: "1452262991847227522",
  VOUCH_CHANNEL_ID: "1452263084646338582",
  SALES_CHANNEL_ID: "1452285768742600755",

  // 💳 Betalning
  SWISH: "0736816921",
  LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
};

/* ================= PRODUKTER ================= */
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

const orders = new Map();

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`Bot online som ${client.user.tag}`);

  // 🎟 Ticket panel
  const panel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);
  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Skapa ticket")
        .setDescription("Klicka på **Köp** för att handla.")
        .setColor("Purple")
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_buy")
          .setLabel("🛒 Köp")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, member => {
  const ch = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
  if (!ch) return;

  ch.send(
    `👋 Välkommen **${member.user.username}**!\n\n` +
    `📦 Se **#tjänster**\n` +
    `💰 Se **#priser**\n` +
    `🎟 Öppna ticket i **#ticket**`
  );
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== OPEN BUY ===== */
  if (interaction.isButton() && interaction.customId === "open_buy") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_product")
      .setPlaceholder("Välj produkt")
      .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ===== SELECT PRODUCT ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
    const product = interaction.values[0];
    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_period")
      .setPlaceholder("Välj period")
      .addOptions(
        Object.entries(PRODUCTS[product]).map(([p, price]) => ({
          label: `${p} – ${price}`,
          value: `${product}|${p}|${price}`
        }))
      );

    return interaction.update({
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ===== CREATE TICKET ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "select_period") {
    const [product, period, price] = interaction.values[0].split("|");

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: CONFIG.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    orders.set(channel.id, { user: interaction.user, product, period, price });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛒 Ny beställning")
          .setDescription(
            `**Produkt:** ${product}\n` +
            `**Period:** ${period}\n` +
            `**Pris:** ${price}\n\n` +
            `Väntar på admin.`
          )
          .setColor("Yellow")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("approve").setLabel("✅ Godkänn").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("deny").setLabel("❌ Neka").setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return interaction.reply({ content: `🎟 Ticket skapad: ${channel}`, ephemeral: true });
  }

  /* ===== APPROVE / DENY ===== */
  if (interaction.isButton() && ["approve", "deny"].includes(interaction.customId)) {
    if (!interaction.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: "Endast admin.", ephemeral: true });
    }

    if (interaction.customId === "deny") {
      await interaction.channel.send("❌ Beställning nekad.");
      return setTimeout(() => interaction.channel.delete(), 5000);
    }

    return interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("💳 Betalning")
          .setDescription(
            `**Swish:** ${CONFIG.SWISH}\n\n` +
            `**LTC:**\n\`${CONFIG.LTC}\``
          )
          .setColor("Green")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("deliver").setLabel("📦 Leverera konto").setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  /* ===== DELIVER ===== */
  if (interaction.isButton() && interaction.customId === "deliver") {
    if (!interaction.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) return;

    const order = orders.get(interaction.channel.id);
    if (!order) return;

    await order.user.send(
      `📦 **Ditt konto är levererat**\n\n` +
      `${order.product}\n${order.period}\n\n` +
      `Kontakta oss om något inte funkar.`
    );

    await interaction.channel.send({
      content: "✅ Konto skickat via DM.\nKund, bekräfta:",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("confirm").setLabel("⭐ Allt funkar").setStyle(ButtonStyle.Success)
        )
      ]
    });
  }

  /* ===== CONFIRM + VOUCH ===== */
  if (interaction.isButton() && interaction.customId === "confirm") {
    const modal = new ModalBuilder()
      .setCustomId("review")
      .setTitle("Lämna omdöme");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("stars")
          .setLabel("Betyg 1–5")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("Kommentar")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "review") {
    const stars = "⭐".repeat(Math.min(5, Math.max(1, Number(interaction.fields.getTextInputValue("stars")))));
    const text = interaction.fields.getTextInputValue("text");

    const vouch = await client.channels.fetch(CONFIG.VOUCH_CHANNEL_ID);
    const sales = await client.channels.fetch(CONFIG.SALES_CHANNEL_ID);

    await vouch.send({ embeds: [new EmbedBuilder().setTitle("⭐ Omdöme").setDescription(`${stars}\n${text}`)] });
    await sales.send(`📦 Ny kund: **${interaction.user.tag}**`);

    await interaction.reply("✅ Tack! Ticket stängs om 10 sek.");
    setTimeout(() => interaction.channel.delete(), 10000);
  }
});

/* ================= LOGIN ================= */
client.login(CONFIG.TOKEN);
