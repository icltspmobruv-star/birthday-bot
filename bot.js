const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js")
const fs = require("fs")

const CLIENT_ID = "1483191419135856722"

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
})

let birthdays={}
let announcedToday=new Set()

let settings={
  birthdayChannel:null,
  birthdayRole:null,
  controlRoles:[],
  timezone:"UTC"
}

if(fs.existsSync("./birthdays.json"))
birthdays=JSON.parse(fs.readFileSync("./birthdays.json"))

if(fs.existsSync("./settings.json"))
settings=JSON.parse(fs.readFileSync("./settings.json"))

function saveBirthdays(){
fs.writeFileSync("./birthdays.json",JSON.stringify(birthdays,null,2))
}

function saveSettings(){
fs.writeFileSync("./settings.json",JSON.stringify(settings,null,2))
}

function cap(name){
return name.charAt(0).toUpperCase()+name.slice(1)
}

function embed(title,desc){
return new EmbedBuilder()
.setTitle(title)
.setDescription(desc)
.setColor(0x3498db)
}

function formatDate(month,day){

const months=[
"January","February","March","April","May","June",
"July","August","September","October","November","December"
]

const suffix=(d)=>{
if(d>=11&&d<=13)return"th"
switch(d%10){
case 1:return"st"
case 2:return"nd"
case 3:return"rd"
default:return"th"
}
}

return `${months[month-1]} ${day}${suffix(day)}`
}

function daysUntil(month,day){

const now=new Date()
let next=new Date(now.getFullYear(),month-1,day)

if(next<now)next.setFullYear(now.getFullYear()+1)

return Math.ceil((next-now)/(1000*60*60*24))
}

function isAllowed(member){

if(settings.controlRoles.length===0)return true

return member.roles.cache.some(r=>settings.controlRoles.includes(r.id))
}

const commands=[

new SlashCommandBuilder()
.setName("addbirthday")
.setDescription("Add birthday")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o=>o.setName("date").setDescription("Example: 3/18").setRequired(true)),

new SlashCommandBuilder()
.setName("removebirthday")
.setDescription("Remove birthday")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("checkbirthday")
.setDescription("Check birthday")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("birthdaylist")
.setDescription("List birthdays"),

new SlashCommandBuilder()
.setName("upcomingbirthdays")
.setDescription("Upcoming birthdays"),

new SlashCommandBuilder()
.setName("setbirthdaychannel")
.setDescription("Set birthday channel")
.addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder()
.setName("setbirthdayrole")
.setDescription("Set birthday role")
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder()
.setName("birthdaytest")
.setDescription("Send birthday test")
.addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder()
.setName("addcontrolrole")
.setDescription("Add control role")
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder()
.setName("removecontrolrole")
.setDescription("Remove control role")
.addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),

new SlashCommandBuilder()
.setName("listcontrolroles")
.setDescription("List control roles"),

new SlashCommandBuilder()
.setName("settimezone")
.setDescription("Set timezone")
.addStringOption(o=>o.setName("zone").setDescription("Example EST").setRequired(true))

].map(c=>c.toJSON())

const rest = new REST({version:"10"}).setToken(process.env.TOKEN)

client.once("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`)

await rest.put(
Routes.applicationCommands(CLIENT_ID),
{body:commands}
)

console.log("Slash commands registered")

})

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand())return

await interaction.deferReply()

const member=await interaction.guild.members.fetch(interaction.user.id)

if(!isAllowed(member)&&
!["checkbirthday","birthdaylist","upcomingbirthdays"].includes(interaction.commandName))
return interaction.editReply({embeds:[embed("Permission Denied","You cannot use this command")]})

try{

// ADD BDAY
if(interaction.commandName==="addbirthday"){

const user=interaction.options.getUser("user")
const date=interaction.options.getString("date")

if(birthdays[user.id])
return interaction.editReply({embeds:[embed("Error","Birthday already saved")]})

const[month,day]=date.split("/").map(Number)

birthdays[user.id]={month,day}

saveBirthdays()

return interaction.editReply({
embeds:[embed("Birthday Added",`${user} birthday saved as **${formatDate(month,day)}**`)]
})
}

// REMOVE BDAY
if(interaction.commandName==="removebirthday"){

const user=interaction.options.getUser("user")

if(!birthdays[user.id])
return interaction.editReply({embeds:[embed("Error","No birthday saved")]})

delete birthdays[user.id]
saveBirthdays()

return interaction.editReply({
embeds:[embed("Birthday Removed",`${user} removed`)]
})
}

// CHECK
if(interaction.commandName==="checkbirthday"){

const user=interaction.options.getUser("user")

if(!birthdays[user.id])
return interaction.editReply({embeds:[embed("Error","No birthday saved")]})

const b=birthdays[user.id]

const days=daysUntil(b.month,b.day)
const word=days===1?"day":"days"

return interaction.editReply({
embeds:[embed(
`${cap(user.username)}'s Birthday`,
`${formatDate(b.month,b.day)} - ${days} ${word} away`
)]
})
}

// LIST
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

if(list.length===0){
return interaction.editReply({
embeds:[embed("🎂 Server Birthday List","No birthdays saved.")]
})
}

let lines=[]

list.forEach(b=>{
lines.push(`• ${b.name} — ${b.date} (${b.days} ${b.days===1?"day":"days"})`)
})

const pages=[]
let current=""

for(const line of lines){

if((current+line+"\n").length>3800){
pages.push(current)
current=""
}

current+=line+"\n"
}

if(current) pages.push(current)

const embeds=pages.map((p,i)=>{

return embed(
`🎂 Server Birthday List (${i+1}/${pages.length})`,
p
)

})

return interaction.editReply({
embeds:embeds
})
}

