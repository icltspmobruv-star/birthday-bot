const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')

// 🔥 PREVENT CRASHES
process.on('unhandledRejection', console.error)

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
})

const CLIENT_ID = "1483191419135856722"

// Load data
let birthdays = fs.existsSync('./birthdays.json')
  ? JSON.parse(fs.readFileSync('./birthdays.json', 'utf8'))
  : {}

let settings = fs.existsSync('./settings.json')
  ? JSON.parse(fs.readFileSync('./settings.json', 'utf8'))
  : { birthdayChannel: null, birthdayRole: null, timezone: "America/New_York" }

function saveBirthdays() {
  fs.writeFileSync('./birthdays.json', JSON.stringify(birthdays, null, 2))
}

function saveSettings() {
  fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2))
}

// Formatting
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function suffix(d){
  if(d%10===1 && d!==11)return "st"
  if(d%10===2 && d!==12)return "nd"
  if(d%10===3 && d!==13)return "rd"
  return "th"
}

function formatDate(m,d){
  return `${months[m-1]} ${d}${suffix(d)}`
}

// 🔥 FIXED DAYS FUNCTION
function daysUntil(m, d) {
  const now = new Date().toLocaleString("en-US", { timeZone: settings.timezone })
  const today = new Date(now)
  today.setHours(0,0,0,0)

  let next = new Date(today.getFullYear(), m - 1, d)
  next.setHours(0,0,0,0)

  if (next < today) next.setFullYear(today.getFullYear() + 1)

  return Math.round((next - today) / (1000 * 60 * 60 * 24))
}

function embed(title, desc) {
  return new EmbedBuilder().setColor("#2b7fff").setTitle(title).setDescription(desc)
}

// Commands
const commands = [
  new SlashCommandBuilder().setName("addbirthday").setDescription("Set your birthday")
    .addIntegerOption(o=>o.setName("month").setRequired(true))
    .addIntegerOption(o=>o.setName("day").setRequired(true)),

  new SlashCommandBuilder().setName("checkbirthday").setDescription("Check birthday")
    .addUserOption(o=>o.setName("user").setRequired(true)),

  new SlashCommandBuilder().setName("setbirthdaychannel").setDescription("Set channel")
    .addChannelOption(o=>o.setName("channel").setRequired(true)),

  new SlashCommandBuilder().setName("setbirthdayrole").setDescription("Set role")
    .addRoleOption(o=>o.setName("role").setRequired(true)),

  new SlashCommandBuilder().setName("birthdaytest").setDescription("Test birthday")
]

// Ready
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`)

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)

  for (const cmd of commands) {
    await rest.post(Routes.applicationCommands(CLIENT_ID), { body: cmd.toJSON() })
  }

  setInterval(checkBirthdays, 60000)
})

// Commands handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return

  try {

    if (interaction.commandName === "addbirthday") {
      const m = interaction.options.getInteger("month")
      const d = interaction.options.getInteger("day")

      birthdays[interaction.user.id] = { month: m, day: d }
      saveBirthdays()

      return interaction.reply({ embeds: [embed("Saved", formatDate(m,d))] })
    }

    if (interaction.commandName === "checkbirthday") {
      const user = interaction.options.getUser("user")

      if (!birthdays[user.id])
        return interaction.reply({ embeds: [embed("Error", "No birthday")] })

      const b = birthdays[user.id]
      const days = daysUntil(b.month, b.day)

      let text = days === 0
        ? "🎉 TODAY 🎉"
        : `${formatDate(b.month,b.day)} - ${days} days away`

      return interaction.reply({
        embeds: [embed(`${user.username}'s Birthday`, text)]
      })
    }

    if (interaction.commandName === "setbirthdaychannel") {
      settings.birthdayChannel = interaction.options.getChannel("channel").id
      saveSettings()
      return interaction.reply({ embeds: [embed("Set", "Channel saved")] })
    }

    if (interaction.commandName === "setbirthdayrole") {
      settings.birthdayRole = interaction.options.getRole("role").id
      saveSettings()
      return interaction.reply({ embeds: [embed("Set", "Role saved")] })
    }

    if (interaction.commandName === "birthdaytest") {
      return interaction.reply({
        embeds: [embed("🎉 Happy Birthday!", `<@${interaction.user.id}> 🎉`)]
      })
    }

  } catch (e) {
    console.log(e)
    if (!interaction.replied)
      interaction.reply({ content: "Error", ephemeral: true })
  }
})

// 🔥 AUTO BIRTHDAY SYSTEM
async function checkBirthdays() {
  const now = new Date().toLocaleString("en-US", { timeZone: settings.timezone })
  const today = new Date(now)

  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.get(settings.birthdayChannel)
    if (!channel) continue

    for (const id in birthdays) {
      const b = birthdays[id]

      if (today.getMonth()+1 === b.month && today.getDate() === b.day) {
        channel.send({
          embeds: [embed("🎉 Happy Birthday!", `<@${id}> 🎉`)]
        })

        if (settings.birthdayRole) {
          const member = await guild.members.fetch(id).catch(()=>null)
          if (member) member.roles.add(settings.birthdayRole).catch(()=>{})
        }
      }
    }
  }
}

client.login(process.env.TOKEN)
