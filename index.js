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
client.on(Events.GuildMemberAdd, async member => {
  try {
    // Ge medlemsroll automatiskt
    const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
    if (role) await member.roles.add(role);

    const channel = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(CONFIG.BRAND.COLOR)
      .setAuthor({
        name: `Välkommen till ${CONFIG.BRAND.NAME}!`,
        iconURL: member.guild.iconURL({ dynamic: true })
      })
      .setDescription(
        `👋 **Välkommen ${member.user.username}!**\n\n` +
        `🛒 **Tjänster:** <#${CONFIG.CHANNELS.PANEL}>\n` +
        `💰 **Priser:** <#${CONFIG.CHANNELS.PANEL}>\n` +
        `🎟 **Köp:** <#${CONFIG.CHANNELS.PANEL}>`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Welcome error:", err);
  }
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

//* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (
      !interaction.isButton() &&
      !interaction.isStringSelectMenu() &&
      !interaction.isModalSubmit()
    ) return;

    /* ========== CREATE TICKET ========== */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.customId.split("_")[1];

      const channel = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CHANNELS.CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: type === "buy"
              ? CONFIG.ROLES.SELLER
              : CONFIG.ROLES.PARTNER_MANAGER,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });

      tickets.set(channel.id, { userId: interaction.user.id, type });

      await channel.send(
        type === "buy"
          ? `<@&${CONFIG.ROLES.SELLER}> ny köpticket skapad.`
          : `<@&${CONFIG.ROLES.PARTNER_MANAGER}> ny partner-ticket skapad.`
      );

      /* BUY → PRODUCT MENU */
      if (type === "buy") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("select_product")
          .setPlaceholder("🛒 Välj vilket konto du vill köpa")
          .addOptions(
            Object.keys(PRODUCTS).map(p => ({ label: p, value: p }))
          );

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🛒 Köp konto")
              .setDescription("Välj vilket konto du vill köpa.")
              .setColor(CONFIG.BRAND.COLOR)
          ],
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      /* PARTNER → FORM BUTTON */
      if (type === "partner") {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🤝 Samarbetsförfrågan")
              .setDescription("Skicka invite + annons via formuläret.")
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

      return interaction.editReply({ content: `🎟 Ticket skapad: ${channel}` });
    }

    /* ========== PRODUCT SELECT ========== */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      await interaction.deferUpdate();

      const t = tickets.get(interaction.channel.id);
      if (!t) return;

      t.product = interaction.values[0];

      await interaction.channel.send({
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

    /* ========== DURATION SELECT ========== */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
      await interaction.deferUpdate();

      const t = tickets.get(interaction.channel.id);
      if (!t) return;

      [t.duration, t.price] = interaction.values[0].split("|");
      t.orderId = orderId();

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Välj betalmetod")
            .setDescription(
              `🆔 **Order:** ${t.orderId}\n\n` +
              `${t.product}\n${t.duration} – ${t.price}`
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

    /* ========== PAY SWISH ========== */
    if (interaction.isButton() && interaction.customId === "pay_swish") {
      await interaction.deferUpdate();

      const t = tickets.get(interaction.channel.id);
      t.payment = "Swish";

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 Swish-betalning")
            .setDescription(
              `📱 **Nummer:** ${CONFIG.PAYMENTS.SWISH}\n` +
              `💰 **Summa:** ${t.price}\n\n` +
              `➡️ Gör betalningen\n` +
              `➡️ Skicka **screenshot här i chatten**`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    /* ========== PAY LTC ========== */
    if (interaction.isButton() && interaction.customId === "pay_ltc") {
      await interaction.deferUpdate();

      const t = tickets.get(interaction.channel.id);
      t.payment = "LTC";

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("💳 LTC-betalning")
            .setDescription(
              `🔐 **Adress:** ${CONFIG.PAYMENTS.LTC}\n` +
              `💰 **Summa:** ${t.price}\n\n` +
              `➡️ Skicka betalningen\n` +
              `➡️ Skicka **screenshot här i chatten**`
            )
            .setColor(CONFIG.BRAND.COLOR)
        ]
      });
    }

    /* ========== PARTNER FORM ========== */
    if (interaction.isButton() && interaction.customId === "open_partner_form") {
      const modal = new ModalBuilder()
        .setCustomId("partner_form")
        .setTitle("🤝 Samarbetsförfrågan");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("invite")
            .setLabel("Discord-invite")
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("ad")
            .setLabel("Er annons")
            .setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

  } catch (err) {
    console.error("Interaction error:", err);
  }
});

    /* PAY */
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
