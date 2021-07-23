let sessions = require('./sessions.js')
const fetch = require('node-fetch');

let verification = module.exports = {
  checkCloud: function (discordID) {
    return new Promise(async (resolve, reject) => {
      let scratchResponse = await fetch('https://api.scratch.mit.edu/users/isthistaken1234/projects/554914758/comments?offset=0&limit=20').then(r => r.json())
      let code = sessions.codes.filter(i => i.discord === discordID)[0].code
      let cloudUpdate = scratchResponse.find(i => i.content.trim() == code.toString())
      sessions.removeByCode(code)
      return cloudUpdate ? resolve(cloudUpdate.author.username) : reject("no cloud update")
    })
  }
}