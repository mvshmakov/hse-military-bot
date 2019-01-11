const config = {
  node_env: process.env.NODE_ENV,
  heroku_url: process.env.HEROKU_URL || '',
  firebase_users_url: process.env.FIREBASE_USERS_URL || '',
  firebase_users_project_id: process.env.FIREBASE_USERS_PROJECT_ID || '',
  firebase_users_client_email: process.env.FIREBASE_USERS_CLIENT_EMAIL || '',
  firebase_users_private_key: process.env.FIREBASE_USERS_PRIVATE_KEY || '',
  metrika_token: process.env.METRIKA_TOKEN || '',
  port: process.env.PORT || 3000,
  token: process.env.TOKEN || '',
  std_num_of_articles: 5,
};

const Telegraf = require('telegraf');

const bot = new Telegraf(config.token, { username: 'hse_military_bot' });

const Stage = require('telegraf/stage');

const { enter } = Stage;
const stage = new Stage();

const GoogleNewsRss = require('google-news-rss');

const googleNews = new GoogleNewsRss();

const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const Scene = require('telegraf/scenes/base');
const session = require('telegraf/session');

const Firebase = require('firebase-admin');

const firebaseUsers = Firebase.initializeApp({
  credential: Firebase.credential.cert({
    projectId: config.firebase_users_project_id,
    clientEmail: config.firebase_users_client_email,
    privateKey: config.firebase_users_private_key.replace(/\\n/g, '\n'),
  }),
  databaseURL: config.firebase_users_url,
});

const botan = require('botanio')(config.metrika_token);

const Schedule = require('./schedule');

const newsTopics = ['ВКС', 'Разведка', 'РВСН', 'Внутренняя политика', 'Внешняя политика', 'Военные технологии'];

const platoonTypes = ['Офицеры РВСН', 'Офицеры разведки', 'Офицеры ВКС', 'Сержанты МСВ', 'Солдаты разведки'];
const platoons = [
  ['1601', '1701', '1702', '1811', '1812'],
  ['1602', '1603', '1604', '1703', '1704', '1705', '1801', '1802', '1803'],
  ['1605', '1606', '1706', '1707', '1708', '1807', '1808', '1809', '1810'],
  ['1607', '1608', '1609', '1610', '1709', '1710', '1711', '1712', '1804', '1805', '1806'],
  ['1616', '1617', '1618', '1713'],
];
const dates = [
  ['9 января', '16 января', '23 января', '30 января', '6 февраля', '13 февраля', '20 февраля', '27 февраля', '6 марта', '13 марта', '20 марта', '27 марта', '3 апреля', '10 апреля', '17 апреля', '24 апреля', '1 мая'],
  ['10 января', '17 января', '24 января', '31 января', '7 февраля', '14 февраля', '21 февраля', '28 февраля', '7 марта', '14 марта', '21 марта', '28 марта', '4 апреля', '11 апреля', '18 апреля', '25 апреля', '2 мая'],
  ['11 января', '18 января', '25 января', '1 февраля', '8 февраля', '15 февраля', '22 февраля', '1 марта', '8 марта', '15 марта', '22 марта', '29 марта', '5 апреля', '12 апреля', '19 апреля', '26 апреля', '3 мая', '7 мая', '17 мая'],
];
const menuButtons = {
  scheduleDefault: 'Расписание для своего взвода',
  schedule: 'Общее расписание',
  news: 'Информирование',
  stickers: 'Стикерпак',
  settings: 'Настройки',
};
const menuControls = {
  back: 'Назад',
  menu: 'В меню',
};
const settings = {
  defaultPlatoon: 'Выбрать свой взвод',
};

/* Helpers */

const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function getFormattedDate(dateObj) {
  return `${dateObj.getDate()} ${
  	months[dateObj.getMonth()]} ${
    dateObj.getFullYear()}, ${
    dateObj.getHours()}:${
    dateObj.getMinutes().toString().length === 1 ? `0${dateObj.getMinutes()}` : dateObj.getMinutes()}`;
}

function isValueInObject(obj, value) {
  for (key in obj) {
    if (obj[key] === value) {
      return true;
    }
  }
  return false;
}

function isValueInArray(arr, value) {
  if (arr.indexOf(value) !== -1) {
    return true;
  }
  return false;
}

function getTypeFromPlatoon(platoon) {
  let platoonType = null;

  platoons.some((item) => {
    const isInArr = item.indexOf(platoon);
    if (isInArr != -1) {
      platoonType = platoonTypes[isInArr + 1];
    }
  });

  return platoonType;
}

