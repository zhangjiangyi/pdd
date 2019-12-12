process.on('uncaughtException', function (err) { console.log(err) });
const Koa = require('koa');
const app = new Koa();
const db = require('better-sqlite3')('config.db');
const devices = require('puppeteer/DeviceDescriptors');
const puppeteer = require('puppeteer');
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

var running = true;

function rand(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

db.prepare('create table if not exists tokens (token text unique, used numeric)').run();

async function waitForClose(page) {
	return new Promise((resolve, reject) => {
		page.on('close', () => { resolve(); });
	});
}

async function spider(token) {
	var args = ['--no-sandbox'];
	var browser;
	try {
		browser = await puppeteer.launch({
			headless: false,
			ignoreDefaultArgs: ["--enable-automation"],
			args: args
		});
		const page = await browser.newPage();
		await page.emulate(devices['iPhone 7']);
		await page.setUserAgent('alipay'); // UA填这里面
		await page.goto('https://mobile.yangkeduo.com/');
		await page.setCookie({ name: 'PDDAccessToken', value: token });
		await waitForClose(page);
	} catch (e) {
		console.log('浏览器运行错误！');
	}
}

function getToken() {
	var token = db.prepare('select token from tokens where used = 1').get();
	if (token) {
		token = token.token;
		db.prepare('update tokens set used = 1 where token = ?').run(token);
	}
	return token;
}

async function startBrowser() {
	running = true;
	while (true) {
		var token = getToken();
		if (!token) {
			running = false;
			return;
		}
		await spider(token);
	}
};

app.use(require('koa-static')(__dirname + '/files'));

app.use((ctx) => {
	switch (ctx.path) {
		case '/delToken':
			var tokens = ctx.query.tokens;
			if (tokens) {
				tokens = JSON.parse(tokens);
				const stmtd = db.prepare('delete from tokens where token = ?');
				for (var i = 0; i < tokens.length; i++)
					stmtd.run(tokens[i]);
				ctx.body = 'ok';
			} else ctx.body = 'no';
			break;
		case '/addToken':
			var tokens = ctx.query.tokens;
			if (tokens) {
				tokens = JSON.parse(tokens);
				const stmti = db.prepare('insert or replace into tokens (token, used) values (?, 0)');
				for (var i = 0; i < tokens.length; i++) {
					if (tokens[i]) {
						stmti.run(tokens[i]);
						if (!running) {
							running = true;
							startBrowser();
						}
					}
				}
				ctx.body = 'ok';
			} else ctx.body = 'no';
			break;
		case '/showToken':
			ctx.body = db.prepare('select * from tokens').all();
			break;
	}
});

app.listen(8888, () => {
	console.log('服务已启动。');
	startBrowser();
});