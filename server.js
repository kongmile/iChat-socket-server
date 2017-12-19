/**
 * Created by smile on 2017/12/18.
 */
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var jwt = require('jsonwebtoken');
var redis = require('redis');
var client = redis.createClient();
var sub = redis.createClient();
// 页面
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});
var socketMap = { };
var idMap = { };
io.on('connection', function(socket){
    console.log('a user connected: ' + socket.id + ' addr: ' + socket.handshake.address);
    socket.emit('online', "You are online");
    // 用户验证
    socket.on('token', function(token) {
        jwt.verify(token, 'zih6QGYi841Vqsc0FFLNsnUDzsHsSUaX', function(err, decoded){
            if(err) {
                socket.emit('authenticate failed');
            } else {
                online(decoded);
            }
        });
    });
    // 连接断开
    socket.on('disconnect', function(){
        console.log('user disconnected');
        offline();
    });
    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
    });
    // 上线记录
    function online(decoded) {
        console.log(decoded.sub)
        if(socketMap.hasOwnProperty(decoded.sub)) {
            socketMap[decoded.sub].emit('login on other client');
        }
        socketMap[decoded.sub] = socket;
        idMap[socket.id] = decoded.sub;
        client.set('isOnline:' + decoded.sub, 1);
    }
    // 下线记录
    function offline() {
        client.del('isOnline:' + idMap[socket.id]);
        delete idMap[socket.id];
        delete socketMap[idMap[socket.id]];
    }
});

sub.psubscribe('chat.user.*');
sub.on('psubscribe', function(channel, count) {
    console.log('subscribing ' + count + ' channel: ' + channel);
});
sub.on('pmessage', function(pattern, channel, message) {
    console.log(channel + ':' + message);
    var data = JSON.parse(message);
    var to = channel.replace('chat.user.', '');
    client.get('isOnline:' + to, function (err, reply) {
        if(reply) {
            var event = data.event.replace('App\\Events\\', '');
            socketMap[to].emit(event, data.data);
        }
    })
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});

