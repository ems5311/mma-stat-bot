"use strict";

var telegramBotToken = require('./bot-token-def');

var mma = require('mma');
var AWS = require('aws-sdk');
var dynamoDb = new AWS.DynamoDB();
var TelegramBot = require('node-telegram-bot-api');

var telegramBot = new TelegramBot(telegramBotToken.token, {polling: false});    
var tableName = 'MmaBotTable';

var IsEmpty = function(obj) {
  if (Object.getOwnPropertyNames(obj).length === 0) return true;
  else return false;
}

exports.handler = function(event, context, lambdaCallback) {
  var chatId = event.message.chat.id;
  var userName = event.message.from.username;

  // Find out if this user has an existing record in the DB:
  dynamoDb.getItem({
      'TableName': tableName,
      'Key': {
        'User': {
          'S': userName
        }
      },
      'ProjectionExpression': 'Fighter'
    }, function(err, data) {
      if (err) {
        context.fail('ERROR: Get from Dynamo failed: ' + err);
      } else {
        if (IsEmpty(data)) {
          telegramBot.sendMessage(chatId, 'You are a new user');

          // --- NEW USER ---
          // Query for Fighter
          
          var fighterQuery = event.message.text;
          telegramBot.sendMessage(chatId, "MmaStatBot querying for '" + fighterQuery + "'");

          var queryResponse;
          mma.fighter(fighterQuery, function(data) {
            queryResponse = data;
            telegramBot.sendMessage(chatId, "Fighter " + queryResponse.name + " has " + queryResponse.wins.total + " wins.");

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
              }, function(err, data) {
                if (err) {
                  context.fail('ERROR: Put to Dynamo failed: ' + err);
                } else {
                  telegramBot.sendMessage(chatId, 'Put to Dynamo Success' + JSON.stringify(data, null, '  '));
                }
              });

            });
        } else {
          telegramBot.sendMessage(chatId, 'User found! ' + JSON.stringify(data, null, ' '));
        }
      }
    });
  

};