// UPCOMING
if(interaction.commandName==="upcomingbirthdays"){

const list=[]

for(const id in birthdays){

const user=await client.users.fetch(id).catch(()=>null)
if(!user)continue

const b=birthdays[id]

list.push({
name:cap(user.username),
date:formatDate(b.month,b.day),
days:daysUntil(b.month,b.day)
})
}

list.sort((a,b)=>a.days-b.days)

let text=""

list.slice(0,5).forEach(b=>{
text+=`• ${b.name} — ${b.date} (${b.days} ${b.days===1?"day":"days"})\n`
})

return interaction.editReply({
embeds:[embed("📅 Upcoming Birthdays",text)]
})
}

// CHANNEL
if(interaction.commandName==="setbirthdaychannel"){

const channel=interaction.options.getChannel("channel")

settings.birthdayChannel=channel.id
saveSettings()

return interaction.editReply({
embeds:[embed("Channel Set",`Birthday channel set to ${channel}`)]
})
}

// ROLE
if(interaction.commandName==="setbirthdayrole"){

const role=interaction.options.getRole("role")

settings.birthdayRole=role.id
saveSettings()

return interaction.editReply({
embeds:[embed("Role Set",`Birthday role set to ${role}`)]
})
}

// TEST
if(interaction.commandName==="birthdaytest"){

const channel=interaction.options.getChannel("channel")

const embedMsg=new EmbedBuilder()
.setTitle("🎉 Happy Birthday!")
.setDescription(`Everyone wish ${interaction.user} a happy birthday!`)
.setColor(0xFFD700)

await channel.send({embeds:[embedMsg]})

return interaction.editReply({embeds:[embed("Test Sent","Birthday test sent")]})
}

// CONTROL ADD
if(interaction.commandName==="addcontrolrole"){

const role=interaction.options.getRole("role")

if(!settings.controlRoles.includes(role.id))
settings.controlRoles.push(role.id)

saveSettings()

return interaction.editReply({
embeds:[embed("Control Role Added",`${role} can control the bot`)]
})
}

// CONTROL REMOVE
if(interaction.commandName==="removecontrolrole"){

const role=interaction.options.getRole("role")

settings.controlRoles=settings.controlRoles.filter(r=>r!==role.id)
saveSettings()

return interaction.editReply({
embeds:[embed("Control Role Removed",`${role} removed`)]
})
}

// CONTROL LIST
if(interaction.commandName==="listcontrolroles"){

let text=""

for(const id of settings.controlRoles){

const role=interaction.guild.roles.cache.get(id)
if(role) text+=`• ${role.name}\n`
}

if(!text) text="No roles set."

return interaction.editReply({
embeds:[embed("Control Roles",text)]
})
}

// TIMEZONE
if(interaction.commandName==="settimezone"){

const zone=interaction.options.getString("zone")

settings.timezone=zone
saveSettings()

return interaction.editReply({
embeds:[embed("Timezone Set",`Timezone set to **${zone}**`)]
})
}

}catch(err){
console.log(err)
interaction.editReply({embeds:[embed("Error","Something went wrong")]})
}

})

setInterval(async()=>{

const now=new Date()
const month=now.getMonth()+1
const day=now.getDate()

for(const guild of client.guilds.cache.values()){

const channel=guild.channels.cache.get(settings.birthdayChannel)
if(!channel)continue

for(const id in birthdays){

const b=birthdays[id]
const member=await guild.members.fetch(id).catch(()=>null)
if(!member)continue

if(b.month===month&&b.day===day){

if(!announcedToday.has(id)){

announcedToday.add(id)

const embedMsg=new EmbedBuilder()
.setTitle("🎉 Happy Birthday!")
.setDescription(`Everyone wish <@${id}> a happy birthday!`)
.setColor(0xFFD700)

await channel.send({embeds:[embedMsg]})

if(settings.birthdayRole){
const role=guild.roles.cache.get(settings.birthdayRole)
if(role)member.roles.add(role).catch(()=>{})
}

}

}else{

if(settings.birthdayRole){
const role=guild.roles.cache.get(settings.birthdayRole)
if(role&&member.roles.cache.has(role.id)){
member.roles.remove(role).catch(()=>{})
}
}

}

}

}

},60000)

client.login(process.env.TOKEN)
