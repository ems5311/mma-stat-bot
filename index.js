"use strict";

var telegramBotToken = '';

var mma = require('mma');
var AWS = require('aws-sdk');
var dynamoDb = new AWS.DynamoDB();
var emoji_flags = require('emoji-flags');
var TelegramBot = require('node-telegram-bot-api');

var telegramBot = new TelegramBot(telegramBotToken, {polling: false});    
var tableName = 'MmaBotTable';

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

var boldify = function(str) { return '*' + str + '*'; }
var italicize = function(str) { return '_' + str + '_'; }

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
    res += boldify('WINS: ') + '\n';
    if (winKo !== 0)
      res += 'KO: ' + winKo + ' ' + getPercentage(winKo, winTotal) + '\n';
    if (winSub !== 0)
      res += 'SUB: ' + winSub + ' ' + getPercentage(winSub, winTotal) + '\n';
    if (winDec !== 0)
      res += 'DEC: ' + winDec + ' ' + getPercentage(winDec, winTotal) + '\n'
    if (winOther !== 0)
      res += 'OTHER: ' + winOther + ' ' + getPercentage(winOther, winTotal) + '\n';
  }

  if (lossTotal !== 0) {
    res += boldify('LOSSES: ') + '\n';
    if (lossKo !== 0)
      res += 'KO: ' + lossKo + ' ' + getPercentage(lossKo, lossTotal) + '\n';
    if (lossSub !== 0)
      res += 'SUB: ' + lossSub + ' ' + getPercentage(lossSub, lossTotal) + '\n';
    if (lossDec !== 0)
      res += 'DEC: ' + lossDec + ' ' + getPercentage(lossDec, lossTotal) + '\n'
    if (lossOther !== 0)
      res += 'OTHER: ' + lossOther + ' ' + getPercentage(lossOther, lossTotal) + '\n';
  }

  return res;
}

var printFoundFighterResponse = function(resp) {
  var res = boldify(resp.name) + '\n';
  res += emoji_flags[resp.nationality].emoji + ' ' + resp.record + '\n';
  res += resp.height + ' ' + resp.weight + ' (' + resp.weight_class + ')\n';
  if (resp.nickname !== '') {
    res += '"' + resp.nickname + '"\n';
  }
  res += '\n';
  res += winLossQuickInfo(resp);
  res += '\n';

  res += 'More stats:\n'
  res += '/strikes\n';
  res += '/takedowns\n';
  res += '/fights\n';

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
    var res = boldify(data.fullname) + ' ' + italicize('Fights') + '\n';
    var charCount = 0;
    data.fights.forEach(function(currentValue, index, array) {
      var fightInfoLine = fightQuickInfo(currentValue);
      res += fightInfoLine;
    });
    var textSegment = Math.ceil(res.length / 4096);
    for (var i = 0; i < textSegment; i++) {
      telegramBot.sendMessage(chatId, res.substr((i * 4096), 4096)/*, MessageOpts*/); // TODO - separate this by lines rather than just by text
    }
  } else {
    // Print 'couldn't read your command'
    return new Error('Couldn\'t run command');
  }
}

var fightQuickInfo = function(curVal) {
  var res = '';

  // Fight result (Bold)
  var valResult = curVal.result.toLowerCase();
  if (valResult === 'win') res += boldify('W');
  else if (valResult === 'loss') res += boldify('L');
  else res += boldify(valResult.toUpperCase());

  res += ' ';
  // Method that result was decided by (Italic)
  var valMethod = curVal.method.toLowerCase();
  if (valMethod.indexOf('sub') > -1) res += italicize('SUB');
  else if (valMethod.indexOf('tko') > -1) res += italicize('TKO');
  else if (valMethod.indexOf('ko') > -1) res += italicize('KO');
  else if (valMethod.indexOf('dec') > -1) {
    if (valMethod.indexOf('unan') > -1) res += italicize('UD');
    else if (valMethod.indexOf('split') > -1) res += italicize('SD');
    else res += italicize('DEC');
  }
  else if (valMethod.indexOf('draw') > -1) res += italicize('DRAW');
  
  res += ' ';
  // Opponent name (Italic)
  res += boldify(curVal.opponent);

  res += ' ';
  // Time, round fight ended
  res += curVal.time + 'R' + curVal.round;

  res += ' ';
  // Date TODO: better formatting
  res += italicize(parseDate(curVal.date));
  
  res += '\n';
  return res;
}

exports.handler = function(event, context, lambdaCallback) {
  var chatId = event.message.chat.id;
  var userName = event.message.from.username;
  var msgText = event.message.text;
  var entities = event.message.entities;
  var botCmd = BotCommand.None;

  if (!isEmpty(entities) && !isEmpty(entities[0]) && entities[0].type === 'bot_command') { // See if this entity is one of our commands
    if (msgText.substr(entities[0].offset, entities[0].length) === '/strikes') {
      botCmd = BotCommand.Strikes;
    } else if (msgText.substr(entities[0].offset, entities[0].length) === '/takedowns') {
      botCmd = BotCommand.Takedowns;
    } else if (msgText.substr(entities[0].offset, entities[0].length) === '/fights') {
      botCmd = BotCommand.Fights;
    } else if (msgText.substr(entities[0].offset, entities[0].length) === '/start') {
      var startResponse = 'Welcome to the Mma Stats Bot! Type a fighter\'s name to get started.\n';
      startResponse += '(Try a full name like \'*Rin Nakai*\', or a nickname like \'*Little Nog*\')\n';
      telegramBot.sendMessage(chatId, startResponse, MessageOpts);
      return;
    }
  }
    
  // Find out if this user has an existing record in the DB:
  dynamoDb.getItem({
      'TableName': tableName,
      'Key': {
        'User': {
          'S': userName
        }
      },
      'ProjectionExpression': 'Fighter'
    }, function(err, dbResponse) {
      if (err) {
        context.fail('ERROR: Get from Dynamo failed: ' + err);
      } else {
        if (isEmpty(dbResponse) || botCmd === BotCommand.None) {
          mma.fighter(msgText, function(queryResponse) {
            var msgResponse = printFoundFighterResponse(queryResponse);

            telegramBot.sendMessage(chatId, msgResponse, MessageOpts);

            // --- Put to DynamoDB ---
            var dateTime = new Date().getTime().toString();

            // Put the fact that the user just queried a fighter into the dynamodb for this user:
            dynamoDb.putItem({
                'TableName': tableName,
                'Item': {
                  'User': {
                    'S': userName
                  },
                  'Date': {
                    'N': dateTime
                  },
                  'Fighter': {
                    'S': queryResponse.name
                  }
                }
              }, function(err, dbPut) {
                if (err) {
                  context.fail('ERROR: Put to Dynamo failed: ' + err);
                } //else { telegramBot.sendMessage(chatId, 'Put to Dynamo Success' + JSON.stringify(data, null, '  ')); }
              });
          });
        } else { // We found a name associated with this user in the DB, and a bot_command was given
          var dbFighterName = dbResponse.Item.Fighter.S;

          mma.fighter(dbFighterName, function(queryResponse) { // Query for the fighter name in the db.
            runBotCommand(chatId, botCmd, queryResponse);
          });
        }
      }
    });
}

