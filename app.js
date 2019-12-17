process.on('uncaughtException', function (err) { console.log(err) });
const Koa = require('koa');
const app = new Koa();
const userDB = require('better-sqlite3')('config.db');
const uaDB = require('better-sqlite3')('ua.db');
const devices = require('puppeteer/DeviceDescriptors');
const puppeteer = require('puppeteer');
const ipControl = require('./ipcontrol');
process.on('exit', () => userDB.close() && uaDB.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

var running = true;

function rand(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

userDB.prepare('create table if not exists tokens (token text unique, ua text, used numeric)').run();
uaDB.prepare('create table if not exists ua (ua text unique, times numeric)').run();

async function waitForClose(page) {
	return new Promise((resolve, reject) => {
		page.on('close', () => { resolve(); });
	});
}

async function spider(user) {
	let ip = await controlIp(user);
	var args = [
		'--no-sandbox'
		, `--proxy-server=${ip}`		// 设置代理
	];
	var browser;
	try {
		browser = await puppeteer.launch({
			headless: false,
			ignoreDefaultArgs: ["--enable-automation"],
			args: args
		});
		const page = await browser.newPage();
		addInterception(page, browser);
		await page.emulate(devices['iPhone 7']);
		await page.setUserAgent(user.ua); // UA填这里面
		await page.goto('https://mobile.yangkeduo.com/');
		await page.setCookie({ name: 'PDDAccessToken', value: user.token });
		await waitForClose(page);
	} catch (e) {
		console.log('浏览器运行错误！');
	}
}

async function controlIp(user) {
	let ips = await ipControl.getProxyList();
	return ips[0]
}

function getUA() {
	return uaDB.prepare('SELECT * FROM ua ORDER BY RANDOM() limit 1').get();
}

function addInterception(page, browser) {
	// 启用请求拦截
	page.setRequestInterception(true);
	//监听请求事件
	page.on('request', (req) => {
		// console.log('拦截的headers-------------------------------------' + JSON.stringify(req.headers()));
		req.continue();
	})
}

function getToken() {
	var token = userDB.prepare('select token from tokens where used = 0').get();
	if (token) {
		token = token.token;
		userDB.prepare('update tokens set used = 1 where token = ?').run(token);
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

app.use(async (ctx) => {
	switch (ctx.path) {
		case '/delToken':
			var tokens = ctx.query.tokens;
			if (tokens) {
				tokens = JSON.parse(tokens);
				const stmtd = userDB.prepare('delete from tokens where token = ?');
				for (var i = 0; i < tokens.length; i++)
					stmtd.run(tokens[i]);
				ctx.body = 'ok';
			} else ctx.body = 'no';
			break;
		case '/addToken':
			var tokens = ctx.query.tokens;
			if (tokens) {
				tokens = JSON.parse(tokens);
				const stmti = userDB.prepare('insert or replace into tokens (token, ua, used) values (?, ?, 0)');
				for (var i = 0; i < tokens.length; i++) {
					if (tokens[i]) {
						let ua = getUA();
						stmti.run(tokens[i], ua.ua);
					}
				}
				ctx.body = 'ok';
			} else ctx.body = 'no';
			break;
		case '/openPage':
			var users = JSON.parse(ctx.query.users || []);
			if (users) {
				users.forEach(user => spider(user));
			}
			ctx.body = 'ok';
			break;
		case '/showToken':
			ctx.body = userDB.prepare('select * from tokens').all();
			break;

		// ua处理 最好跟token一起搞成一个通用组件（增删改查）
		case '/showUA':
			ctx.body = uaDB.prepare('select * from ua').all();
			break;
		case '/addUA':
			var uas = ctx.query.uas;
			uas = JSON.parse(uas);
			const stmti = uaDB.prepare('insert or replace into ua (ua) values (?)');
			for (var i = 0; i < uas.length; i++) {
				if (uas[i]) {
					stmti.run(uas[i]);
				}
			}
			ctx.body = 'ok';
			break;
		case '/delUA':
			var uas = ctx.query.uas;
			if (uas) {
				uas = JSON.parse(uas);
				const stmtd = uaDB.prepare('delete from ua where ua = ?');
				for (var i = 0; i < uas.length; i++)
					stmtd.run(uas[i]);
				ctx.body = 'ok';
			} else ctx.body = 'no';
			break;
			break;
	}
});

app.listen(8888, () => {
	console.log('服务已启动。');
	// startBrowser();
});