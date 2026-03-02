const MongoStore = require('connect-mongo');
console.log('MongoStore type:', typeof MongoStore);
console.log('MongoStore keys:', Object.keys(MongoStore));
console.log('MongoStore.create type:', typeof MongoStore.create);
if (MongoStore.default) {
    console.log('MongoStore.default keys:', Object.keys(MongoStore.default));
    console.log('MongoStore.default.create type:', typeof MongoStore.default.create);
}
