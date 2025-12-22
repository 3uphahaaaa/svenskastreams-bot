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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
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
    ANNOUNCEMENTS: "1452389624801525992",
    VOUCH: "1452263084646338582",
    SWISH_LOGS: "1452671397871489175",
    PARTNER_LOGS: "1452624943543226501"
  },
  CATEGORIES: {
    BUY: "1452706749340586025",
    PARTNER: "1452706558226989089"
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

/* ================= PRODUCTS (ORÖRDA) ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": {
    "1 Månad": "19",
    "3 Månader": "39",
    "6 Månader": "59",
    "12 Månader": "89"
  },
  "🎬 Netflix 4K UHD Premium": {
    "6 Månader": "39",
    "12 Månader": "59"
  },
  "📺 HBO Max Premium": {
    "6 Månader": "39",
    "12 Månader": "59"
  },
  "🍿 Disney+ Premium": {
    "6 Månader": "39",
    "12 Månader": "59"
  },
  "🔐 NordVPN Plus": {
    "12 Månader": "49"
  },
  "🛡 Malwarebytes Premium": {
    "12 Månader": "69"
  }
};

/* ================= STATE ================= */
const tickets = new Map();
const orderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;

const hasRole = (member, roles) =>
  member.roles.cache.some(r => roles.includes(r.id));

const SALE_APPROVERS = [
  CONFIG.ROLES.OWNER,
  CONFIG.ROLES.ADMIN,
  CONFIG.ROLES.SELLER
];

const PARTNER_APPROVERS = [
  CONFIG.ROLES.OWNER,
  CONFIG.ROLES.ADMIN,
  CONFIG.ROLES.PARTNER_MANAGER
];

/* ================= READY – PANEL ================= */
client.once(Events.ClientReady, async () => {
  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 20 });
  msgs.filter(m => m.author.id === client.user.id).forEach(m => m.delete().catch(() => {}));

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
        .setTitle(`👋 Välkommen till ${CONFIG.BRAND.NAME}!`)
        .setDescription(
          `🛒 **Tjänster & köp:** <#${CONFIG.CHANNELS.PANEL}>\n🤝 **Samarbete:** via ticket-panelen`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
    ]
  });
});

