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
    CATEGORY: "1452057139618119821",
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

/* ================= SALES ================= */
const SALES_FILE = "./sales.json";
const SALES_GOAL = 2000;
const OWNER_ID = "1010449707866267668";

let totalSales = 0;
if (fs.existsSync(SALES_FILE)) {
  try {
    totalSales = JSON.parse(fs.readFileSync(SALES_FILE)).total || 0;
  } catch {
    totalSales = 0;
  }
}

const saveSales = () =>
  fs.writeFileSync(SALES_FILE, JSON.stringify({ total: totalSales }, null, 2));

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

const progressBar = (c, g, s = 18) => {
  const f = Math.min(s, Math.round((c / g) * s));
  return "█".repeat(f) + "░".repeat(s - f);
};

const hasAnyRole = (member, roles) =>
  member.roles.cache.some(r => roles.includes(r.id));

const CAN_APPROVE_SALE = [
  CONFIG.ROLES.OWNER,
  CONFIG.ROLES.ADMIN,
  CONFIG.ROLES.SELLER
];

const CAN_APPROVE_PARTNER = [
  CONFIG.ROLES.OWNER,
  CONFIG.ROLES.ADMIN,
  CONFIG.ROLES.PARTNER_MANAGER
];

/* ================= READY – PANEL ================= */
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

  console.log(`✅ ${CONFIG.BRAND.NAME} online`);
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
          `👋 **Välkommen ${member.user.username}!**\n\n🎟 Skapa en ticket för köp eller samarbete`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
    ]
  });
});

/* ================= SCREENSHOT LOGGER ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot || !tickets.has(msg.channel.id) || !msg.attachments.size) return;

  const t = tickets.get(msg.channel.id);
  const image = msg.attachments.find(a => a.contentType?.startsWith("image/"));
  if (!image) return;

  const logChannel = await msg.guild.channels.fetch(
    t.type === "partner" ? CONFIG.CHANNELS.PARTNER_LOGS : CONFIG.CHANNELS.SWISH_LOGS
  );

  const embed = new EmbedBuilder()
    .setTitle("📸 Screenshot mottagen")
    .setImage(image.url)
    .setColor(CONFIG.BRAND.COLOR)
    .addFields(
      { name: "Användare", value: `<@${msg.author.id}>`, inline: true },
      { name: "Order-ID", value: t.orderId ?? "Partner", inline: true }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });

  await msg.channel.send({
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(t.type === "partner" ? "approve_partner" : "approve_payment")
          .setLabel("✅ Godkänn screenshot")
          .setStyle(ButtonStyle.Success)
      )
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    /* ---------- CREATE TICKET ---------- */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.customId.split("_")[1];

      const ch = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CHANNELS.CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: type === "buy" ? CONFIG.ROLES.SELLER : CONFIG.ROLES.PARTNER_MANAGER,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      tickets.set(ch.id, { userId: interaction.user.id, type });

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

      return interaction.editReply({ content: `🎟 Ticket skapad: ${ch}` });
    }

    /* ---------- PRODUCT SELECT ---------- */
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

    /* ---------- DURATION ---------- */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
      const t = tickets.get(interaction.channel.id);
      [t.duration, t.price] = interaction.values[0].split("|");
      t.orderId = orderId();

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Betalning")
            .setDescription(`🆔 ${t.orderId}\n${t.product}\n${t.duration} – ${t.price}`)
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

    /* ---------- PAYMENTS ---------- */
    if (interaction.isButton() && interaction.customId === "pay_swish") {
      const t = tickets.get(interaction.channel.id);
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Swish")
            .setDescription(`📱 ${CONFIG.PAYMENTS.SWISH}\n💰 ${t.price}\n📸 Skicka screenshot`)
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "pay_ltc") {
      const t = tickets.get(interaction.channel.id);
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 LTC")
            .setDescription(`🔐 ${CONFIG.PAYMENTS.LTC}\n💰 ${t.price}\n📸 Skicka screenshot`)
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    /* ---------- APPROVE PAYMENT ---------- */
    if (interaction.isButton() && interaction.customId === "approve_payment") {
      if (!hasAnyRole(interaction.member, CAN_APPROVE_SALE))
        return interaction.reply({ content: "❌ Ingen behörighet.", ephemeral: true });

      const t = tickets.get(interaction.channel.id);
      totalSales += parseInt(t.price);
      saveSales();

      const owner = await client.users.fetch(OWNER_ID);
      await owner.send(
        `💰 Ny sale\n${progressBar(totalSales, SALES_GOAL)}\n${totalSales}/${SALES_GOAL} kr`
      );

      return interaction.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("deliver_account").setLabel("📦 Leverera konto").setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    /* ---------- DELIVERY ---------- */
    if (interaction.isButton() && interaction.customId === "deliver_account") {
      const modal = new ModalBuilder().setCustomId("deliver").setTitle("📦 Leverera konto");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short))
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "deliver") {
      const t = tickets.get(interaction.channel.id);
      const user = await client.users.fetch(t.userId);

      await user.send(
`📦 Ditt konto
${t.product}
${t.duration}
Pris: ${t.price}

📧 ${interaction.fields.getTextInputValue("email")}
🔑 ${interaction.fields.getTextInputValue("password")}`
      );

      return interaction.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_working").setLabel("✅ Kontot funkar").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    /* ---------- CONFIRM WORKING ---------- */
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder().setCustomId("review").setTitle("⭐ Omdöme");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("text").setLabel("Kommentar").setStyle(TextInputStyle.Paragraph))
      );
      return interaction.showModal(modal);
    }

    /* ---------- REVIEW ---------- */
    if (interaction.isModalSubmit() && interaction.customId === "review") {
      const t = tickets.get(interaction.channel.id);
      const stars = "⭐".repeat(Math.min(5, Math.max(1, parseInt(interaction.fields.getTextInputValue("stars")))));

      const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
      await vouch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⭐ Review")
            .setDescription(`${interaction.fields.getTextInputValue("text")}\n\n${stars}`)
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });

      const member = await interaction.guild.members.fetch(t.userId);
      const role = interaction.guild.roles.cache.get(CONFIG.ROLES.CUSTOMER);
      if (role) await member.roles.add(role);

      setTimeout(() => interaction.channel.delete(), 5000);
      return interaction.reply({ content: "🙏 Tack för ditt omdöme!", ephemeral: true });
    }

    /* ---------- PARTNER ---------- */
    if (interaction.isModalSubmit() && interaction.customId === "partner_form") {
      const t = tickets.get(interaction.channel.id);
      t.invite = interaction.fields.getTextInputValue("invite");
      t.ad = interaction.fields.getTextInputValue("ad");
      return interaction.reply({ content: "📨 Partnerförfrågan mottagen.", ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === "approve_partner") {
      const t = tickets.get(interaction.channel.id);
      await interaction.guild.channels.fetch(CONFIG.CHANNELS.ANNOUNCEMENTS)
        .then(ch => ch.send(`${t.ad}\n\n${t.invite}`));
      setTimeout(() => interaction.channel.delete(), 5000);
      return interaction.reply({ content: "✅ Partner godkänd.", ephemeral: true });
    }

  } catch (err) {
    console.error(err);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
