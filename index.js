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
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= CONFIG ================= */
const CONFIG = {
  BRAND: {
    NAME: "Svenska Streams",
    COLOR: "Purple",
    INVITE: "https://discord.gg/hNRyB2Mewv"
  },
  CHANNELS: {
    WELCOME: "1452047332278538373",
    TICKET_PANEL: "1452057166721581216",
    TICKET_CATEGORY: "1452057139618119821",
    ANNOUNCEMENTS: "1452389624801525992",
    LOGS: "1452624943543226501",
    VOUCH: "1452263084646338582",
    SALES: "1452285768742600755"
  },
  ROLES: {
    STAFF: "1452057264155267242",
    MEMBER: "1452050878839394355",
    CUSTOMER: "1452263553234108548"
  },
  PAYMENTS: {
    SWISH: "0736816921",
    LTC: "LbepGSyhcYXHCCLdE73NoGGFSLZAXebFkr"
  },
  AUTO: {
    CLOSE_TICKET_AFTER: 10,
    COOLDOWN: 2500
  }
};

/* ================= PRODUKTER ================= */
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
  "🛡️ Malwarebytes Premium": {
    "12 Månader": "69 kr"
  }
};

/* ================= STATE ================= */
const tickets = new Map();
const cooldown = new Set();

/* ================= AUTO CLEAN ================= */
client.on(Events.ChannelDelete, channel => {
  if (tickets.has(channel.id)) tickets.delete(channel.id);
});

