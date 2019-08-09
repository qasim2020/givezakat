const {Orders, mongoose} = require('../app');

let addOrdersfortest = () =>
Orders.find().deleteMany().then(ok => {
  return Orders.insertMany(
    [
      /* 1 */
      {
          "_id" : ObjectId("5d4570900f05ea34a707ff21"),
          "status" : "pending",
          "paidby" : "5cfba4ded3ab6d228d4f5689",
          "paidto" : "5d3c6402006cfdef999240c6",
          "amount" : "10000",
          "currency" : "pkr",
          "customer" : "cus_FYSNXlZbkZ5BVS",
          "receipt" : "https://pay.stripe.com/receipts/acct_1DPCQZJYQaNXTKzl/ch_1F3LSlJYQaNXTKzlYUv7Mr4q/rcpt_FYSN6FAaIQQOry39taWJgPx5J7QFOsL",
          "__v" : 0
      },

      /* 2 */
      {
          "_id" : ObjectId("5d4570900f05ea34a707ff22"),
          "status" : "inprogress",
          "paidby" : "5cfba4ded3ab6d228d4f5689",
          "paidto" : "5d3c6402006cfdef999240ca",
          "amount" : "60000",
          "currency" : "pkr",
          "customer" : "cus_FYSNXlZbkZ5BVS",
          "receipt" : "https://pay.stripe.com/receipts/acct_1DPCQZJYQaNXTKzl/ch_1F3LSlJYQaNXTKzlYUv7Mr4q/rcpt_FYSN6FAaIQQOry39taWJgPx5J7QFOsL",
          "__v" : 0
      },

      /* 3 */
      {
          "_id" : ObjectId("5d4575d8e75a693ac6a09851"),
          "status" : "pending",
          "paidby" : "5cfba4ded3ab6d228d4f5689",
          "paidto" : "5d3c6402006cfdef999240c5",
          "amount" : "6000",
          "currency" : "pkr",
          "customer" : "cus_FYSko3Jfy31W9A",
          "receipt" : "https://pay.stripe.com/receipts/acct_1DPCQZJYQaNXTKzl/ch_1F3LoZJYQaNXTKzlCpGKozY6/rcpt_FYSkIveG5niWmc8Y0OMLaFiBSxm0bKt",
          "__v" : 0
      },

      /* 4 */
      {
          "_id" : ObjectId("5d4575d8e75a693ac6a09852"),
          "status" : "pending",
          "paidby" : "5cfba4ded3ab6d228d4f5689",
          "paidto" : "5d3c6402006cfdef999240cc",
          "amount" : "2000",
          "currency" : "pkr",
          "customer" : "cus_FYSko3Jfy31W9A",
          "receipt" : "https://pay.stripe.com/receipts/acct_1DPCQZJYQaNXTKzl/ch_1F3LoZJYQaNXTKzlCpGKozY6/rcpt_FYSkIveG5niWmc8Y0OMLaFiBSxm0bKt",
          "__v" : 0
      },

      /* 5 */
      {
          "_id" : ObjectId("5d4575d8e75a693ac6a09853"),
          "status" : "delivered",
          "paidby" : "5cfba4ded3ab6d228d4f5689",
          "paidto" : "5d3c6402006cfdef999240cb",
          "amount" : "4000",
          "currency" : "pkr",
          "customer" : "cus_FYSko3Jfy31W9A",
          "receipt" : "https://pay.stripe.com/receipts/acct_1DPCQZJYQaNXTKzl/ch_1F3LoZJYQaNXTKzlCpGKozY6/rcpt_FYSkIveG5niWmc8Y0OMLaFiBSxm0bKt",
          "__v" : 0
      }
    ]
  )
});

module.exports = {addpeoplefortest};
