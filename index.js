require('./config/config');

const express = require('express');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const _ = require('lodash');
const readXlsxFile = require('read-excel-file/node');

const {sheet} = require('./server/sheets.js');
const {mongoose} = require('./db/mongoose');
const {People} = require('./models/people');

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
// sheet('ramadan','read').then((msg) => {
//   res.render('home.hbs',{
//     data: msg[0].values,
//   });
// }).catch((e) => {
//   console.log(e);
// });

app.get('/',(req,res) => {
  console.log('home page opened.');
  readXlsxFile(__dirname+'/static/sample.xlsx').then((rows) => {
    res.render('home.hbs',{
      sampleRows: rows[0]
    });
  });
});

app.post('/data',(req,res) => {

  if (req.body) {
    return res.status(200).send('data recieved');
  }
  res.status(400).send('sorry no data recieved');

});

app.post('/excelData',(req,res) => {
  // console.log(req.body);
  var body = _.pick(req.body,['name','mob','salary','fMembers','story','address','sponsorName','sponsorMob','sponsorAccountTitle','sponsorAccountNo','sponsorAccountIBAN','package','packageCost','packageQty','orderDate','deliveryDate','pteInfo','nearestCSD','cardClass','addedBy']);
  _.each(req.body,(val,key)=> {
    console.log(val.Name);
  })
  if (req.body) {
    return res.status(200).send('data received');
  }
  res.status(400).send('no data receieved');
});

app.listen(port, () => {
  console.log(`listening on port ${port}...`);
});
