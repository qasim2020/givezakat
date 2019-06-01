const express = require('express');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const _ = require('lodash');

const {sheet} = require('./server/sheets.js');

var app = express();
var port = process.env.PORT || 3000;
app.use(express.static(__dirname+'/static'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine','hbs');

// sheet('construction','read');
// sheet('material','read');
// sheet('material','update',[
// [new Date().toString(),'MES','Sand','2000', 'cft','Brought it for const of Washroom']
// ]);

app.get('/',(req,res) => {
  console.log('home page opened');
  sheet('ramadan','read').then((msg) => {
    res.render('home.hbs',{
      data: msg[0].values,
    });
  }).catch((e) => {
    console.log(e);
  });

});

app.post('/data',(req,res) => {

  console.log(req.body);
  if (req.body) {
    return res.status(200).send('data recieved');
  }

  res.status(400).send('sorry no data recieved');

});

app.listen(port, () => {
  console.log(`listening on port ${port}...`);
})
