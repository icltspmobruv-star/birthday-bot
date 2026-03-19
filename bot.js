const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')

const client = new Client({
intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers]
})

const CLIENT_ID = "1483191419135856722"

let birthdays = JSON.parse(fs.readFileSync('./birthdays.json','utf8'))
let settings = fs.existsSync('./settings.json')
? JSON.parse(fs.readFileSync('./settings.json','utf8'))
: {birthdayChannel:null,birthdayRole:null,controlRoles:[],timezone:"UTC"}

function saveBirthdays(){fs.writeFileSync('./birthdays.json',JSON.stringify(birthdays,null,2))}
function saveSettings(){fs.writeFileSync('./settings.json',JSON.stringify(settings,null,2))}

function cap(str){return str.charAt(0).toUpperCase()+str.slice(1)}

function suffix(d){
if(d%10===1 && d!==11)return "st"
if(d%10===2 && d!==12)return "nd"
if(d%10===3 && d!==13)return "rd"
return "th"
}

const months=["January","February","March","April","May","June","July","August","September","October","November","December"]

function formatDate(m,d){
return `${months[m-1]} ${d}${suffix(d)}`
}

// 🔥 FIXED FUNCTION
function daysUntil(m,d){
const now = new Date().toLocaleString("en-US",{timeZone:settings.timezone})
const today = new Date(now)
today.setHours(0,0,0,0)

const currentYear = today.getFullYear()

let nextBirthday = new Date(currentYear,m-1,d)
nextBirthday.setHours(0,0,0,0)

if(nextBirthday < today){
nextBirthday.setFullYear(currentYear+1)
}

const diffTime = nextBirthday - today
const diffDays = Math.round(diffTime/(1000*60*60*24))

return diffDays
}

function embed(title,desc){
return new EmbedBuilder()
.setColor("#2b7fff")
.setTitle(title)
.setDescription(desc)
}

function isControl(member){
return settings.controlRoles.some(r=>member.roles.cache.has(r))
}

const commands = [

new SlashCommandBuilder().setName("addbirthday").setDescription("Set your birthday (MM/DD)")
.addIntegerOption(o=>o.setName("month").setDescription("Month").setRequired(true))
.addIntegerOption(o=>o.setName("day").setDescription("Day").setRequired(true)),

new SlashCommandBuilder().setName("checkbirthday").setDescription("Check a birthday")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder().setName("birthdaylist").setDescription("List birthdays"),

new SlashCommandBuilder().setName("setbirthdaychannel").setDescription("Set channel")
.addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder().setName("setbirthdayrole").setDescription("Set role")
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder().setName("settimezone").setDescription("Set timezone")
.addStringOption(o=>o.setName("zone").setDescription("Example: America/New_York").setRequired(true)),

new SlashCommandBuilder().setName("birthdaytest").setDescription("Test birthday message")

]

client.once("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`)

const rest = new REST({version:"10"}).setToken(process.env.TOKEN)

for(const cmd of commands){
try{
await rest.post(Routes.applicationCommands(CLIENT_ID),{body:cmd.toJSON()})
console.log(`Registered ${cmd.name}`)
}catch(e){console.log(e)}
}

setInterval(checkBirthdays,60000)
})

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return

await interaction.deferReply()

try{

if(interaction.commandName==="addbirthday"){

const m=interaction.options.getInteger("month")
const d=interaction.options.getInteger("day")

birthdays[interaction.user.id]={month:m,day:d}
saveBirthdays()

return interaction.editReply({
embeds:[embed("Birthday Saved",`${cap(interaction.user.username)}'s birthday saved as ${formatDate(m,d)}`)]
})
}

if(interaction.commandName==="checkbirthday"){

const user=interaction.options.getUser("user")

if(!birthdays[user.id])
return interaction.editReply({embeds:[embed("Error","No birthday saved")]})

const b=birthdays[user.id]
const days=daysUntil(b.month,b.day)

let text = `${formatDate(b.month,b.day)} - ${days} ${days===1?"day":"days"} away`
if(days===0) text = "🎉 TODAY 🎉"

return interaction.editReply({
embeds:[embed(`${cap(user.username)}'s Birthday`,text)]
})
}

if(interaction.commandName==="birthdaylist"){

const list=[]

for(const id in birthdays){

const user=await client.users.fetch(id).catch(()=>null)
if(!user) continue

const b=birthdays[id]

list.push({
name:cap(user.username),
date:formatDate(b.month,b.day),
days:daysUntil(b.month,b.day)
})
}

list.sort((a,b)=>a.days-b.days)

if(list.length===0)
return interaction.editReply({embeds:[embed("List","No birthdays")]})

let lines=list.map(b=>`• ${b.name} — ${b.date} (${b.days} ${b.days===1?"day":"days"})`)

return interaction.editReply({
embeds:[embed("🎂 Server Birthday List",lines.join("\n"))]
})
}

if(interaction.commandName==="settimezone"){

const zone=interaction.options.getString("zone")
settings.timezone=zone
saveSettings()

return interaction.editReply({
embeds:[embed("Timezone Set",zone)]
})
}

if(interaction.commandName==="birthdaytest"){

return interaction.editReply({
embeds:[embed("🎉 Happy Birthday!",`<@${interaction.user.id}> 🎉`)]
})
}

}catch(e){
console.log(e)
interaction.editReply("Error")
}
})

async function checkBirthdays(){

const now = new Date().toLocaleString("en-US",{timeZone:settings.timezone})
const today = new Date(now)

for(const guild of client.guilds.cache.values()){

const channel=guild.channels.cache.get(settings.birthdayChannel)
if(!channel) continue

for(const id in birthdays){

const b=birthdays[id]

if(today.getMonth()+1===b.month && today.getDate()===b.day){

channel.send({
embeds:[embed("🎉 Happy Birthday!",`<@${id}> 🎉`)]
})

if(settings.birthdayRole){

const member=await guild.members.fetch(id).catch(()=>null)
if(member) member.roles.add(settings.birthdayRole).catch(()=>{})
}
}
}
}
}

client.login(process.env.TOKEN)