async function getNewsArticles(topic) {
  const articlesFinal = [];
  const numOfArticles = config.std_num_of_articles;

  const articles = await googleNews.search(`${topic} РФ`, numOfArticles, 'ru');

  for (let i = 0; i < numOfArticles; i++) {
    const dateObj = new Date(articles[i].pubDate);
    articlesFinal.push(`${articles[i].title}\n\n${articles[i].link}\n\n${getFormattedDate(dateObj)}`);
  }

  return articlesFinal;
}

async function writeUserSelection(chatId, field, value) {
  try {
    await firebaseUsers.database().ref(`/users/${chatId}/${field}`).set(value);
  } catch (err) {
    return null;
  }
}

async function readUserSelection(chatId, field) {
  try {
    return await firebaseUsers.database().ref(`/users/${chatId}`).once('value').then(data => platoonFinal = data.val()[field]);
  } catch (err) {
    return null;
  }
}

/* Menu scene */

const menuScene = new Scene('menu');
menuScene.enter(async (ctx) => {
  const defaultPlatoon = await readUserSelection(ctx.from.id, 'defaultPlatoon');

  return ctx.reply('Выберите нужный пункт меню', Extra.markup(markup => markup.resize()
    .keyboard(Object.keys(menuButtons).filter((key) => {
      if (!defaultPlatoon && key == 'scheduleDefault') {

      } else {
        return menuButtons[key];
      }
    }).map(key => [menuButtons[key]]))));
});
menuScene.command('menu', ctx => ctx.scene.enter('menu'));
menuScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
menuScene.hears(menuButtons.scheduleDefault, enter('scheduleDefaultDate'));
menuScene.hears(menuButtons.schedule, enter('scheduleType'));
menuScene.hears(menuButtons.news, enter('news'));
menuScene.hears(menuButtons.stickers, (ctx) => {
  ctx.replyWithSticker('CAADAgADGQADuoh2BvDmu8LdojQmAg', Markup.inlineKeyboard([
    Markup.urlButton('Полный стикерпак', 'https://t.me/addstickers/HseArmy', false),
  ]).extra());
});
menuScene.hears(menuButtons.settings, enter('settings'));
stage.register(menuScene);

/* Settings scene */

const settingsScene = new Scene('settings');
settingsScene.enter((ctx) => {
  const settingsArray = Object.keys(settings).map(key => settings[key]);

  return ctx.reply('Выберите нужный пункт настроек', Extra.markup(markup => markup.resize()
    .keyboard(Object.keys(settings).map(key => settings[key]).concat(menuControls.menu))));
});
settingsScene.command('menu', ctx => ctx.scene.enter('menu'));
settingsScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
settingsScene.hears(menuControls.menu, enter('menu'));
settingsScene.hears(settings.defaultPlatoon, enter('settingsType'));
settingsScene.on('message', (ctx) => {
  ctx.reply('Выберите существующую настройку, или вернитесь в меню');
});
stage.register(settingsScene);

/* SettingsType scene */

const settingsTypeScene = new Scene('settingsType');
settingsTypeScene.enter(ctx => ctx.reply('Выберите цикл', Extra.markup(markup => markup.resize()
  .keyboard(platoonTypes.concat(menuControls.menu)))));
settingsTypeScene.command('menu', ctx => ctx.scene.enter('menu'));
settingsTypeScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
settingsTypeScene.hears(menuControls.menu, enter('menu'));
settingsTypeScene.on('message', async (ctx) => {
  if (isValueInArray(platoonTypes, ctx.message.text)) {
    await writeUserSelection(ctx.from.id, 'platoonType', ctx.message.text).then(() => {
      botan.track(ctx, `Цикл из настроек: ${ctx.message.text}`);

      return ctx.scene.enter('settingsPlatoon');
    });
  } else {
    ctx.reply('Выберите существующий цикл, или вернитесь в меню');
  }
});
stage.register(settingsTypeScene);

/* SettingsPlatoon scene */

const settingsPlatoonScene = new Scene('settingsPlatoon');
settingsPlatoonScene.enter(ctx => ctx.reply('Выберите нужный взвод', Extra.markup(markup => markup.resize()
  .keyboard(platoons[platoonTypes.indexOf(ctx.message.text)].concat(menuControls.menu)))));
