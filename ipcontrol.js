var request = require("request");
// var iconv = require('iconv-lite');
var Promise = require("bluebird");

function getProxyList() {
    let num = 1;        // 提取数量
    let pack = 77211;   // 套餐id
    let type = 2;       // 数据格式：1:TXT 2:JSON 3:html
    let yys = 0;        // 0:不限 100026:联通 100017:电信
    let port = 11;      // IP协议 1:HTTP 2:SOCK5 11:HTTPS
    let ts = 1;	        // 是否显示IP过期时间: 1显示 2不显示
    let mr = 1;	        // 去重选择（1:360天去重 2:单日去重 3:不去重）
    let apiURL = `http://http.tiqu.alicdns.com/getip3?num=${num}&type=${type}&yys=${yys}&port=${port}&pack=${pack}&ts=${ts}&mr=${mr}`;

    return new Promise((resolve, reject) => {
        var options = {
            method: 'GET',
            url: apiURL
            // gzip: true,
            // encoding: null,
            // headers: {
            //     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            //     'Accept-Encoding': 'gzip, deflate',
            //     'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
            //     'User-Agent': 'Mozilla/8.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36'
            // },
        };

        request(options, function (error, response, body) {
            try {
                if (error) throw error;
                let bodyObj = JSON.parse(body);
                let ips = bodyObj.data.map(data => data.ip + ':' + data.port);
                resolve(ips);
            } catch (e) {
                return reject(e);
            }
        });
    })
}

module.exports = {
    getProxyList
}