require('babel/register');
var express = require('express');
var cors = require('cors')
var graphql = require('graphql');
var expressGraphql = require('express-graphql');
var Schema = require('./server/schema.js').default;

var app = express();
var corsOptions = {
  origin: 'http://localhost:9000'
}

app.use(cors(corsOptions));
app.use('/graphql', expressGraphql({
  schema: Schema,
  graphiql: true
}));

app.listen(3000);
console.log('GraphQL started on port: 3000');	