settingsPlatoonScene.command('menu', ctx => ctx.scene.enter('menu'));
settingsPlatoonScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
settingsPlatoonScene.hears(menuControls.menu, enter('menu'));
settingsPlatoonScene.on('message', async (ctx) => {
  const platoonType = await readUserSelection(ctx.from.id, 'platoonType');

  if (isValueInArray(platoons[platoonTypes.indexOf(platoonType)], ctx.message.text)) {
    await writeUserSelection(ctx.from.id, 'defaultPlatoon', ctx.message.text).then(() => {
      botan.track(ctx, `Взвод из настроек: ${ctx.message.text}`);

      return ctx.reply('Настройки сохранены').then(() => {
        ctx.scene.enter('menu');
      });
    });
  } else {
    ctx.reply('Выберите существующий взвод, или вернитесь в меню');
  }
});
stage.register(settingsPlatoonScene);

/* ScheduleType scene */

const scheduleTypeScene = new Scene('scheduleType');
scheduleTypeScene.enter(ctx => ctx.reply('Выберите цикл', Extra.markup(markup => markup.resize()
  .keyboard(platoonTypes.concat(menuControls.menu)))));
scheduleTypeScene.command('menu', ctx => ctx.scene.enter('menu'));
scheduleTypeScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
scheduleTypeScene.hears(menuControls.menu, enter('menu'));
scheduleTypeScene.on('message', async (ctx) => {
  if (isValueInArray(platoonTypes, ctx.message.text)) {
    await writeUserSelection(ctx.from.id, 'platoonType', ctx.message.text).then(() => {
      botan.track(ctx, `Цикл: ${ctx.message.text}`);

      return ctx.scene.enter('schedulePlatoon');
    });
  } else {
    ctx.reply('Выберите существующий цикл, или вернитесь в меню');
  }
});
stage.register(scheduleTypeScene);

/* SchedulePlatoon scene */

const schedulePlatoonScene = new Scene('schedulePlatoon');
schedulePlatoonScene.enter(async ctx => ctx.reply('Выберите взвод', Extra.markup(markup => markup.resize()
  .keyboard(platoons[platoonTypes.indexOf(ctx.message.text)].concat(menuControls.menu)))));
schedulePlatoonScene.command('menu', ctx => ctx.scene.enter('menu'));
schedulePlatoonScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
schedulePlatoonScene.hears(menuControls.menu, enter('menu'));
schedulePlatoonScene.on('message', async (ctx) => {
  const platoonType = await readUserSelection(ctx.from.id, 'platoonType');

  if (isValueInArray(platoons[platoonTypes.indexOf(platoonType)], ctx.message.text)) {
    await writeUserSelection(ctx.from.id, 'platoon', ctx.message.text).then(() => {
      botan.track(ctx, `Взвод: ${ctx.message.text}`);

      return ctx.scene.enter('scheduleDate');
    });
  } else {
    ctx.reply('Выберите существующий взвод, или вернитесь в меню');
  }
});
stage.register(schedulePlatoonScene);

/* ScheduleDate scene */

const scheduleDateScene = new Scene('scheduleDate');
scheduleDateScene.enter(async (ctx) => {
  const platoon = await readUserSelection(ctx.from.id, 'platoon');
  return ctx.reply('Выберите дату', Extra.markup((markup) => {
    const year = platoon.split('')[0] + platoon.split('')[1];
    const key = () => {
      if (year == 17) { return 0; } else if (year == 18) { return 1; } else if (year == 16) { return 2; }
    };
    return markup.resize()
      .keyboard(dates[key()].concat(menuControls.menu));
  }));
});
scheduleDateScene.command('menu', ctx => ctx.scene.enter('menu'));
scheduleDateScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
scheduleDateScene.hears(menuControls.menu, enter('menu'));
scheduleDateScene.on('message', async (ctx) => {
  const platoon = await readUserSelection(ctx.from.id, 'platoon');
  const year = platoon.split('')[0] + platoon.split('')[1];
  const key = () => {
    if (year == 17) { return 0; } else if (year == 18) { return 1; } else if (year == 16) { return 2; }
  };

  if (!isValueInArray(dates[key()], ctx.message.text)) {
    return ctx.reply('Выберите существующую дату, или вернитесь в меню');
  }

  await Schedule(platoon, ctx.message.text).then(async (schedule) => {
    let scheduleStringified = null;
    schedule.forEach(async (item) => {
      if (!item.meta) {
        // str.replace(/ {1,}/g," ") for removing long spaces
        if (!scheduleStringified) {
          scheduleStringified = `${item.time.replace(/\r\n/g, ' ')} - ${item.lesson.replace(/\r\n/g, ' ')}\n`;
        } else {
          scheduleStringified += `${item.time.replace(/\r\n/g, ' ')} - ${item.lesson.replace(/\r\n/g, ' ')}\n`;
        }
      } else {
        scheduleStringified = `${item.meta}\n\n`;
      }
    });
    return ctx.reply(scheduleStringified);
  }).then(() => ctx.scene.enter('menu'));
});
stage.register(scheduleDateScene);

