const request = require('request');


function wiki(query) {
  return new Promise(function(resolve, reject) {
    query.term = query.term || 'meetings';
    request(`https://www.mediawiki.org/w/api.php?action=query&list=search&srsearch=${query.term}&format=json`, function (error, response, body) {
      if (error) return reject (error)
      console.log(body);
      data = JSON.parse(body).query.search.map(val => {
        return val = [
          {small: val.timestamp, class:"badge"},
          {h3: `<u>Title</u>: <br> ${val.title}`},
          {p: `<u>Page ID</u>: <br> ${val.pageid}`},
          {p: `<u>Word Count</u>: <br> ${val.wordcount}`},
          {p: `<u>Timestamp</u>: <br> ${val.timestamp}`},
          {p: `<u>Text Snippet</u>: <br> ${val.snippet}`},
        ]
      })
      data.more = {
        type: 'cards',
        info: [
          {h1: "The WikiMedia API"},
          {p: "You can build your own book shelves, timelines, history picks and tid bits like what happened 50 years today. It is a detailed api that lets you write search queries and much more."},
          {p: "Below data is fetched for a specific query; `meeting`"},
          {a: 'https://www.mediawiki.org/wiki/API:Main_page#Endpoint', title: "Learn More"},
          {a: 'https://www.mediawiki.org', title: "API Website"},
          {p: 'Write a query to get the results below'},
          {
            form: 'form',
            inputs: [
              {name: 'api', val: 'wiki', class: 'd-none' },
              {name: 'term', val: `${query.term}`, class: '', placeholder: 'Write a query' },
            ],
            button: 'submit',
            action: '/api'
          },
          {p: `Total hits are <b>${JSON.parse(body).query.searchinfo.totalhits}</b>`}
        ]
      };
      resolve(data)
    });
  });
}

module.exports = {wiki}
