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
  } catch {}
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
const progressBar = (c, g, s = 18) =>
  "█".repeat(Math.min(s, Math.round((c / g) * s))) +
  "░".repeat(s - Math.min(s, Math.round((c / g) * s)));

const hasAnyRole = (m, r) => m.roles.cache.some(x => r.includes(x.id));

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  const panel = await client.channels.fetch(CONFIG.CHANNELS.PANEL);
  const msgs = await panel.messages.fetch({ limit: 50 });
  for (const m of msgs.values())
    if (m.author.id === client.user.id) await m.delete().catch(() => {});

  await panel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎟 ${CONFIG.BRAND.NAME}`)
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
});

/* ================= WELCOME ================= */
client.on(Events.GuildMemberAdd, async m => {
  const r = m.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
  if (r) await m.roles.add(r);
  const ch = m.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
  if (!ch) return;
  ch.send({
    embeds: [
      new EmbedBuilder()
        .setAuthor({ name: `Välkommen till ${CONFIG.BRAND.NAME}!` })
        .setDescription("🎟 Skapa en ticket för köp eller samarbete")
        .setThumbnail(m.user.displayAvatarURL())
        .setColor(CONFIG.BRAND.COLOR)
    ]
  });
});

/* ================= SCREENSHOT LOGGER ================= */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot || !tickets.has(msg.channel.id) || !msg.attachments.size) return;

  const t = tickets.get(msg.channel.id);
  if (t.type === "buy" && !t.payment) return;

  const img = msg.attachments.find(a => a.contentType?.startsWith("image/"));
  if (!img) return;

  const log = await msg.guild.channels.fetch(
    t.type === "partner" ? CONFIG.CHANNELS.PARTNER_LOGS : CONFIG.CHANNELS.SWISH_LOGS
  );

  await log.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📸 Screenshot mottagen")
        .setImage(img.url)
        .addFields(
          { name: "User", value: `<@${msg.author.id}>`, inline: true },
          { name: "Order", value: t.orderId || "Partner", inline: true }
        )
        .setColor(CONFIG.BRAND.COLOR)
    ]
  });

  msg.channel.send({
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
client.on(Events.InteractionCreate, async i => {
  try {
    if (!i.isButton() && !i.isStringSelectMenu() && !i.isModalSubmit()) return;

    /* CREATE TICKET */
    if (i.isButton() && i.customId.startsWith("ticket_")) {
      await i.deferReply({ ephemeral: true });
      const type = i.customId.split("_")[1];

      const ch = await i.guild.channels.create({
        name: `ticket-${type}-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CHANNELS.CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: type === "buy" ? CONFIG.ROLES.SELLER : CONFIG.ROLES.PARTNER_MANAGER,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      tickets.set(ch.id, { userId: i.user.id, type });

      if (type === "buy") {
        ch.send({
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("select_product")
                .setPlaceholder("Välj konto")
                .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })))
            )
          ]
        });
      }

      return i.editReply(`🎟 Ticket skapad: ${ch}`);
    }

    /* PRODUCT */
    if (i.isStringSelectMenu() && i.customId === "select_product") {
      const t = tickets.get(i.channel.id);
      t.product = i.values[0];

      return i.update({
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
    if (i.isStringSelectMenu() && i.customId === "select_duration") {
      const t = tickets.get(i.channel.id);
      [t.duration, t.price] = i.values[0].split("|");
      t.orderId = orderId();

      return i.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pay_swish").setLabel("Swish").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("pay_ltc").setLabel("LTC").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    /* PAY */
    if (i.isButton() && (i.customId === "pay_swish" || i.customId === "pay_ltc")) {
      const t = tickets.get(i.channel.id);
      t.payment = i.customId === "pay_swish" ? "Swish" : "LTC";
      return i.reply({ content: "📸 Skicka screenshot på betalningen", ephemeral: true });
    }

    /* APPROVE PAYMENT */
    if (i.isButton() && i.customId === "approve_payment") {
      const t = tickets.get(i.channel.id);
      totalSales += parseInt(t.price);
      saveSales();

      const owner = await client.users.fetch(OWNER_ID);
      owner.send(`💰 Sale\n${progressBar(totalSales, SALES_GOAL)}\n${totalSales}/${SALES_GOAL}`);

      return i.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("deliver_account").setLabel("📦 Leverera konto").setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    /* DELIVERY */
    if (i.isButton() && i.customId === "deliver_account") {
      const modal = new ModalBuilder().setCustomId("deliver").setTitle("📦 Leverera konto");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short))
      );
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === "deliver") {
      const t = tickets.get(i.channel.id);
      const u = await client.users.fetch(t.userId);
      u.send(`📦 Konto\n${t.product}\n${t.duration}\n${t.price}\n📧 ${i.fields.getTextInputValue("email")}\n🔑 ${i.fields.getTextInputValue("password")}`);
      return i.channel.send({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_working").setLabel("✅ Kontot funkar").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    /* CONFIRM */
    if (i.isButton() && i.customId === "confirm_working") {
      const modal = new ModalBuilder().setCustomId("review").setTitle("⭐ Review");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("text").setLabel("Kommentar").setStyle(TextInputStyle.Paragraph))
      );
      return i.showModal(modal);
    }

    /* REVIEW */
    if (i.isModalSubmit() && i.customId === "review") {
      const t = tickets.get(i.channel.id);
      const v = await i.guild.channels.fetch(CONFIG.CHANNELS.VOUCH);
      await v.send(i.fields.getTextInputValue("text"));
      const m = await i.guild.members.fetch(t.userId);
      await m.roles.add(CONFIG.ROLES.CUSTOMER);
      setTimeout(() => i.channel.delete(), 5000);
      return i.reply({ content: "🙏 Tack!", ephemeral: true });
    }

  } catch (e) {
    console.error(e);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
