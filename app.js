var http = require('http'),
    express = require('express'),
    app = express(),
    xml2js = require('xml2js'),
    mysql = require('mysql'),
    crypto = require('crypto'),
    async=require('async')  ,
    /*公众号的secretKey*/
    secretKey = "d932969d2749e1bbfc1618509ae65813";


var pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'password',
    database: 'database'
});

app.set('port', process.env.PORT || 8888);

// app.use(express.bodyParser());

//处理请求的body
app.use(function(req, res, next) {
    req.rawBody = '';
    req.setEncoding('utf8');

    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });

    req.on('end', function() {
        next();
    });
});

//负责业务处理
app.all('/talk', function(req, res) {
    try {


        console.log(req.rawBody);
        if (!checkSignature(req)) {
            responseMessage(res, "请求参数不正确，只允许合法服务器的回调。", 400);
            return;
        }


        if (!req.rawBody.length) {
            responseMessage(res, "错误请求。", 400);
            return
        }
        //解析请求的xml
        var parser = new xml2js.Parser({
            rootName: "xml"
        });
        parser.parseString(req.rawBody, function(err, result) {
            var xmlRoot = result.xml;
            var requestBody = {};
            requestBody.fromUserName = xmlRoot.FromUserName[0];
            var type = requestBody.msgType = xmlRoot.MsgType[0];
            var ssoKeyValue = requestBody.ssoValue = xmlRoot.SSOKeyValue[0];
            if (type == "text") {
                var content = requestBody.Content = xmlRoot.Content[0];
                pool.getConnection(function(err, connection) {
                    if (err) throw err;
                    var message = "没查到对应的用户信息。",
                        networId=-1;
                    async.series([
                    function(callback){
                        connection.query('select a.network_id from accounts a where a.email=?',[ssoKeyValue],function(err,results){
                            networId=results[0].network_id;
                            callback();
                        })
                    },
                    function(callback) { // Use the connection
                        connection.query('select a.email,i.preferred_mobile,i.cellvoice1 ,i.emp_code from accounts a,users u,user_infos i where a.id=u.account_id and u.id=i.user_id and (u.name=? or i.cellvoice1=?) and u.hidden=0 and a.network_id=?', [content, content,networId], function(err, results) {
                            if (err) throw err;
                            var user = results[0];
                            
                            if (user) {
                                message = "名字：" + user.name + "<br>"
                                message = "邮箱：" + user.email + "<br>"
                                message += "手机：" + user.cellvoice1 + "<br>"
                                message += "短号：" + user.preferred_mobile
                            }

                            callback();
                        });
                    },
                    function(callback) {
                        // Don't use the connection here, it has been returned to the pool.
                        connection.release();
                        responseMessage(res, message);
                    }]);


                });
            } else {
                //  event
                var code = xmlRoot.EventKey[0],
                    message = "";

                switch (code) {
                    case '01':
                        message = "请发送您想要查询的对方的姓名或手机号";
                        responseMessage(res, message);
                        break;
                    case '02':
                        pool.getConnection(function(err, connection) {
                            // Use the connection
                            connection.query('select count(*) as num from departments where network_id=3', [], function(err, results) {
                                if (err) throw err;
                                message = "公司总共有" + results[0].num + "个部门";
                                connection.release();
                                responseMessage(res, message);
                            })
                        });
                        break;
                    case '03':
                        pool.getConnection(function(err, connection) {
                            // Use the connection
                            connection.query('select count(*) as num from accounts where network_id=3', [], function(err, results) {
                                if (err) throw err;
                                message = "公司总共有" + results[0].num + "位员工";
                                connection.release();
                                responseMessage(res, message);
                            })
                        });
                        break;
                    default:
                        message = "我不明白你说的什么啊。";
                        responseMessage(res, message);
                        break;
                }
            }


        });


    } catch (e) {
        console.error(e);
        responseMessage(res, "服务器异常，请联系管理员。", 500);
    }

});

http.createServer(app).listen(app.get('port'), function() {
    console.log('listen to ' + app.get('port'));
});

/*校验签名是否合法*/
var checkSignature = function(req) {
    var headers = req.headers;
    var token = headers.token,
        timestamp = headers.timestamp,
        nonce = headers.nonce;
    if (!token) return false;
    openId = token.split(":")[0];
    var str = timestamp + nonce;
    checkToken = openId + ":" + crypto.createHmac('sha1', secretKey).update(str).digest("base64");
    console.log(token);
    console.log(checkToken);
    return token == checkToken;
}
/*返回敏行服务器消息*/
var responseMessage = function(res, message, code) {
    // var result = {};
    // result.ToUserName = requestBody.fromUserName
    // result.CreateTime = new Date().getTime()
    // result.MessageType = "text"
    // result.Content = message
    // var builder = new xml2js.Builder({
    //     rootName: "xml"
    // });
    // var resultXml = builder.buildObject(result);
    res.writeHead((code || 200), {
        'Content-Type': 'text/html;charset=utf-8'
    });
    res.end(message);
}

process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log(err);
});