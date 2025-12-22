require("dotenv").config();
const fs = require("fs");
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: {
    NAME: "Svenska Streams",
    COLOR: "#7b3fe4",
    INVITE: "https://discord.gg/hNRyB2Mewv"
  },
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
    OWNER: "1452263448921509958",
    ADMIN: "1452057264155267242",
    SELLER: "1452263273528299673",
    PARTNER_MANAGER: "1452672352344342528",
    MEMBER: "1452050878839394355",
    CUSTOMER: "1452263553234108548"
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
  },
  "🍿 Disney+ Premium": {
    "6 Månader": "39 kr",
    "12 Månader": "59 kr"
  },
  "🔐 NordVPN Plus": {
    "12 Månader": "49 kr"
  },
  "🛡 Malwarebytes Premium": {
    "12 Månader": "69 kr"
  }
};

/* ================= STATE ================= */
const tickets = new Map();

/* ================= HELPERS ================= */
const orderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;
const hasAnyRole = (member, roles) =>
  member.roles.cache.some(r => roles.includes(r.id));

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
        .setTitle(`🎟 ${CONFIG.BRAND.NAME} – Tickets`)
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
        .setAuthor({ name: `Välkommen till ${CONFIG.BRAND.NAME}!` })
        .setDescription(
          `👋 **Välkommen ${member.user.username}!**\n\n` +
          `🛒 **Köp:** <#${CONFIG.CHANNELS.PANEL}>\n` +
          `🤝 **Samarbete:** <#${CONFIG.CHANNELS.PANEL}>`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
    ]
  });
});

/* ================= SCREENSHOT LOGGER ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!tickets.has(msg.channel.id)) return;
  if (!msg.attachments.size) return;

  const t = tickets.get(msg.channel.id);
  if (t.step !== "awaiting_screenshot") return;

  const attachment = msg.attachments.first();
  const logChannelId =
    t.type === "partner"
      ? CONFIG.CHANNELS.PARTNER_LOGS
      : CONFIG.CHANNELS.SWISH_LOGS;

  const logChannel = await msg.guild.channels.fetch(logChannelId);

  const embed = new EmbedBuilder()
    .setTitle("📸 Screenshot mottagen")
    .setImage(attachment.url)
    .setColor(CONFIG.BRAND.COLOR)
    .addFields(
      { name: "Användare", value: `<@${msg.author.id}>`, inline: true },
      { name: "Typ", value: t.type === "partner" ? "Partner" : "Betalning", inline: true }
    )
    .setTimestamp();

  if (t.type === "buy") {
    embed.addFields(
      { name: "Produkt", value: t.product },
      { name: "Pris", value: t.price },
      { name: "Order-ID", value: t.orderId }
    );
  }

  await logChannel.send({ embeds: [embed] });

  t.step = "awaiting_approval";

  await msg.channel.send({
    content: "🔍 Screenshot mottagen – väntar på manuell godkännande",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(t.type === "partner" ? "approve_partner" : "approve_payment")
          .setLabel("✅ Godkänn")
          .setStyle(ButtonStyle.Success)
      )
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {

    /* ===== CREATE TICKET ===== */
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
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: type === "buy" ? CONFIG.ROLES.SELLER : CONFIG.ROLES.PARTNER_MANAGER,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      tickets.set(ch.id, {
        userId: interaction.user.id,
        type,
        step: type === "buy" ? "select_product" : "partner_form"
      });

      await ch.send(
        type === "buy"
          ? `<@&${CONFIG.ROLES.SELLER}> ny köpticket skapad.`
          : `<@&${CONFIG.ROLES.PARTNER_MANAGER}> ny partner-ticket skapad.`
      );

      if (type === "buy") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("select_product")
          .setPlaceholder("🛒 Välj konto")
          .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

        await ch.send({
          embeds: [new EmbedBuilder().setTitle("🛒 Köp konto").setColor(CONFIG.BRAND.COLOR)],
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      if (type === "partner") {
        await ch.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🤝 Samarbetsförfrågan")
              .setDescription("Skicka invite + annons via formuläret.\nScreenshot krävs.")
              .setColor(CONFIG.BRAND.COLOR)
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("open_partner_form")
                .setLabel("📨 Skicka samarbetsförfrågan")
                .setStyle(ButtonStyle.Primary)
            )
          ]
        });
      }

      return interaction.editReply(`🎟 Ticket skapad: ${ch}`);
    }

    /* ===== PRODUCT ===== */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      const t = tickets.get(interaction.channel.id);
      if (!t || t.step !== "select_product") return;

      t.product = interaction.values[0];
      t.step = "select_duration";

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

    /* ===== DURATION ===== */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
      const t = tickets.get(interaction.channel.id);
      if (!t || t.step !== "select_duration") return;

      [t.duration, t.price] = interaction.values[0].split("|");
      t.orderId = orderId();
      t.step = "select_payment_method";

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Välj betalningsmetod")
            .setDescription(`${t.product}\n${t.duration} – ${t.price}`)
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

    /* ===== PAYMENT METHOD ===== */
    if (interaction.isButton() && interaction.customId === "pay_swish") {
      const t = tickets.get(interaction.channel.id);
      if (!t || t.step !== "select_payment_method") return;

      t.step = "awaiting_screenshot";

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("📱 Swish-betalning")
            .setDescription(
              `Nummer: **${CONFIG.PAYMENTS.SWISH}**\n` +
              `Summa: **${t.price}**\n\n➡️ Betala först\n➡️ Skicka screenshot EFTER`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "pay_ltc") {
      const t = tickets.get(interaction.channel.id);
      if (!t || t.step !== "select_payment_method") return;

      t.step = "awaiting_screenshot";

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 LTC-betalning")
            .setDescription(
              `Adress:\n${CONFIG.PAYMENTS.LTC}\n\nSumma: ${t.price}\n\nSkicka screenshot`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

  } catch (err) {
    console.error(err);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
