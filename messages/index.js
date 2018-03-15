var builder = require('botbuilder');
require('dotenv').config();
var botbuilder_azure = require('botbuilder-azure');
var lifx = require('lifx-http-api'),
  lifxClient;

lifxClient = new lifx({
  bearerToken: process.env['LifxApiKey']
});

var connector = new botbuilder_azure.BotServiceConnector({
  appId: process.env['MicrosoftAppId'],
  appPassword: process.env['MicrosoftAppPassword']
  // openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector, {
  storage: new builder.MemoryBotStorage()
});

let luisModelUrl = `https://${process.env['LuisAPIHostName']}/luis/v2.0/apps/${
  process.env['LuisAppId']
}?subscription-key=${process.env['LuisAPIKey']}`;

// Main dialog with LUIS
const recognizer = new builder.LuisRecognizer(luisModelUrl);
const intents = new builder.IntentDialog({ recognizers: [recognizer] })
  .matches('Greeting', session => {
    session.send('Sup, yo!');
  })
  .matches('Thank You', session => {
    session.send('No problem! Glad I could help.');
  })
  .matches('Help', session => {
    session.send(
      'I can control the lights in your house. You can say things like, "Turn the kitchen lights on".'
    );
  })
  .matches('Cancel', session => {
    session.send('OK. Canceled.');
    session.endDialog();
  })
  .matches('Lights', (session, args) => {
    session.send('OK! One sec...');

    let lightState;
    let location = builder.EntityRecognizer.findEntity(args.entities, 'Light');
    location = { entity: 'Your home office' }; //TODO: this is madness!
    let color = builder.EntityRecognizer.findEntity(args.entities, 'Color');

    // if (!color) {
    lightState = builder.EntityRecognizer.findEntity(args.entities, 'State'); //TODO - case sensitive. make it cry
    // } else {
    //   lightState = {
    //     entity: 'on',
    //     type: 'state',
    //     startIndex: 0,
    //     endIndex: 1,
    //     score: 100
    //   };
    // }

    // got both location and light state, move on to the next step
    console.log('************************');
    console.log(location);
    console.log(lightState);
    console.log(color);
    console.log('************************');

    if (location && (lightState || color)) {
      // we call LIFX
      lightState = lightState || {
        entity: 'on',
        type: 'state',
        startIndex: 0,
        endIndex: 1,
        score: 100
      };

      controlLights(
        session,
        location.entity,
        lightState.entity,
        color && color.entity
      );
      // controlLights(session, location.entity, lightState.entity);
    }

    // got a location, but no light state
    if (!location || !lightState) {
      session.send(
        `I need to know which light and if you want it on or off. You can say things like, "Turn on/off the light".`
      );
    }
  })
  .onDefault((session, args) => {
    console.log(args);
    session.send("Sorry, I did not understand '%s'.", session.message.text);
  });

bot.dialog('/', intents);

function controlLights(session, location, lightState, color) {
  let message = `The ${location} was turned ${lightState}`;
  let stateToSet = {
    power: `${lightState}`,
    brightness: 1.0,
    duration: 1
  };
  if (color) {
    stateToSet.color = `${color} saturation:1.0`;
    message += ` and was set to ${color}`;
  }

  // TODO: use your light name here
  lifxClient
    .setState('group:Dads Office', stateToSet)
    .then(result => {
      session.send(message);
      session.endDialog();
    })
    .catch(console.error);
}

module.exports = connector.listen();
