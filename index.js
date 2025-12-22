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

let totalSales = fs.existsSync(SALES_FILE)
  ? JSON.parse(fs.readFileSync(SALES_FILE)).total
  : 0;

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
        .setDescription("🎟 Skapa en ticket för köp eller samarbete")
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

  const isPartner = t.type === "partner";
  const logChannel = await msg.guild.channels.fetch(
    isPartner ? CONFIG.CHANNELS.PARTNER_LOGS : CONFIG.CHANNELS.SWISH_LOGS
  );

  const embed = new EmbedBuilder()
    .setTitle("📸 Screenshot mottagen")
    .setImage(image.url)
    .setColor(CONFIG.BRAND.COLOR)
    .addFields(
      { name: "Användare", value: `<@${msg.author.id}>`, inline: true },
      { name: "Typ", value: isPartner ? "Partner" : "Betalning", inline: true }
    )
    .setTimestamp();

  if (!isPartner) {
    embed.addFields(
      { name: "Produkt", value: t.product, inline: true },
      { name: "Pris", value: t.price, inline: true },
      { name: "Order-ID", value: t.orderId, inline: true }
    );
  }

  await logChannel.send({ embeds: [embed] });

  await msg.channel.send({
    content: "🔍 Screenshot mottagen – väntar på godkännande",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(isPartner ? "approve_partner" : "approve_payment")
          .setLabel("✅ Godkänn screenshot")
          .setStyle(ButtonStyle.Success)
      )
    ]
  });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (
      !interaction.isButton() &&
      !interaction.isStringSelectMenu() &&
      !interaction.isModalSubmit()
    ) return;

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
        id:
          type === "buy"
            ? CONFIG.ROLES.SELLER
            : CONFIG.ROLES.PARTNER_MANAGER,
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

  // 🛒 KÖP → PRODUKTMENY
  if (type === "buy") {
    const productMenu = new StringSelectMenuBuilder()
      .setCustomId("select_product")
      .setPlaceholder("🛒 Välj vilket konto du vill köpa")
      .addOptions(
        Object.keys(PRODUCTS).map(p => ({
          label: p,
          value: p
        }))
      );

    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🛒 Köp konto")
          .setDescription("Välj vilket konto du vill köpa nedan.")
          .setColor(CONFIG.BRAND.COLOR)
      ],
      components: [new ActionRowBuilder().addComponents(productMenu)]
    });
  }

  // 🤝 PARTNER → FORM
  if (type === "partner") {
    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🤝 Samarbetsförfrågan")
          .setDescription(
            "Skicka in er invite och er annons.\nEfter godkänd screenshot postas er annons automatiskt."
          )
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

  await interaction.editReply({
    content: `🎟 Ticket skapad: ${ch}`
  });
}


    /* ---------- PAYMENT ---------- */
    if (interaction.isButton() && interaction.customId === "pay_swish") {
      const t = tickets.get(interaction.channel.id);
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Swish")
            .setDescription(
              `📱 **Nummer:** ${CONFIG.PAYMENTS.SWISH}\n💰 **Summa:** ${t.price}\n\n📸 Skicka screenshot på betalningen`
            )
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
            .setDescription(
              `🔐 **Adress:** ${CONFIG.PAYMENTS.LTC}\n💰 **Summa:** ${t.price}\n\n📸 Skicka screenshot på betalningen`
            )
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
        `💰 **Ny sale**\n${progressBar(totalSales, SALES_GOAL)}\n${totalSales}/${SALES_GOAL} kr`
      );

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

      return interaction.reply("✅ Betalning godkänd.");
    }

    /* ---------- DELIVER ACCOUNT ---------- */
    if (interaction.isButton() && interaction.customId === "deliver_account") {
      if (!hasAnyRole(interaction.member, CAN_APPROVE_SALE))
        return interaction.reply({ content: "❌ Ingen behörighet.", ephemeral: true });

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
`📦 **Ditt konto**
${t.product}
${t.duration}
Pris: ${t.price}

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

    /* ---------- CONFIRM WORKING ---------- */
    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const t = tickets.get(interaction.channel.id);
      if (interaction.user.id !== t.userId)
        return interaction.reply({ content: "❌ Endast kunden.", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("review_modal")
        .setTitle("⭐ Lämna omdöme");

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

    /* ---------- REVIEW ---------- */
    if (interaction.isModalSubmit() && interaction.customId === "review_modal") {
      const t = tickets.get(interaction.channel.id);

      const stars = "⭐".repeat(
        Math.min(5, Math.max(1, parseInt(interaction.fields.getTextInputValue("stars"))))
      );

      const embed = new EmbedBuilder()
        .setTitle("⭐ Ny Review")
        .setColor(CONFIG.BRAND.COLOR)
        .setDescription(`"${interaction.fields.getTextInputValue("text")}"\n\n${stars}`)
        .setFooter({ text: "Svenska Streams" })
        .setTimestamp();

      const vouch = await interaction.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
      const msg = await vouch.send({ embeds: [embed] });
      await msg.react("❤️");

      const member = await interaction.guild.members.fetch(t.userId);
      const role = interaction.guild.roles.cache.get(CONFIG.ROLES.CUSTOMER);
      if (role) await member.roles.add(role).catch(() => {});

      await interaction.reply("🙏 Tack för ditt omdöme! Du har nu fått kund-rollen.");
      setTimeout(() => interaction.channel.delete(), 5000);
    }

    /* ---------- PARTNER APPROVE ---------- */
    if (interaction.isButton() && interaction.customId === "approve_partner") {
      if (!hasAnyRole(interaction.member, CAN_APPROVE_PARTNER))
        return interaction.reply({ content: "❌ Ingen behörighet.", ephemeral: true });

      const t = tickets.get(interaction.channel.id);
      await interaction.guild.channels.fetch(CONFIG.CHANNELS.ANNOUNCEMENTS)
        .then(ch => ch.send(`${t.ad}\n\n${t.invite}`));

      await interaction.reply("✅ Partner godkänd.");
      setTimeout(() => interaction.channel.delete(), 5000);
    }

  } catch (err) {
    console.error(err);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
