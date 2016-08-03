"use strict";

var telegramBotToken = '';

var mma = require('mma');
var emoji_flags = require('emoji-flags');
var TelegramBot = require('node-telegram-bot-api');

var telegramBot = new TelegramBot(telegramBotToken, {polling: false});    

var isEmpty = function(obj) {
  if (Object.getOwnPropertyNames(obj).length === 0) return true;
  else return false;
}

var boldify = function(str) { return '*' + str + '*'; }

var ForceReplyOpts = {
  parse_mode: 'Markdown',
  reply_markup: JSON.stringify(
    {
      force_reply: true
    })
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
      res += 'KO: ' + winKo + '(' + ((winKo / winTotal) * 100).toPrecision(3) + '%)\n';
    if (winSub !== 0)
      res += 'SUB: ' + winSub + '(' + ((winSub / winTotal) * 100).toPrecision(3) + '%)\n';
    if (winDec !== 0)
      res += 'DEC: ' + winDec + '(' + ((winDec / winTotal) * 100).toPrecision(3) + '%)\n'
    if (winOther !== 0)
      res += 'OTHER: ' + winOther + '(' + ((winOther / winTotal) * 100).toPrecision(3) + '%)\n';
  }

  if (lossTotal !== 0) {
    res += boldify('LOSSES: ') + '\n';
    if (lossKo !== 0)
      res += 'KO: ' + lossKo + '(' + ((lossKo / lossTotal) * 100).toPrecision(3) + '%)\n';
    if (lossSub !== 0)
      res += 'SUB: ' + lossSub + '(' + ((lossSub / lossTotal) * 100).toPrecision(3) + '%)\n';
    if (lossDec !== 0)
      res += 'DEC: ' + lossDec + '(' + ((lossDec / lossTotal) * 100).toPrecision(3) + '%)\n'
    if (lossOther !== 0)
      res += 'OTHER: ' + lossOther + '(' + ((lossOther / lossTotal) * 100).toPrecision(3) + '%)\n';
  }

  return res;
}

var foundFighterResponse = function(resp) {
  var res = boldify(resp.name) + '\n';
  res += emoji_flags[resp.nationality].emoji + ' ' + resp.record + '\n';
  res += resp.height + ' ' + resp.weight + ' (' + resp.weight_class + ')\n';
  if (resp.nickname !== '') {
    res += '"' + resp.nickname + '"\n';
  }
  res += '\n';
  res += winLossQuickInfo(resp);
  /* COMING SOON
  res += '\n';
  res += 'More stats:\n'
  res += '/strikes\n';
  res += '/takedowns\n';
  */
  return res;
}

exports.handler = function(event, context, lambdaCallback) {
  var chatId = event.message.chat.id;
  var userName = event.message.from.username;

  // Query for Fighter
  
  var fighterQuery = event.message.text;
  telegramBot.sendMessage(chatId, "MmaStatBot querying for '" + fighterQuery + "'");

  var queryResponse;
  mma.fighter(fighterQuery, function(data) {
    queryResponse = data;
    var msgText = foundFighterResponse(queryResponse);

    var opts = ForceReplyOpts;
    telegramBot.sendMessage(chatId, msgText, opts)
      .then(function(sentMsg) {
        var sentMsgChatId = sentMsg.chat.id;
        var sentMsgMsgId = sentMsg.message_id;
        telegramBot.onReplyToMessage(sentMsgChatId, sentMsgMsgId, function(replyMsg) {
          telegramBot.sendMessage(chatId, "You replied " + replyMsg.text);
        });
      });
  });

}

