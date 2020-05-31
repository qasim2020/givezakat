require('../config/config');

var OAuth = require('oauth')
// `npm install oauth` to satisfy
// website: https://github.com/ciaranj/node-oauth

var KEY = process.env.noun_public;
var SECRET = process.env.noun_secret;
console.log(process.env.noun_public);
var oauth = new OAuth.OAuth(
	'http://api.thenounproject.com',
	'http://api.thenounproject.com',
	KEY,
	SECRET,
	'1.0',
	null,
	'HMAC-SHA1'
)

function nounproject() {
    return new Promise(function(resolve, reject) {
      oauth.get(
      	'https://api.thenounproject.com/icons/recent_uploads',
      	null,
      	null,
      	function (e, data, res){
          console.log(typeof JSON.parse(data));
          data = JSON.parse(data).recent_uploads.map(val => {
            return val = [
              {small: val.term, class: "badge"},
							{img: val.preview_url, class: "d-block m-auto w-90"},
              {img: val.preview_url_84, class: "d-block m-auto w-90"},
							{img: val.preview_url_42, class: "d-block m-auto w-90"},
              {p: val.attribution},
              {a: val.attribution_preview_url},
              {small: val.generated_at}
            ]
          })
					data.more = {
						type: 'cards',
						info: [
							{h1: "The Neon Project"},
							{p: "Use the Noun Project Icon API to tell visual stories, create real-time infographics, build interactive games, or whatever crazy idea you have. With our API you can bring a growing collection of high quality symbols to anything you create. Innovators are using the Noun Project API to tell visual stories, educate children with autism, create real-time infographics, build interactive games, and personalize 3-D printed products. The possibilities are endless and we can't wait to see what you create!"},
							{a: 'https://thenounproject.com/', title: "Learn More"},
							{a: 'https://api.thenounproject.com/', title: "API Website"},
						]
					}
          resolve(data)
      		if (e) reject(e)
      	}
      )
    });
}


module.exports = {nounproject}
