require('dotenv').config()

const { users } = require('./db.js')

const Discord = require('discord.js');
const client = new Discord.Client();

let sessions = require('./sessions.js')
let verification = require('./verification.js');
let whois = require('./whois.js');
let scratchWhois = require('./scratch-whois.js');
let errorHandling = require('./error-handle.js');

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});


client.on('message', async message => {
  if (message.content.toLowerCase().startsWith('g!verify')) {
    // temp fix: don't let user verify in a non dm or in a channel that contains the word "commands"
    if (!(message.channel.type.startsWith('dm') || message.channel.name.includes('commands'))) return
    // if (message.deletable) message.delete()
    let code = addCode(message.author.id)
    message.author.send(`Your verification code is \`${code}\`. Comment it under https://scratch.mit.edu/projects/554914758/, and when you're done, reply \`g!done\` here.`)
      .catch(err => {
        console.error(err)
        message.reply(`something went wrong while I tried to send you a DM. Please make sure I am unblocked and you have your DMs open.`)
      })
    if (message.channel.type !== 'dm') message.reply("please check your DMs to proceed.")
  } else if (message.content.toLowerCase().startsWith('g!done')) {
    if (!message.channel.type.startsWith('dm')) return
    if (!sessions.codes.filter(i => i.discord === message.author.id)[0]) return message.author.send(`You have not started the verification process yet. Use g!verify to get started.`)

    let [scratchUsername, error] = await errorHandling(verification.checkCloud(message.author.id))

    if (error) {
      return message.author.send("Sorry, you failed verification. Please try again.")
    }

    let server = client.guilds.cache.get(process.env.GUILD_ID);
    let member = server.members.cache.get(message.author.id)
    let verifiedRole = server.roles.cache.get(process.env.VERIFIED_ROLE_ID);

    member.roles.add(verifiedRole)

    let logChannel = server.channels.cache.get(process.env.LOG_CHANNEL_ID)
    logChannel.send(`${message.author.username} (${message.author.id}) verified as ${scratchUsername}`)

    let existingUser = await users.findOne({ discord: message.author.id })
    let user = {}
    if (existingUser) {
      user = existingUser
      if (existingUser.scratch.includes(scratchUsername)) {
        return message.author.send(`you are already verified as ${scratchUsername}.`)
      } else {
        let user = existingUser
        user.scratch.push(scratchUsername)
        user.updated = Date.now()
        await users.update({ discord: message.author.id }, { $set: user })
      }
    } else {
      // we add the user to the array
      user = await users.insert({ discord: message.author.id, scratch: [scratchUsername], updated: Date.now() })
    }
    message.author.send({
      embed: {
        "title": "Verification Confirmation",
        "description": `You have added **${scratchUsername}** as a scratch account. \n\n**Current list of accounts:**\n${user.scratch.map(i => '- ' + i).join('\n')}\n\nYou can verify more accounts by typing g!verify.`,
        "color": '#00a9c0',
        "thumbnail": {
          "url": `https://my-ocular.jeffalo.net/api/user/${scratchUsername}/picture`
        }
      }
    })

  } else if (message.content.toLowerCase().startsWith('g!whois')) {
    // if the user has the moderator role
    if (message.channel.type.startsWith('dm')) return message.reply('please do this in the server thanks (todo: make this work in DMs)')
    if (!(message.member.roles.cache.get(process.env.MODERATOR_ROLE_ID) || message.member.hasPermission("ADMINISTRATOR"))) return
    
    // smart name finding

    let pingedUser = message.mentions.users.first()
    if (!pingedUser) {
      let server = client.guilds.cache.get(process.env.GUILD_ID);
      let member = server.members.cache.get(message.content.split(' ')[1])
      if (member) {
        pingedUser = member.user
      } else {
        // 1. there was no user mentioned.
        // 2. there was no user ID provided.
        // 3. so try to find the user by tag
        let member = server.members.cache.find(member => member.user.tag.toLowerCase() == message.content.split(' ')[1].toLowerCase())
        if (member) {
          pingedUser = member.user
        } else {
          // if there was no user mentioned and no user ID provided, and we couldn't find the user by tag,
          // try finding the user by name
          let member = server.members.cache.find(member => member.user.username.toLowerCase() == message.content.split(' ')[1].toLowerCase())
          if (member) {
            pingedUser = member.user
          } else {
            // if we still couldn't find the user, we can't do anything
            return message.reply('I could not find the user you were looking for. Please try using a user ID, tag, or mention.')
          }
        }
      }
    }
    let [embedMessage, error] = await errorHandling(whois(pingedUser))
    if (error) return message.channel.send("That user is not verified yet.")
    message.channel.send(embedMessage)
  } else if (message.content.toLowerCase().startsWith('g!whoami') || message.content.toLowerCase().startsWith('g!id') || message.content.toLowerCase().startsWith('g!me')) {
    // send the same verification status as whois
    let [embedMessage, error] = await errorHandling(whois(message.author))
    if (error) return message.channel.send("You are not verified. DM me g!verify to get started.")
    message.channel.send(embedMessage)
  }
  else if (message.content.toLowerCase().startsWith('g!scratchwhois')) {
    // get the discord accounts linked to a scratch username
    if (!(message.member.roles.cache.get(process.env.MODERATOR_ROLE_ID) || message.member.hasPermission("ADMINISTRATOR"))) return
    let [embedMessage, error] = await errorHandling(scratchWhois(message.content.split(' ')[1]))
    if (error) return message.channel.send("I could not find any Discord accounts linked to that Scratch user. This command is case sensitive.")
    message.channel.send(embedMessage)
  } else if (message.content.toLowerCase().startsWith('g!remove')) {
    // if the user has one linked scratch account, remove them completely
    // otherwise, remove only one linked scratch account
    let discordID = message.mentions.users.first().id
    let scratchUsername = message.content.split(' ')[2]
    let user = await users.findOne({ discord: discordID })
    if (user) {
      // if the user has a linked scratch account with the username
      if (user.scratch.includes(scratchUsername)) {
        // remove the linked scratch account
        user.scratch = user.scratch.filter(i => i !== scratchUsername)
        user.updated = Date.now()

        // if the user has now has no linked scratch accounts, remove them completely
        if (user.scratch.length == 0) {
          await users.remove({ discord: discordID })
        } else {
          // otherwise save the user
          await users.update({ discord: discordID }, { $set: user })
        }

        message.channel.send({
          embed: {
            "title": `Verification Status (${message.mentions.users.first().tag})`,
            "description": `**Current list of accounts:**\n${user.scratch.map(i => '- ' + i).join('\n')}\n\nLast updated: <t:${Math.floor(user.updated / 1000)}:R>.`,
            "color": '#00a9c0',
            "thumbnail": {
              "url": message.mentions.users.first().displayAvatarURL()
            }
          }
        })
      } else {
        message.channel.send(`${scratchUsername} isnt linked to ${message.mentions.users.first().tag}.`)
      }
    } else if (message.content.toLowerCase().startsWith('g!add')){
        let discordID = message.mentions.users.first().id
        let scratchUsername = message.content.split(' ')[2]
        let user = await users.findOne({ discord: discordID })
        if (user) {
            // if the user has a linked scratch account with the username
            // add account here (does nothing)
            user.updated = Date.now()
        }
    } else if (message.content.toLowerCase().startsWith('g!help')) {
        message.channel.send({
            embed: {
                "title": `Griffbot Commands`,
                "description": `**Verify Commands**\ng!verify - Start the verifying process.\n\n**Profile Commands**\ng!id or g!whoami - Check your profile.\ng!setdesc - Set your description.`,
                "color": '#00a9c0',
                "thumbnail": {
                    "url": `https://cdn.discordapp.com/avatars/867815341451116564/5e80a2a503812bb35b4762c1bf6f2935.png?size=256`
                }
            }
        })
    } else {
      message.channel.send(`${message.mentions.users.first().tag} isnt linked to any scratch accounts.`)
    }
  }
})

client.on('guildMemberAdd', async (member) => { // role on rejoin
  // find the user in the users.json file
  let user = await users.findOne({ discord: member.user.id })
  // if the user is in the file, they are verified. assign them the verified role.
  console.log(`${member.user.id} joined ${member.guild.name}`)
  if (user) {
    let server = client.guilds.cache.get(process.env.GUILD_ID);
    let verifiedRole = server.roles.cache.get(process.env.VERIFIED_ROLE_ID);
    member.roles.add(verifiedRole)
  }
})

let codes = []

function addCode(discord) {
  // code is a random 10 digit number
  let code = generateCode()
  // add the code to the array
  sessions.add({ code: code, discord: discord })
  // return the code

  setTimeout(() => {
    // remove the code from the array after 180000ms (in minutes: 3 minutes)
    sessions.removeByCode(code)
  }, 180000)
  return code
}

function generateCode() {
  let code = makeID(10)
  // check if it is already used
  if (codes.find(i => i.code == code)) {
    return generateCode()
  }
  return code
}

function makeID(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

client.login(process.env.DISCORD_TOKEN);
