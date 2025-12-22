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
    GatewayIntentBits.MessageContent
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: { NAME: "Svenska Streams", COLOR: "#7b3fe4" },
  CHANNELS: {
    PANEL: "1452057166721581216",
    WELCOME: "1452047332278538373",
    BUY_CATEGORY: "1452706749340586025",
    PARTNER_CATEGORY: "1452706558226989089",
    ANNOUNCEMENTS: "1452389624801525992",
    SWISH_LOGS: "1452671397871489175",
    PARTNER_LOGS: "1452624943543226501",
    VOUCH: "1452263084646338582"
  },
  ROLES: {
    SELLER: "1452263273528299673",
    PARTNER_MANAGER: "1452672352344342528",
    CUSTOMER: "1452263553234108548"
  },
  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
  }
};

/* ================= PRODUCTS ================= */
const PRODUCTS = {
  "🎵 Spotify Premium": { "1 Månad": "19 kr", "3 Månader": "39 kr", "6 Månader": "59 kr", "12 Månader": "89 kr" },
  "🎬 Netflix 4K UHD Premium": { "6 Månader": "39 kr", "12 Månader": "59 kr" },
  "📺 HBO Max Premium": { "6 Månader": "39 kr", "12 Månader": "59 kr" },
  "🍿 Disney+ Premium": { "6 Månader": "39 kr", "12 Månader": "59 kr" },
  "🔐 NordVPN Plus": { "12 Månader": "49 kr" },
  "🛡 Malwarebytes Premium": { "12 Månader": "69 kr" }
};

const tickets = new Map();
const orderId = () => `SS-${Math.floor(100000 + Math.random() * 900000)}`;

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 5 });
  msgs.forEach(m => m.author.id === client.user.id && m.delete().catch(() => {}));

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎟 ${CONFIG.BRAND.NAME}`)
        .setDescription("🛒 **Köp konto**\n🤝 **Samarbete / Partner**")
        .setColor(CONFIG.BRAND.COLOR)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_buy").setLabel("🛒 Köp").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_partner").setLabel("🤝 Partner").setStyle(ButtonStyle.Secondary)
      )
    ]
  });

  console.log("✅ Bot redo");
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (!ch) return;

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setColor(CONFIG.BRAND.COLOR)
        .setTitle("👋 Välkommen till Svenska Streams!")
        .setDescription(
          `Hej **${member.user.username}**!\n\n` +
          `🛒 Köp konton via tickets\n` +
          `🤝 Samarbete & partners\n\n` +
          `🎟 Skapa ticket i <#${CONFIG.CHANNELS.PANEL}>`
        )
        .setThumbnail(member.user.displayAvatarURL())
    ]
  });
});

/* ================= SCREENSHOT LOGGER ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!tickets.has(msg.channel.id)) return;
  if (!msg.attachments.size) return;

  const t = tickets.get(msg.channel.id);
  const img = msg.attachments.first();

  const logChannel = await msg.guild.channels.fetch(
    t.type === "partner" ? CONFIG.CHANNELS.PARTNER_LOGS : CONFIG.CHANNELS.SWISH_LOGS
  );

  await logChannel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📸 Screenshot mottagen")
        .setImage(img.url)
        .addFields(
          { name: "Kund", value: `<@${msg.author.id}>` },
          { name: "Produkt", value: t.product || "Partner" },
          { name: "Pris", value: t.price || "-" },
          { name: "Order", value: t.orderId || "-" }
        )
        .setColor(CONFIG.BRAND.COLOR)
    ]
  });

  await msg.channel.send({
    embeds: [
      new EmbedBuilder()
        .setDescription("🔍 Screenshot mottagen\nVäntar på godkännande av personal.")
        .setColor(CONFIG.BRAND.COLOR)
    ],
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

    /* CREATE TICKET */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.customId.split("_")[1];

      const ch = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: type === "buy" ? CONFIG.CHANNELS.BUY_CATEGORY : CONFIG.CHANNELS.PARTNER_CATEGORY,
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
            .setTitle("💳 Välj betalmetod")
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

    /* PAYMENT */
    if (interaction.isButton() && interaction.customId === "pay_swish") {
      const t = tickets.get(interaction.channel.id);
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("📱 Swish-betalning")
            .setDescription(
              `Nummer: **${CONFIG.PAYMENTS.SWISH}**\n` +
              `Summa: **${t.price}**\n\n` +
              `➡️ Betala först\n➡️ Skicka screenshot efter`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    /* APPROVE PAYMENT */
    if (interaction.isButton() && interaction.customId === "approve_payment") {
      const modal = new ModalBuilder()
        .setCustomId("delivery_modal")
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

    /* DELIVERY */
    if (interaction.isModalSubmit() && interaction.customId === "delivery_modal") {
      const t = tickets.get(interaction.channel.id);
      const user = await interaction.guild.members.fetch(t.userId);

      await user.send(
        `📦 **Ditt konto**\n\n${t.product}\n${t.duration}\nPris: ${t.price}\n\n📧 ${interaction.fields.getTextInputValue("email")}\n🔑 ${interaction.fields.getTextInputValue("password")}`
      );

      await interaction.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_working").setLabel("✅ Kontot funkar").setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.reply({ content: "📦 Konto levererat.", ephemeral: true });
    }

    /* CONFIRM WORKING */
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder()
        .setCustomId("review_modal")
        .setTitle("⭐ Lämna omdöme");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("review").setLabel("Ditt omdöme").setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    /* REVIEW */
    if (interaction.isModalSubmit() && interaction.customId === "review_modal") {
      const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
      await vouch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⭐ Ny review")
            .setDescription(interaction.fields.getTextInputValue("review"))
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });

      setTimeout(() => interaction.channel.delete(), 5000);
      return interaction.reply({ content: "🙏 Tack för ditt omdöme!", ephemeral: true });
    }

  } catch (e) {
    console.error(e);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