/* ScheduleDefaultDate scene */

const scheduleDefaultDateScene = new Scene('scheduleDefaultDate');
scheduleDefaultDateScene.enter(async (ctx) => {
  const platoon = await readUserSelection(ctx.from.id, 'defaultPlatoon');

  return ctx.reply(`Ваш взвод: ${platoon}`).then(() => {
    botan.track(ctx, `Цикл: ${getTypeFromPlatoon(platoon)}`);
    botan.track(ctx, `Взвод: ${platoon}`);

    ctx.reply('Выберите дату', Extra.markup((markup) => {
      const year = platoon.split('')[0] + platoon.split('')[1];
      const key = () => {
        if (year == 17) { return 0; } else if (year == 18) { return 1; } else if (year == 16) { return 2; }
      };
      return markup.resize()
        .keyboard(dates[key()].concat(menuControls.menu));
    }));
  });
});
scheduleDefaultDateScene.command('menu', ctx => ctx.scene.enter('menu'));
scheduleDefaultDateScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
scheduleDefaultDateScene.hears(menuControls.menu, enter('menu'));
scheduleDefaultDateScene.on('message', async (ctx) => {
  const platoon = await readUserSelection(ctx.from.id, 'defaultPlatoon');
  const year = platoon.split('')[0] + platoon.split('')[1];
  const key = () => {
    if (year == 17) { return 0; } else if (year == 18) { return 1; } else if (year == 16) { return 2; }
  };

  if (!isValueInArray(dates[key()], ctx.message.text)) {
    return ctx.reply('Выберите существующую дату, или вернитесь в меню');
  }

  await Schedule(platoon, ctx.message.text).then(async (schedule) => {
    let scheduleStringified = null;
    schedule.forEach(async (item) => {
      if (!item.meta) {
        // str.replace(/ {1,}/g," ") for removing long spaces
        if (!scheduleStringified) {
          scheduleStringified = `${item.time.replace(/\r\n/g, ' ')} - ${item.lesson.replace(/\r\n/g, ' ')}\n`;
        } else {
          scheduleStringified += `${item.time.replace(/\r\n/g, ' ')} - ${item.lesson.replace(/\r\n/g, ' ')}\n`;
        }
      } else {
        scheduleStringified = `${item.meta}\n\n`;
      }
    });
    return ctx.reply(scheduleStringified);
  }).then(() => ctx.scene.enter('menu'));
});
stage.register(scheduleDefaultDateScene);

/* News scene */

const newsScene = new Scene('news');
newsScene.enter(ctx => ctx.reply('Выберите тему для проведения информирования', Extra.markup(markup => markup.resize()
  .keyboard(newsTopics.concat(menuControls.menu)))));
newsScene.command('menu', ctx => ctx.scene.enter('menu'));
newsScene.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
newsScene.hears(menuControls.menu, enter('menu'));
newsScene.on('message', async (ctx) => {
  if (isValueInArray(newsTopics, ctx.message.text)) {
    botan.track(ctx, `Тема для информирования: ${ctx.message.text}`);

    const articles = await getNewsArticles(ctx.message.text);
    articles.forEach((article) => {
      ctx.reply(article);
    });
  } else {
    ctx.reply('Выберите существующую тему, или вернитесь в меню');
  }
});
stage.register(newsScene);

/* Main listeners */

bot.use(session());
bot.use(stage.middleware());

bot.command('menu', ctx => ctx.scene.enter('menu'));
bot.command('help', ctx => ctx.reply('Навигация в боте производится с помощью меню.'));
bot.hears(menuButtons.scheduleDefault, enter('scheduleDefaultDate'));
bot.hears(menuButtons.schedule, enter('scheduleType'));
bot.hears(menuButtons.news, enter('news'));
bot.hears(menuButtons.stickers, (ctx) => {
  ctx.replyWithSticker('CAADAgADGQADuoh2BvDmu8LdojQmAg', Markup.inlineKeyboard([
    Markup.urlButton('Полный стикерпак', 'https://t.me/addstickers/HseArmy', false),
  ]).extra());
});
bot.hears(menuButtons.settings, enter('settings'));
bot.on('message', enter('menu'));

module.exports = bot;