/* ================= SCREENSHOT HANDLER ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  const t = tickets.get(msg.channel.id);
  if (!t || !t.awaitingScreenshot || !msg.attachments.size) return;

  const image = msg.attachments.first();
  if (!image.contentType?.startsWith("image/")) return;

  const logChannel = await msg.guild.channels.fetch(
    t.type === "partner"
      ? CONFIG.CHANNELS.PARTNER_LOGS
      : CONFIG.CHANNELS.SWISH_LOGS
  );

  await logChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📸 Screenshot mottagen")
        .setImage(image.url)
        .setColor(CONFIG.BRAND.COLOR)
        .addFields(
          { name: "User", value: `<@${msg.author.id}>`, inline: true },
          { name: "Typ", value: t.type, inline: true },
          t.type === "buy"
            ? { name: "Order", value: `${t.product} – ${t.price} kr`, inline: false }
            : { name: "Partner-annons", value: t.ad || "Ej ifylld", inline: false }
        )
    ]
  });

  await msg.channel.send({
    content: "📸 Screenshot mottagen – väntar på godkännande",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(t.type === "partner" ? "approve_partner" : "approve_payment")
          .setLabel("✅ Godkänn")
          .setStyle(ButtonStyle.Success)
      )
    ]
  });

  t.awaitingScreenshot = false;
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {

    /* ===== CREATE TICKET ===== */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.customId.split("_")[1];

      const channel = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: type === "buy" ? CONFIG.CATEGORIES.BUY : CONFIG.CATEGORIES.PARTNER,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      tickets.set(channel.id, { userId: interaction.user.id, type });

      await channel.send(
        type === "buy"
          ? `<@&${CONFIG.ROLES.SELLER}> ny köpticket skapad.`
          : `<@&${CONFIG.ROLES.PARTNER_MANAGER}> ny partner-ticket skapad.`
      );

      if (type === "buy") {
        await channel.send({
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("select_product")
                .setPlaceholder("🛒 Välj konto")
                .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })))
            )
          ]
        });
      } else {
        await channel.send({
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

      return interaction.editReply(`🎟 Ticket skapad: ${channel}`);
    }

    /* ===== PRODUCT ===== */
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
                  label: `${d} – ${p} kr`,
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
      [t.duration, t.price] = interaction.values[0].split("|");
      t.orderId = orderId();

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Betalning")
            .setDescription(
              `🆔 Order: ${t.orderId}\n${t.product}\n${t.duration} – ${t.price} kr`
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

    /* ===== PAYMENT INFO ===== */
    if (interaction.isButton() && ["pay_swish", "pay_ltc"].includes(interaction.customId)) {
      const t = tickets.get(interaction.channel.id);
      t.awaitingScreenshot = true;

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(interaction.customId === "pay_swish" ? "📱 Swish-betalning" : "💎 Litecoin-betalning")
            .setDescription(
              interaction.customId === "pay_swish"
                ? `Nummer: ${CONFIG.PAYMENTS.SWISH}\nSumma: ${t.price} kr\n\n➡️ Betala först\n➡️ Skicka screenshot EFTER betalning`
                : `Adress: ${CONFIG.PAYMENTS.LTC}\nSumma: ${t.price} kr\n\n➡️ Betala först\n➡️ Skicka screenshot EFTER betalning`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    /* ===== APPROVE PAYMENT ===== */
    if (interaction.isButton() && interaction.customId === "approve_payment") {
      if (!hasRole(interaction.member, SALE_APPROVERS))
        return interaction.reply({ content: "❌ Ingen behörighet", ephemeral: true });

      await interaction.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("deliver_account")
              .setLabel("📦 Leverera konto")
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });

      return interaction.reply("✅ Betalning godkänd");
    }

    /* ===== DELIVERY ===== */
    if (interaction.isButton() && interaction.customId === "deliver_account") {
      const modal = new ModalBuilder()
        .setCustomId("deliver_modal")
        .setTitle("📦 Leverera konto");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "deliver_modal") {
      const t = tickets.get(interaction.channel.id);
      const user = await client.users.fetch(t.userId);

      await user.send(
`📦 Ditt konto
${t.product}
${t.duration} – ${t.price} kr

📧 ${interaction.fields.getTextInputValue("email")}
🔑 ${interaction.fields.getTextInputValue("password")}`
      );

      await interaction.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_working")
              .setLabel("✅ Kontot funkar")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    /* ===== CONFIRM + REVIEW ===== */
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder()
        .setCustomId("review_modal")
        .setTitle("⭐ Omdöme");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("text").setLabel("Kommentar").setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "review_modal") {
      const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
      await vouch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⭐ Ny Review")
            .setDescription(interaction.fields.getTextInputValue("text"))
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(CONFIG.ROLES.CUSTOMER);

      await interaction.reply("🙏 Tack för ditt omdöme!");
      setTimeout(() => interaction.channel.delete(), 5000);
    }

    /* ===== PARTNER FORM ===== */
    if (interaction.isButton() && interaction.customId === "open_partner_form") {
      const modal = new ModalBuilder()
        .setCustomId("partner_form")
        .setTitle("🤝 Samarbetsförfrågan");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("invite").setLabel("Invite").setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("ad").setLabel("Annons").setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "partner_form") {
      const t = tickets.get(interaction.channel.id);
      t.invite = interaction.fields.getTextInputValue("invite");
      t.ad = interaction.fields.getTextInputValue("ad");
      t.awaitingScreenshot = true;

      return interaction.reply("📨 Förfrågan mottagen. Skicka nu screenshot.");
    }

    if (interaction.isButton() && interaction.customId === "approve_partner") {
      if (!hasRole(interaction.member, PARTNER_APPROVERS))
        return interaction.reply({ content: "❌ Ingen behörighet", ephemeral: true });

      const t = tickets.get(interaction.channel.id);
      const ann = await interaction.guild.channels.fetch(CONFIG.CHANNELS.ANNOUNCEMENTS);

      await ann.send(`${t.ad}\n\n👉 ${t.invite}`);

      await interaction.reply("✅ Partner godkänd & annons postad");
      setTimeout(() => interaction.channel.delete(), 5000);
    }

  } catch (err) {
    console.error(err);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
