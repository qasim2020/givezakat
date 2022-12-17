console.log("ZAKATLISTS started");

const {app, http} = require('./app');
const reload = require('reload');

var port = process.env.PORT || 3000;


app.set('port', process.env.PORT || 3000);
var server = http.createServer(app);

// Reload code here
reload(app).then(function (reloadReturned) {
  server.listen(app.get('port'), function () {
    console.log('Web server listening on port ' + app.get('port'))
  })
}).catch(function (err) {
  console.error('Reload could not start, could not start server/sample app', err);
});
