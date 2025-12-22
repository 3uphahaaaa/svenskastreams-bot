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
  EmbedBuilder
} = require("discord.js");

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: { NAME: "Svenska Streams", COLOR: "#7b3fe4" },
  CHANNELS: {
    WELCOME: "1452047332278538373",
    PANEL: "1452057166721581216",
    BUY_CATEGORY: "1452706749340586025",
    PARTNER_CATEGORY: "1452706558226989089",
    ANNOUNCEMENTS: "1452389624801525992",
    VOUCH: "1452263084646338582",
    SWISH_LOGS: "1452671397871489175",
    PARTNER_LOGS: "1452624943543226501"
  },
  ROLES: {
    SELLER: "1452263273528299673",
    PARTNER_MANAGER: "1452672352344342528",
    MEMBER: "1452050878839394355"
  },
  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
  }
};

/* ================= PRODUCTS ================= */
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
  }
};

/* ================= STATE ================= */
const tickets = new Map();
const orderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 50 });
  for (const m of msgs.values()) {
    if (m.author.id === client.user.id) await m.delete().catch(() => {});
  }

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎟 Svenska Streams – Tickets")
        .setDescription("🛒 Köp\n🤝 Samarbete")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Samarbete").setStyle(ButtonStyle.Secondary)
      )
    ]
  });

  console.log("✅ Bot online");
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
  if (role) await member.roles.add(role);

  const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (!ch) return;

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setColor(CONFIG.BRAND.COLOR)
        .setTitle("👋 Välkommen till Svenska Streams!")
        .setDescription("🛒 Köp & 🤝 Samarbete via ticket-panelen")
        .setThumbnail(member.user.displayAvatarURL())
    ]
  });
});

/* ================= SCREENSHOT LOGGER (FIXAD) ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!tickets.has(msg.channel.id)) return;
  if (!msg.attachments.size) return;

  const ticket = tickets.get(msg.channel.id);
  if (!ticket.awaitingScreenshot) return; // 🔒 KRITISK FIX

  const attachment = msg.attachments.first();
  const logChannelId =
    ticket.type === "partner"
      ? CONFIG.CHANNELS.PARTNER_LOGS
      : CONFIG.CHANNELS.SWISH_LOGS;

  const logChannel = await msg.guild.channels.fetch(logChannelId);

  const embed = new EmbedBuilder()
    .setTitle("📸 Screenshot mottagen")
    .setImage(attachment.url)
    .setColor(CONFIG.BRAND.COLOR)
    .addFields(
      { name: "Användare", value: `<@${msg.author.id}>` },
      { name: "Produkt", value: ticket.product || "Partner" },
      { name: "Pris", value: ticket.price || "-" },
      { name: "Order-ID", value: ticket.orderId || "-" }
    );

  await logChannel.send({ embeds: [embed] });

  ticket.awaitingScreenshot = false;

  await msg.channel.send({
    content: "🔍 Screenshot mottagen – väntar på godkännande",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("approve_payment")
          .setLabel("✅ Godkänn screenshot")
          .setStyle(ButtonStyle.Success)
      )
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    /* CREATE TICKET */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.customId.split("_")[1];

      const category =
        type === "buy"
          ? CONFIG.CHANNELS.BUY_CATEGORY
          : CONFIG.CHANNELS.PARTNER_CATEGORY;

      const ch = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      tickets.set(ch.id, { userId: interaction.user.id, type });

      if (type === "buy") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("select_product")
          .setPlaceholder("Välj konto")
          .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

        await ch.send({
          embeds: [new EmbedBuilder().setTitle("🛒 Köp konto").setColor(CONFIG.BRAND.COLOR)],
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      return interaction.editReply(`🎟 Ticket skapad: ${ch}`);
    }

    /* PRODUCT */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      const t = tickets.get(interaction.channel.id);
      t.product = interaction.values[0];

      return interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("select_duration")
              .setPlaceholder("Välj period")
              .addOptions(
                Object.entries(PRODUCTS[t.product]).map(([d, p]) => ({
                  label: `${d} – ${p}`,
                  value: `${d}|${p}`
                }))
              )
          )
        ]
      });
    }

    /* DURATION */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
      const t = tickets.get(interaction.channel.id);
      [t.duration, t.price] = interaction.values[0].split("|");
      t.orderId = orderId();

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("📱 Swish-betalning")
            .setDescription(
              `📞 **Nummer:** ${CONFIG.PAYMENTS.SWISH}\n` +
              `💰 **Summa:** ${t.price}\n\n` +
              `➡️ Betala först\n➡️ Skicka screenshot EFTER`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pay_swish").setLabel("Swish").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("pay_ltc").setLabel("LTC").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    /* PAY */
    if (interaction.isButton() && ["pay_swish", "pay_ltc"].includes(interaction.customId)) {
      const t = tickets.get(interaction.channel.id);
      t.awaitingScreenshot = true;
      return interaction.deferUpdate();
    }

  } catch (e) {
    console.error(e);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