/* ================= AUTOROLE + WELCOME ================= */
client.on(Events.GuildMemberAdd, async member => {
  try {
    const role = member.guild.roles.cache.get(CONFIG.ROLES.MEMBER);
    if (role) await member.roles.add(role);

    const ch = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setAuthor({
        name: `Välkommen till ${CONFIG.BRAND.NAME}!`,
        iconURL: member.guild.iconURL({ dynamic: true })
      })
      .setDescription(
        `👋 **Välkommen ${member.user.username}!**\n\n` +
        `🛒 **Tjänster:** <#${CONFIG.CHANNELS.SERVICES ?? CONFIG.CHANNELS.TICKET_PANEL}>\n` +
        `💰 **Priser:** <#${CONFIG.CHANNELS.PRICES ?? CONFIG.CHANNELS.TICKET_PANEL}>\n` +
        `🎟 **Köp:** <#${CONFIG.CHANNELS.TICKET_PANEL}>`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await ch.send({ embeds: [embed] });
  } catch (err) {
    console.error("Welcome error:", err);
  }
});


/* ================= READY – AUTO PANEL ================= */
client.once(Events.ClientReady, async () => {
  console.log(`✅ ${CONFIG.BRAND.NAME} online som ${client.user.tag}`);

  const panel = await client.channels.fetch(CONFIG.CHANNELS.TICKET_PANEL).catch(() => null);
  if (!panel?.isTextBased()) return;

  const msgs = await panel.messages.fetch({ limit: 50 });
  for (const m of msgs.values()) {
    if (m.author.id === client.user.id && m.embeds[0]?.title?.includes("Tickets")) {
      await m.delete().catch(() => {});
    }
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
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    /* ===== COOLDOWN ===== */
    if (interaction.isButton()) {
      if (cooldown.has(interaction.user.id))
        return interaction.reply({ content: "⏳ Vänta lite.", ephemeral: true });
      cooldown.add(interaction.user.id);
      setTimeout(() => cooldown.delete(interaction.user.id), CONFIG.AUTO.COOLDOWN);
    }

    /* ===== CREATE TICKET ===== */
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      const existing = [...tickets.entries()].find(
        ([id, t]) => t.userId === interaction.user.id && interaction.guild.channels.cache.has(id)
      );
      if (existing)
        return interaction.reply({ content: "❌ Du har redan en öppen ticket.", ephemeral: true });

      const type = interaction.customId.split("_")[1];
      const channel = await interaction.guild.channels.create({
        name: `ticket-${type}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CONFIG.CHANNELS.TICKET_CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: CONFIG.ROLES.STAFF, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      tickets.set(channel.id, { userId: interaction.user.id, type });

      /* === BUY === */
      if (type === "buy") {
        const menu = new StringSelectMenuBuilder()
          .setCustomId("select_product")
          .setPlaceholder("Välj produkt")
          .addOptions(Object.keys(PRODUCTS).map(p => ({ label: p, value: p })));

        await channel.send({
          embeds: [new EmbedBuilder().setTitle("🛒 Välj produkt")],
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      /* === PARTNER === */
      if (type === "partner") {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🤝 Samarbetsförfrågan")
              .setDescription(
                "Vänligen fyll i formuläret nedan med er annons.\n" +
                "En samarbetsansvarig återkommer så snabbt som möjligt."
              )
              .setColor("Orange")
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

      return interaction.reply({ content: `🎟 Ticket skapad: ${channel}`, ephemeral: true });
    }

    /* ===== BUY FLOW ===== */
    if (interaction.isStringSelectMenu() && interaction.customId === "select_product") {
      const t = tickets.get(interaction.channel.id);
      t.product = interaction.values[0];

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_duration")
        .setPlaceholder("Välj period")
        .addOptions(Object.entries(PRODUCTS[t.product]).map(([d, p]) => ({
          label: `${d} – ${p}`,
          value: `${d}|${p}`
        })));

      return interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "select_duration") {
      const t = tickets.get(interaction.channel.id);
      [t.duration, t.price] = interaction.values[0].split("|");

      return interaction.update({
        embeds: [new EmbedBuilder().setTitle("💰 Välj betalmetod").setDescription(`${t.product}\n${t.duration} – ${t.price}`)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pay_swish").setLabel("Swish").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("pay_ltc").setLabel("LTC").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("pay_")) {
      const t = tickets.get(interaction.channel.id);
      t.payment = interaction.customId === "pay_swish" ? "Swish" : "LTC";

      return interaction.update({
        embeds: [
          new EmbedBuilder().setTitle("💳 Betalning").setDescription(
            `${t.product}\n${t.duration} – ${t.price}\n\n` +
            (t.payment === "Swish" ? `Swish: ${CONFIG.PAYMENTS.SWISH}` : `LTC:\n${CONFIG.PAYMENTS.LTC}`)
          )
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_paid").setLabel("Jag har betalat").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "confirm_paid") {
      return interaction.update({
        content: "⏳ Väntar på leverans...",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("deliver_account").setLabel("📦 Leverera konto").setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    if (interaction.isButton() && interaction.customId === "deliver_account") {
      if (!interaction.member.roles.cache.has(CONFIG.ROLES.STAFF))
        return interaction.reply({ content: "❌ Endast staff.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId("deliver").setTitle("📦 Leverera konto");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("email").setLabel("Email").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("password").setLabel("Lösenord").setStyle(TextInputStyle.Short))
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "deliver") {
      await interaction.deferReply({ ephemeral: true });
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
        content: "✅ Konto skickat. Bekräfta när det funkar:",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_working").setLabel("Kontot funkar").setStyle(ButtonStyle.Success)
          )
        ]
      });

      return interaction.editReply("📨 Konto skickat.");
    }

    if (interaction.isButton() && interaction.customId === "confirm_working") {
      const modal = new ModalBuilder().setCustomId("review").setTitle("⭐ Omdöme");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("stars").setLabel("Betyg 1–5").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("text").setLabel("Kommentar").setStyle(TextInputStyle.Paragraph))
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "review") {
      await interaction.deferReply({ ephemeral: true });
      const t = tickets.get(interaction.channel.id);

      const stars = "⭐".repeat(Math.min(5, Math.max(1, parseInt(interaction.fields.getTextInputValue("stars")))));

      await client.channels.fetch(CONFIG.CHANNELS.VOUCH)
        .then(ch => ch.send(`**${stars}**\n${t.product} – ${t.price}\n${interaction.fields.getTextInputValue("text")}`));

      await client.channels.fetch(CONFIG.CHANNELS.SALES)
        .then(ch => ch.send(`✅ ${t.product} – ${t.price}`));

      await client.channels.fetch(CONFIG.CHANNELS.LOGS)
        .then(ch => ch.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Köp slutfört")
              .addFields(
                { name: "Kund", value: `<@${t.userId}>`, inline: true },
                { name: "Produkt", value: t.product, inline: true },
                { name: "Pris", value: t.price, inline: true },
                { name: "Betalning", value: t.payment, inline: true }
              )
              .setTimestamp()
          ]
        }));

      const role = interaction.guild.roles.cache.get(CONFIG.ROLES.CUSTOMER);
      if (role) await interaction.member.roles.add(role);

      await interaction.editReply("🙏 Tack för ditt omdöme! Ticket stängs.");
      setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
    }

    /* ===== PARTNER FLOW ===== */
    if (interaction.isButton() && interaction.customId === "open_partner_form") {
      const modal = new ModalBuilder()
        .setCustomId("partner_form")
        .setTitle("🤝 Samarbetsförfrågan");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("invite")
            .setLabel("Discord-invite till er server")
            .setPlaceholder("https://discord.gg/xxxx")
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("ad")
            .setLabel("Er annons (den text vi ska posta)")
            .setStyle(TextInputStyle.Paragraph)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "partner_form") {
      await interaction.deferReply({ ephemeral: true });
      const t = tickets.get(interaction.channel.id);

      t.invite = interaction.fields.getTextInputValue("invite");
      t.ad = interaction.fields.getTextInputValue("ad");

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📨 Samarbetsförslag")
            .addFields(
              { name: "Invite", value: t.invite },
              { name: "Annons", value: t.ad }
            )
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("partner_approve").setLabel("Godkänn").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("partner_deny").setLabel("Neka").setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return interaction.editReply("✅ Samarbetsförfrågan skickad till staff.");
    }

    if (interaction.isButton() && interaction.customId === "partner_approve") {
      const t = tickets.get(interaction.channel.id);

      await client.channels.fetch(CONFIG.CHANNELS.ANNOUNCEMENTS)
        .then(ch => ch.send(`${t.ad}\n\n👉 ${t.invite}`));

      const user = await client.users.fetch(t.userId);
      await user.send(`🎬 **${CONFIG.BRAND.NAME}**\n👉 ${CONFIG.BRAND.INVITE}`);

      await interaction.reply("✅ Samarbete godkänt.");
      setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
    }

    if (interaction.isButton() && interaction.customId === "partner_deny") {
      await interaction.reply("❌ Samarbete nekad.");
      setTimeout(() => interaction.channel.delete(), CONFIG.AUTO.CLOSE_TICKET_AFTER * 1000);
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "⚠️ Ett fel uppstod.", ephemeral: true }).catch(() => {});
    }
  }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
