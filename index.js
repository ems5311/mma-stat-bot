"use strict";

var telegramBotToken = 'YOURKEYHERE';

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

var boldify = function(str) { return '*' + str + '*'; }

var MessageOpts = {
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
    var res = boldify(data.fullname) + ' _Striking_\n';
    res += strikes.successful + ' successful of ' + strikes.attempted + ' attempted ';
    res += getPercentage(strikes.successful, strikes.attempted) + '\n';
    res += 'Standing: ' + strikes.standing + ' ' + getPercentage(strikes.standing, strikes.successful) + '\n';
    res += 'Clinch: ' + strikes.clinch + ' ' + getPercentage(strikes.clinch, strikes.successful) + '\n';
    res += 'Ground: ' + strikes.ground + ' ' + getPercentage(strikes.ground, strikes.successful) + '\n';
    telegramBot.sendMessage(chatId, res, MessageOpts);
  } else if (command === BotCommand.Takedowns) {
    var takedowns = data.takedowns;
    var res = boldify(data.fullname) + ' _Takedowns_\n';
    res += takedowns.successful + ' successful of ' + takedowns.attempted + ' attempted ';
    res += getPercentage(takedowns.successful, takedowns.attempted) + '\n';
    res += 'Submissions: ' + takedowns.submissions + '\n';
    res += 'Passes: ' + takedowns.passes + '\n';
    res += 'Sweeps: ' + takedowns.sweeps + '\n';
    telegramBot.sendMessage(chatId, res, MessageOpts);
  } else if (command === BotCommand.Fights) {
    var res = boldify(data.fullname) + ' _Fights_\n';
    var charCount = 0;
    data.fights.forEach(function(currentValue, index, array) {
      var strJsonCurVal = JSON.stringify(currentValue) + '\n';
      res += strJsonCurVal;
      charCount += strJsonCurVal.length;
    });
    for (var i = 0; i < charCount / 4096; i++) {
      telegramBot.sendMessage(chatId, res.substr((i * charCount), 4096), MessageOpts);
    }
  } else {
    // Print 'couldn't read your command'
    return new Error('Couldn\'t run command');
  }
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

