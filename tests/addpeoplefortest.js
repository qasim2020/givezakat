const {People, mongoose} = require('../app');

let addpeoplefortest = (user) =>
People.find().deleteMany().then(ok => {
  return People.insertMany(
    [/* 1 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bbe"),
      "mob" : "+923165109656",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Multan",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "3",
      "name" : "Foxtrot Heluy",
      "occupation" : "worker",
      "salary" : "29000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 2 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bbf"),
      "mob" : "+923435064796",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Rwp",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "10",
      "name" : "Sidrah Rasoo",
      "occupation" : "worker",
      "salary" : "24148",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 3 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc0"),
      "mob" : "+923069531940",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Rwp",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "13",
      "name" : "Koh e noor",
      "occupation" : "worker",
      "salary" : "27294",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 4 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc1"),
      "mob" : "+923434430577",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Rwp",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "3",
      "name" : "Cubic Metric",
      "occupation" : "worker",
      "salary" : "20541",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 5 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc2"),
      "mob" : "+923085175049",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Khn",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "5",
      "name" : "Nation wide",
      "occupation" : "worker",
      "salary" : "15000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 6 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc3"),
      "mob" : "+923357425771",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Gujranwala",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "7",
      "name" : "Hangry",
      "occupation" : "worker",
      "salary" : "21000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 7 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc4"),
      "mob" : "+923428447837",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Kohat",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "7",
      "name" : "Zulo Rasheed",
      "occupation" : "worker",
      "salary" : "21000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 8 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc5"),
      "mob" : "+923435581029",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Gujranwala",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "9",
      "name" : "Delta Hameed",
      "occupation" : "worker",
      "salary" : "17632",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 9 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc6"),
      "mob" : "+923438906889",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "DI Khan",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "8",
      "name" : "Neelum Pari",
      "occupation" : "worker",
      "salary" : "12000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 10 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc7"),
      "mob" : "+923425061979",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Rwp",
      "cardClass" : "pending",
      "currency" : "PKR",
      "fMembers" : "10",
      "name" : "John Smith",
      "occupation" : "worker",
      "salary" : "17632",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 11 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc8"),
      "mob" : "+923024684396",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Rwp",
      "cardClass" : "inprogress",
      "currency" : "PKR",
      "fMembers" : "13",
      "name" : "Hameed Saeed",
      "occupation" : "worker",
      "salary" : "12000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 12 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bc9"),
      "mob" : "+923128229982",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Bahawalpur",
      "cardClass" : "inprogress",
      "currency" : "PKR",
      "fMembers" : "10",
      "name" : "Cubic Seira",
      "occupation" : "worker",
      "salary" : "21000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 13 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bca"),
      "mob" : "+923454110552",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "Rwp",
      "cardClass" : "delivered",
      "currency" : "PKR",
      "fMembers" : "13",
      "name" : "Delta Lima",
      "occupation" : "worker",
      "salary" : "29000",
      "story" : "Financially broke and can barely bear his expenses"
  },

  /* 14 */
  {
      "_id" : mongoose.Types.ObjectId("5d477e1b006cfdef99932bcb"),
      "mob" : "+923446187687",
      "addedBy" : mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      "address" : "DI Khan",
      "cardClass" : "delivered",
      "currency" : "PKR",
      "fMembers" : "6",
      "name" : "Sidrah Rasoo",
      "occupation" : "worker",
      "salary" : "29000",
      "story" : "Financially broke and can barely bear his expenses"
  }
])
});

module.exports = {addpeoplefortest};
