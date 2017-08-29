"use strict";


var mma = require('mma');
var emoji_flags = require('emoji-flags');

var isEmpty = function(obj) {
  if (typeof obj === 'undefined') return true;
  if (Object.getOwnPropertyNames(obj).length === 0) return true;
  else return false;
}

var getPercentage = function(x, y) {
  if (y !== 0) {
    return '(' + ((x / y) * 100).toPrecision(3).toString() + '%)';
  }
  else return ''
}

var parseDate = function(date) {
  var parsed = '';
  var dateSplit = date.split('/');
  var month = dateSplit[0].trim();
  var day = dateSplit[1].trim();
  var year = dateSplit[2].trim();

  if (month == 'Jan') parsed += '1';
  else if (month == 'Feb') parsed += '2';
  else if (month == 'Mar') parsed += '3';
  else if (month == 'Apr') parsed += '4';
  else if (month == 'May') parsed += '5';
  else if (month == 'Jun') parsed += '6';
  else if (month == 'Jul') parsed += '7';
  else if (month == 'Aug') parsed += '8';
  else if (month == 'Sep') parsed += '9';
  else if (month == 'Oct') parsed += '10';
  else if (month == 'Nov') parsed += '11';
  else if (month == 'Dec') parsed += '12';
  else parsed += 'noMonth';

  parsed += '-' + day + '-' + year;
  return parsed;
}

var head1 = function(str) { return '# ' + str; }
var boldify = function(str) { return '**' + str + '**'; }
var italicize = function(str) { return '_' + str + '_'; }
var listify = function(str) { return '*   ' + str; }

var MessageOpts = { // Include this var with bot sendMessage calls to include additional options
  parse_mode: 'Markdown',
};

// Enum for user commands
var BotCommand = { 
  None: 0,
  Strikes: 1,
  Takedowns: 2,
  Fights: 3
};

var winLossQuickInfo = function(resp) {
  var res = '';
  var winTotal = resp.wins.total;
  var winKo = resp.wins.knockouts;
  var winSub = resp.wins.submissions;
  var winDec = resp.wins.decisions;
  var winOther = resp.wins.others;

  var lossTotal = resp.losses.total;
  var lossKo = resp.losses.knockouts;
  var lossSub = resp.losses.submissions;
  var lossDec = resp.losses.decisions;
  var lossOther = resp.losses.others;

  if (winTotal !== 0) {
    res += '\n';
    res += boldify('WINS:') + '\n\n';
    if (winKo !== 0)
      res += listify('KO: ') + winKo + ' ' + getPercentage(winKo, winTotal) + '\n';
    if (winSub !== 0)
      res += listify('SUB: ') + winSub + ' ' + getPercentage(winSub, winTotal) + '\n';
    if (winDec !== 0)
      res += listify('DEC: ') + winDec + ' ' + getPercentage(winDec, winTotal) + '\n'
    if (winOther !== 0)
      res += listify('OTHER: ') + winOther + ' ' + getPercentage(winOther, winTotal) + '\n';
  }

  if (lossTotal !== 0) {
    res += '\n';
    res += boldify('LOSSES:') + '\n\n';
    if (lossKo !== 0)
      res += listify('KO: ') + lossKo + ' ' + getPercentage(lossKo, lossTotal) + '\n';
    if (lossSub !== 0)
      res += listify('SUB: ') + lossSub + ' ' + getPercentage(lossSub, lossTotal) + '\n';
    if (lossDec !== 0)
      res += listify('DEC: ') + lossDec + ' ' + getPercentage(lossDec, lossTotal) + '\n'
    if (lossOther !== 0)
      res += listify('OTHER: ') + lossOther + ' ' + getPercentage(lossOther, lossTotal) + '\n';
  }

  return res;
}

var foundFighterResponse = function(resp) {
  var res = head1(resp.name) + '\n';
  res += emoji_flags[resp.nationality].emoji + ' ' + resp.record + '\n';
  res += resp.height + ' ' + resp.weight + ' (' + resp.weight_class + ')\n';
  if (resp.nickname !== '') {
    res += '"' + resp.nickname + '"\n';
  }
  res += '\n';
  res += winLossQuickInfo(resp);
  res += '\n';

  return res;
}

var runBotCommand = function(chatId, command, data) {
  if (command === BotCommand.Strikes) {
    var strikes = data.strikes;
    var res = boldify(data.fullname) + ' ' + italicize('Striking') + '\n';
    res += strikes.successful + ' successful of ' + strikes.attempted + ' attempted ';
    res += getPercentage(strikes.successful, strikes.attempted) + '\n';
    res += 'Standing: ' + strikes.standing + ' ' + getPercentage(strikes.standing, strikes.successful) + '\n';
    res += 'Clinch: ' + strikes.clinch + ' ' + getPercentage(strikes.clinch, strikes.successful) + '\n';
    res += 'Ground: ' + strikes.ground + ' ' + getPercentage(strikes.ground, strikes.successful) + '\n';
    telegramBot.sendMessage(chatId, res, MessageOpts);
  } else if (command === BotCommand.Takedowns) {
    var takedowns = data.takedowns;
    var res = boldify(data.fullname) + ' ' + italicize('Takedowns') + '\n';
    res += takedowns.successful + ' successful of ' + takedowns.attempted + ' attempted ';
    res += getPercentage(takedowns.successful, takedowns.attempted) + '\n';
    res += 'Submissions: ' + takedowns.submissions + '\n';
    res += 'Passes: ' + takedowns.passes + '\n';
    res += 'Sweeps: ' + takedowns.sweeps + '\n';
    telegramBot.sendMessage(chatId, res, MessageOpts);
  } else if (command === BotCommand.Fights) {
    var res = '';

    var linesPerMessage = 80;
    var linesToPrint = data.fights.length;
    var msgToSendCount = Math.ceil(data.fights.length / linesPerMessage);
    for (var i = 0; i < msgToSendCount; i++) {
      for (var j = 0; j < Math.min(linesPerMessage, linesToPrint); j++) {
        var fightInfoLine = fightQuickInfo(data.fights[(i * linesPerMessage) + j]);
        res += fightInfoLine;
      }
      telegramBot.sendMessage(chatId, res + ' ' + res.length, MessageOpts);
      res = '';
      linesToPrint -= linesPerMessage;
    }
  } else {
    // Print 'couldn't read your command'
    return new Error('Couldn\'t run command');
  }
}
//module.exports = (context, callback) => {
//exports.handler = function(event, context, callback) {
module.exports = function(context, callback) {

  //process.stdout.write(context);
  //console.log('console.log: ' + context);

//  callback(undefined, {nodeVersion: process.version, input: context });
      
    // Find out if this user has an existing record in the DB:
    mma.fighter(context, function(queryResponse) {
      var msgResponse = foundFighterResponse(queryResponse);

      //process.stdout.write("Downloading  bytes\r");
      //console.log(msgResponse);
      callback(null, msgResponse);
    });
}


