const mongoose = require('mongoose');

const uri = "mongodb://poovarasan936161_db_user:R7quooui4gUn6fm4@ac-wuyemwq-shard-00-00.wwpyz6y.mongodb.net:27017,ac-wuyemwq-shard-00-01.wwpyz6y.mongodb.net:27017,ac-wuyemwq-shard-00-02.wwpyz6y.mongodb.net:27017/testdb?ssl=true&replicaSet=atlas-4rruef-shard-0&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, family: 4 })
.then(() => {
    console.log("FINAL SUCCESS: Connected with correct Replica Set!");
    process.exit(0);
})
.catch(err => {
    console.error("FINAL FAILURE:", err.message);
    process.exit(1);
});
